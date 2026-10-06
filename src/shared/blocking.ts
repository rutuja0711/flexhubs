import type { ConversationItem, ConversationKind } from './chat';
import type { FriendRelationship } from './features';
import type { MessageItem } from './messages';

export function isBlockedByViewer(
  userId: string | null | undefined,
  blockedUserIds: ReadonlySet<string>,
): boolean {
  if (!userId) {
    return false;
  }

  return blockedUserIds.has(userId);
}

export function isViewerBlockedByPeer(
  peerUserId: string | null | undefined,
  blockedByPeerIds: ReadonlySet<string>,
): boolean {
  if (!peerUserId) {
    return false;
  }

  return blockedByPeerIds.has(peerUserId);
}

export function shouldRedactUserIdentity(
  userId: string | null | undefined,
  blockedUserIds: ReadonlySet<string>,
  blockedByPeerIds: ReadonlySet<string>,
): boolean {
  if (!userId) {
    return false;
  }

  return blockedUserIds.has(userId) || blockedByPeerIds.has(userId);
}

/** True when the peer blocked the viewer (not when the viewer blocked the peer). */
export function resolveViewerBlockedByPeer(
  peerUserId: string,
  relationship: FriendRelationship,
  blockedUserIds: ReadonlySet<string>,
): boolean {
  if (blockedUserIds.has(peerUserId) || relationship.blockedByMe) {
    return false;
  }

  if (relationship.isBlockedByUser || relationship.blockedYou) {
    return true;
  }

  return relationship.isBlocked === true;
}

export function shouldHideMessageFromBlockedUser(
  message: Pick<MessageItem, 'senderId' | 'isOwn'>,
  conversationKind: ConversationKind,
  blockedUserIds: ReadonlySet<string>,
  currentUserId: string | null,
): boolean {
  if (conversationKind === 'direct') {
    return false;
  }

  if (message.isOwn || (currentUserId && message.senderId === currentUserId)) {
    return false;
  }

  if (!message.senderId) {
    return false;
  }

  return blockedUserIds.has(message.senderId);
}

export function filterMessagesForBlockPolicy(
  messages: MessageItem[],
  conversationKind: ConversationKind,
  blockedUserIds: ReadonlySet<string>,
  currentUserId: string | null,
): MessageItem[] {
  if (blockedUserIds.size === 0 || conversationKind === 'direct') {
    return messages;
  }

  return messages.filter(
    (message) =>
      !shouldHideMessageFromBlockedUser(message, conversationKind, blockedUserIds, currentUserId),
  );
}

export function redactDirectConversationForPeerBlock(
  conversation: ConversationItem,
  blockedByPeerIds: ReadonlySet<string>,
): ConversationItem {
  if (
    conversation.kind !== 'direct' ||
    conversation.isSelf ||
    !conversation.peerUserId ||
    !isViewerBlockedByPeer(conversation.peerUserId, blockedByPeerIds)
  ) {
    return conversation;
  }

  const subtitle = conversation.isDraftPreview ? conversation.subtitle : '';

  return {
    ...conversation,
    avatarUrl: null,
    status: null,
    peerStatusMessage: null,
    subtitle,
  };
}

export function redactPeerProfileForViewerBlocked(
  profile: {
    avatarUrl: string | null;
    status?: string | null;
    lastSeenAt?: string | null;
    sharePresence?: boolean;
    tagline?: string | null;
    role?: string | null;
  },
  peerBlockedViewer: boolean,
): typeof profile {
  if (!peerBlockedViewer) {
    return profile;
  }

  return {
    ...profile,
    avatarUrl: null,
    status: null,
    lastSeenAt: null,
    sharePresence: false,
    tagline: null,
    role: null,
  };
}
