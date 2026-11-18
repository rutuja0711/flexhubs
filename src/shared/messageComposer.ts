import type { MessageItem } from './messages';
import { filterEditableMessageMedia } from './messageEditPlan';
import {
  isCallLogMessage,
  isCalendarEventAnnouncementMessage,
  isDeletedMessage,
  isPollMessage,
  isStickerMessage,
  isVoiceOnlyMessage,
} from './messages';

const EDIT_WINDOW_MS = 5 * 60 * 60 * 1000;

export function canEditMessage(
  message: MessageItem,
  viewerUserId: string | null | undefined,
): boolean {
  if (!viewerUserId || !message.isOwn) {
    return false;
  }

  if (message.senderId && message.senderId !== viewerUserId) {
    return false;
  }

  if (isDeletedMessage(message)) {
    return false;
  }

  if (message.status === 'sending' || message.id.startsWith('local-')) {
    return false;
  }

  if (isPollMessage(message) || isCallLogMessage(message) || isCalendarEventAnnouncementMessage(message)) {
    return false;
  }

  if (isStickerMessage(message) || isVoiceOnlyMessage(message)) {
    return false;
  }

  const messageType = String(message.messageType ?? 'TEXT').toUpperCase();
  if (messageType === 'STICKER' || messageType === 'VOICE' || messageType === 'POLL') {
    return false;
  }

  const hasEditableAttachments = filterEditableMessageMedia(message).length > 0;
  const hasText = message.content.trim().length > 0;

  if (messageType === 'GIF' || messageType === 'IMAGE' || messageType === 'TEXT') {
    if (!hasText && !hasEditableAttachments && messageType !== 'GIF') {
      return false;
    }
  } else if (!hasText && !hasEditableAttachments) {
    return false;
  }

  const createdAt = Date.parse(message.createdAt);
  if (Number.isFinite(createdAt) && Date.now() - createdAt > EDIT_WINDOW_MS) {
    return false;
  }

  return true;
}

export function findLastEditableOwnMessage(
  messages: MessageItem[],
  viewerUserId: string | null | undefined,
): MessageItem | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];

    if (canEditMessage(message, viewerUserId)) {
      return message;
    }
  }

  return null;
}

export function isTextSelectionContext(target: EventTarget | null): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const selection = window.getSelection();
  const text = selection?.toString().trim() ?? '';

  if (!text) {
    return null;
  }

  if (!target || !(target instanceof Node)) {
    return text;
  }

  const element = target instanceof Element ? target : target.parentElement;
  const row = element?.closest('[data-message-id]');

  if (!row) {
    return null;
  }

  return text;
}