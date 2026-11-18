import { applyMessageDeletionToList, type MessageItem } from '../shared/messages';

type ThreadKey = string;

const repliesByThread = new Map<ThreadKey, MessageItem[]>();
const listeners = new Set<(key: ThreadKey) => void>();

function threadKey(conversationId: string, rootId: string): ThreadKey {
  return `${conversationId}:${rootId}`;
}

function sortThreadReplies(messages: MessageItem[]): MessageItem[] {
  return [...messages].sort((left, right) => {
    const leftTime = Date.parse(left.createdAt);
    const rightTime = Date.parse(right.createdAt);

    if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime) {
      return leftTime - rightTime;
    }

    return left.id.localeCompare(right.id);
  });
}

function dedupeThreadReplies(messages: MessageItem[], rootId: string): MessageItem[] {
  const byId = new Map<string, MessageItem>();

  for (const message of messages) {
    if (message.id === rootId) {
      continue;
    }

    byId.set(message.id, message);
  }

  return sortThreadReplies([...byId.values()]);
}

function notify(key: ThreadKey): void {
  for (const listener of listeners) {
    listener(key);
  }
}

export function getThreadReplies(conversationId: string, rootId: string): MessageItem[] {
  return repliesByThread.get(threadKey(conversationId, rootId)) ?? [];
}

export function mergeThreadReplies(
  conversationId: string,
  rootId: string,
  fetched: MessageItem[],
): MessageItem[] {
  const key = threadKey(conversationId, rootId);
  const cached = repliesByThread.get(key) ?? [];
  const merged = dedupeThreadReplies([...cached, ...fetched], rootId);

  repliesByThread.set(key, merged);
  return merged;
}

export function replaceThreadReply(
  conversationId: string,
  rootId: string,
  localId: string,
  serverMessage: MessageItem | null,
): MessageItem[] {
  const key = threadKey(conversationId, rootId);
  const cached = repliesByThread.get(key) ?? [];

  const withoutLocal = cached.filter((message) => message.id !== localId);
  const next = serverMessage
    ? dedupeThreadReplies([...withoutLocal, serverMessage], rootId)
    : dedupeThreadReplies(withoutLocal, rootId);

  repliesByThread.set(key, next);
  notify(key);
  return next;
}

export function syncThreadReplyCountForRoot(
  conversationId: string,
  rootId: string,
): number {
  return getThreadReplies(conversationId, rootId).length;
}

export function patchThreadReplyReactions(
  conversationId: string,
  messageId: string,
  reactions: MessageItem['reactions'],
): void {
  const prefix = `${conversationId}:`;

  for (const [key, replies] of repliesByThread.entries()) {
    if (!key.startsWith(prefix)) {
      continue;
    }

    const rootId = key.slice(prefix.length);
    const index = replies.findIndex((message) => message.id === messageId);

    if (index < 0) {
      continue;
    }

    const next = [...replies];
    next[index] = { ...next[index], reactions };
    repliesByThread.set(key, dedupeThreadReplies(next, rootId));
    notify(key);
  }
}

export function appendThreadReply(
  conversationId: string,
  rootId: string,
  message: MessageItem,
): MessageItem[] {
  const key = threadKey(conversationId, rootId);
  const stamped = {
    ...message,
    threadRootId: message.threadRootId ?? rootId,
  };
  const merged = dedupeThreadReplies([...(repliesByThread.get(key) ?? []), stamped], rootId);

  repliesByThread.set(key, merged);
  notify(key);
  return merged;
}

export function subscribeThreadReplies(listener: (key: ThreadKey) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function clearThreadRepliesStore(): void {
  repliesByThread.clear();
}

export function applyThreadReplyEdit(
  conversationId: string,
  rootId: string,
  messageId: string,
  updated: MessageItem,
): MessageItem[] {
  const key = threadKey(conversationId, rootId);
  const cached = repliesByThread.get(key);

  if (!cached?.length) {
    return cached ?? [];
  }

  const next = dedupeThreadReplies(
    cached.map((message) => (message.id === messageId ? { ...message, ...updated } : message)),
    rootId,
  );

  repliesByThread.set(key, next);
  notify(key);
  return next;
}

export function applyThreadReplyDeletion(
  conversationId: string,
  messageId: string,
  scope: 'me' | 'everyone',
): void {
  const prefix = `${conversationId}:`;

  for (const [key, replies] of repliesByThread.entries()) {
    if (!key.startsWith(prefix)) {
      continue;
    }

    const next = applyMessageDeletionToList(replies, messageId, scope);

    if (next === replies) {
      continue;
    }

    repliesByThread.set(key, next);
    notify(key);
  }
}
