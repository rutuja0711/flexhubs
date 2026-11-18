import type { MessageItem } from '../../shared/messages';
import {
  registerThreadReplyMessage,
  trackPendingThreadSend,
} from '../../shared/messages';
import { sendChatMessage } from '../chatApi';
import { createLocalMessageId } from '../features/chat/lib/chatPageHelpers';
import { appendThreadReply, replaceThreadReply } from '../threadRepliesStore';

export type ThreadTextSendResult =
  | { ok: true; message: MessageItem }
  | { ok: false; error: string; status?: number };

export type ThreadReplyAuthor = {
  userId: string;
  displayName: string;
  initials: string;
};

export function buildOptimisticThreadReply(
  author: ThreadReplyAuthor,
  content: string,
  threadRootId: string,
  replyToId?: string,
): MessageItem {
  return {
    id: createLocalMessageId(),
    content,
    senderId: author.userId,
    senderName: author.displayName,
    senderInitials: author.initials,
    createdAt: new Date().toISOString(),
    editedAt: null,
    pinnedAt: null,
    isOwn: true,
    status: 'sending',
    readBy: [],
    reactions: [],
    replyToMessageId: replyToId,
    threadRootId,
    messageType: 'TEXT',
    media: [],
    deletedForEveryone: false,
    poll: null,
  };
}

export async function sendThreadTextReply(options: {
  conversationId: string;
  threadRootId: string;
  content: string;
  replyToId?: string;
  author: ThreadReplyAuthor;
}): Promise<ThreadTextSendResult> {
  const trimmed = options.content.trim();

  if (!trimmed) {
    return { ok: false, error: 'Message is empty.' };
  }

  trackPendingThreadSend(trimmed, options.threadRootId);

  const optimistic = buildOptimisticThreadReply(
    options.author,
    trimmed,
    options.threadRootId,
    options.replyToId,
  );

  appendThreadReply(options.conversationId, options.threadRootId, optimistic);

  const result = await sendChatMessage(
    options.conversationId,
    trimmed,
    options.replyToId,
    options.threadRootId,
  );

  if (!result.ok) {
    replaceThreadReply(options.conversationId, options.threadRootId, optimistic.id, null);
    return { ok: false, error: result.error, status: result.status };
  }

  const serverMessage: MessageItem = {
    ...result.data,
    threadRootId: result.data.threadRootId ?? options.threadRootId,
    isOwn: true,
  };

  registerThreadReplyMessage(serverMessage.id, serverMessage.threadRootId ?? options.threadRootId);
  replaceThreadReply(options.conversationId, options.threadRootId, optimistic.id, serverMessage);

  return { ok: true, message: serverMessage };
}