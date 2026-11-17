import type { BrowserWindow } from 'electron';
import { showNativeDesktopNotification } from './nativeNotification';

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

export function deliverDesktopNotification(
  _mainWindow: BrowserWindow | null,
  payload: DesktopNotificationPayload,
  onClick: () => void,
): { ok: boolean; channel: 'toast' | 'native' | 'overlay' | 'both' } {
  const title = payloadTitle(payload);
  const body = payloadBody(payload);

  const tag = typeof payload.tag === 'string' ? payload.tag.trim() : '';
  const conversationId =
    typeof payload.conversationId === 'string' || payload.conversationId === null
      ? payload.conversationId
      : undefined;

  if (
    showNativeDesktopNotification(title, body, onClick, {
      tag: tag || undefined,
      conversationId,
    })
  ) {
    return { ok: true, channel: 'native' };
  }

  return { ok: false, channel: 'native' };
}
