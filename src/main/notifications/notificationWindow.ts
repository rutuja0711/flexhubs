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

const NOTIFICATION_MARGIN = 16;
const NOTIFICATION_WIDTH = 388;
const NOTIFICATION_HEIGHT = 108;

function positionNotificationWindow(): void {
  if (!notificationWindow || notificationWindow.isDestroyed()) {
    return;
  }

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: workAreaWidth } = primaryDisplay.workAreaSize;
  const { x: workAreaX, y: workAreaY } = primaryDisplay.workArea;

  const x = workAreaX + workAreaWidth - NOTIFICATION_WIDTH - NOTIFICATION_MARGIN;
  const y = workAreaY + NOTIFICATION_MARGIN;

  notificationWindow.setBounds(
    { x, y, width: NOTIFICATION_WIDTH, height: NOTIFICATION_HEIGHT },
    false,
  );
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
  positionNotificationWindow();

  const win = notificationWindow;
  setTimeout(() => {
    if (win.isDestroyed()) {
      return;
    }
    win.showInactive();
  }, 40);
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

    const x = workAreaX + width - NOTIFICATION_WIDTH - NOTIFICATION_MARGIN;
    const y = workAreaY + NOTIFICATION_MARGIN;

    notificationWindow = new BrowserWindow({
      width: NOTIFICATION_WIDTH,
      height: NOTIFICATION_HEIGHT,
      minWidth: NOTIFICATION_WIDTH,
      maxWidth: NOTIFICATION_WIDTH,
      minHeight: NOTIFICATION_HEIGHT,
      maxHeight: NOTIFICATION_HEIGHT,
      x,
      y,
      frame: false,
      transparent: true,
      resizable: false,
      movable: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      hasShadow: true,
      focusable: false,
      acceptFirstMouse: true,
      show: false,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    if (process.platform !== 'darwin') {
      notificationWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    }

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
  }, 7000);
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

ipcMain.on('notification:action', (_event, actionType: string) => {
  const clickHandler = actionType === 'click' ? currentOnClick : null;
  currentOnClick = null;
  closeNotificationWindow();
  clickHandler?.();
});
