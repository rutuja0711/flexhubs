import { autoUpdater } from 'electron-updater';
import { BrowserWindow, ipcMain, app, shell } from 'electron';

/** Rolling release tag on GitHub (see scripts/ci/publish-desktop-mac.sh and INSTALL.md). */
const DESKTOP_RELEASE_FEED_URL =
  process.env.FLEXHUBS_UPDATE_FEED_URL?.trim() ||
  'https://github.com/rutuja0711/flexhubs/releases/download/desktop-latest';

const DESKTOP_RELEASE_PAGE =
  process.env.FLEXHUBS_RELEASE_PAGE_URL?.trim() ||
  'https://github.com/rutuja0711/flexhubs/releases/tag/desktop-latest';

let mainWindow: BrowserWindow | null = null;

type UpdaterPhase = 'idle' | 'checking' | 'downloading';

let updaterPhase: UpdaterPhase = 'idle';

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

export type UpdaterDownloadResult = { ok: true; method: 'in-app' } | { ok: false; error: string };

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
  autoUpdater.disableDifferentialDownload = false;

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
    lower.includes('zip file not provided')
  ) {
    return 'This update could not be applied automatically. Use Manual download once, then try in-app updates again.';
  }

  if (lower.includes('timed out') || lower.includes('timeout')) {
    return 'Update check timed out. Try again later.';
  }

  if (
    lower.includes('operation not permitted') ||
    lower.includes('eperm') ||
    lower.includes('eacces')
  ) {
    return 'macOS blocked updating the app in Applications. Quit FlexHubs, use Manual download to reinstall, then try Restart & Install again.';
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
    const message = err.message || 'Update failed.';
    console.warn('[FlexHubs] Updater error:', message);
    sendToRenderer('updater:error', {
      error: sanitizeUpdaterError(message),
    });
  });

  autoUpdater.on('download-progress', (progressObj) => {
    sendToRenderer('updater:download-progress', {
      percent: progressObj.percent,
      transferred: progressObj.transferred,
      total: progressObj.total,
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
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
    const result = await autoUpdater.checkForUpdates();
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

async function downloadInAppUpdate(): Promise<UpdaterDownloadResult> {
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
      resolve(result);
    };

    const onDownloaded = () => {
      finish({ ok: true, method: 'in-app' });
    };

    const onError = (error: Error) => {
      finish({ ok: false, error: sanitizeUpdaterError(error.message || 'Update download failed.') });
    };

    const timeoutId = setTimeout(() => {
      finish({ ok: false, error: 'Update download timed out. Check your connection and try again.' });
    }, UPDATE_DOWNLOAD_TIMEOUT_MS);

    autoUpdater.once('update-downloaded', onDownloaded);
    autoUpdater.once('error', onError);

    void autoUpdater.downloadUpdate().catch((error: unknown) => {
      const raw = error instanceof Error ? error.message : 'Update download failed.';
      finish({ ok: false, error: sanitizeUpdaterError(raw) });
    });
  });
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

  if (updaterPhase === 'downloading') {
    const version = lastKnownAvailableVersion?.trim();
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

      console.info('[FlexHubs] Downloading in-app update patch (zip/NSIS via electron-updater)...');
      return await downloadInAppUpdate();
    } finally {
      updaterPhase = 'idle';
    }
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
      console.info('[FlexHubs] Quitting to install update', pending.version);
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
