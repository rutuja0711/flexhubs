function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  return value as Record<string, unknown>;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export type MessageReaction = {
  emoji: string;
  userId: string;
  username: string;
};

export type MessageItem = {
  id: string;
  content: string;
  senderId: string | null;
  senderName: string;
  senderInitials: string;
  createdAt: string;
  editedAt: string | null;
  pinnedAt: string | null;
  isOwn: boolean;
  status: 'sent' | 'seen' | null;
  reactions: MessageReaction[];
  replyToMessageId?: string;
  replyToMessage?: MessageItem;
};

export type ConversationBootstrap = {
  conversation: Record<string, unknown> | null;
  messages: MessageItem[];
  pinnedMessageIds: string[];
};

export type MessageDraft = {
  content: string;
};

export type NotificationItem = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  type: string;
  conversationId: string | null;
  channelId: string | null;
};

export type PendingFriendItem = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
};

export type TeammateItem = {
  id: string;
  name: string;
  username: string;
  avatarUrl: string | null;
  initials: string;
  statusMessage: string;
};

function initialsFromName(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return name.slice(0, 2).toUpperCase();
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

function normalizeReactions(value: unknown): MessageReaction[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(asRecord)
    .filter((item): item is Record<string, unknown> => item !== null)
    .map((record) => ({
      emoji: readString(record.emoji) ?? '👍',
      userId: readString(record.userId) ?? '',
      username: readString(record.username) ?? '',
    }))
    .filter((reaction) => reaction.userId);
}

export function groupMessageReactions(
  reactions: MessageReaction[],
  currentUserId: string | null,
): { emoji: string; count: number; reactedByMe: boolean }[] {
  const groups = new Map<string, { count: number; reactedByMe: boolean }>();

  for (const reaction of reactions) {
    const existing = groups.get(reaction.emoji) ?? { count: 0, reactedByMe: false };
    groups.set(reaction.emoji, {
      count: existing.count + 1,
      reactedByMe: existing.reactedByMe || reaction.userId === currentUserId,
    });
  }

  return Array.from(groups.entries()).map(([emoji, data]) => ({
    emoji,
    ...data,
  }));
}

export function normalizeMessage(record: Record<string, unknown>, index: number): MessageItem {
  const sender = asRecord(record.sender) ?? asRecord(record.user) ?? asRecord(record.author);
  const senderName =
    readString(record.senderName) ??
    (sender ? readString(sender.name) ?? readString(sender.displayName) ?? readString(sender.username) : null) ??
    'Unknown';

  const content =
    readString(record.content) ??
    readString(record.text) ??
    readString(record.body) ??
    readString(record.message) ??
    '';

  const statusRaw = String(record.status ?? record.deliveryStatus ?? '').toLowerCase();
  let status: MessageItem['status'] = null;

  if (statusRaw.includes('seen') || statusRaw.includes('read')) {
    status = 'seen';
  } else if (statusRaw.includes('sent') || statusRaw.includes('delivered')) {
    status = 'sent';
  }

  return {
    id: readString(record.id) ?? readString(record.messageId) ?? `message-${index}`,
    content,
    senderId: sender ? readString(sender.id) : readString(record.senderId),
    senderName,
    senderInitials: initialsFromName(senderName),
    createdAt:
      readString(record.createdAt) ??
      readString(record.sentAt) ??
      readString(record.timestamp) ??
      '',
    editedAt: readString(record.editedAt),
    pinnedAt: readString(record.pinnedAt),
    isOwn: record.isOwn === true || record.isMine === true || record.mine === true,
    status,
    reactions: normalizeReactions(record.reactions),
    replyToMessageId: readString(record.replyToId) ?? readString(record.replyToMessageId) ?? undefined,
    replyToMessage: record.replyTo ? normalizeMessage(asRecord(record.replyTo) ?? {}, 0) : record.replyToMessage ? normalizeMessage(asRecord(record.replyToMessage) ?? {}, 0) : undefined,
  };
}

export function extractMessageFromPayload(payload: unknown): Record<string, unknown> | null {
  const record = asRecord(payload);

  if (!record) {
    return null;
  }

  if (asRecord(record.message)) {
    return asRecord(record.message);
  }

  return record;
}

export function normalizeBootstrap(payload: unknown): ConversationBootstrap {
  const record = asRecord(payload);
  const messagesRaw = extractArray(payload, ['messages', 'items']).length
    ? extractArray(payload, ['messages', 'items'])
    : extractArray(record?.messages, ['items', 'data']);

  const pinnedRaw = extractArray(record?.pinned ?? record?.pinnedMessages, ['items', 'messages']);

  const conversation =
    asRecord(record?.conversation) ??
    asRecord(record?.chat) ??
    (record && !Array.isArray(record.messages) ? record : null);

  return {
    conversation,
    messages: messagesRaw
      .map(asRecord)
      .filter((item): item is Record<string, unknown> => item !== null)
      .map(normalizeMessage),
    pinnedMessageIds: pinnedRaw
      .map((item) => {
        if (typeof item === 'string') {
          return item;
        }

        const pinnedRecord = asRecord(item);
        return pinnedRecord ? readString(pinnedRecord.id) : null;
      })
      .filter((item): item is string => Boolean(item)),
  };
}

export function normalizeMessageThread(payload: unknown): MessageItem[] {
  const items = extractArray(payload, ['messages', 'items', 'data', 'thread']);
  return items
    .map(asRecord)
    .filter((item): item is Record<string, unknown> => item !== null)
    .map((item) => normalizeMessage(item, 0));
}

export function normalizeDraft(payload: unknown): MessageDraft {
  const record = asRecord(payload);

  if (!record) {
    return { content: '' };
  }

  const draft = asRecord(record.draft);

  return {
    content:
      readString(record.content) ??
      readString(record.text) ??
      (draft ? readString(draft.content) ?? readString(draft.text) : null) ??
      '',
  };
}

export function normalizeNotifications(payload: unknown): NotificationItem[] {
  return extractArray(payload, ['notifications', 'items', 'data'])
    .map(asRecord)
    .filter((item): item is Record<string, unknown> => item !== null)
    .map((record, index) => {
      const data = asRecord(record.data) ?? asRecord(record.metadata);
      const conversation = asRecord(record.conversation) ?? asRecord(data?.conversation);
      const channel = asRecord(record.channel) ?? asRecord(data?.channel);

      return {
        id: readString(record.id) ?? `notification-${index}`,
        title: readString(record.title) ?? readString(record.type) ?? 'Notification',
        body:
          readString(record.body) ??
          readString(record.message) ??
          readString(record.preview) ??
          readString(record.text) ??
          '',
        createdAt: readString(record.createdAt) ?? readString(record.timestamp) ?? '',
        type: readString(record.type) ?? 'notification',
        conversationId:
          readString(record.conversationId) ??
          (conversation ? readString(conversation.id) : null) ??
          (data ? readString(data.conversationId) : null) ??
          readString(record.targetConversationId) ??
          null,
        channelId:
          readString(record.channelId) ??
          (channel ? readString(channel.id) : null) ??
          (data ? readString(data.channelId) : null) ??
          null,
      };
    });
}

export function resolveNotificationConversationId(
  notification: NotificationItem,
  conversations: import('./chat').ConversationItem[],
): string | null {
  if (notification.conversationId) {
    const directMatch = conversations.find(
      (conversation) => conversation.id === notification.conversationId,
    );

    if (directMatch) {
      return directMatch.id;
    }
  }

  if (notification.channelId) {
    const channelMatch = conversations.find(
      (conversation) => conversation.id === notification.channelId,
    );

    if (channelMatch) {
      return channelMatch.id;
    }
  }

  const haystack = `${notification.title} ${notification.body}`.toLowerCase();

  const titleMatch = conversations.find((conversation) => {
    const title = conversation.title.toLowerCase();
    return title.length > 1 && haystack.includes(title);
  });

  if (titleMatch) {
    return titleMatch.id;
  }

  return notification.conversationId ?? notification.channelId;
}

export function normalizePendingFriends(payload: unknown): PendingFriendItem[] {
  return extractArray(payload, ['requests', 'pending', 'items', 'data'])
    .map(asRecord)
    .filter((item): item is Record<string, unknown> => item !== null)
    .map((record, index) => {
      const user = asRecord(record.user) ?? asRecord(record.fromUser) ?? record;
      const name =
        readString(user.name) ??
        readString(user.displayName) ??
        readString(user.username) ??
        'Someone';

      return {
        id: readString(record.id) ?? readString(user.id) ?? `friend-${index}`,
        title: 'Friend request',
        body: `${name} sent you a friend request.`,
        createdAt: readString(record.createdAt) ?? readString(record.timestamp) ?? '',
      };
    });
}

export function normalizeTeammates(payload: unknown): TeammateItem[] {
  return extractArray(payload, ['members', 'users', 'items', 'data'])
    .map(asRecord)
    .filter((item): item is Record<string, unknown> => item !== null)
    .map((record, index) => {
      const name =
        readString(record.name) ??
        readString(record.displayName) ??
        readString(record.username) ??
        'Teammate';

      return {
        id: readString(record.id) ?? readString(record.userId) ?? `member-${index}`,
        name,
        username: readString(record.username) ?? '',
        avatarUrl: readString(record.avatarUrl) ?? readString(record.avatar),
        initials: initialsFromName(name),
        statusMessage:
          readString(record.statusMessage) ??
          readString(record.status) ??
          readString(record.bio) ??
          '',
      };
    });
}

export function validateMessageDraft(content: string): { ok: true } | { ok: false; error: string } {
  if (content.length > 4000) {
    return { ok: false, error: 'Message must be 4000 characters or fewer.' };
  }

  return { ok: true };
}
