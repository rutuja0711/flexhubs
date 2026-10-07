import type { BrowserWindow } from 'electron';
import { showNativeDesktopNotification } from './nativeNotification';
import { showCustomDesktopNotification } from './notificationWindow';

export type DesktopNotificationPayload = {
  title?: string;
  body?: string;
  tag?: string;
  id?: string;
  conversationId?: string | null;
  messageId?: string | null;
  [key: string]: unknown;
};

function payloadTitle(payload: DesktopNotificationPayload): string {
  return (payload.title ?? 'FlexHubs').trim() || 'FlexHubs';
}

function payloadBody(payload: DesktopNotificationPayload): string {
  const body = payload.body?.trim();
  if (body) {
    return body;
  }

  const subtitle = typeof payload.subtitle === 'string' ? payload.subtitle.trim() : '';
  return subtitle || 'New activity';
}

function mainWindowCanShowInAppToast(mainWindow: BrowserWindow | null): boolean {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return false;
  }

  if (!mainWindow.isVisible() || mainWindow.isMinimized()) {
    return false;
  }

  if (!mainWindow.isFocused()) {
    return false;
  }

  return !mainWindow.webContents.isLoading();
}

export function deliverDesktopNotification(
  mainWindow: BrowserWindow | null,
  payload: DesktopNotificationPayload,
  onClick: () => void,
): { ok: boolean; channel: 'toast' | 'native' | 'overlay' } {
  const title = payloadTitle(payload);
  const body = payloadBody(payload);

  if (mainWindowCanShowInAppToast(mainWindow)) {
    mainWindow!.webContents.send('notification:toast', payload);
    return { ok: true, channel: 'toast' };
  }

  if (showNativeDesktopNotification(title, body, onClick)) {
    return { ok: true, channel: 'native' };
  }

  showCustomDesktopNotification(payload, onClick);
  return { ok: true, channel: 'overlay' };
}
