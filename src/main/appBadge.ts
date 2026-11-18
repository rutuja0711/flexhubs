import { app, BrowserWindow, nativeImage } from 'electron';

export type AppBadgeUpdate = {
  count: number;
  mentionUnread: number;
};

let badgeHostWindow: BrowserWindow | null = null;
let lastBadgeUpdate: AppBadgeUpdate = { count: 0, mentionUnread: 0 };

export function setBadgeHostWindow(window: BrowserWindow | null): void {
  badgeHostWindow = window;

  if (window && !window.isDestroyed()) {
    applyBadgeToPlatform(resolveBadgeHostWindow(window), lastBadgeUpdate);
  }
}

function resolveBadgeHostWindow(preferred: BrowserWindow | null): BrowserWindow | null {
  if (preferred && !preferred.isDestroyed()) {
    return preferred;
  }

  if (badgeHostWindow && !badgeHostWindow.isDestroyed()) {
    return badgeHostWindow;
  }

  return BrowserWindow.getAllWindows().find((entry) => !entry.isDestroyed()) ?? null;
}

function formatBadgeLabel(count: number, mentionUnread: number): string {
  if (count <= 0) {
    return '';
  }

  if (mentionUnread > 0 && mentionUnread >= count) {
    return '@';
  }

  if (count > 99) {
    return '99+';
  }

  return String(count);
}

function createWindowsOverlayImage(count: number, mentionUnread: number): Electron.NativeImage {
  const label = formatBadgeLabel(count, mentionUnread);
  const display = label === '@' ? '@' : label;
  const fontSize = display.length > 2 ? 18 : display.length > 1 ? 20 : 22;
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
  <circle cx="16" cy="16" r="15" fill="#e81123"/>
  <text x="16" y="17" text-anchor="middle" dominant-baseline="central"
    fill="#ffffff" font-family="Segoe UI, Arial, sans-serif" font-size="${fontSize}" font-weight="700">${display}</text>
</svg>`;

  const image = nativeImage.createFromDataURL(
    `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.trim())}`,
  );

  if (image.isEmpty()) {
    console.warn('[FlexHubs] Windows badge overlay SVG could not be loaded.');
    return image;
  }

  // 32×32 source scales more clearly on 125–200% Windows display scaling (OS shows ~16×16).
  return image.resize({ width: 32, height: 32, quality: 'best' });
}

function applyBadgeToPlatform(mainWindow: BrowserWindow | null, update: AppBadgeUpdate): void {
  const count = Math.max(0, Math.floor(update.count));
  const mentionUnread = Math.max(0, Math.floor(update.mentionUnread));

  if (process.platform === 'darwin') {
    if (!app.dock) {
      return;
    }

    if (count <= 0) {
      app.dock.setBadge('');
    } else {
      app.dock.setBadge(formatBadgeLabel(count, mentionUnread));
    }
    return;
  }

  if (process.platform !== 'win32') {
    return;
  }

  const windowForOverlay = resolveBadgeHostWindow(mainWindow);

  if (!windowForOverlay) {
    return;
  }

  if (count <= 0) {
    windowForOverlay.setOverlayIcon(null, '');
    return;
  }

  const overlay = createWindowsOverlayImage(count, mentionUnread);
  if (overlay.isEmpty()) {
    console.warn('[FlexHubs] Windows taskbar badge skipped — overlay image is empty.');
    return;
  }

  try {
    windowForOverlay.setOverlayIcon(
      overlay,
      `${count} unread notification${count === 1 ? '' : 's'}`,
    );
  } catch (error) {
    console.warn('[FlexHubs] setOverlayIcon failed:', error);
    return;
  }

  if (!windowForOverlay.isFocused()) {
    windowForOverlay.flashFrame(true);
  }
}

export function updateApplicationBadge(
  mainWindow: BrowserWindow | null,
  update: AppBadgeUpdate,
): void {
  const count = Math.max(0, Math.floor(update.count));
  const mentionUnread = Math.max(0, Math.floor(update.mentionUnread));
  lastBadgeUpdate = { count, mentionUnread };
  applyBadgeToPlatform(mainWindow, lastBadgeUpdate);
}

export function clearApplicationBadge(mainWindow: BrowserWindow | null): void {
  updateApplicationBadge(mainWindow, { count: 0, mentionUnread: 0 });
}

/** Re-apply the last badge (e.g. after the main window is shown on Windows). */
export function reapplyApplicationBadge(): void {
  applyBadgeToPlatform(badgeHostWindow, lastBadgeUpdate);
}
