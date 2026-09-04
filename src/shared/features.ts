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

    if (value && typeof value === 'object') {
      return [value];
    }
  }

  return [];
}

export type SavedMessageItem = {
  id: string;
  content: string;
  source: string;
  createdAt: string;
  conversationId: string | null;
  messageId: string | null;
};

export type FileItem = {
  id: string;
  name: string;
  sharedBy: string;
  conversationName: string;
  createdAt: string;
  filter: string;
};

export type CalendarEventItem = {
  id: string;
  title: string;
  startsAt: string;
  description: string;
};

export type ChannelItem = {
  id: string;
  name: string;
  memberCount: number;
  description: string;
};

export type HubInviteItem = {
  id: string;
  channelId: string;
  channelName: string;
  invitedBy: string;
  createdAt: string;
};

export type FriendItem = {
  id: string;
  name: string;
  username: string;
  status: string | null;
};

export function normalizeSavedMessages(payload: unknown): SavedMessageItem[] {
  return extractArray(payload, ['saved', 'items', 'messages', 'data'])
    .map(asRecord)
    .filter((item): item is Record<string, unknown> => item !== null)
    .map((record, index) => {
      const message = asRecord(record.message);
      const sender = message ? asRecord(message.sender) : null;
      const conversationTitle = readString(record.conversationTitle);
      const senderName = sender ? readString(sender.username) ?? readString(sender.name) : null;

      let source = 'Unknown';

      if (conversationTitle && senderName) {
        source = `${conversationTitle} · ${senderName}`;
      } else if (conversationTitle) {
        source = conversationTitle;
      } else if (senderName) {
        source = senderName;
      }

      return {
        id: readString(record.id) ?? `saved-${index}`,
        content:
          (message ? readString(message.content) : null) ??
          readString(record.content) ??
          readString(record.text) ??
          readString(record.preview) ??
          '',
        source,
        createdAt: readString(record.savedAt) ?? readString(record.createdAt) ?? '',
        conversationId:
          readString(record.conversationId) ??
          (message ? readString(message.conversationId) : null),
        messageId: message ? readString(message.id) : null,
      };
    });
}

export function normalizeFiles(payload: unknown): FileItem[] {
  return extractArray(payload, ['files', 'items', 'data'])
    .map(asRecord)
    .filter((item): item is Record<string, unknown> => item !== null)
    .map((record, index) => ({
      id: readString(record.id) ?? `file-${index}`,
      name: readString(record.name) ?? readString(record.fileName) ?? 'File',
      sharedBy:
        readString(record.sharedBy) ??
        readString(asRecord(record.user)?.name) ??
        'Unknown',
      conversationName:
        readString(record.conversationName) ??
        readString(record.channelName) ??
        readString(record.hubName) ??
        '',
      createdAt: readString(record.createdAt) ?? '',
      filter: readString(record.filter) ?? readString(record.type) ?? 'all',
    }));
}

export function normalizeCalendarEvents(payload: unknown): CalendarEventItem[] {
  return extractArray(payload, ['events', 'items', 'data'])
    .map(asRecord)
    .filter((item): item is Record<string, unknown> => item !== null)
    .map((record, index) => ({
      id: readString(record.id) ?? `event-${index}`,
      title: readString(record.title) ?? readString(record.name) ?? 'Event',
      startsAt:
        readString(record.startsAt) ??
        readString(record.startAt) ??
        readString(record.date) ??
        '',
      description: readString(record.description) ?? '',
    }));
}

export function normalizeChannels(payload: unknown): ChannelItem[] {
  return extractArray(payload, ['channels', 'hubs', 'items', 'data'])
    .map(asRecord)
    .filter((item): item is Record<string, unknown> => item !== null)
    .map((record, index) => ({
      id: readString(record.id) ?? readString(record.channelId) ?? `channel-${index}`,
      name: readString(record.name) ?? readString(record.title) ?? 'Hub',
      memberCount: typeof record.memberCount === 'number' ? record.memberCount : 0,
      description: readString(record.description) ?? '',
    }));
}

export function normalizeHubInvites(payload: unknown): HubInviteItem[] {
  return extractArray(payload, ['invites', 'items', 'data'])
    .map(asRecord)
    .filter((item): item is Record<string, unknown> => item !== null)
    .map((record, index) => {
      const channel = asRecord(record.channel) ?? record;

      return {
        id: readString(record.id) ?? `invite-${index}`,
        channelId:
          readString(record.channelId) ??
          readString(channel.id) ??
          '',
        channelName:
          readString(record.channelName) ??
          readString(channel.name) ??
          'Hub',
        invitedBy:
          readString(record.invitedBy) ??
          readString(asRecord(record.inviter)?.name) ??
          'Someone',
        createdAt: readString(record.createdAt) ?? '',
      };
    });
}

export function normalizeFriends(payload: unknown): FriendItem[] {
  return extractArray(payload, ['friends', 'items', 'data'])
    .map(asRecord)
    .filter((item): item is Record<string, unknown> => item !== null)
    .map((record, index) => {
      const user = asRecord(record.user) ?? record;

      return {
        id: readString(record.id) ?? readString(user.id) ?? `friend-${index}`,
        name:
          readString(user.name) ??
          readString(user.displayName) ??
          readString(user.username) ??
          'Friend',
        username: readString(user.username) ?? '',
        status: readString(user.status) ?? readString(user.presence),
      };
    });
}
