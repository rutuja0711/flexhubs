export type ConversationKind = 'direct' | 'hub';

export type PresenceStatus = 'online' | 'away' | 'dnd' | 'offline';

export type ConversationItem = {
  id: string;
  kind: ConversationKind;
  title: string;
  subtitle: string;
  timestamp: string;
  avatarUrl: string | null;
  avatarInitials: string;
  isPinned: boolean;
  isSelf: boolean;
  status: PresenceStatus | null;
  unreadCount: number;
};

export type ConversationsPayload = {
  conversations: ConversationItem[];
};

export type UnreadCountPayload = {
  count: number;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  return value as Record<string, unknown>;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function initialsFromName(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return name.slice(0, 2).toUpperCase();
}

function inferKind(record: Record<string, unknown>): ConversationKind {
  const type = String(record.type ?? record.kind ?? record.conversationType ?? '').toUpperCase();

  if (
    type.includes('HUB') ||
    type.includes('CHANNEL') ||
    type.includes('GROUP') ||
    record.isHub === true ||
    record.isChannel === true ||
    record.isGroup === true
  ) {
    return 'hub';
  }

  return 'direct';
}

function inferPresence(record: Record<string, unknown>): PresenceStatus | null {
  const status = String(record.status ?? record.presence ?? record.userStatus ?? '').toLowerCase();

  if (status.includes('online') || status === 'available') {
    return 'online';
  }

  if (status.includes('away') || status.includes('idle')) {
    return 'away';
  }

  if (status.includes('dnd') || status.includes('busy')) {
    return 'dnd';
  }

  if (status.includes('offline')) {
    return 'offline';
  }

  return null;
}

function readLastMessagePreview(record: Record<string, unknown>): string {
  const lastMessage = asRecord(record.lastMessage) ?? asRecord(record.latestMessage);

  if (lastMessage) {
    const content =
      readString(lastMessage.content) ??
      readString(lastMessage.text) ??
      readString(lastMessage.body) ??
      readString(lastMessage.preview);

    if (content) {
      const sender =
        readString(asRecord(lastMessage.sender)?.name) ??
        readString(asRecord(lastMessage.user)?.name) ??
        readString(lastMessage.senderName);

      return sender ? `${sender}: ${content}` : content;
    }
  }

  return (
    readString(record.preview) ??
    readString(record.lastMessagePreview) ??
    readString(record.subtitle) ??
    ''
  );
}

function readConversationTitle(record: Record<string, unknown>): string {
  const directName =
    readString(record.name) ??
    readString(record.title) ??
    readString(record.displayName);

  if (directName) {
    return directName;
  }

  const participants = Array.isArray(record.participants) ? record.participants : [];
  const members = Array.isArray(record.members) ? record.members : [];
  const people = [...participants, ...members];
  const member = people.map(asRecord).find(Boolean);
  const memberRecord = member ?? null;

  if (memberRecord) {
    return (
      readString(memberRecord.name) ??
      readString(memberRecord.displayName) ??
      readString(memberRecord.username) ??
      'Conversation'
    );
  }

  return 'Conversation';
}

function readConversationId(record: Record<string, unknown>, index: number): string {
  const id =
    readString(record.id) ??
    readString(record.conversationId) ??
    readString(record._id);

  return id ?? `conversation-${index}`;
}

function readAvatar(record: Record<string, unknown>): { url: string | null; initials: string } {
  const title = readConversationTitle(record);
  const url =
    readString(record.avatarUrl) ??
    readString(record.avatar) ??
    readString(record.imageUrl);

  if (url) {
    return { url, initials: initialsFromName(title) };
  }

  const participants = Array.isArray(record.participants) ? record.participants : [];
  const firstParticipant = participants.map(asRecord).find(Boolean);

  if (firstParticipant) {
    const participantUrl =
      readString(firstParticipant.avatarUrl) ??
      readString(firstParticipant.avatar);

    const participantName =
      readString(firstParticipant.name) ??
      readString(firstParticipant.displayName) ??
      title;

    return {
      url: participantUrl,
      initials: initialsFromName(participantName),
    };
  }

  return { url: null, initials: initialsFromName(title) };
}

function readTimestamp(record: Record<string, unknown>): string {
  const lastMessage = asRecord(record.lastMessage) ?? asRecord(record.latestMessage);

  return (
    readString(record.updatedAt) ??
    readString(record.lastMessageAt) ??
    readString(lastMessage?.createdAt) ??
    readString(record.createdAt) ??
    ''
  );
}

export function extractConversationRecords(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) {
    return payload.map(asRecord).filter((item): item is Record<string, unknown> => item !== null);
  }

  const record = asRecord(payload);

  if (!record) {
    return [];
  }

  for (const key of ['conversations', 'data', 'items', 'results']) {
    const value = record[key];

    if (Array.isArray(value)) {
      return value.map(asRecord).filter((item): item is Record<string, unknown> => item !== null);
    }
  }

  return [];
}

export function normalizeConversation(
  record: Record<string, unknown>,
  index: number,
): ConversationItem {
  const title = readConversationTitle(record);
  const avatar = readAvatar(record);

  return {
    id: readConversationId(record, index),
    kind: inferKind(record),
    title,
    subtitle: readLastMessagePreview(record),
    timestamp: readTimestamp(record),
    avatarUrl: avatar.url,
    avatarInitials: avatar.initials,
    isPinned: record.isPinned === true || record.pinned === true,
    isSelf: record.isSelf === true || record.isYourself === true || title.toLowerCase().includes('yourself'),
    status: inferPresence(record),
    unreadCount: readNumber(record.unreadCount) ?? readNumber(record.unread) ?? 0,
  };
}

export function normalizeConversations(payload: unknown): ConversationItem[] {
  return extractConversationRecords(payload).map(normalizeConversation);
}

export function normalizeUnreadCount(payload: unknown): number {
  if (typeof payload === 'number') {
    return payload;
  }

  const record = asRecord(payload);

  if (!record) {
    return 0;
  }

  return (
    readNumber(record.count) ??
    readNumber(record.unreadCount) ??
    readNumber(record.total) ??
    0
  );
}

export function validateSearchQuery(query: string): { ok: true; value: string } | { ok: false; error: string } {
  const trimmed = query.trim();

  if (trimmed.length > 120) {
    return { ok: false, error: 'Search must be 120 characters or fewer.' };
  }

  return { ok: true, value: trimmed };
}
