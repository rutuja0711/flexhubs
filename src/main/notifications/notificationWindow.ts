import { BrowserWindow, screen, ipcMain } from 'electron';
import path from 'node:path';

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string | undefined;

let notificationWindow: BrowserWindow | null = null;
let timeoutId: NodeJS.Timeout | null = null;
let currentOnClick: (() => void) | null = null;
let hostWindowProvider: (() => BrowserWindow | null) | null = null;

export function setNotificationHostWindowProvider(
  provider: () => BrowserWindow | null,
): void {
  hostWindowProvider = provider;
}

export function showCustomDesktopNotification(
  payload: any,
  onClickCallback?: () => void,
) {
  currentOnClick = onClickCallback || null;
  const hostWindow = hostWindowProvider?.() ?? null;

  if (hostWindow?.isDestroyed()) {
    return;
  }

  if (!notificationWindow) {
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
        { search: 'route=notification' }
      );
    }

    notificationWindow.on('closed', () => {
      notificationWindow = null;
    });

    notificationWindow.webContents.once('did-finish-load', () => {
      if (notificationWindow) {
        notificationWindow.webContents.send('notification:render', payload);
        // show after rendering
        setTimeout(() => {
          notificationWindow?.showInactive();
        }, 150);
      }
    });
  } else {
    notificationWindow.webContents.send('notification:render', payload);
    if (!notificationWindow.isVisible()) {
      notificationWindow.showInactive();
    }
  }

  if (timeoutId) {
    clearTimeout(timeoutId);
  }
  
  timeoutId = setTimeout(() => {
    closeNotificationWindow();
  }, 5000);
}

export function closeNotificationWindow() {
  if (notificationWindow) {
    notificationWindow.close();
    notificationWindow = null;
  }
}

// Handle clicks from the notification window
ipcMain.on('notification:action', (_event, actionType: string) => {
  const clickHandler = actionType === 'click' ? currentOnClick : null;
  currentOnClick = null;
  closeNotificationWindow();
  clickHandler?.();
});
