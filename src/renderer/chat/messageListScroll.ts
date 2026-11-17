import type { ConversationScrollSnapshot } from '../conversationScrollCache';

export type MessageListEntryLike =
  | { kind: 'date'; key: string }
  | { kind: 'unread'; key: string }
  | { kind: 'message'; key: string; message: { id: string } };

export const STICK_TO_BOTTOM_THRESHOLD_PX = 150;
export const LOAD_OLDER_START_REACHED_THRESHOLD = 320;
export const VIRTUOSO_BASE_FIRST_ITEM_INDEX = 10_000;
export const VIRTUOSO_AUTOSCROLL_MIN_INTERVAL_MS = 80;

export function virtuosoDataIndex(firstItemIndex: number, absoluteIndex: number): number {
  return absoluteIndex - firstItemIndex;
}

export function findMessageEntryIndex(entries: MessageListEntryLike[], messageId: string): number {
  return entries.findIndex(
    (entry) => entry.kind === 'message' && entry.message.id === messageId,
  );
}

export function firstMessageEntryId(entries: MessageListEntryLike[]): string | null {
  const entry = entries.find((item) => item.kind === 'message');
  return entry && entry.kind === 'message' ? entry.message.id : null;
}

export function resolveScrollRestoreTarget(
  snapshot: ConversationScrollSnapshot | null | undefined,
  entries: MessageListEntryLike[],
): { mode: 'bottom' } | { mode: 'anchor'; messageId: string } | { mode: 'scrollTop'; scrollTop: number } | null {
  if (!snapshot) {
    return null;
  }

  if (snapshot.stickToBottom) {
    return { mode: 'bottom' };
  }

  if (snapshot.anchorMessageId) {
    const index = findMessageEntryIndex(entries, snapshot.anchorMessageId);
    if (index >= 0) {
      return { mode: 'anchor', messageId: snapshot.anchorMessageId };
    }
  }

  if (Number.isFinite(snapshot.scrollTop) && snapshot.scrollTop > 0) {
    return { mode: 'scrollTop', scrollTop: snapshot.scrollTop };
  }

  return null;
}