import type { MainView } from '../../../../shared/nav';
import type { ConversationItem } from '../../../../shared/chat';
import { normalizePresenceUserId } from '../../../../shared/chat';
import type {
  ConversationBootstrap,
  MessageItem,
  NotificationItem,
  TeammateItem,
} from '../../../../shared/messages';
import {
  applyMessageReadReceipts,
  compareMessagesChronologically,
  enrichMessageReplies,
  extractPeerLastReadMessageIds,
  filterMainChatMessages,
  resolveMessageReadBy,
  resolveNotificationConversationId,
  resolveThreadRootId,
} from '../../../../shared/messages';

export type ConversationTypingState = {
  userIds: string[];
  namesByUserId: Record<string, string>;
};

export function isActivelyViewingConversation(
  conversationId: string,
  mainView: MainView,
  selectedConversationId: string | null,
): boolean {
  if (mainView !== 'chat' || selectedConversationId !== conversationId) {
    return false;
  }

  if (typeof document === 'undefined') {
    return false;
  }

  return document.hasFocus() && !document.hidden;
}

export function notificationBelongsToConversation(
  notification: NotificationItem,
  conversationId: string,
  conversations: ConversationItem[],
): boolean {
  if (notification.conversationId === conversationId) {
    return true;
  }

  return resolveNotificationConversationId(notification, conversations) === conversationId;
}

export function stripConversationMessageNotifications(
  notifications: NotificationItem[],
  conversationId: string,
  conversations: ConversationItem[],
): NotificationItem[] {
  return notifications.filter(
    (notification) =>
      !notificationBelongsToConversation(notification, conversationId, conversations),
  );
}

export function resolveConversationUnreadCountOverride(
  conversation: ConversationItem,
  selectedConversationId: string | null,
  mainView: MainView,
  pendingReadSync: ReadonlySet<string>,
): number {
  if (mainView === 'chat' && selectedConversationId === conversation.id && conversation.unreadCount > 0) {
    return 0;
  }

  if (pendingReadSync.has(conversation.id) && conversation.unreadCount > 0) {
    return 0;
  }

  return conversation.unreadCount;
}

export function sumConversationUnreadForAppBadge(
  conversations: ConversationItem[],
  selectedConversationId: string | null,
  mainView: MainView,
  pendingReadSync: ReadonlySet<string>,
): number {
  return conversations.reduce(
    (total, conversation) =>
      total +
      resolveConversationUnreadCountOverride(
        conversation,
        selectedConversationId,
        mainView,
        pendingReadSync,
      ),
    0,
  );
}

export function buildPresenceRefreshInflightKey(
  uniqueUserIds: string[],
  options?: { snapshotMissingAsOffline?: boolean },
): string {
  const ids = uniqueUserIds
    .map((id) => normalizePresenceUserId(id))
    .sort()
    .join('\u001f');
  const snapshot = options?.snapshotMissingAsOffline;

  if (snapshot === undefined) {
    return `default\u001e${ids}`;
  }

  return `${snapshot ? 'snapshot:1' : 'snapshot:0'}\u001e${ids}`;
}

export function resolveTyperDisplayName(
  typing: { userId: string; username: string | null },
  teammates: TeammateItem[],
  conversations: ConversationItem[],
): string {
  return (
    typing.username?.trim() ||
    teammates.find((member) => member.id === typing.userId)?.name ||
    conversations.find((item) => item.peerUserId === typing.userId)?.title ||
    'Someone'
  );
}

export function shouldDropHubMessageFromBlockedSender(
  message: MessageItem,
  conversation: ConversationItem | null | undefined,
  blockedUserIds: ReadonlySet<string>,
): boolean {
  return (
    conversation?.kind === 'hub' &&
    !message.isOwn &&
    Boolean(message.senderId) &&
    blockedUserIds.has(message.senderId as string)
  );
}

export function sortConversations(items: ConversationItem[]): ConversationItem[] {
  return [...items].sort((left, right) => {
    if (left.isPinned !== right.isPinned) {
      return left.isPinned ? -1 : 1;
    }

    if (left.isSelf !== right.isSelf) {
      return left.isSelf ? -1 : 1;
    }

    const leftTime = Date.parse(left.timestamp);
    const rightTime = Date.parse(right.timestamp);

    if (!Number.isNaN(leftTime) && !Number.isNaN(rightTime) && leftTime !== rightTime) {
      return rightTime - leftTime;
    }

    return left.title.localeCompare(right.title);
  });
}

export function markOwnMessages(messages: MessageItem[], userId: string | null): MessageItem[] {
  if (!userId) {
    return messages;
  }

  return messages.map((message) => {
    const isOwn = message.senderId === userId || message.isOwn;
    return {
      ...message,
      isOwn,
      status: isOwn ? (message.status ?? 'delivered') : message.status,
    };
  });
}

export const MESSAGE_HISTORY_PAGE_SIZE = 50;

export function resolveHasMoreMessagesFromBootstrap(bootstrap: ConversationBootstrap): boolean {
  if (bootstrap.messages.length === 0) {
    return false;
  }

  if (bootstrap.hasMoreMessages === false) {
    return false;
  }

  if (bootstrap.hasMoreMessages === true) {
    return true;
  }

  // API often omits hasMore on partial pages — allow scroll-to-top fetch until we get an empty page.
  return true;
}

export function applyMainChatFilterIfChanged(messages: MessageItem[]): MessageItem[] {
  const filtered = filterMainChatMessages(messages);

  if (
    filtered.length === messages.length &&
    filtered.every((message, index) => message.id === messages[index]?.id)
  ) {
    return messages;
  }

  return filtered;
}

export function commitMessages(
  messages: MessageItem[],
  userId: string | null,
  conversation?: Record<string, unknown> | null,
): MessageItem[] {
  const owned = markOwnMessages(messages, userId);
  const withReceipts = applyMessageReadReceipts(
    owned,
    extractPeerLastReadMessageIds(conversation ?? null, userId),
  );
  const withReaders = withReceipts.map((message) => {
    if (!message.isOwn || message.status !== 'seen') {
      return message;
    }

    const readBy = resolveMessageReadBy(message, conversation ?? null, withReceipts, userId);

    return readBy.length > 0 ? { ...message, readBy } : message;
  });

  return enrichMessageReplies(filterMainChatMessages(withReaders)).sort(compareMessagesChronologically);
}

export function appendMessage(
  current: MessageItem[],
  message: MessageItem,
  userId: string | null,
): MessageItem[] {
  const next = [...current, markOwnMessages([message], userId)[0]];
  return enrichMessageReplies(next);
}

export function createLocalMessageId(): string {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function isLocalMessageId(id: string): boolean {
  return id.startsWith('local-');
}

export function withDeliveredStatus(message: MessageItem): MessageItem {
  return {
    ...message,
    isOwn: true,
    status: message.status === 'seen' ? 'seen' : 'delivered',
  };
}

export function markMessageStatus(
  current: MessageItem[],
  messageId: string,
  status: MessageItem['status'],
): MessageItem[] {
  return current.map((message) => (message.id === messageId ? { ...message, status } : message));
}

export function replaceLocalMessage(
  current: MessageItem[],
  localId: string,
  incoming: MessageItem,
  userId: string | null,
): MessageItem[] {
  const delivered = markOwnMessages([withDeliveredStatus(incoming)], userId)[0];

  if (current.some((message) => message.id === delivered.id)) {
    return current.filter((message) => message.id !== localId);
  }

  return enrichMessageReplies(
    current.map((message) =>
      message.id === localId
        ? {
            ...delivered,
            createdAt: message.createdAt,
            media: delivered.media.length > 0 ? delivered.media : message.media,
          }
        : message,
    ),
  );
}

export function mergeLocalPendingMessages(
  serverMessages: MessageItem[],
  current: MessageItem[],
): MessageItem[] {
  const pending = current.filter((message) => isLocalMessageId(message.id));

  if (pending.length === 0) {
    return serverMessages;
  }

  const extras = pending.filter((local) => {
    return !serverMessages.some(
      (message) =>
        message.isOwn &&
        message.content === local.content &&
        message.media[0]?.url === local.media[0]?.url,
    );
  });

  return extras.length > 0 ? [...serverMessages, ...extras] : serverMessages;
}

export function bumpThreadReplyCount(current: MessageItem[], threadRootId: string): MessageItem[] {
  return current.map((message) =>
    message.id === threadRootId
      ? { ...message, threadReplyCount: (message.threadReplyCount ?? 0) + 1 }
      : message,
  );
}

export function mergeIncomingMessage(
  current: MessageItem[],
  incoming: MessageItem,
  userId: string | null,
  shouldIgnore?: (message: MessageItem) => boolean,
): MessageItem[] {
  if (shouldIgnore?.(incoming)) {
    return current;
  }

  const threadRootId = resolveThreadRootId(incoming, userId);
  if (threadRootId) {
    return bumpThreadReplyCount(
      current.filter((message) => message.id !== incoming.id),
      threadRootId,
    );
  }

  if (current.some((message) => message.id === incoming.id)) {
    return current;
  }

  if (incoming.isOwn || incoming.senderId === userId) {
    const localIndex = current.findIndex(
      (message) =>
        isLocalMessageId(message.id) &&
        message.isOwn &&
        message.content === incoming.content &&
        message.media[0]?.url === incoming.media[0]?.url,
    );

    if (localIndex >= 0) {
      const next = [...current];
      next[localIndex] = {
        ...markOwnMessages([withDeliveredStatus(incoming)], userId)[0],
        createdAt: current[localIndex].createdAt,
      };
      return enrichMessageReplies(next);
    }
  }

  return appendMessage(current, incoming, userId);
}

export function preserveMessageOwnership(
  updated: MessageItem,
  previous: MessageItem | undefined,
  userId: string | null,
): MessageItem {
  const isOwn = previous?.isOwn ?? (userId ? updated.senderId === userId : updated.isOwn);

  return { ...updated, isOwn };
}
