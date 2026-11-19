import type { MessageItem } from './messages';
import { formatMessagePreview, isDeletedMessage } from './messages';

export const CONVERSATION_SUMMARY_MAX_MESSAGES = 15;

export function pickMessagesForConversationSummary(
  messages: MessageItem[],
  unreadCount = 0,
): MessageItem[] {
  const eligible = messages.filter((message) => !isDeletedMessage(message));

  if (eligible.length === 0) {
    return [];
  }

  if (unreadCount > 0) {
    const unreadSlice = Math.min(unreadCount, CONVERSATION_SUMMARY_MAX_MESSAGES);
    return eligible.slice(-unreadSlice);
  }

  return eligible.slice(-CONVERSATION_SUMMARY_MAX_MESSAGES);
}

export function buildConversationSummaryTranscript(
  messages: MessageItem[],
  currentUserId: string | null,
): string {
  return messages
    .map((message) => {
      const preview = formatMessagePreview(message, currentUserId).trim();
      if (!preview) {
        return null;
      }

      return `${message.senderName}: ${preview}`;
    })
    .filter((line): line is string => Boolean(line))
    .join('\n');
}

export type SummarizeUnreadRequest = {
  messageIds: string[];
  limit: number;
};

export function buildSummarizeUnreadRequest(
  messages: MessageItem[],
  unreadCount = 0,
): SummarizeUnreadRequest | null {
  const picked = pickMessagesForConversationSummary(messages, unreadCount);

  if (picked.length === 0) {
    return null;
  }

  return {
    messageIds: picked.map((message) => message.id),
    limit: picked.length,
  };
}