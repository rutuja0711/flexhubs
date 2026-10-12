import { autoUpdater, CancellationToken } from 'electron-updater';
import { BrowserWindow, ipcMain, app, shell } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

/** Rolling release tag on GitHub (see scripts/ci/publish-desktop-mac.sh and INSTALL.md). */
const DESKTOP_RELEASE_FEED_URL =
  process.env.FLEXHUBS_UPDATE_FEED_URL?.trim() ||
  'https://github.com/rutuja0711/flexhubs/releases/download/desktop-latest';

const DESKTOP_RELEASE_PAGE =
  process.env.FLEXHUBS_RELEASE_PAGE_URL?.trim() ||
  'https://github.com/rutuja0711/flexhubs/releases/tag/desktop-latest';

let mainWindow: BrowserWindow | null = null;

type UpdaterPhase = 'idle' | 'checking' | 'downloading' | 'paused';

let updaterPhase: UpdaterPhase = 'idle';

let activeDownloadCancellation: CancellationToken | null = null;

let downloadPausedIntentionally = false;

let lastDownloadProgressPercent = 0;

let deferredInstallTimer: ReturnType<typeof setTimeout> | null = null;

const DEFERRED_INSTALL_MS = 15 * 60 * 1000;

type PersistedDownloadPause = {
  version: string;
  progress: number;
  pausedAt: string;
};

function pauseStateFilePath(): string {
  return path.join(app.getPath('userData'), 'update-download-pause.json');
}

function readPersistedDownloadPause(): PersistedDownloadPause | null {
  try {
    const raw = fs.readFileSync(pauseStateFilePath(), 'utf8');
    const parsed = JSON.parse(raw) as PersistedDownloadPause;
    if (!parsed?.version?.trim()) {
      return null;
    }
    return {
      version: parsed.version.trim(),
      progress: typeof parsed.progress === 'number' ? Math.max(0, Math.min(100, parsed.progress)) : 0,
      pausedAt: parsed.pausedAt ?? new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function writePersistedDownloadPause(state: PersistedDownloadPause | null): void {
  const filePath = pauseStateFilePath();

  try {
    if (!state) {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      return;
    }
    fs.writeFileSync(filePath, JSON.stringify(state), 'utf8');
  } catch {
    // Best-effort persistence for resume-after-restart.
  }
}

function clearDeferredInstallTimer(): void {
  if (deferredInstallTimer != null) {
    clearTimeout(deferredInstallTimer);
    deferredInstallTimer = null;
  }
}

function scheduleDeferredInstall(): void {
  clearDeferredInstallTimer();

  if (!pendingInstallState().ready) {
    return;
  }

  deferredInstallTimer = setTimeout(() => {
    deferredInstallTimer = null;
    try {
      console.info('[FlexHubs] Deferred restart to apply update');
      autoUpdater.quitAndInstall(false, true);
    } catch (error) {
      console.warn('[FlexHubs] Deferred install failed:', error);
    }
  }, DEFERRED_INSTALL_MS);
}

/** Last version reported by the feed (used when checks are skipped during download). */
let lastKnownAvailableVersion: string | undefined;

/** Set when the in-app patch finished downloading and is waiting for Restart & Install. */
let pendingInstallVersion: string | undefined;

export type UpdaterCheckResult =
  | { ok: true; status: 'skipped'; currentVersion: string }
  | { ok: true; status: 'up-to-date'; currentVersion: string; data?: { version?: string } }
  | {
      ok: true;
      status: 'ready';
      currentVersion: string;
      data?: { version?: string };
    }
  | {
      ok: true;
      status: 'available';
      currentVersion: string;
      data?: { version?: string; releaseNotes?: unknown };
    }
  | { ok: false; error: string; currentVersion: string };

export type UpdaterPendingInstall = {
  ready: boolean;
  version?: string;
};

export type UpdaterDownloadResult =
  | { ok: true; method: 'in-app' }
  | { ok: false; error: string; paused?: boolean };

export type UpdaterDownloadStatus = {
  phase: UpdaterPhase;
  progress: number;
  version?: string;
  paused: boolean;
};

export type UpdaterCapabilities = {
  /** In-app zip / NSIS patch updates only (never downloads or opens DMG/Setup installers). */
  inAppPatchOnly: true;
};

function sendToRenderer(channel: string, ...args: unknown[]): void {
  const win = mainWindow;
  if (!win || win.isDestroyed()) {
    return;
  }

  try {
    win.webContents.send(channel, ...args);
  } catch (error) {
    console.warn('[FlexHubs] Updater could not send to renderer:', channel, error);
  }
}

function parseVersionParts(version: string): number[] {
  return version
    .trim()
    .replace(/^v/i, '')
    .split('.')
    .map((part) => {
      const match = part.match(/^\d+/);
      return match ? Number(match[0]) : 0;
    });
}

function isVersionNewer(latest: string, current: string): boolean {
  const a = parseVersionParts(latest);
  const b = parseVersionParts(current);
  const length = Math.max(a.length, b.length);

  for (let index = 0; index < length; index += 1) {
    const left = a[index] ?? 0;
    const right = b[index] ?? 0;
    if (left > right) {
      return true;
    }
    if (left < right) {
      return false;
    }
  }

  return false;
}

function ensureAutoUpdaterConfigured(): void {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.autoRunAppAfterInstall = false;
  autoUpdater.allowDowngrade = false;
  autoUpdater.allowPrerelease = false;
  // Full zip only — differential patches often fail late in the download on macOS.
  autoUpdater.disableDifferentialDownload = true;

  autoUpdater.setFeedURL({
    provider: 'generic',
    url: DESKTOP_RELEASE_FEED_URL,
  });

  console.info('[FlexHubs] Update feed (in-app patch only):', DESKTOP_RELEASE_FEED_URL);
}

/** User-safe message; full details stay in main-process logs only. */
export function sanitizeUpdaterError(raw: string): string {
  const message = raw.trim();
  console.warn('[FlexHubs] Updater error:', message);

  const lower = message.toLowerCase();

  if (
    lower.includes('404') ||
    lower.includes('not found') ||
    lower.includes('channel_file_not_found') ||
    lower.includes('latest-mac.yml') ||
    lower.includes('latest.yml')
  ) {
    return 'No update is available yet. Check again later.';
  }

  if (lower.includes('sha512') || lower.includes('checksum') || lower.includes('hash')) {
    return 'The update failed verification. Try again, or use Manual download.';
  }

  if (
    lower.includes('code signature') ||
    lower.includes('codesign') ||
    lower.includes('not signed') ||
    lower.includes('signature invalid') ||
    lower.includes('squirrel') ||
    lower.includes('could not locate') ||
    lower.includes('zip file not provided') ||
    lower.includes('err_updater') ||
    lower.includes('blockmap')
  ) {
    return 'This update could not be applied automatically. Use Manual download to install the latest DMG once (same signed build as updates), then try again. You can also tap Retry to clear the cached download and redownload.';
  }

  if (lower.includes('timed out') || lower.includes('timeout')) {
    return 'Update check timed out. Try again later.';
  }

  if (
    lower.includes('operation not permitted') ||
    lower.includes('eperm') ||
    lower.includes('eacces')
  ) {
    return 'macOS blocked updating the app in Applications. Quit FlexHubs, use Manual download to reinstall, then try Restart again.';
  }

  if (
    lower.includes('network') ||
    lower.includes('offline') ||
    lower.includes('enotfound') ||
    lower.includes('econnrefused') ||
    lower.includes('enetunreach')
  ) {
    return 'Could not reach the update server. Check your internet connection and try again.';
  }

  if (message.length > 0 && message.length <= 280) {
    return message;
  }

  return 'Update failed. Try again later.';
}

function attachAutoUpdaterListeners(): void {
  if (autoUpdater.listenerCount('checking-for-update') > 0) {
    return;
  }

  ensureAutoUpdaterConfigured();

  autoUpdater.on('checking-for-update', () => {
    sendToRenderer('updater:checking');
  });

  autoUpdater.on('update-available', (info) => {
    const version = String(info.version || '').trim();
    const current = app.getVersion();

    if (!version || !isVersionNewer(version, current)) {
      lastKnownAvailableVersion = undefined;
      sendToRenderer('updater:update-not-available', {
        version: current,
      });
      return;
    }

    lastKnownAvailableVersion = version;
    sendToRenderer('updater:update-available', {
      version,
      releaseNotes: info.releaseNotes,
    });
  });

  autoUpdater.on('update-not-available', (info) => {
    lastKnownAvailableVersion = undefined;
    sendToRenderer('updater:update-not-available', {
      version: info.version ?? app.getVersion(),
    });
  });

  autoUpdater.on('error', (err) => {
    if (downloadPausedIntentionally) {
      return;
    }

    const message = err.message || 'Update failed.';
    console.warn('[FlexHubs] Updater error:', message);
    sendToRenderer('updater:error', {
      error: sanitizeUpdaterError(message),
    });
  });

  autoUpdater.on('download-progress', (progressObj) => {
    lastDownloadProgressPercent = Math.floor(progressObj.percent || 0);
    sendToRenderer('updater:download-progress', {
      percent: progressObj.percent,
      transferred: progressObj.transferred,
      total: progressObj.total,
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    writePersistedDownloadPause(null);
    downloadPausedIntentionally = false;
    updaterPhase = 'idle';
    activeDownloadCancellation = null;

    if (info.version) {
      pendingInstallVersion = info.version;
      lastKnownAvailableVersion = info.version;
    }

    sendToRenderer('updater:update-downloaded', {
      version: info.version,
      method: 'in-app',
    });
  });
}

function pendingInstallState(): UpdaterPendingInstall {
  const version = pendingInstallVersion?.trim();

  if (!version || !isVersionNewer(version, app.getVersion())) {
    pendingInstallVersion = undefined;
    return { ready: false };
  }

  return { ready: true, version };
}

type FeedCheckOutcome =
  | { kind: 'available'; version: string; releaseNotes?: unknown }
  | { kind: 'up-to-date'; version?: string }
  | { kind: 'error'; message: string };

async function checkFeedForUpdate(): Promise<FeedCheckOutcome> {
  attachAutoUpdaterListeners();

  try {
    const result = await Promise.race([
      autoUpdater.checkForUpdates(),
      new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error('Update check timed out. Try again later.'));
        }, UPDATE_CHECK_TIMEOUT_MS);
      }),
    ]);
    if (!result) {
      return { kind: 'up-to-date', version: app.getVersion() };
    }

    const version = String(result.updateInfo.version || '').trim();
    if (!version) {
      return { kind: 'error', message: 'Update feed returned an invalid version.' };
    }

    lastKnownAvailableVersion = version;

    if (isVersionNewer(version, app.getVersion())) {
      return {
        kind: 'available',
        version,
        releaseNotes: result.updateInfo.releaseNotes,
      };
    }

    lastKnownAvailableVersion = undefined;
    return { kind: 'up-to-date', version: app.getVersion() };
  } catch (error: unknown) {
    const raw = error instanceof Error ? error.message : 'Update check failed.';
    return { kind: 'error', message: sanitizeUpdaterError(raw) };
  }
}

const UPDATE_DOWNLOAD_TIMEOUT_MS = 25 * 60_000;
const UPDATE_CHECK_TIMEOUT_MS = 45_000;

async function downloadInAppUpdate(): Promise<UpdaterDownloadResult> {
  downloadPausedIntentionally = false;
  const cancellationToken = new CancellationToken();
  activeDownloadCancellation = cancellationToken;

  return new Promise((resolve) => {
    let settled = false;

    const finish = (result: UpdaterDownloadResult) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeoutId);
      autoUpdater.removeListener('update-downloaded', onDownloaded);
      autoUpdater.removeListener('error', onError);

      if (!result.ok && result.paused) {
        activeDownloadCancellation = null;
        updaterPhase = 'paused';
      } else if (result.ok) {
        activeDownloadCancellation = null;
        updaterPhase = 'idle';
      }

      resolve(result);
    };

    const onDownloaded = () => {
      finish({ ok: true, method: 'in-app' });
    };

    const onError = (error: Error) => {
      const message = error.message || 'Update download failed.';

      if (downloadPausedIntentionally || cancellationToken.cancelled) {
        const version = lastKnownAvailableVersion?.trim() ?? app.getVersion();
        writePersistedDownloadPause({
          version,
          progress: lastDownloadProgressPercent,
          pausedAt: new Date().toISOString(),
        });
        sendToRenderer('updater:download-paused', {
          version,
          progress: lastDownloadProgressPercent,
        });
        finish({ ok: false, error: '', paused: true });
        return;
      }

      finish({ ok: false, error: sanitizeUpdaterError(message) });
    };

    const timeoutId = setTimeout(() => {
      if (!downloadPausedIntentionally) {
        finish({ ok: false, error: 'Update download timed out. Check your connection and try again.' });
      }
    }, UPDATE_DOWNLOAD_TIMEOUT_MS);

    autoUpdater.once('update-downloaded', onDownloaded);
    autoUpdater.once('error', onError);

    void autoUpdater.downloadUpdate(cancellationToken).catch((error: unknown) => {
      const raw = error instanceof Error ? error.message : 'Update download failed.';

      if (downloadPausedIntentionally || cancellationToken.cancelled) {
        onError(error instanceof Error ? error : new Error(raw));
        return;
      }

      finish({ ok: false, error: sanitizeUpdaterError(raw) });
    });
  });
}

function downloadStatus(): UpdaterDownloadStatus {
  const persisted = readPersistedDownloadPause();
  const version = lastKnownAvailableVersion?.trim() ?? persisted?.version;

  if (updaterPhase === 'downloading') {
    return {
      phase: 'downloading',
      progress: lastDownloadProgressPercent,
      version,
      paused: false,
    };
  }

  if (updaterPhase === 'paused' || persisted) {
    return {
      phase: 'paused',
      progress: persisted?.progress ?? lastDownloadProgressPercent,
      version: persisted?.version ?? version,
      paused: true,
    };
  }

  return {
    phase: updaterPhase,
    progress: lastDownloadProgressPercent,
    version,
    paused: false,
  };
}

function clearUpdaterDownloadCache(): void {
  const cacheRoots = [
    app.getPath('localCache'),
    app.getPath('userData'),
    path.join(app.getPath('temp'), app.getName()),
  ];
  const dirNames = [
    'flexhubs-desktop-updater',
    `${app.getName()}-updater`,
    'flexhubs-desktop-updater-updater',
  ];

  for (const root of cacheRoots) {
    for (const dirName of dirNames) {
      const target = path.join(root, dirName);

      try {
        if (fs.existsSync(target)) {
          fs.rmSync(target, { recursive: true, force: true });
          console.info('[FlexHubs] Cleared updater cache:', target);
        }
      } catch (error) {
        console.warn('[FlexHubs] Could not clear updater cache:', target, error);
      }
    }
  }
}

async function resetDownloadState(): Promise<{ ok: true }> {
  if (updaterPhase === 'downloading' && activeDownloadCancellation) {
    downloadPausedIntentionally = true;
    activeDownloadCancellation.cancel();
  }

  updaterPhase = 'idle';
  activeDownloadCancellation = null;
  downloadPausedIntentionally = false;
  lastDownloadProgressPercent = 0;
  pendingInstallVersion = undefined;
  writePersistedDownloadPause(null);
  clearUpdaterDownloadCache();
  clearDeferredInstallTimer();

  return { ok: true };
}

async function pauseActiveDownload(): Promise<{ ok: true } | { ok: false; error: string }> {
  if (updaterPhase !== 'downloading' || !activeDownloadCancellation) {
    return { ok: false, error: 'No update download is in progress.' };
  }

  downloadPausedIntentionally = true;
  activeDownloadCancellation.cancel();
  return { ok: true };
}

async function resumePausedDownload(): Promise<UpdaterDownloadResult> {
  if (!app.isPackaged) {
    return { ok: false, error: 'Updates are only available in installed builds.' };
  }

  const alreadyDownloaded = pendingInstallState();
  if (alreadyDownloaded.ready) {
    return { ok: true, method: 'in-app' };
  }

  if (updaterPhase === 'downloading') {
    return { ok: false, error: 'A download is already in progress.' };
  }

  attachAutoUpdaterListeners();
  updaterPhase = 'downloading';
  downloadPausedIntentionally = false;

  const persisted = readPersistedDownloadPause();
  if (persisted?.version) {
    lastKnownAvailableVersion = persisted.version;
    lastDownloadProgressPercent = persisted.progress;
  }

  try {
    if (!lastKnownAvailableVersion || !isVersionNewer(lastKnownAvailableVersion, app.getVersion())) {
      const checked = await checkFeedForUpdate();
      if (checked.kind === 'error') {
        return { ok: false, error: checked.message };
      }
      if (checked.kind !== 'available') {
        return { ok: false, error: 'No update is available to download right now.' };
      }
    }

    console.info('[FlexHubs] Resuming in-app update download...');
    return await downloadInAppUpdate();
  } finally {
    if (updaterPhase === 'downloading') {
      updaterPhase = 'idle';
    }
  }
}

let updateCheckInFlight: Promise<UpdaterCheckResult> | null = null;

async function runUpdateCheckInternal(): Promise<UpdaterCheckResult> {
  const currentVersion = app.getVersion();

  if (!app.isPackaged) {
    return { ok: true, status: 'skipped', currentVersion };
  }

  const pending = pendingInstallState();

  if (pending.ready && pending.version) {
    return {
      ok: true,
      status: 'ready',
      currentVersion,
      data: { version: pending.version },
    };
  }

  if (updaterPhase === 'downloading' || updaterPhase === 'paused' || readPersistedDownloadPause()) {
    const version = lastKnownAvailableVersion?.trim() ?? readPersistedDownloadPause()?.version;
    const hasNewerDownload =
      version && isVersionNewer(version, currentVersion);

    return {
      ok: true,
      status: hasNewerDownload ? 'available' : 'up-to-date',
      currentVersion,
      data: { version: hasNewerDownload ? version : currentVersion },
    };
  }

  updaterPhase = 'checking';

  try {
    const outcome = await checkFeedForUpdate();

    if (outcome.kind === 'error') {
      return { ok: false, error: outcome.message, currentVersion };
    }

    if (outcome.kind === 'available') {
      return {
        ok: true,
        status: 'available',
        currentVersion,
        data: { version: outcome.version, releaseNotes: outcome.releaseNotes },
      };
    }

    lastKnownAvailableVersion = undefined;

    return {
      ok: true,
      status: 'up-to-date',
      currentVersion,
      data: { version: outcome.version ?? currentVersion },
    };
  } finally {
    updaterPhase = 'idle';
  }
}

function runUpdateCheck(): Promise<UpdaterCheckResult> {
  if (updateCheckInFlight) {
    return updateCheckInFlight;
  }

  updateCheckInFlight = runUpdateCheckInternal().finally(() => {
    updateCheckInFlight = null;
  });

  return updateCheckInFlight;
}

function registerUpdaterIpcHandlers(): void {
  const register = <T extends unknown[]>(
    channel: string,
    handler: (...args: T) => unknown | Promise<unknown>,
  ) => {
    ipcMain.removeHandler(channel);
    ipcMain.handle(channel, handler as (...args: unknown[]) => unknown);
  };

  register('updater:check', () => runUpdateCheck());

  register('updater:download', async (): Promise<UpdaterDownloadResult> => {
    if (!app.isPackaged) {
      return { ok: false, error: 'Updates are only available in installed builds.' };
    }

    const alreadyDownloaded = pendingInstallState();

    if (alreadyDownloaded.ready) {
      return { ok: true, method: 'in-app' };
    }

    if (updaterPhase === 'downloading') {
      return { ok: false, error: 'A download is already in progress.' };
    }

    attachAutoUpdaterListeners();
    updaterPhase = 'downloading';

    try {
      const checked = await checkFeedForUpdate();

      if (checked.kind === 'error') {
        return { ok: false, error: checked.message };
      }

      if (checked.kind !== 'available') {
        return { ok: false, error: 'No update is available to download right now.' };
      }

      writePersistedDownloadPause(null);
      console.info('[FlexHubs] Downloading in-app update patch (zip/NSIS via electron-updater)...');
      const result = await downloadInAppUpdate();
      if (!result.ok && result.paused) {
        return result;
      }
      return result;
    } finally {
      if (updaterPhase !== 'paused') {
        updaterPhase = 'idle';
      }
    }
  });

  register('updater:pause-download', () => pauseActiveDownload());

  register('updater:resume-download', () => resumePausedDownload());

  register('updater:reset-download-state', () => resetDownloadState());

  register('updater:get-download-status', (): UpdaterDownloadStatus => downloadStatus());

  register('updater:schedule-deferred-restart', (): { ok: true; delayMs: number } => {
    scheduleDeferredInstall();
    return { ok: true, delayMs: DEFERRED_INSTALL_MS };
  });

  register('updater:cancel-deferred-restart', (): { ok: true } => {
    clearDeferredInstallTimer();
    return { ok: true };
  });

  register('updater:quit-and-install', (): { ok: true } | { ok: false; error: string } => {
    if (!app.isPackaged) {
      return { ok: false, error: 'Updates are only available in installed builds.' };
    }

    const pending = pendingInstallState();

    if (!pending.ready) {
      return {
        ok: false,
        error: 'No downloaded update is ready to install. Download the update again first.',
      };
    }

    try {
      clearDeferredInstallTimer();
      console.info('[FlexHubs] Quitting to apply update', pending.version);
      setImmediate(() => {
        autoUpdater.quitAndInstall(false, true);
      });
      return { ok: true };
    } catch (error: unknown) {
      const raw = error instanceof Error ? error.message : 'Could not start install.';
      return { ok: false, error: sanitizeUpdaterError(raw) };
    }
  });

  register('updater:get-pending-install', (): UpdaterPendingInstall => pendingInstallState());

  register('updater:open-release-page', () => {
    void shell.openExternal(DESKTOP_RELEASE_PAGE);
    return { ok: true as const };
  });

  register('updater:get-capabilities', (): UpdaterCapabilities => ({
    inAppPatchOnly: true,
  }));

  register('updater:get-version', () => app.getVersion());
}

/** Call once during app startup (safe to call again after dev HMR). */
export function initUpdater(): void {
  attachAutoUpdaterListeners();
  registerUpdaterIpcHandlers();

  const persisted = readPersistedDownloadPause();
  if (persisted && !pendingInstallState().ready) {
    updaterPhase = 'paused';
    lastKnownAvailableVersion = persisted.version;
    lastDownloadProgressPercent = persisted.progress;
  }
}

/** Point the updater at the current main window (call from createWindow). */
export function setUpdaterMainWindow(window: BrowserWindow | null): void {
  mainWindow = window;
}

/** @deprecated Use initUpdater() once and setUpdaterMainWindow() per window. */
export function setupUpdater(window: BrowserWindow): void {
  initUpdater();
  setUpdaterMainWindow(window);
}
