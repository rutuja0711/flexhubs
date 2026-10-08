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

export type UpdaterCheckResult =
  | { ok: true; status: 'skipped'; currentVersion: string }
  | { ok: true; status: 'up-to-date'; currentVersion: string; data?: { version?: string } }
  | {
      ok: true;
      status: 'available';
      currentVersion: string;
      data?: { version?: string; releaseNotes?: unknown };
    }
  | { ok: false; error: string; currentVersion: string };

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

function ensureAutoUpdaterConfigured(): void {
  autoUpdater.autoDownload = false;
  // Defer Squirrel until quitAndInstall — if Squirrel runs during downloadUpdate() and fails
  // (common with unsigned or Gatekeeper issues), the UI shows "Update failed" even after the zip downloaded.
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.autoRunAppAfterInstall = false;
  autoUpdater.allowDowngrade = false;
  autoUpdater.allowPrerelease = false;
  autoUpdater.disableDifferentialDownload = true;

  autoUpdater.setFeedURL({
    provider: 'generic',
    url: DESKTOP_RELEASE_FEED_URL,
  });

  console.info('[FlexHubs] Update feed:', DESKTOP_RELEASE_FEED_URL);
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
    return 'No update feed is available yet. Check again after the next desktop release is published on GitHub.';
  }

  if (lower.includes('sha512') || lower.includes('checksum') || lower.includes('hash')) {
    return 'The update file failed verification. Install manually from the desktop-latest release (DMG on Mac, Setup.exe on Windows).';
  }

  if (
    lower.includes('code signature') ||
    lower.includes('codesign') ||
    lower.includes('signed') ||
    lower.includes('squirrel') ||
    lower.includes('could not locate') ||
    lower.includes('zip file not provided')
  ) {
    return 'This build could not apply the in-app update automatically. Download FlexHubs-Desktop.dmg (Mac) or FlexHubs-Desktop-Setup.exe (Windows) from the desktop-latest GitHub release and install over the existing app.';
  }

  if (lower.includes('timed out') || lower.includes('timeout')) {
    return 'Update check timed out. Try again later.';
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

  return 'Update failed. Try again, or install manually from the desktop-latest release on GitHub.';
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
    if (info.version) {
      lastKnownAvailableVersion = info.version;
    }
    sendToRenderer('updater:update-available', {
      version: info.version,
      releaseNotes: info.releaseNotes,
    });
  });

  autoUpdater.on('update-not-available', (info) => {
    sendToRenderer('updater:update-not-available', {
      version: info.version,
    });
  });

  autoUpdater.on('error', (err) => {
    const userMessage = sanitizeUpdaterError(err.message);
    if (updaterPhase === 'idle') {
      console.warn('[FlexHubs] Ignoring background updater error:', err.message);
      return;
    }
    sendToRenderer('updater:error', { message: userMessage });
  });

  autoUpdater.on('download-progress', (progressObj) => {
    sendToRenderer('updater:download-progress', {
      percent: progressObj.percent,
      transferred: progressObj.transferred,
      total: progressObj.total,
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    sendToRenderer('updater:update-downloaded', {
      version: info.version,
    });
  });
}

const UPDATE_CHECK_TIMEOUT_MS = 45_000;
const UPDATE_DOWNLOAD_TIMEOUT_MS = 20 * 60_000;

function waitForUpdateCheckOutcome(): Promise<
  | { kind: 'available'; version: string; releaseNotes?: unknown }
  | { kind: 'up-to-date'; version?: string }
  | { kind: 'error'; message: string }
> {
  return new Promise((resolve) => {
    let settled = false;

    const finish = (
      outcome:
        | { kind: 'available'; version: string; releaseNotes?: unknown }
        | { kind: 'up-to-date'; version?: string }
        | { kind: 'error'; message: string },
    ) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeoutId);
      autoUpdater.removeListener('update-available', onAvailable);
      autoUpdater.removeListener('update-not-available', onNotAvailable);
      autoUpdater.removeListener('error', onError);
      resolve(outcome);
    };

    const onAvailable = (info: { version: string; releaseNotes?: unknown }) => {
      finish({ kind: 'available', version: info.version, releaseNotes: info.releaseNotes });
    };

    const onNotAvailable = (info: { version: string }) => {
      finish({ kind: 'up-to-date', version: info.version });
    };

    const onError = (error: Error) => {
      finish({
        kind: 'error',
        message: sanitizeUpdaterError(error.message || 'Update check failed.'),
      });
    };

    const timeoutId = setTimeout(() => {
      finish({ kind: 'error', message: 'Update check timed out. Try again later.' });
    }, UPDATE_CHECK_TIMEOUT_MS);

    autoUpdater.once('update-available', onAvailable);
    autoUpdater.once('update-not-available', onNotAvailable);
    autoUpdater.once('error', onError);
  });
}

function waitForUpdateDownloaded(): Promise<{ ok: true } | { ok: false; message: string }> {
  return new Promise((resolve) => {
    let settled = false;

    const finish = (result: { ok: true } | { ok: false; message: string }) => {
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
      finish({ ok: true });
    };

    const onError = (error: Error) => {
      finish({ ok: false, message: sanitizeUpdaterError(error.message || 'Update download failed.') });
    };

    const timeoutId = setTimeout(() => {
      finish({ ok: false, message: 'Update download timed out. Check your connection and try again.' });
    }, UPDATE_DOWNLOAD_TIMEOUT_MS);

    autoUpdater.once('update-downloaded', onDownloaded);
    autoUpdater.once('error', onError);
  });
}

async function runUpdateCheck(): Promise<UpdaterCheckResult> {
  const currentVersion = app.getVersion();

  if (!app.isPackaged) {
    return { ok: true, status: 'skipped', currentVersion };
  }

  if (updaterPhase === 'downloading') {
    return {
      ok: true,
      status: 'available',
      currentVersion,
      data: { version: lastKnownAvailableVersion ?? currentVersion },
    };
  }

  if (updaterPhase === 'checking') {
    return {
      ok: true,
      status: lastKnownAvailableVersion ? 'available' : 'up-to-date',
      currentVersion,
      data: { version: lastKnownAvailableVersion ?? currentVersion },
    };
  }

  attachAutoUpdaterListeners();
  updaterPhase = 'checking';

  try {
    const pendingOutcome = waitForUpdateCheckOutcome();
    await autoUpdater.checkForUpdates();
    const outcome = await pendingOutcome;

    if (outcome.kind === 'error') {
      return { ok: false, error: outcome.message, currentVersion };
    }

    if (outcome.kind === 'available') {
      lastKnownAvailableVersion = outcome.version;
      return {
        ok: true,
        status: 'available',
        currentVersion,
        data: { version: outcome.version, releaseNotes: outcome.releaseNotes },
      };
    }

    return {
      ok: true,
      status: 'up-to-date',
      currentVersion,
      data: { version: outcome.version },
    };
  } catch (error: unknown) {
    const raw = error instanceof Error ? error.message : 'Update check failed.';
    return { ok: false, error: sanitizeUpdaterError(raw), currentVersion };
  } finally {
    updaterPhase = 'idle';
  }
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

  register('updater:download', async () => {
    if (!app.isPackaged) {
      return { ok: false as const, error: 'Updates are only available in installed builds.' };
    }

    if (updaterPhase === 'downloading') {
      return { ok: false as const, error: 'A download is already in progress.' };
    }

    attachAutoUpdaterConfiguredOnly();
    attachAutoUpdaterListeners();
    updaterPhase = 'downloading';

    try {
      const checkOutcome = waitForUpdateCheckOutcome();
      await autoUpdater.checkForUpdates();
      const checked = await checkOutcome;

      if (checked.kind === 'error') {
        return { ok: false as const, error: checked.message };
      }

      if (checked.kind !== 'available') {
        return { ok: false as const, error: 'No update is available to download right now.' };
      }

      const pendingDownload = waitForUpdateDownloaded();
      await autoUpdater.downloadUpdate();
      const downloaded = await pendingDownload;

      if (!downloaded.ok) {
        return { ok: false as const, error: downloaded.message };
      }

      return { ok: true as const };
    } catch (error: unknown) {
      const raw = error instanceof Error ? error.message : 'Update download failed.';
      return { ok: false as const, error: sanitizeUpdaterError(raw) };
    } finally {
      updaterPhase = 'idle';
    }
  });

  register('updater:quit-and-install', () => {
    if (!app.isPackaged) {
      return;
    }

    autoUpdater.quitAndInstall(false, true);
  });

  register('updater:open-release-page', () => {
    void shell.openExternal(DESKTOP_RELEASE_PAGE);
    return { ok: true as const };
  });

  register('updater:get-version', () => app.getVersion());
}

function attachAutoUpdaterConfiguredOnly(): void {
  ensureAutoUpdaterConfigured();
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
