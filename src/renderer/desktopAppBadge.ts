import type { ConversationItem } from '../shared/chat';
import type { NotificationItem } from '../shared/messages';
import { sumConversationUnreadForAppBadge } from './features/chat/lib/chatPageHelpers';
import type { MainView } from '../shared/nav';

export function isMentionNotification(notification: NotificationItem): boolean {
  const type = notification.type.toLowerCase();

  if (type.includes('mention')) {
    return true;
  }

  const haystack = `${notification.title} ${notification.body}`.toLowerCase();
  return haystack.includes('mention') || haystack.includes('mentioned you');
}

function isMessageNotification(notification: NotificationItem): boolean {
  if (notification.messageId?.trim()) {
    return true;
  }

  if (notification.inviteId?.trim() || notification.eventId?.trim()) {
    return false;
  }

  const type = notification.type.toLowerCase();

  if (
    type.includes('friend') ||
    type.includes('invite') ||
    type.includes('calendar') ||
    type.includes('meeting')
  ) {
    return false;
  }

  return Boolean(notification.conversationId?.trim() || notification.channelId?.trim());
}

function countUnreadMessageNotifications(notifications: NotificationItem[]): number {
  return notifications.filter((item) => !item.isRead && isMessageNotification(item)).length;
}

/**
 * Dock / taskbar badge: chat unreads + non-message activity (friends, hub invites, etc.).
 * Activity nav badge still uses notification API count only.
 */
export function syncDesktopAppBadge(options: {
  activityUnread: number;
  notifications: NotificationItem[];
  conversations: ConversationItem[];
  selectedConversationId: string | null;
  mainView: MainView;
  pendingReadSync: ReadonlySet<string>;
}): void {
  if (!window.electronAPI?.setAppBadge) {
    return;
  }

  const activityUnread = Math.max(0, Math.floor(options.activityUnread));
  const chatUnread = sumConversationUnreadForAppBadge(
    options.conversations,
    options.selectedConversationId,
    options.mainView,
    options.pendingReadSync,
  );

  const messageNotificationUnread = countUnreadMessageNotifications(options.notifications);
  const nonMessageActivity = Math.max(0, activityUnread - messageNotificationUnread);
  const count = chatUnread + nonMessageActivity;

  const mentionUnread = options.notifications.filter(
    (item) => !item.isRead && isMentionNotification(item),
  ).length;

  void window.electronAPI.setAppBadge({ count, mentionUnread });
}
