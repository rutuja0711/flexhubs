import {
  applyMessageDeletionToList,
  isDeletedMessage,
  markMessageDeletedForEveryone,
  type MessageItem,
} from './messages';

const STORAGE_KEY = 'flexhubs-message-deletions-everyone';
const MAX_TOMBSTONE_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_TOMBSTONES = 2_000;

type TombstoneRecord = {
  messageId: string;
  conversationId: string | null;
  deletedAt: number;
};

function readTombstones(): TombstoneRecord[] {
  if (typeof localStorage === 'undefined') {
    return [];
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((entry) => {
        const record = entry as Record<string, unknown>;
        const messageId = typeof record.messageId === 'string' ? record.messageId.trim() : '';
        const conversationId =
          typeof record.conversationId === 'string' ? record.conversationId.trim() : null;
        const deletedAt = typeof record.deletedAt === 'number' ? record.deletedAt : 0;

        if (!messageId) {
          return null;
        }

        return { messageId, conversationId: conversationId || null, deletedAt };
      })
      .filter((entry): entry is TombstoneRecord => entry !== null);
  } catch {
    return [];
  }
}

function writeTombstones(entries: TombstoneRecord[]): void {
  if (typeof localStorage === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Ignore quota errors — in-memory callers still win via merge guards.
  }
}

function pruneTombstones(entries: TombstoneRecord[]): TombstoneRecord[] {
  const now = Date.now();
  const fresh = entries.filter((entry) => now - entry.deletedAt <= MAX_TOMBSTONE_AGE_MS);

  if (fresh.length <= MAX_TOMBSTONES) {
    return fresh;
  }

  return fresh
    .sort((left, right) => right.deletedAt - left.deletedAt)
    .slice(0, MAX_TOMBSTONES);
}

const tombstoneIds = new Set<string>();

function syncTombstoneIds(entries: TombstoneRecord[]): void {
  tombstoneIds.clear();

  for (const entry of entries) {
    tombstoneIds.add(entry.messageId);
  }
}

let loaded = false;

function ensureLoaded(): void {
  if (loaded) {
    return;
  }

  loaded = true;
  syncTombstoneIds(pruneTombstones(readTombstones()));
}

export function rememberMessageDeletedForEveryone(
  messageId: string,
  conversationId?: string | null,
): void {
  const trimmedId = messageId.trim();

  if (!trimmedId) {
    return;
  }

  ensureLoaded();
  tombstoneIds.add(trimmedId);

  const entries = pruneTombstones(readTombstones()).filter((entry) => entry.messageId !== trimmedId);
  entries.push({
    messageId: trimmedId,
    conversationId: conversationId?.trim() || null,
    deletedAt: Date.now(),
  });

  writeTombstones(pruneTombstones(entries));
}

export function isMessageDeletedForEveryoneTombstone(messageId: string): boolean {
  ensureLoaded();
  return tombstoneIds.has(messageId);
}

export function findTombstoneConversationId(messageId: string): string | null {
  const entries = pruneTombstones(readTombstones());
  const match = entries.find((entry) => entry.messageId === messageId);
  return match?.conversationId ?? null;
}

export function applyDeletionTombstones(messages: MessageItem[]): MessageItem[] {
  ensureLoaded();

  if (tombstoneIds.size === 0) {
    return messages;
  }

  return messages.map((message) =>
    tombstoneIds.has(message.id) && !isDeletedMessage(message)
      ? markMessageDeletedForEveryone(message)
      : message,
  );
}

export function applyDeletionTombstoneToMessage(message: MessageItem): MessageItem {
  ensureLoaded();

  if (!tombstoneIds.has(message.id) || isDeletedMessage(message)) {
    return message;
  }

  return markMessageDeletedForEveryone(message);
}

export function applyDeletionToListWithTombstones(
  messages: MessageItem[],
  messageId: string,
  scope: 'me' | 'everyone',
): MessageItem[] {
  if (scope === 'everyone') {
    rememberMessageDeletedForEveryone(messageId);
  }

  return applyMessageDeletionToList(messages, messageId, scope);
}