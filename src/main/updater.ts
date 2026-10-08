import { autoUpdater } from 'electron-updater';
import { BrowserWindow, ipcMain, app } from 'electron';

/** Rolling release tag on GitHub (see scripts/ci/publish-desktop-mac.sh and INSTALL.md). */
const DESKTOP_RELEASE_FEED_URL =
  process.env.FLEXHUBS_UPDATE_FEED_URL?.trim() ||
  'https://github.com/rutuja0711/flexhubs/releases/download/desktop-latest';

let mainWindow: BrowserWindow | null = null;

export type UpdaterCheckResult =
  | { ok: true; status: 'skipped'; currentVersion: string }
  | { ok: true; status: 'up-to-date'; data?: { version?: string } }
  | { ok: true; status: 'available'; data?: { version?: string; releaseNotes?: unknown } }
  | { ok: false; error: string };

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
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.allowDowngrade = false;
  autoUpdater.allowPrerelease = true;
  autoUpdater.disableDifferentialDownload = true;

  // Generic feed pinned to the rolling `desktop-latest` release (not "newest GitHub release by tag name").
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

  if (lower.includes('timed out') || lower.includes('timeout')) {
    return 'Update check timed out. Try again later.';
  }

  if (
    lower.includes('network') ||
    lower.includes('offline') ||
    lower.includes('enotfound') ||
    lower.includes('econnrefused')
  ) {
    return 'Could not reach the update server. Check your internet connection and try again.';
  }

  return 'Unable to check for updates right now. Please try again later.';
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
    sendToRenderer('updater:error', sanitizeUpdaterError(err.message));
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

function registerUpdaterIpcHandlers(): void {
  const register = <T extends unknown[]>(
    channel: string,
    handler: (...args: T) => unknown | Promise<unknown>,
  ) => {
    ipcMain.removeHandler(channel);
    ipcMain.handle(channel, handler as (...args: unknown[]) => unknown);
  };

  register('updater:check', async (): Promise<UpdaterCheckResult> => {
    const currentVersion = app.getVersion();

    if (!app.isPackaged) {
      return { ok: true, status: 'skipped', currentVersion };
    }

    try {
      attachAutoUpdaterListeners();
      sendToRenderer('updater:checking');

      const pendingOutcome = waitForUpdateCheckOutcome();
      await autoUpdater.checkForUpdates();
      const outcome = await pendingOutcome;

      if (outcome.kind === 'error') {
        const userMessage = sanitizeUpdaterError(outcome.message);
        sendToRenderer('updater:error', userMessage);
        return { ok: false, error: userMessage };
      }

      if (outcome.kind === 'available') {
        sendToRenderer('updater:update-available', {
          version: outcome.version,
          releaseNotes: outcome.releaseNotes,
        });
        return {
          ok: true,
          status: 'available',
          data: { version: outcome.version, releaseNotes: outcome.releaseNotes },
        };
      }

      sendToRenderer('updater:update-not-available', { version: outcome.version });
      return { ok: true, status: 'up-to-date', data: { version: outcome.version } };
    } catch (error: unknown) {
      const raw = error instanceof Error ? error.message : 'Update check failed.';
      const message = sanitizeUpdaterError(raw);
      sendToRenderer('updater:error', message);
      return { ok: false, error: message };
    }
  });

  register('updater:download', async () => {
    if (!app.isPackaged) {
      return { ok: false as const, error: 'Updates are only available in installed builds.' };
    }

    try {
      await autoUpdater.downloadUpdate();
      return { ok: true as const };
    } catch (error: unknown) {
      const raw = error instanceof Error ? error.message : 'Update download failed.';
      return { ok: false as const, error: sanitizeUpdaterError(raw) };
    }
  });

  register('updater:quit-and-install', () => {
    if (!app.isPackaged) {
      return;
    }

    // isForceRunAfter=true relaunches the app after the Mac zip is applied.
    autoUpdater.quitAndInstall(false, true);
  });

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
