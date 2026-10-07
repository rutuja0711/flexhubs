import { BrowserWindow, screen, ipcMain } from 'electron';
import path from 'node:path';

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string | undefined;

let notificationWindow: BrowserWindow | null = null;
let timeoutId: NodeJS.Timeout | null = null;
let currentOnClick: (() => void) | null = null;
let hostWindowProvider: (() => BrowserWindow | null) | null = null;
let pendingPayload: unknown = null;
let overlayReady = false;

const NOTIFICATION_MARGIN = 20;
const NOTIFICATION_DEFAULT_WIDTH = 396;
const NOTIFICATION_DEFAULT_HEIGHT = 112;

function positionNotificationWindow(width: number, height: number): void {
  if (!notificationWindow || notificationWindow.isDestroyed()) {
    return;
  }

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: workAreaWidth } = primaryDisplay.workAreaSize;
  const { x: workAreaX, y: workAreaY } = primaryDisplay.workArea;

  const x = workAreaX + workAreaWidth - width - NOTIFICATION_MARGIN;
  const y = workAreaY + NOTIFICATION_MARGIN;

  notificationWindow.setBounds({ x, y, width, height }, false);
}

export function setNotificationHostWindowProvider(
  provider: () => BrowserWindow | null,
): void {
  hostWindowProvider = provider;
}

function flushPayloadToOverlay(): void {
  if (!notificationWindow || notificationWindow.isDestroyed()) {
    return;
  }

  if (!overlayReady || pendingPayload == null) {
    return;
  }

  notificationWindow.webContents.send('notification:render', pendingPayload);

  const win = notificationWindow;
  setTimeout(() => {
    if (win.isDestroyed()) {
      return;
    }
    if (process.platform === 'darwin') {
      win.show();
    } else {
      win.showInactive();
    }
  }, 50);
}

function deliverPayload(payload: unknown): void {
  pendingPayload = payload;

  if (!notificationWindow || notificationWindow.isDestroyed()) {
    return;
  }

  if (notificationWindow.webContents.isLoading()) {
    overlayReady = false;
    notificationWindow.webContents.once('did-finish-load', () => {
      flushPayloadToOverlay();
    });
    return;
  }

  flushPayloadToOverlay();
}

export function showCustomDesktopNotification(
  payload: unknown,
  onClickCallback?: () => void,
) {
  currentOnClick = onClickCallback || null;
  const hostWindow = hostWindowProvider?.() ?? null;
  if (hostWindow?.isDestroyed()) {
    return;
  }

  if (!notificationWindow || notificationWindow.isDestroyed()) {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;
    const { x: workAreaX, y: workAreaY } = primaryDisplay.workArea;

    const winWidth = 400;
    const winHeight = 168;

    const x = workAreaX + width - winWidth - 20;
    const y = workAreaY + 20;

    notificationWindow = new BrowserWindow({
      width: winWidth,
      height: winHeight,
      x,
      y,
      frame: false,
      transparent: true,
      resizable: false,
      movable: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      hasShadow: true,
      focusable: true,
      acceptFirstMouse: true,
      show: false,
      ...(process.platform === 'darwin' ? { type: 'panel' as const } : {}),
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    notificationWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
      void notificationWindow.loadURL(`${MAIN_WINDOW_VITE_DEV_SERVER_URL}?route=notification`);
    } else {
      void notificationWindow.loadFile(
        path.join(__dirname, `../../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
        { search: 'route=notification' },
      );
    }

    notificationWindow.on('closed', () => {
      notificationWindow = null;
    });

    notificationWindow.webContents.once('did-finish-load', () => {
      deliverPayload(payload);
    });
  } else {
    deliverPayload(payload);
  }

  if (timeoutId) {
    clearTimeout(timeoutId);
  }

  timeoutId = setTimeout(() => {
    closeNotificationWindow();
  }, 5000);
}

export function closeNotificationWindow() {
  overlayReady = false;
  pendingPayload = null;

  if (notificationWindow && !notificationWindow.isDestroyed()) {
    notificationWindow.close();
    notificationWindow = null;
  }
}

ipcMain.on('notification:ready', (event) => {
  if (!notificationWindow || notificationWindow.isDestroyed()) {
    return;
  }

  if (event.sender.id !== notificationWindow.webContents.id) {
    return;
  }

  overlayReady = true;
  flushPayloadToOverlay();
});

ipcMain.on('notification:set-bounds', (event, size: { width?: number; height?: number }) => {
  if (!notificationWindow || notificationWindow.isDestroyed()) {
    return;
  }

  if (event.sender.id !== notificationWindow.webContents.id) {
    return;
  }

  const nextWidth = Math.min(
    Math.max(Math.ceil(Number(size?.width) || NOTIFICATION_DEFAULT_WIDTH), 280),
    420,
  );
  const nextHeight = Math.min(
    Math.max(Math.ceil(Number(size?.height) || NOTIFICATION_DEFAULT_HEIGHT), 88),
    320,
  );

  positionNotificationWindow(nextWidth, nextHeight);
});

ipcMain.on('notification:action', (_event, actionType: string) => {
  const clickHandler = actionType === 'click' ? currentOnClick : null;
  currentOnClick = null;
  closeNotificationWindow();
  clickHandler?.();
});
