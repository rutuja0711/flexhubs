import { normalizeMessage, type MessageItem } from './messages';

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
    readString(asRecord(record.message)?.conversationId)
  );
}

export function extractMessageFromRealtimePayload(payload: unknown): MessageItem | null {
  const record = asRecord(payload);

  if (!record) {
    return null;
  }

  const messageRecord =
    asRecord(record.message) ??
    (readString(record.id) && (readString(record.content) ?? readString(record.text)) ? record : null);

  if (!messageRecord) {
    return null;
  }

  return normalizeMessage(messageRecord, 0);
}

export function isNewMessageEvent(type: string): boolean {
  const normalized = type.toLowerCase();

  if (normalized === 'message' || normalized === 'message.created') {
    return true;
  }

  return (
    normalized.includes('message') &&
    (normalized.includes('new') ||
      normalized.includes('create') ||
      normalized.includes('created') ||
      normalized.includes('sent') ||
      normalized.includes('insert'))
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
  return type.toLowerCase() === 'presence';
}

export function extractPresenceUpdate(
  payload: unknown,
): { userId: string; status: string } | null {
  const record = asRecord(payload);

  if (!record) {
    return null;
  }

  const userId = readString(record.userId);
  const status = readString(record.status);

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
): { userId: string; conversationId: string; username: string | null; isTyping: boolean } | null {
  const record = asRecord(payload);

  if (!record) {
    return null;
  }

  const userId =
    readString(record.userId) ??
    readString(record.id) ??
    readString(asRecord(record.user)?.id);

  const conversationId =
    readString(record.conversationId) ??
    readString(record.channelId) ??
    readString(record.chatId) ??
    fallbackConversationId ??
    null;

  if (!userId || !conversationId) {
    return null;
  }

  const isTyping =
    record.isTyping === true ||
    record.typing === true ||
    (record.isTyping !== false && record.typing !== false && record.stopped !== true);

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
