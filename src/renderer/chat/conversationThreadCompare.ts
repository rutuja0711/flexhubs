import type { ConversationItem } from '../../shared/chat';
import { normalizePresenceUserId } from '../../shared/chat';
import type { MessageItem } from '../../shared/messages';
import type { ConversationScrollSnapshot } from '../conversationScrollCache';
import type { ConversationThreadProps } from './ConversationThread';

function readOnlySetEqual(left?: ReadonlySet<string>, right?: ReadonlySet<string>): boolean {
  if (left === right) {
    return true;
  }

  if (!left || !right || left.size !== right.size) {
    return false;
  }

  for (const value of left) {
    if (!right.has(value)) {
      return false;
    }
  }

  return true;
}

function conversationRowEqual(left: ConversationItem, right: ConversationItem): boolean {
  return (
    left.id === right.id &&
    left.title === right.title &&
    left.unreadCount === right.unreadCount &&
    left.messagePreview === right.messagePreview &&
    left.draftPreview === right.draftPreview &&
    left.isDraftPreview === right.isDraftPreview &&
    left.status === right.status &&
    left.peerUserId === right.peerUserId &&
    left.kind === right.kind &&
    left.timestamp === right.timestamp
  );
}

function scrollSnapshotEqual(
  left?: ConversationScrollSnapshot | null,
  right?: ConversationScrollSnapshot | null,
): boolean {
  if (left === right) {
    return true;
  }

  if (!left || !right) {
    return false;
  }

  return left.scrollTop === right.scrollTop && left.stickToBottom === right.stickToBottom;
}

function recordEqual(
  left?: Record<string, unknown> | null,
  right?: Record<string, unknown> | null,
): boolean {
  return left === right;
}

function progressMapsEqual(
  left?: Record<string, number>,
  right?: Record<string, number>,
): boolean {
  if (left === right) {
    return true;
  }

  if (!left || !right) {
    return !left && !right;
  }

  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);

  if (leftKeys.length !== rightKeys.length) {
    return false;
  }

  for (const key of leftKeys) {
    if (left[key] !== right[key]) {
      return false;
    }
  }

  return true;
}

/** Custom memo compare for ConversationThread — ignores callback identity (stable via ref bridge). */
export function areConversationThreadPropsEqual(
  prev: ConversationThreadProps,
  next: ConversationThreadProps,
): boolean {
  if (!conversationRowEqual(prev.conversation, next.conversation)) {
    return false;
  }

  if (prev.messages !== next.messages) {
    return false;
  }

  if (
    prev.draft !== next.draft ||
    prev.loading !== next.loading ||
    prev.error !== next.error ||
    prev.draftError !== next.draftError ||
    prev.typingLabel !== next.typingLabel ||
    prev.isSending !== next.isSending ||
    prev.currentUserId !== next.currentUserId ||
    prev.focusMessageId !== next.focusMessageId ||
    prev.unreadAnchorMessageId !== next.unreadAnchorMessageId ||
    prev.scrollRestoreKey !== next.scrollRestoreKey ||
    prev.hasMoreOlder !== next.hasMoreOlder ||
    prev.loadingOlder !== next.loadingOlder ||
    prev.callBusy !== next.callBusy ||
    prev.viewerSharePresence !== next.viewerSharePresence
  ) {
    return false;
  }

  if (prev.conversations !== next.conversations) {
    if (prev.conversations.length !== next.conversations.length) {
      return false;
    }
  }

  if (!readOnlySetEqual(prev.savedMessageIds, next.savedMessageIds)) {
    return false;
  }

  if (!readOnlySetEqual(prev.blockedUserIds, next.blockedUserIds)) {
    return false;
  }

  if (!readOnlySetEqual(prev.blockedByPeerIds, next.blockedByPeerIds)) {
    return false;
  }

  const peerUserId = next.conversation.peerUserId;

  if (peerUserId) {
    const peerKey = normalizePresenceUserId(peerUserId);
    const prevPeerStatus = prev.presenceByUserId?.get(peerKey);
    const nextPeerStatus = next.presenceByUserId?.get(peerKey);

    if (prevPeerStatus !== nextPeerStatus) {
      return false;
    }
  }

  if (!scrollSnapshotEqual(prev.initialScrollSnapshot, next.initialScrollSnapshot)) {
    return false;
  }

  const prevPinned = prev.pinnedMessageIds ?? [];
  const nextPinned = next.pinnedMessageIds ?? [];

  if (prevPinned.length !== nextPinned.length || prevPinned.join() !== nextPinned.join()) {
    return false;
  }

  if (!progressMapsEqual(prev.sendProgressByMessageId, next.sendProgressByMessageId)) {
    return false;
  }

  if (
    !recordEqual(prev.hubDetails, next.hubDetails) ||
    !recordEqual(prev.conversationDetails, next.conversationDetails)
  ) {
    return false;
  }

  return true;
}
