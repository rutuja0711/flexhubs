import { normalizeMessage, parseMessageReactions, type MessageItem, type MessageReaction } from './messages';

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  return value as Record<string, unknown>;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export type RealtimeConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'unavailable';

export type RealtimeEvent = {
  type: string;
  payload: unknown;
  raw: unknown;
};

export type RealtimeStatusPayload = {
  enabled: boolean;
  mode: string | null;
};

export type PresenceItem = {
  userId: string;
  status: string;
};

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

export function normalizePresencePayload(payload: unknown): PresenceItem[] {
  const record = asRecord(payload);

  if (record) {
    const mapLike =
      asRecord(record.presence) ??
      asRecord(record.users) ??
      asRecord(record.statuses);

    if (mapLike && !Array.isArray(record.presence) && !Array.isArray(record.users)) {
      return Object.entries(mapLike)
        .map(([userId, value]) => {
          const entry = asRecord(value);
          const status =
            typeof value === 'string'
              ? value
              : readString(entry?.status) ?? readString(entry?.presence);

          if (!status) {
            return null;
          }

          return { userId, status };
        })
        .filter((item): item is PresenceItem => item !== null);
    }
  }

  return extractArray(payload, ['presence', 'users', 'items', 'data'])
    .map(asRecord)
    .filter((item): item is Record<string, unknown> => item !== null)
    .map((entry) => {
      const user = asRecord(entry.user) ?? entry;
      const userId =
        readString(entry.userId) ??
        readString(user.id) ??
        readString(entry.id);

      const status =
        readString(entry.status) ??
        readString(entry.presence) ??
        readString(user.status);

      if (!userId || !status) {
        return null;
      }

      return { userId, status };
    })
    .filter((item): item is PresenceItem => item !== null);
}

export function extractConversationMemberIds(conversation: Record<string, unknown> | null): string[] {
  if (!conversation) {
    return [];
  }

  const ids = new Set<string>();

  for (const key of ['members', 'participants', 'users']) {
    const value = conversation[key];

    if (!Array.isArray(value)) {
      continue;
    }

    for (const entry of value) {
      const member = asRecord(entry);
      if (!member) {
        continue;
      }

      const user = asRecord(member.user) ?? member;
      const userId =
        readString(user.id) ??
        readString(member.userId) ??
        readString(member.id);

      if (userId) {
        ids.add(userId);
      }
    }
  }

  return [...ids];
}

export function parseRealtimeEvent(data: unknown): RealtimeEvent {
  const record = asRecord(data);

  if (!record) {
    return { type: 'unknown', payload: data, raw: data };
  }

  const nestedEvent = asRecord(record.event);

  if (nestedEvent) {
    const channel = readString(record.channel) ?? '';
    let type = readString(nestedEvent.type) ?? 'unknown';

    if (channel.includes('typing')) {
      type = 'typing';
    }

    const payload = nestedEvent.payload ?? nestedEvent.data ?? nestedEvent;

    return { type, payload, raw: data };
  }

  const type =
    readString(record.type) ??
    readString(record.event) ??
    readString(record.name) ??
    readString(record.action) ??
    'unknown';

  const payload = record.payload ?? record.data ?? record;

  return { type, payload, raw: data };
}

export function normalizeRealtimeStatus(payload: unknown): RealtimeStatusPayload {
  const record = asRecord(payload);

  if (!record) {
    return { enabled: false, mode: null };
  }

  const mode =
    readString(record.realtime) ??
    readString(record.mode) ??
    readString(record.provider) ??
    readString(record.type);

  const enabled =
    record.redis === true ||
    record.enabled === true ||
    record.available === true ||
    record.connected === true ||
    String(record.status ?? '').toLowerCase() === 'ok' ||
    mode === 'redis';

  return {
    enabled,
    mode,
  };
}

export function extractRealtimeToken(payload: unknown): string | null {
  if (typeof payload === 'string' && payload.trim()) {
    return payload.trim();
  }

  const record = asRecord(payload);

  if (!record) {
    return null;
  }

  return (
    readString(record.accessToken) ??
    readString(record.token) ??
    readString(record.realtimeToken) ??
    readString(record.jwt)
  );
}

export function extractConversationId(payload: unknown): string | null {
  const record = asRecord(payload);

  if (!record) {
    return null;
  }

  return (
    readString(record.conversationId) ??
    readString(asRecord(record.conversation)?.id) ??
    readString(asRecord(record.message)?.conversationId) ??
    readString(record.channelId) ??
    readString(record.chatId)
  );
}

export function extractConversationIdFromRealtime(rawEvent: unknown, payload: unknown): string | null {
  const fromPayload = extractConversationId(payload);

  if (fromPayload) {
    return fromPayload;
  }

  const rawRecord = asRecord(rawEvent);
  const channel = rawRecord ? readString(rawRecord.channel) : null;

  return extractConversationIdFromChannel(channel);
}

export function extractMessageFromRealtimePayload(payload: unknown): MessageItem | null {
  const record = asRecord(payload);

  if (!record) {
    return null;
  }

  const messageRecord = asRecord(record.message);

  if (messageRecord) {
    return normalizeMessage(messageRecord, 0);
  }

  const messageId = readString(record.messageId) ?? readString(record.id);

  if (
    messageId &&
    (readString(record.content) ||
      readString(record.text) ||
      Array.isArray(record.reactions) ||
      readString(record.createdAt) ||
      readString(record.sentAt))
  ) {
    return normalizeMessage({ ...record, id: messageId }, 0);
  }

  return null;
}

export type ReactionEventPatch = {
  messageId: string;
  message: MessageItem | null;
  reactions: MessageReaction[] | null;
  addedReaction: MessageReaction | null;
  removedReaction: { emoji: string; userId: string } | null;
};

export function isReactionEvent(type: string): boolean {
  return type.toLowerCase().includes('reaction');
}

export function extractReactionEvent(payload: unknown): ReactionEventPatch | null {
  const record = asRecord(payload);

  if (!record) {
    return null;
  }

  const message = extractMessageFromRealtimePayload(payload);

  if (message) {
    return {
      messageId: message.id,
      message,
      reactions: message.reactions.length > 0 ? message.reactions : null,
      addedReaction: null,
      removedReaction: null,
    };
  }

  const messageId =
    readString(record.messageId) ??
    readString(asRecord(record.message)?.id) ??
    readString(record.id);

  if (!messageId) {
    return null;
  }

  const user = asRecord(record.user) ?? asRecord(record.sender);
  const emoji = readString(record.emoji) ?? readString(record.reaction);
  const userId =
    readString(record.userId) ??
    readString(user?.id) ??
    readString(user?.userId);
  const username =
    readString(record.username) ??
    readString(user?.username) ??
    readString(user?.name) ??
    readString(user?.displayName) ??
    '';
  const action = String(record.action ?? record.event ?? record.type ?? '').toLowerCase();
  const removed =
    record.removed === true ||
    action.includes('remove') ||
    action.includes('delete') ||
    action.includes('unreact');

  if (Array.isArray(record.reactions)) {
    return {
      messageId,
      message: null,
      reactions: parseMessageReactions(record.reactions),
      addedReaction: null,
      removedReaction: null,
    };
  }

  if (removed && emoji && userId) {
    return {
      messageId,
      message: null,
      reactions: null,
      addedReaction: null,
      removedReaction: { emoji, userId },
    };
  }

  if (emoji && userId) {
    return {
      messageId,
      message: null,
      reactions: null,
      addedReaction: { emoji, userId, username },
      removedReaction: null,
    };
  }

  return null;
}

export function isNewMessageEvent(type: string): boolean {
  const normalized = type.toLowerCase();

  if (
    normalized === 'message' ||
    normalized === 'message.created' ||
    normalized === 'message.new' ||
    normalized === 'message_created' ||
    normalized === 'new_message' ||
    normalized === 'newmessage'
  ) {
    return true;
  }

  return (
    normalized.includes('message') &&
    (normalized.includes('new') ||
      normalized.includes('create') ||
      normalized.includes('created') ||
      normalized.includes('sent') ||
      normalized.includes('insert') ||
      normalized.includes('received'))
  );
}

export function isMessageUpdateEvent(type: string): boolean {
  const normalized = type.toLowerCase();

  return (
    normalized.includes('message') &&
    (normalized.includes('update') ||
      normalized.includes('edit') ||
      normalized.includes('reaction') ||
      normalized.includes('pin'))
  );
}

export function isMessageDeleteEvent(type: string): boolean {
  const normalized = type.toLowerCase();

  return normalized.includes('message') && normalized.includes('delete');
}

export function isConversationUpdateEvent(type: string): boolean {
  const normalized = type.toLowerCase();

  return normalized.includes('conversation') || normalized.includes('chat');
}

export function isUnreadUpdateEvent(type: string): boolean {
  const normalized = type.toLowerCase();

  return normalized.includes('unread') || normalized.includes('notification');
}

export function isPresenceEvent(type: string): boolean {
  const normalized = type.toLowerCase();

  return normalized === 'presence' || normalized.includes('presence');
}

export function extractPresenceUpdate(
  payload: unknown,
): { userId: string; status: string } | null {
  const record = asRecord(payload);

  if (!record) {
    return null;
  }

  const nested = asRecord(record.presence) ?? asRecord(record.user);
  const userId =
    readString(record.userId) ??
    readString(nested?.id) ??
    readString(record.id);
  const status =
    readString(record.status) ??
    readString(record.presence) ??
    readString(nested?.status);

  if (!userId || !status) {
    return null;
  }

  return { userId, status };
}

export function isTypingEvent(type: string): boolean {
  const normalized = type.toLowerCase();

  return normalized === 'typing' || normalized.includes('typing');
}

export function extractConversationIdFromChannel(channel: string | null): string | null {
  if (!channel) {
    return null;
  }

  const conversationMatch = channel.match(/conversation[:/][^:/]+/i);

  if (conversationMatch) {
    const id = conversationMatch[0].split(/[:/]/).pop();
    return id && id.length > 8 ? id : null;
  }

  const parts = channel.split(':');
  const last = parts[parts.length - 1];

  if (last && last.length > 12 && /^c[a-z0-9]+$/i.test(last)) {
    return last;
  }

  return null;
}

export function isTypingChannelEvent(rawEvent: unknown): boolean {
  const record = asRecord(rawEvent);

  if (!record) {
    return false;
  }

  const channel = readString(record.channel);

  return Boolean(channel?.includes('typing'));
}

export function extractTypingUpdate(
  payload: unknown,
  fallbackConversationId?: string | null,
  rawEvent?: unknown,
): { userId: string; conversationId: string; username: string | null; isTyping: boolean } | null {
  const record = asRecord(payload);

  if (!record) {
    return null;
  }

  const userId =
    readString(record.userId) ??
    readString(record.id) ??
    readString(asRecord(record.user)?.id);

  const rawRecord = asRecord(rawEvent);
  const channelConversationId = extractConversationIdFromChannel(
    rawRecord ? readString(rawRecord.channel) : null,
  );

  const conversationId =
    readString(record.conversationId) ??
    readString(record.channelId) ??
    readString(record.chatId) ??
    channelConversationId ??
    fallbackConversationId ??
    null;

  if (!userId || !conversationId) {
    return null;
  }

  const isTyping =
    record.isTyping === true ||
    record.typing === true ||
    (record.isTyping !== false &&
      record.typing !== false &&
      record.stopped !== true &&
      record.action !== 'stop');

  return {
    userId,
    conversationId,
    username:
      readString(record.username) ??
      readString(asRecord(record.user)?.username) ??
      readString(asRecord(record.user)?.name) ??
      readString(record.name),
    isTyping,
  };
}
