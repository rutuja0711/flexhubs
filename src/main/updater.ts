import { autoUpdater } from 'electron-updater';
import { BrowserWindow, ipcMain, app, shell } from 'electron';
import { downloadReleaseAsset, revealInstaller } from './desktopReleaseDownload';

/** Rolling release tag on GitHub (see scripts/ci/publish-desktop-mac.sh and INSTALL.md). */
const DESKTOP_RELEASE_FEED_URL =
  process.env.FLEXHUBS_UPDATE_FEED_URL?.trim() ||
  'https://github.com/rutuja0711/flexhubs/releases/download/desktop-latest';

const DESKTOP_RELEASE_PAGE =
  process.env.FLEXHUBS_RELEASE_PAGE_URL?.trim() ||
  'https://github.com/rutuja0711/flexhubs/releases/tag/desktop-latest';

const MAC_DMG_FILE_NAME = 'FlexHubs-Desktop.dmg';
const WIN_SETUP_FILE_NAME = 'FlexHubs-Desktop-Setup.exe';

let mainWindow: BrowserWindow | null = null;

type UpdaterPhase = 'idle' | 'checking' | 'downloading';

let updaterPhase: UpdaterPhase = 'idle';

/** Last version reported by the feed (used when checks are skipped during download). */
let lastKnownAvailableVersion: string | undefined;

let lastDownloadedInstallerPath: string | undefined;

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

export type UpdaterDownloadResult =
  | { ok: true; method: 'in-app' }
  | { ok: true; method: 'installer'; installerPath: string }
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
    return 'The update file failed verification. Use Download installer to get the DMG (Mac) or Setup.exe (Windows) from desktop-latest.';
  }

  if (
    lower.includes('code signature') ||
    lower.includes('codesign') ||
    lower.includes('signed') ||
    lower.includes('squirrel') ||
    lower.includes('could not locate') ||
    lower.includes('zip file not provided')
  ) {
    return 'In-app zip update is not available for this build. Use Download installer instead.';
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

  return 'Update failed. Try Download installer, or install from the desktop-latest release on GitHub.';
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

  // Mac Squirrel emits many benign errors; IPC handlers report real failures.
  autoUpdater.on('error', (err) => {
    console.warn('[FlexHubs] Updater (logged only):', err.message);
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

    return { kind: 'up-to-date', version };
  } catch (error: unknown) {
    const raw = error instanceof Error ? error.message : 'Update check failed.';
    return { kind: 'error', message: sanitizeUpdaterError(raw) };
  }
}

async function downloadMacDmg(version: string): Promise<UpdaterDownloadResult> {
  const downloaded = await downloadReleaseAsset({
    feedBaseUrl: DESKTOP_RELEASE_FEED_URL,
    fileName: MAC_DMG_FILE_NAME,
    versionLabel: version,
    onProgress: (progress) => {
      sendToRenderer('updater:download-progress', progress);
    },
  });

  if (!downloaded.ok) {
    return { ok: false, error: sanitizeUpdaterError(downloaded.error) };
  }

  lastDownloadedInstallerPath = downloaded.filePath;
  sendToRenderer('updater:update-downloaded', { version, method: 'installer' });
  void revealInstaller(downloaded.filePath);
  return { ok: true, method: 'installer', installerPath: downloaded.filePath };
}

async function downloadWindowsSetup(version: string): Promise<UpdaterDownloadResult> {
  const downloaded = await downloadReleaseAsset({
    feedBaseUrl: DESKTOP_RELEASE_FEED_URL,
    fileName: WIN_SETUP_FILE_NAME,
    versionLabel: version,
    onProgress: (progress) => {
      sendToRenderer('updater:download-progress', progress);
    },
  });

  if (!downloaded.ok) {
    return { ok: false, error: sanitizeUpdaterError(downloaded.error) };
  }

  lastDownloadedInstallerPath = downloaded.filePath;
  sendToRenderer('updater:update-downloaded', { version, method: 'installer' });
  void revealInstaller(downloaded.filePath);
  return { ok: true, method: 'installer', installerPath: downloaded.filePath };
}

async function downloadViaElectronUpdater(): Promise<UpdaterDownloadResult> {
  try {
    await autoUpdater.downloadUpdate();
    return { ok: true, method: 'in-app' };
  } catch (error: unknown) {
    const raw = error instanceof Error ? error.message : 'Update download failed.';
    return { ok: false, error: sanitizeUpdaterError(raw) };
  }
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

    return {
      ok: true,
      status: 'up-to-date',
      currentVersion,
      data: { version: outcome.version },
    };
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

  register('updater:download', async (): Promise<UpdaterDownloadResult> => {
    if (!app.isPackaged) {
      return { ok: false, error: 'Updates are only available in installed builds.' };
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

      if (process.platform === 'darwin') {
        return downloadMacDmg(checked.version);
      }

      if (process.platform === 'win32') {
        const setupResult = await downloadWindowsSetup(checked.version);
        if (setupResult.ok) {
          return setupResult;
        }

        const inApp = await downloadViaElectronUpdater();
        return inApp;
      }

      return downloadViaElectronUpdater();
    } finally {
      updaterPhase = 'idle';
    }
  });

  register('updater:quit-and-install', () => {
    if (!app.isPackaged) {
      return;
    }

    if (lastDownloadedInstallerPath) {
      void revealInstaller(lastDownloadedInstallerPath);
      return;
    }

    autoUpdater.quitAndInstall(false, true);
  });

  register('updater:open-release-page', () => {
    void shell.openExternal(DESKTOP_RELEASE_PAGE);
    return { ok: true as const };
  });

  register('updater:open-downloaded-installer', async () => {
    if (!lastDownloadedInstallerPath) {
      return { ok: false as const, error: 'No installer has been downloaded yet.' };
    }

    await revealInstaller(lastDownloadedInstallerPath);
    return { ok: true as const };
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
