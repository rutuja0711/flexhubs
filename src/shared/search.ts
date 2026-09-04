import { validateSearchQuery } from './chat';

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  return value as Record<string, unknown>;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function extractArray(payload: unknown, keys: string[]): unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }

  const record = asRecord(payload);

  if (!record) {
    return [];
  }

  for (const key of keys) {
    const value = record[key];

    if (Array.isArray(value)) {
      return value;
    }
  }

  return [];
}

function initialsFromName(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return name.slice(0, 2).toUpperCase();
}

export type SearchPerson = {
  id: string;
  name: string;
  username: string;
  avatarUrl: string | null;
  initials: string;
  status: string | null;
};

export type SearchChat = {
  id: string;
  title: string;
  subtitle: string;
  kind: 'direct' | 'hub';
};

export type GlobalSearchResult = {
  people: SearchPerson[];
  chats: SearchChat[];
};

export type MessageSearchHit = {
  messageId: string;
  content: string;
  highlight: string;
  senderName: string;
  createdAt: string;
};

export type MessageSearchResult = {
  hits: MessageSearchHit[];
  count: number;
};

function normalizePerson(record: Record<string, unknown>, index: number): SearchPerson {
  const name =
    readString(record.name) ??
    readString(record.displayName) ??
    readString(record.username) ??
    'User';

  return {
    id: readString(record.id) ?? readString(record.userId) ?? `user-${index}`,
    name,
    username: readString(record.username) ?? '',
    avatarUrl: readString(record.avatarUrl) ?? readString(record.avatar),
    initials: initialsFromName(name),
    status: readString(record.status) ?? readString(record.presence),
  };
}

function normalizeSearchChat(record: Record<string, unknown>, index: number): SearchChat {
  const type = String(record.type ?? record.kind ?? '').toUpperCase();
  const title =
    readString(record.name) ??
    readString(record.title) ??
    readString(record.displayName) ??
    'Chat';

  return {
    id: readString(record.id) ?? readString(record.conversationId) ?? `chat-${index}`,
    title,
    subtitle:
      readString(record.preview) ??
      readString(record.lastMessagePreview) ??
      readString(record.subtitle) ??
      '',
    kind:
      type.includes('HUB') || type.includes('CHANNEL') || type.includes('GROUP') ? 'hub' : 'direct',
  };
}

export function normalizeGlobalSearch(payload: unknown): GlobalSearchResult {
  const record = asRecord(payload);

  const people = extractArray(payload, ['people', 'users', 'members']).length
    ? extractArray(payload, ['people', 'users', 'members'])
    : extractArray(record?.people, ['items', 'data']);

  const chats = extractArray(payload, ['chats', 'conversations', 'channels']).length
    ? extractArray(payload, ['chats', 'conversations', 'channels'])
    : extractArray(record?.conversations, ['items', 'data']);

  return {
    people: people
      .map(asRecord)
      .filter((item): item is Record<string, unknown> => item !== null)
      .map(normalizePerson),
    chats: chats
      .map(asRecord)
      .filter((item): item is Record<string, unknown> => item !== null)
      .map(normalizeSearchChat),
  };
}

export function normalizeUserSearch(payload: unknown): SearchPerson[] {
  return extractArray(payload, ['users', 'people', 'results', 'data', 'items'])
    .map(asRecord)
    .filter((item): item is Record<string, unknown> => item !== null)
    .map(normalizePerson);
}

export function normalizeMessageSearch(payload: unknown): MessageSearchResult {
  const record = asRecord(payload);
  const items = extractArray(payload, ['messages', 'results', 'hits', 'items', 'data']);

  const hits = items
    .map(asRecord)
    .filter((item): item is Record<string, unknown> => item !== null)
    .map((item, index) => {
      const content =
        readString(item.content) ??
        readString(item.text) ??
        readString(item.body) ??
        '';

      const sender = asRecord(item.sender) ?? asRecord(item.user);

      return {
        messageId: readString(item.id) ?? readString(item.messageId) ?? `hit-${index}`,
        content,
        highlight: readString(item.highlight) ?? readString(item.snippet) ?? content,
        senderName:
          readString(item.senderName) ??
          (sender ? readString(sender.name) ?? readString(sender.displayName) : null) ??
          'Unknown',
        createdAt: readString(item.createdAt) ?? readString(item.timestamp) ?? '',
      };
    });

  const count =
    typeof record?.count === 'number'
      ? record.count
      : typeof record?.total === 'number'
        ? record.total
        : hits.length;

  return { hits, count };
}

export function validateSearchInput(query: string): { ok: true; value: string } | { ok: false; error: string } {
  const base = validateSearchQuery(query);

  if (!base.ok) {
    return base;
  }

  if (base.value.length > 0 && base.value.length < 2) {
    return { ok: false, error: 'Enter at least 2 characters to search.' };
  }

  return base;
}
