import type { MessageItem } from '../shared/messages';

export type ThreadCacheEntry = {
  messages: MessageItem[];
  pinnedMessageIds: string[];
  activeHubDetails: Record<string, unknown> | null;
  draft: string;
  hasMoreOlderMessages?: boolean;
  fetchedAt: number;
};

export type ThreadCacheStore = Record<string, ThreadCacheEntry>;

const CACHE_TTL_MS = 5 * 60_000;
const MAX_CACHE_ENTRIES = 40;

export function getThreadCacheEntry(
  store: ThreadCacheStore,
  conversationId: string,
): ThreadCacheEntry | null {
  const entry = store[conversationId];

  if (!entry) {
    return null;
  }

  if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) {
    delete store[conversationId];
    return null;
  }

  return entry;
}

export function writeThreadCacheEntry(
  store: ThreadCacheStore,
  conversationId: string,
  entry: Omit<ThreadCacheEntry, 'fetchedAt'>,
): void {
  const keys = Object.keys(store);

  if (keys.length >= MAX_CACHE_ENTRIES && !store[conversationId]) {
    let oldestKey = keys[0];
    let oldestTime = store[oldestKey]?.fetchedAt ?? Infinity;

    for (const key of keys) {
      const fetchedAt = store[key]?.fetchedAt ?? Infinity;

      if (fetchedAt < oldestTime) {
        oldestTime = fetchedAt;
        oldestKey = key;
      }
    }

    delete store[oldestKey];
  }

  store[conversationId] = {
    ...entry,
    fetchedAt: Date.now(),
  };
}

export function invalidateThreadCacheEntry(store: ThreadCacheStore, conversationId: string): void {
  delete store[conversationId];
}

export function patchThreadCacheMessages(
  store: ThreadCacheStore,
  conversationId: string,
  updater: (messages: MessageItem[]) => MessageItem[],
): void {
  const entry = store[conversationId];

  if (!entry) {
    return;
  }

  entry.messages = updater(entry.messages);
  entry.fetchedAt = Date.now();
}
