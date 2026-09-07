import type { MessageItem, NotificationItem } from '../shared/messages';

let notificationSnapshotReady = false;
const knownNotificationKeys = new Set<string>();
const shownMessageIds = new Set<string>();

function notificationIconUrl(): string {
  return new URL('./icon.png', window.location.href).href;
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
    knownNotificationKeys.add(getNotificationKey(notification));
  }

  notificationSnapshotReady = true;
}

export function markNotificationSeen(notification: NotificationItem): void {
  knownNotificationKeys.add(getNotificationKey(notification));
}

export async function ensureNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    return false;
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
  const allowed = await ensureNotificationPermission();

  if (!allowed) {
    return;
  }

  const desktopNotification = new Notification(title || 'FlexHubs Desktop', {
    body,
    tag,
    icon: notificationIconUrl(),
  });

  desktopNotification.onclick = () => {
    window.focus();
    onClick();
    desktopNotification.close();
  };
}

export async function showDesktopNotification(
  notification: NotificationItem,
  onClick: () => void,
): Promise<void> {
  await openDesktopNotification(
    notification.title || 'Flexhubs',
    notification.body || '',
    getNotificationKey(notification),
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
): Promise<void> {
  if (!notificationSnapshotReady) {
    seedNotificationSnapshot(notifications);
    return;
  }

  for (const notification of notifications) {
    const key = getNotificationKey(notification);

    if (knownNotificationKeys.has(key)) {
      continue;
    }

    knownNotificationKeys.add(key);
    onNewNotification?.(notification);
    await showDesktopNotification(notification, () => onClick(notification));
  }
}

function messagePreview(message: MessageItem): string {
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
  conversationTitle: string,
  onClick: () => void,
): Promise<void> {
  if (shownMessageIds.has(message.id)) {
    return;
  }

  shownMessageIds.add(message.id);

  const title = conversationTitle.trim() || message.senderName || 'New message';
  const body = `${message.senderName}: ${messagePreview(message)}`;

  await openDesktopNotification(title, body, `message-${message.id}`, onClick);
}

export async function showCalendarEventReminder(
  title: string,
  body: string,
  onClick: () => void,
): Promise<void> {
  await openDesktopNotification(title || 'Calendar event', body, `calendar-${title}-${body}`, onClick);
}
