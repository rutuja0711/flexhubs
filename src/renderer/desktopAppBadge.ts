import type { NotificationItem } from '../shared/messages';

export function isMentionNotification(notification: NotificationItem): boolean {
  const type = notification.type.toLowerCase();

  if (type.includes('mention')) {
    return true;
  }

  const haystack = `${notification.title} ${notification.body}`.toLowerCase();
  return haystack.includes('mention') || haystack.includes('mentioned you');
}

/**
 * Dock / taskbar badge matches Activity nav unread (notifications API + pending
 * friends + hub invites). Chat sidebar unread badges are separate and must not
 * inflate the app icon badge.
 */
export function syncDesktopAppBadge(options: {
  activityUnread: number;
  notifications: NotificationItem[];
}): void {
  if (!window.electronAPI?.setAppBadge) {
    return;
  }

  const count = Math.max(0, Math.floor(options.activityUnread));
  const mentionUnread = options.notifications.filter(
    (item) => !item.isRead && isMentionNotification(item),
  ).length;

  void window.electronAPI.setAppBadge({ count, mentionUnread });
}
