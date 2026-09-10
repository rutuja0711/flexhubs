import type { MessageItem } from '../shared/messages';

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
