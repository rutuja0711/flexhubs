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

export type MessageMediaKind = 'gif' | 'sticker' | 'image' | 'file';

export type MessageMedia = {
  kind: MessageMediaKind;
  url: string;
  previewUrl: string | null;
  name: string | null;
};

export type PollOptionItem = {
  id: string;
  text: string;
  voteCount: number;
  votedByMe: boolean;
};

export type MessagePoll = {
  question: string;
  options: PollOptionItem[];
  allowMultiple: boolean;
  totalVotes: number;
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
  messageType: string | null;
  media: MessageMedia[];
  deletedForEveryone: boolean;
  poll: MessagePoll | null;
};

export const DELETED_MESSAGE_TEXT = 'This message was deleted.';

export function isDeletedMessage(
  message: Pick<MessageItem, 'content' | 'deletedForEveryone'>,
): boolean {
  return message.deletedForEveryone || message.content.trim() === DELETED_MESSAGE_TEXT;
}

export type ConversationBootstrap = {
  conversation: Record<string, unknown> | null;
  messages: MessageItem[];
  pinnedMessageIds: string[];
  isFavorite: boolean;
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
  isRead: boolean;
  conversationId: string | null;
  channelId: string | null;
  eventId: string | null;
  messageId: string | null;
  scheduledMessageId: string | null;
  link: string | null;
};

export type NotificationAction =
  | { kind: 'calendar'; eventId: string | null }
  | { kind: 'chat'; conversationId: string; messageId: string | null }
  | { kind: 'none' };

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

  const reactions: MessageReaction[] = [];

  for (const entry of value) {
    const record = asRecord(entry);

    if (!record) {
      continue;
    }

    const user = asRecord(record.user) ?? asRecord(record.sender);
    const emoji = readString(record.emoji) ?? readString(record.reaction) ?? '👍';
    const userId =
      readString(record.userId) ??
      readString(user?.id) ??
      readString(user?.userId) ??
      '';
    const username =
      readString(record.username) ??
      readString(user?.username) ??
      readString(user?.name) ??
      readString(user?.displayName) ??
      '';

    if (userId) {
      reactions.push({ emoji, userId, username });
      continue;
    }

    const nestedUsers = Array.isArray(record.users) ? record.users : [];

    for (const nestedUser of nestedUsers) {
      const userRecord = asRecord(nestedUser);
      if (!userRecord) {
        continue;
      }

      const nestedUserId =
        readString(userRecord.id) ??
        readString(userRecord.userId) ??
        '';

      if (nestedUserId) {
        reactions.push({
          emoji,
          userId: nestedUserId,
          username:
            readString(userRecord.username) ??
            readString(userRecord.name) ??
            readString(userRecord.displayName) ??
            '',
        });
      }
    }
  }

  return reactions;
}

export function applyReactionPatch(
  message: MessageItem,
  patch: {
    incoming?: MessageItem;
    reactions?: MessageReaction[];
    addedReaction?: MessageReaction | null;
    removedReaction?: { emoji: string; userId: string } | null;
  },
): MessageItem {
  if (patch.incoming) {
    return mergeMessageUpdates(message, patch.incoming);
  }

  if (patch.reactions) {
    return { ...message, reactions: patch.reactions };
  }

  if (patch.addedReaction) {
    const withoutDuplicate = message.reactions.filter(
      (reaction) =>
        !(
          reaction.userId === patch.addedReaction!.userId &&
          reaction.emoji === patch.addedReaction!.emoji
        ),
    );

    return { ...message, reactions: [...withoutDuplicate, patch.addedReaction] };
  }

  if (patch.removedReaction) {
    return {
      ...message,
      reactions: message.reactions.filter(
        (reaction) =>
          !(
            reaction.userId === patch.removedReaction!.userId &&
            reaction.emoji === patch.removedReaction!.emoji
          ),
      ),
    };
  }

  return message;
}

export function mergeMessageUpdates(previous: MessageItem, incoming: MessageItem): MessageItem {
  return {
    ...previous,
    ...incoming,
    content: incoming.content || previous.content,
    senderName: incoming.senderName !== 'Unknown' ? incoming.senderName : previous.senderName,
    senderId: incoming.senderId ?? previous.senderId,
    reactions: incoming.reactions.length > 0 ? incoming.reactions : previous.reactions,
    media: incoming.media.length > 0 ? incoming.media : previous.media,
    status: incoming.status ?? previous.status,
    poll: incoming.poll ?? previous.poll,
  };
}

export function parseMessageReactions(value: unknown): MessageReaction[] {
  return normalizeReactions(value);
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

function normalizeMediaKind(value: unknown, fallback: MessageMediaKind = 'image'): MessageMediaKind {
  const normalized = String(value ?? '').toLowerCase();

  if (normalized.includes('sticker')) {
    return 'sticker';
  }

  if (normalized.includes('gif')) {
    return 'gif';
  }

  if (normalized.includes('image') || normalized.includes('photo')) {
    return 'image';
  }

  return fallback;
}

function isLikelyMediaUrl(url: string): boolean {
  if (!/^https?:\/\//i.test(url)) {
    return false;
  }

  if (/\.(gif|webp|png|jpe?g|bmp|svg)(\?|$)/i.test(url)) {
    return true;
  }

  return /giphy\.com|tenor\.com|media\.tenor|media\d?\.giphy|klipy\.com|imgur\.com|flexhubs\.in\/api\/files|flexhubs\.in\/uploads|cloudinary|amazonaws\.com/i.test(
    url,
  );
}

function readMediaFromObject(
  record: Record<string, unknown>,
  fallbackKind: MessageMediaKind = 'image',
): MessageMedia | null {
  const url =
    readString(record.url) ??
    readString(record.fileUrl) ??
    readString(record.src) ??
    readString(record.href) ??
    readString(record.mediaUrl) ??
    readString(record.imageUrl) ??
    readString(record.originalUrl) ??
    readString(record.fullUrl);

  if (!url || !isLikelyMediaUrl(url)) {
    return null;
  }

  const kind = normalizeMediaKind(
    record.type ?? record.kind ?? record.mediaType ?? record.mimeType ?? record.contentType,
    fallbackKind,
  );

  return {
    kind,
    url,
    previewUrl:
      readString(record.previewUrl) ??
      readString(record.thumbnailUrl) ??
      readString(record.thumbUrl) ??
      readString(record.preview) ??
      null,
    name: readString(record.name) ?? readString(record.fileName) ?? readString(record.title),
  };
}

function extractMessageMedia(record: Record<string, unknown>, content: string): MessageMedia[] {
  if (readString(record.deletedForEveryoneAt)) {
    return [];
  }

  const media: MessageMedia[] = [];
  const seen = new Set<string>();

  const pushMedia = (item: MessageMedia | null) => {
    if (!item || seen.has(item.url)) {
      return;
    }

    seen.add(item.url);
    media.push(item);
  };

  for (const key of ['attachments', 'files', 'media', 'embeds', 'assets']) {
    const value = record[key];

    if (Array.isArray(value)) {
      for (const entry of value) {
        const entryRecord = asRecord(entry);
        if (entryRecord) {
          pushMedia(readMediaFromObject(entryRecord));
        }
      }
    } else {
      const nested = asRecord(value);
      if (nested) {
        pushMedia(readMediaFromObject(nested));
      }
    }
  }

  for (const key of ['gif', 'sticker', 'image', 'media', 'attachment']) {
    const nested = asRecord(record[key]);
    if (nested) {
      pushMedia(readMediaFromObject(nested, key === 'sticker' ? 'sticker' : key === 'gif' ? 'gif' : 'image'));
    }
  }

  const metadata = asRecord(record.metadata) ?? asRecord(record.meta) ?? asRecord(record.payload);
  if (metadata) {
    pushMedia(
      readMediaFromObject(
        metadata,
        normalizeMediaKind(metadata.type ?? metadata.kind ?? record.type, 'gif'),
      ),
    );

    const metadataUrl =
      readString(metadata.url) ??
      readString(metadata.gifUrl) ??
      readString(metadata.stickerUrl) ??
      readString(metadata.mediaUrl) ??
      readString(metadata.imageUrl);

    if (metadataUrl && isLikelyMediaUrl(metadataUrl)) {
      pushMedia({
        kind: normalizeMediaKind(metadata.type ?? metadata.kind ?? record.type, 'gif'),
        url: metadataUrl,
        previewUrl: readString(metadata.previewUrl) ?? readString(metadata.thumbnailUrl),
        name: readString(metadata.name),
      });
    }
  }

  const topLevelUrl =
    readString(record.mediaUrl) ??
    readString(record.gifUrl) ??
    readString(record.stickerUrl) ??
    readString(record.imageUrl) ??
    readString(record.attachmentUrl) ??
    readString(record.fileUrl);

  if (topLevelUrl && isLikelyMediaUrl(topLevelUrl)) {
    pushMedia({
      kind: normalizeMediaKind(record.type ?? record.messageType ?? record.kind, 'gif'),
      url: topLevelUrl,
      previewUrl: readString(record.previewUrl) ?? readString(record.thumbnailUrl),
      name: readString(record.name) ?? readString(record.fileName),
    });
  }

  const trimmedContent = content.trim();
  const jsonContent = trimmedContent.startsWith('{')
    ? (() => {
        try {
          return asRecord(JSON.parse(trimmedContent));
        } catch {
          return null;
        }
      })()
    : null;

  if (jsonContent) {
    pushMedia(readMediaFromObject(jsonContent, normalizeMediaKind(jsonContent.type, 'gif')));
  }

  if (trimmedContent && isLikelyMediaUrl(trimmedContent)) {
    pushMedia({
      kind: normalizeMediaKind(record.type ?? record.messageType ?? record.kind, 'gif'),
      url: trimmedContent,
      previewUrl: null,
      name: null,
    });
  }

  const markdownImage = trimmedContent.match(/^!\[[^\]]*]\((https?:\/\/[^)]+)\)$/i);
  if (markdownImage?.[1]) {
    pushMedia({
      kind: normalizeMediaKind(record.type ?? record.messageType, 'gif'),
      url: markdownImage[1],
      previewUrl: null,
      name: null,
    });
  }

  const fileUrl = readString(record.fileUrl);
  if (fileUrl && isLikelyMediaUrl(fileUrl)) {
    const mimeType = readString(record.mimeType)?.toLowerCase() ?? '';
    const messageType = String(record.type ?? record.messageType ?? '').toUpperCase();
    const isStickerMarker = trimmedContent === 'sticker';
    const isSticker =
      isStickerMarker ||
      (messageType === 'GIF' && (mimeType === 'image/png' || mimeType === 'image/webp'));

    pushMedia({
      kind: isSticker ? 'sticker' : messageType === 'GIF' || mimeType.includes('gif') ? 'gif' : 'image',
      url: fileUrl,
      previewUrl: readString(record.previewUrl) ?? readString(record.thumbnailUrl),
      name: readString(record.fileName) ?? readString(record.name),
    });
  }

  return media;
}

function readReplyToRecord(record: Record<string, unknown>): Record<string, unknown> | null {
  return (
    asRecord(record.replyTo) ??
    asRecord(record.replyToMessage) ??
    asRecord(record.repliedToMessage) ??
    asRecord(record.quotedMessage) ??
    asRecord(record.parentMessage)
  );
}

export function resolveReplyTarget(
  message: Pick<MessageItem, 'replyToMessageId' | 'replyToMessage'>,
  allMessages: MessageItem[],
): MessageItem | null {
  const stub = message.replyToMessage ?? null;
  const replyId = message.replyToMessageId ?? stub?.id;
  const full = replyId ? allMessages.find((item) => item.id === replyId) ?? null : null;

  if (!stub && !full) {
    return null;
  }

  if (full && (!stub || stub.media.length === 0) && full.media.length > 0) {
    return {
      ...full,
      senderName: stub?.senderName || full.senderName,
      senderId: stub?.senderId ?? full.senderId,
    };
  }

  return stub ?? full;
}

export function enrichMessageReplies(messages: MessageItem[]): MessageItem[] {
  if (messages.length === 0) {
    return messages;
  }

  const byId = new Map(messages.map((message) => [message.id, message]));

  return messages.map((message) => {
    const replyId = message.replyToMessageId ?? message.replyToMessage?.id;

    if (!replyId) {
      return message;
    }

    const full = byId.get(replyId);

    if (!full) {
      return message;
    }

    const stub = message.replyToMessage;
    const stubHasMedia = Boolean(stub?.media.length);
    const fullHasMedia = full.media.length > 0;

    if (!stub) {
      return fullHasMedia ? { ...message, replyToMessage: full } : message;
    }

    if (stubHasMedia || !fullHasMedia) {
      return message;
    }

    return {
      ...message,
      replyToMessage: {
        ...full,
        senderName: stub.senderName || full.senderName,
        senderId: stub.senderId ?? full.senderId,
      },
    };
  });
}

export function readLastReadMessageId(conversation: Record<string, unknown> | null): string | null {
  if (!conversation) {
    return null;
  }

  const membership =
    asRecord(conversation.membership) ??
    asRecord(conversation.member) ??
    asRecord(conversation.currentMember);

  return (
    readString(conversation.lastReadMessageId) ??
    readString(conversation.readUpToMessageId) ??
    readString(conversation.lastSeenMessageId) ??
    (membership ? readString(membership.lastReadMessageId) : null) ??
    (membership ? readString(membership.readUpToMessageId) : null)
  );
}

export function findFirstUnreadMessageId(
  messages: MessageItem[],
  unreadCount: number,
  lastReadMessageId: string | null,
  currentUserId: string | null,
): string | null {
  const isIncoming = (message: MessageItem) =>
    !message.isOwn && message.senderId !== currentUserId;

  if (lastReadMessageId) {
    const lastReadIndex = messages.findIndex((message) => message.id === lastReadMessageId);

    if (lastReadIndex >= 0) {
      for (let index = lastReadIndex + 1; index < messages.length; index += 1) {
        if (isIncoming(messages[index])) {
          return messages[index].id;
        }
      }

      return null;
    }
  }

  if (unreadCount <= 0) {
    return null;
  }

  let remaining = unreadCount;

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];

    if (!isIncoming(message)) {
      continue;
    }

    remaining -= 1;

    if (remaining === 0) {
      return message.id;
    }
  }

  return messages.find(isIncoming)?.id ?? null;
}

export function formatMessagePreview(
  message: Pick<MessageItem, 'content' | 'media' | 'messageType' | 'deletedForEveryone'>,
): string {
  if (isDeletedMessage(message)) {
    return DELETED_MESSAGE_TEXT;
  }

  const trimmedContent =
    message.content.trim() === 'sticker' ? '' : message.content.trim();

  if (trimmedContent && message.media.length === 0) {
    return trimmedContent;
  }

  if (message.media.length > 0) {
    const primary = message.media[0];
    const label =
      primary.kind === 'sticker' ? 'Sticker' : primary.kind === 'gif' ? 'GIF' : 'Photo';
    return trimmedContent ? `${trimmedContent} (${label})` : label;
  }

  const type = String(message.messageType ?? '').toLowerCase();
  if (type.includes('sticker')) return 'Sticker';
  if (type.includes('gif')) return 'GIF';
  if (type.includes('image')) return 'Photo';

  return trimmedContent;
}

export function isMediaOnlyMessage(
  message: Pick<MessageItem, 'content' | 'media' | 'messageType' | 'deletedForEveryone'>,
): boolean {
  if (isDeletedMessage(message)) {
    return false;
  }

  const trimmedContent =
    message.content.trim() === 'sticker' ? '' : message.content.trim();

  if (trimmedContent || message.media.length === 0) {
    return false;
  }

  return message.media.every(
    (item) => item.kind === 'gif' || item.kind === 'sticker' || item.kind === 'image',
  );
}

export function isPollMessage(
  message: Pick<MessageItem, 'poll' | 'messageType'>,
): boolean {
  if (message.poll) {
    return true;
  }

  return String(message.messageType ?? '').toUpperCase() === 'POLL';
}

function normalizePollOption(
  record: Record<string, unknown> | string,
  index: number,
  myVotes: Set<string>,
): PollOptionItem | null {
  if (typeof record === 'string') {
    const id = `option-${index}`;
    return {
      id,
      text: record.trim(),
      voteCount: 0,
      votedByMe: myVotes.has(id),
    };
  }

  const text =
    readString(record.text) ??
    readString(record.label) ??
    readString(record.option) ??
    readString(record.optionText) ??
    readString(record.answer) ??
    readString(record.value) ??
    readString(record.title) ??
    readString(record.content) ??
    readString(record.name);

  if (!text) {
    return null;
  }

  const id = readString(record.id) ?? readString(record.optionId) ?? `option-${index}`;
  const countRecord = asRecord(record._count);
  const voteCount =
    typeof record.voteCount === 'number'
      ? record.voteCount
      : typeof record.votes === 'number'
        ? record.votes
        : countRecord && typeof countRecord.votes === 'number'
          ? countRecord.votes
          : Array.isArray(record.votes)
            ? record.votes.length
            : 0;

  return {
    id,
    text,
    voteCount,
    votedByMe:
      myVotes.has(id) ||
      record.votedByMe === true ||
      record.voted === true ||
      record.selected === true,
  };
}

export function normalizeMessagePoll(record: Record<string, unknown>): MessagePoll | null {
  const metadata = asRecord(record.metadata);
  const pollRecord =
    asRecord(record.poll) ??
    asRecord(record.messagePoll) ??
    asRecord(metadata?.poll) ??
    asRecord(metadata?.messagePoll);
  const messageType = String(record.type ?? record.messageType ?? '').toUpperCase();

  if (!pollRecord && messageType !== 'POLL') {
    return null;
  }

  const source = pollRecord ?? record;
  const myVoteIds = new Set<string>();
  for (const vote of [
    ...(Array.isArray(source.myVotes) ? source.myVotes : []),
    ...(Array.isArray(source.myVoteIds) ? source.myVoteIds : []),
    ...(Array.isArray(record.myVotes) ? record.myVotes : []),
  ]) {
    if (typeof vote === 'string') {
      myVoteIds.add(vote);
    } else if (vote && typeof vote === 'object') {
      const voteRecord = vote as Record<string, unknown>;
      const optionId = readString(voteRecord.optionId) ?? readString(voteRecord.id);
      if (optionId) {
        myVoteIds.add(optionId);
      }
    }
  }

  const question =
    readString(source.question) ??
    readString(source.title) ??
    readString(source.pollQuestion) ??
    readString(record.pollQuestion) ??
    readString(record.question) ??
    (readString(record.content) && readString(record.content) !== 'select one option'
      ? readString(record.content)
      : null) ??
    'Poll';

  const rawOptionsSource =
    source.options ??
    source.items ??
    source.answers ??
    source.choices ??
    source.pollOptions ??
    record.pollOptions ??
    metadata?.pollOptions;

  let rawOptions: unknown[] = [];
  if (Array.isArray(rawOptionsSource)) {
    rawOptions = rawOptionsSource;
  } else if (typeof rawOptionsSource === 'string') {
    try {
      const parsed = JSON.parse(rawOptionsSource) as unknown;
      if (Array.isArray(parsed)) {
        rawOptions = parsed;
      }
    } catch {
      rawOptions = [];
    }
  }

  const options = rawOptions
    .map((item, index) =>
      normalizePollOption(
        typeof item === 'string' ? item : (asRecord(item) ?? {}),
        index,
        myVoteIds,
      ),
    )
    .filter((item): item is PollOptionItem => item !== null);

  if (options.length === 0 && messageType !== 'POLL') {
    return null;
  }

  const allowMultiple =
    source.allowMultiple === true ||
    source.multiple === true ||
    source.allowMultipleVotes === true ||
    source.maxSelections === null;

  const totalVotes =
    typeof source.totalVotes === 'number'
      ? source.totalVotes
      : options.reduce((sum, option) => sum + option.voteCount, 0);

  return {
    question,
    options,
    allowMultiple,
    totalVotes,
  };
}

export function normalizeMessage(record: Record<string, unknown>, index: number): MessageItem {
  const sender = asRecord(record.sender) ?? asRecord(record.user) ?? asRecord(record.author);
  const senderName =
    readString(record.senderName) ??
    (sender ? readString(sender.name) ?? readString(sender.displayName) ?? readString(sender.username) : null) ??
    'Unknown';

  const deletedForEveryone = Boolean(readString(record.deletedForEveryoneAt));

  const content = deletedForEveryone
    ? DELETED_MESSAGE_TEXT
    : readString(record.content) ??
      readString(record.text) ??
      readString(record.body) ??
      readString(record.message) ??
      '';

  const messageType = deletedForEveryone
    ? 'TEXT'
    : readString(record.type) ??
      readString(record.messageType) ??
      readString(record.kind) ??
      readString(record.contentType) ??
      null;

  const media = deletedForEveryone ? [] : extractMessageMedia(record, content);

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
    replyToMessage: (() => {
      const replyRecord = readReplyToRecord(record);
      return replyRecord ? normalizeMessage(replyRecord, 0) : undefined;
    })(),
    messageType,
    media,
    deletedForEveryone,
    poll: deletedForEveryone ? null : normalizeMessagePoll(record),
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

  const isFavorite =
    record?.isFavorite === true ||
    record?.favorite === true ||
    record?.isFavorited === true ||
    Boolean(readString(record?.favoritedAt)) ||
    conversation?.isFavorite === true ||
    conversation?.favorite === true;

  return {
    conversation,
    messages: enrichMessageReplies(
      messagesRaw
        .map(asRecord)
        .filter((item): item is Record<string, unknown> => item !== null)
        .map(normalizeMessage),
    ),
    pinnedMessageIds: pinnedRaw
      .map((item) => {
        if (typeof item === 'string') {
          return item;
        }

        const pinnedRecord = asRecord(item);
        return pinnedRecord ? readString(pinnedRecord.id) : null;
      })
      .filter((item): item is string => Boolean(item)),
    isFavorite,
  };
}

export function normalizeMessageThread(payload: unknown): MessageItem[] {
  const items = extractArray(payload, ['messages', 'items', 'data', 'thread']);
  return enrichMessageReplies(
    items
      .map(asRecord)
      .filter((item): item is Record<string, unknown> => item !== null)
      .map((item) => normalizeMessage(item, 0)),
  );
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
      const message = asRecord(record.message) ?? asRecord(data?.message);
      const event =
        asRecord(record.event) ??
        asRecord(data?.event) ??
        asRecord(record.calendarEvent) ??
        asRecord(data?.calendarEvent);
      const scheduledMessage =
        asRecord(record.scheduledMessage) ?? asRecord(data?.scheduledMessage);

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
        isRead:
          record.isRead === true ||
          record.read === true ||
          Boolean(readString(record.readAt)) ||
          Boolean(readString(record.seenAt)),
        conversationId:
          readString(record.conversationId) ??
          (conversation ? readString(conversation.id) : null) ??
          (data ? readString(data.conversationId) : null) ??
          (message ? readString(message.conversationId) : null) ??
          readString(record.targetConversationId) ??
          null,
        channelId:
          readString(record.channelId) ??
          (channel ? readString(channel.id) : null) ??
          (data ? readString(data.channelId) : null) ??
          null,
        eventId:
          readString(record.eventId) ??
          readString(data?.eventId) ??
          readString(data?.calendarEventId) ??
          (event ? readString(event.id) : null) ??
          null,
        messageId:
          readString(record.messageId) ??
          readString(data?.messageId) ??
          (message ? readString(message.id) : null) ??
          null,
        scheduledMessageId:
          readString(record.scheduledMessageId) ??
          readString(data?.scheduledMessageId) ??
          (scheduledMessage ? readString(scheduledMessage.id) : null) ??
          null,
        link:
          readString(record.link) ??
          readString(record.url) ??
          readString(record.href) ??
          (data ? readString(data.link) : null) ??
          null,
      };
    });
}

function notificationHaystack(notification: NotificationItem): string {
  return `${notification.type} ${notification.title} ${notification.body} ${notification.link ?? ''}`.toLowerCase();
}

export function isCalendarRelatedNotification(notification: NotificationItem): boolean {
  if (notification.eventId) {
    return true;
  }

  const type = notification.type.toLowerCase();
  if (
    type.includes('calendar') ||
    type.includes('event') ||
    type.includes('reminder') ||
    type.includes('invite')
  ) {
    return true;
  }

  const haystack = notificationHaystack(notification);
  return (
    haystack.includes('calendar') ||
    haystack.includes('/calendar') ||
    haystack.includes('event reminder') ||
    haystack.includes('scheduled event') ||
    haystack.includes('event invite') ||
    haystack.includes('upcoming event')
  );
}

export function isScheduledMessageNotification(notification: NotificationItem): boolean {
  if (notification.scheduledMessageId) {
    return true;
  }

  const type = notification.type.toLowerCase();
  return type.includes('scheduled') && type.includes('message');
}

export function resolveNotificationAction(
  notification: NotificationItem,
  conversations: import('./chat').ConversationItem[],
): NotificationAction {
  if (isCalendarRelatedNotification(notification) && !isScheduledMessageNotification(notification)) {
    return { kind: 'calendar', eventId: notification.eventId };
  }

  const conversationId = resolveNotificationConversationId(notification, conversations);

  if (conversationId) {
    return {
      kind: 'chat',
      conversationId,
      messageId: notification.messageId,
    };
  }

  if (isScheduledMessageNotification(notification)) {
    return { kind: 'calendar', eventId: null };
  }

  return { kind: 'none' };
}

export function isNotificationClickable(
  notification: NotificationItem,
  conversations: import('./chat').ConversationItem[],
): boolean {
  return resolveNotificationAction(notification, conversations).kind !== 'none';
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

export function buildScheduleMessageBody(input: {
  content: string;
  scheduledAt: string;
  replyToId?: string | null;
  mentionUserIds?: string[];
}): Record<string, unknown> {
  const body: Record<string, unknown> = {
    content: input.content.trim(),
    type: 'TEXT',
    scheduledAt: input.scheduledAt,
  };

  if (input.replyToId) {
    body.replyToId = input.replyToId;
  }

  if (input.mentionUserIds && input.mentionUserIds.length > 0) {
    body.mentionUserIds = input.mentionUserIds;
  }

  return body;
}
