import { formatCallLogPreview, formatNotificationDisplayBody, parseCallLogContent } from '../shared/calls';
import { buildConversationListPreview, type ConversationItem } from '../shared/chat';
import type { MessageItem, NotificationItem } from '../shared/messages';
import { isCallLogMessage } from '../shared/messages';
import { getUserId } from '../shared/user';
import { getStoredUser } from './authApi';

let notificationSnapshotReady = false;
const knownNotificationKeys = new Set<string>();
const shownMessageIds = new Set<string>();
const shownFingerprints = new Set<string>();
const pendingClicks = new Map<string, () => void>();
let clickListenerBound = false;

function normalizeFingerprint(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function notificationFingerprint(notification: NotificationItem): string | null {
  if (!notification.conversationId || !notification.body.trim()) {
    return null;
  }

  return normalizeFingerprint(`${notification.conversationId}|${notification.body}`);
}

function messageFingerprint(conversationId: string, body: string): string {
  return normalizeFingerprint(`${conversationId}|${body}`);
}

export function isIncomingMessageNotification(notification: NotificationItem): boolean {
  const type = notification.type.toLowerCase();
  const title = notification.title.toLowerCase();
  return (
    (type.includes('message') && !type.includes('scheduled')) ||
    title === 'new message'
  );
}

function notificationIconUrl(): string {
  return new URL('./icon-256.png', window.location.href).href;
}

function bindNativeNotificationClicks(): void {
  if (clickListenerBound || !window.electronAPI?.onDesktopNotificationClick) {
    return;
  }

  clickListenerBound = true;
  window.electronAPI.onDesktopNotificationClick((tag) => {
    const onClick = pendingClicks.get(tag);
    pendingClicks.delete(tag);
    onClick?.();
  });
}

export function getNotificationKey(notification: NotificationItem): string {
  const id = notification.id.trim();
  if (id && !id.startsWith('notification-')) {
    return id;
  }

  return [
    notification.createdAt,
    notification.type,
    notification.title,
    notification.body,
  ].join('|');
}

export function seedNotificationSnapshot(notifications: NotificationItem[]): void {
  knownNotificationKeys.clear();

  for (const notification of notifications) {
    rememberShownNotification(notification);
  }

  notificationSnapshotReady = true;
}

export function markNotificationSeen(notification: NotificationItem): void {
  rememberShownNotification(notification);
}

export function markMessageNotificationShown(messageId: string): void {
  if (messageId) {
    shownMessageIds.add(messageId);
  }
}

function wasAlreadyShown(notification: NotificationItem): boolean {
  const key = getNotificationKey(notification);

  if (knownNotificationKeys.has(key)) {
    return true;
  }

  if (notification.messageId && shownMessageIds.has(notification.messageId)) {
    return true;
  }

  const fingerprint = notificationFingerprint(notification);
  return Boolean(fingerprint && shownFingerprints.has(fingerprint));
}

function rememberShownNotification(notification: NotificationItem): void {
  knownNotificationKeys.add(getNotificationKey(notification));

  if (notification.messageId) {
    shownMessageIds.add(notification.messageId);
  }

  const fingerprint = notificationFingerprint(notification);
  if (fingerprint) {
    shownFingerprints.add(fingerprint);
  }
}

export async function ensureNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    return false;
  }

  if (Notification.permission === 'default') {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return false;
    }
  }

  if (window.electronAPI?.showDesktopNotification && Notification.permission !== 'denied') {
    return true;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission === 'denied') {
    return false;
  }

  const permission = await Notification.requestPermission();
  return permission === 'granted';
}

async function openDesktopNotification(
  title: string,
  body: string,
  tag: string,
  onClick: () => void,
): Promise<void> {
  bindNativeNotificationClicks();

  if (window.electronAPI?.showDesktopNotification) {
    pendingClicks.set(tag, onClick);
    const result = await window.electronAPI.showDesktopNotification(title, body, tag);

    if (result.ok) {
      return;
    }
  }

  const allowed = await ensureNotificationPermission();

  if (!allowed) {
    return;
  }

  const desktopNotification = new Notification(title || 'FlexHubs Desktop', {
    body,
    tag,
    // macOS treats icon as a right-side attachment; native notifications use the app icon instead.
    ...(window.electronAPI ? {} : { icon: notificationIconUrl() }),
  });

  desktopNotification.onclick = () => {
    window.focus();
    onClick();
    desktopNotification.close();
  };
}

function parseSenderFromNotificationBody(body: string): string | null {
  const match = body.trim().match(/^([^:\n]{1,48}):\s([\s\S]+)$/);

  if (!match) {
    return null;
  }

  return match[1].trim() || null;
}

export function formatDesktopMessageNotification(
  preview: string,
  senderName: string,
  conversation: Pick<ConversationItem, 'kind' | 'title'> | null,
): { title: string; body: string } {
  const trimmedPreview = preview.trim();
  const trimmedSender = senderName.trim() || 'Someone';

  if (conversation?.kind === 'hub') {
    return {
      title: conversation.title.trim() || 'Group message',
      body: buildConversationListPreview('hub', trimmedPreview, trimmedSender),
    };
  }

  const strippedPreview = parseSenderFromNotificationBody(trimmedPreview)
    ? trimmedPreview.replace(/^([^:\n]{1,48}):\s/, '').trim()
    : trimmedPreview;

  return {
    title: conversation?.title.trim() || trimmedSender || 'New message',
    body: strippedPreview || trimmedPreview || 'New message',
  };
}

export async function showDesktopNotification(
  notification: NotificationItem,
  onClick: () => void,
  conversation: Pick<ConversationItem, 'kind' | 'title'> | null = null,
): Promise<void> {
  if (wasAlreadyShown(notification)) {
    rememberShownNotification(notification);
    return;
  }

  rememberShownNotification(notification);

  const formattedBody = formatNotificationDisplayBody(
    notification.body || '',
    getUserId(getStoredUser()),
  );

  let title = notification.title || 'FlexHubs';
  let body = formattedBody;

  if (isIncomingMessageNotification(notification)) {
    const senderName =
      parseSenderFromNotificationBody(formattedBody) ?? notification.title.trim() ?? '';
    const effectiveConversation =
      conversation ??
      (senderName
        ? ({ kind: 'direct' as const, title: senderName } satisfies Pick<
            ConversationItem,
            'kind' | 'title'
          >)
        : null);
    const formatted = formatDesktopMessageNotification(
      formattedBody,
      senderName,
      effectiveConversation,
    );
    title = formatted.title;
    body = formatted.body;
  }

  await openDesktopNotification(
    title,
    body,
    notification.messageId ? `message-${notification.messageId}` : getNotificationKey(notification),
    onClick,
  );
}

export function peekNewNotifications(notifications: NotificationItem[]): NotificationItem[] {
  if (!notificationSnapshotReady) {
    return [];
  }

  return notifications.filter(
    (notification) => !knownNotificationKeys.has(getNotificationKey(notification)),
  );
}

export async function alertNewDesktopNotifications(
  notifications: NotificationItem[],
  onClick: (notification: NotificationItem) => void,
  onNewNotification?: (notification: NotificationItem) => void,
  resolveConversation?: (notification: NotificationItem) => ConversationItem | null,
): Promise<void> {
  if (!notificationSnapshotReady) {
    seedNotificationSnapshot(notifications);
    return;
  }

  for (const notification of peekNewNotifications(notifications)) {
    if (wasAlreadyShown(notification)) {
      rememberShownNotification(notification);
      continue;
    }

    onNewNotification?.(notification);
    await showDesktopNotification(
      notification,
      () => onClick(notification),
      resolveConversation?.(notification) ?? null,
    );
  }
}

function messagePreview(message: MessageItem): string {
  if (isCallLogMessage(message)) {
    const callLog = parseCallLogContent(message.content);
    if (callLog) {
      return formatCallLogPreview(callLog, getUserId(getStoredUser()));
    }
  }

  const formattedBody = formatNotificationDisplayBody(
    message.content,
    getUserId(getStoredUser()),
  );

  if (formattedBody !== message.content.trim()) {
    return formattedBody;
  }

  const trimmed = message.content.trim();

  if (trimmed && trimmed !== 'sticker') {
    return trimmed.length > 140 ? `${trimmed.slice(0, 140)}…` : trimmed;
  }

  if (message.media.length > 0) {
    const kind = message.media[0]?.kind;
    if (kind === 'gif') return 'Sent a GIF';
    if (kind === 'sticker') return 'Sent a sticker';
    if (kind === 'image') return 'Sent an image';
    return 'Sent a file';
  }

  return 'New message';
}

export async function showIncomingMessageDesktopNotification(
  message: MessageItem,
  conversation: Pick<ConversationItem, 'kind' | 'title'> | null,
  onClick: () => void,
  conversationId?: string,
): Promise<void> {
  if (isCallLogMessage(message)) {
    return;
  }

  const effectiveConversation =
    conversation ??
    (message.senderName.trim()
      ? ({ kind: 'direct' as const, title: message.senderName.trim() } satisfies Pick<
          ConversationItem,
          'kind' | 'title'
        >)
      : null);

  const preview = messagePreview(message);
  const { title, body } = formatDesktopMessageNotification(
    preview,
    message.senderName,
    effectiveConversation,
  );
  const fingerprint = conversationId ? messageFingerprint(conversationId, body) : null;

  if (shownMessageIds.has(message.id) || (fingerprint && shownFingerprints.has(fingerprint))) {
    return;
  }

  shownMessageIds.add(message.id);
  if (fingerprint) {
    shownFingerprints.add(fingerprint);
  }

  await openDesktopNotification(title, body, `message-${message.id}`, onClick);
}

export async function showIncomingCallDesktopNotification(
  callerName: string,
  video: boolean,
  callId: string,
  onClick: () => void,
): Promise<void> {
  const title = video ? 'Incoming video call' : 'Incoming voice call';
  const body = `${callerName} is calling you`;

  await openDesktopNotification(title, body, `call-${callId}`, onClick);
}

export async function showGroupMeetingDesktopNotification(
  starterName: string,
  conversationTitle: string,
  video: boolean,
  onClick: () => void,
): Promise<void> {
  const title = video ? 'Video meeting started' : 'Voice meeting started';
  const body = `${starterName} started a meeting in ${conversationTitle}`;

  await openDesktopNotification(
    title,
    body,
    `meeting-${conversationTitle}-${Date.now()}`,
    onClick,
  );
}

export async function showCalendarEventReminder(
  title: string,
  body: string,
  onClick: () => void,
): Promise<void> {
  await openDesktopNotification(title || 'Calendar event', body, `calendar-${title}-${body}`, onClick);
}
