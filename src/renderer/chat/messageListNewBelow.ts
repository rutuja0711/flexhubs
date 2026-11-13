import type { MessageItem } from '../../shared/messages';

/** Count tail messages after the anchor id (excludes prepended history). */
export function countMessagesBelowAnchor(
  messages: MessageItem[],
  anchorMessageId: string | null,
): number {
  if (!anchorMessageId || messages.length === 0) {
    return 0;
  }

  const anchorIndex = messages.findIndex((message) => message.id === anchorMessageId);
  if (anchorIndex < 0) {
    return 0;
  }

  return Math.max(0, messages.length - 1 - anchorIndex);
}
