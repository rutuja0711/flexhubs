import {
  formatCallLogPreview,
  isCallLogMessage as isCallLogContent,
  parseCallLogContent,
} from './calls';
import { normalizeUploadUrl, readUserStatusMessage, resolveAvatarUrl } from './profile';

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

export type MessageMediaKind = 'gif' | 'sticker' | 'image' | 'file' | 'video';

export type MessageMedia = {
  kind: MessageMediaKind;
  url: string;
  previewUrl: string | null;
  name: string | null;
};

const VIDEO_FILE_PATTERN = /\.(mp4|webm|mov|mkv|avi|m4v)(\?|#|$)/i;
const DOCUMENT_FILE_PATTERN =
  /\.(zip|txt|pdf|doc|docx|xls|xlsx|ppt|pptx|csv|json|xml|md|rar|7z|tar|gz|mp3|wav)(\?|#|$)/i;

function looksLikeDocumentAttachment(item: Pick<MessageMedia, 'kind' | 'url' | 'name'>): boolean {
  if (item.kind === 'file') {
    return true;
  }

  const name = item.name ?? '';
  const url = item.url ?? '';

  if (DOCUMENT_FILE_PATTERN.test(name) || DOCUMENT_FILE_PATTERN.test(url)) {
    return true;
  }

  return false;
}

export function isVideoMediaItem(
  item: Pick<MessageMedia, 'kind' | 'url' | 'name'>,
  mimeType?: string | null,
): boolean {
  if (item.kind === 'video') {
    return true;
  }

  const normalizedMime = mimeType?.toLowerCase() ?? '';
  if (normalizedMime.startsWith('video/')) {
    return true;
  }

  if (item.name && VIDEO_FILE_PATTERN.test(item.name)) {
    return true;
  }

  if (item.url && VIDEO_FILE_PATTERN.test(item.url)) {
    return true;
  }

  return false;
}

export function isDownloadableFileMedia(
  item: Pick<MessageMedia, 'kind' | 'url' | 'name'>,
): boolean {
  return looksLikeDocumentAttachment(item) && !isVideoMediaItem(item);
}

export function withResolvedAttachmentKind(
  item: MessageMedia,
  mimeType?: string | null,
): MessageMedia {
  if (isVideoMediaItem(item, mimeType) && item.kind !== 'video') {
    return { ...item, kind: 'video' };
  }

  if (isDownloadableFileMedia(item) && item.kind !== 'file') {
    return { ...item, kind: 'file' };
  }

  return item;
}

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

export type MessageReadReceipt = {
  userId: string;
  name: string;
  readAt: string | null;
};

export type MessageItem = {
  id: string;
  content: string;
  senderId: string | null;
  senderName: string;
  senderInitials: string;
  senderAvatarUrl: string | null;
  createdAt: string;
  editedAt: string | null;
  pinnedAt: string | null;
  isOwn: boolean;
  status: 'sending' | 'delivered' | 'seen' | 'failed' | null;
  readBy: MessageReadReceipt[];
  reactions: MessageReaction[];
  replyToMessageId?: string;
  replyToMessage?: MessageItem;
  messageType: string | null;
  media: MessageMedia[];
  poll: MessagePoll | null;
  threadRootId?: string;
  threadReplyCount?: number;
  deletedForEveryone?: boolean;
};

const threadReplyMessageIds = new Set<string>();
const threadRootByMessageId = new Map<string, string>();

type PendingThreadSend = {
  content: string;
  threadRootId: string;
  sentAt: number;
};

const pendingThreadSends: PendingThreadSend[] = [];

export function clearThreadReplyRegistry(): void {
  threadReplyMessageIds.clear();
  threadRootByMessageId.clear();
  pendingThreadSends.length = 0;
}

export function registerThreadReplyMessage(messageId: string, threadRootId: string): void {
  threadReplyMessageIds.add(messageId);
  threadRootByMessageId.set(messageId, threadRootId);
}

export function registerThreadReplyMessages(messages: MessageItem[], threadRootId: string): void {
  for (const message of messages) {
    registerThreadReplyMessage(message.id, message.threadRootId ?? threadRootId);
  }
}

export function trackPendingThreadSend(content: string, threadRootId: string): void {
  const trimmed = content.trim();
  if (!trimmed) {
    return;
  }

  pendingThreadSends.push({ content: trimmed, threadRootId, sentAt: Date.now() });

  const cutoff = Date.now() - 60_000;
  while (pendingThreadSends.length > 0 && pendingThreadSends[0].sentAt < cutoff) {
    pendingThreadSends.shift();
  }
}

export function resolveThreadRootId(
  message: Pick<MessageItem, 'id' | 'threadRootId' | 'content' | 'isOwn' | 'senderId'>,
  userId: string | null,
): string | null {
  if (message.threadRootId) {
    registerThreadReplyMessage(message.id, message.threadRootId);
    return message.threadRootId;
  }

  const knownRoot = threadRootByMessageId.get(message.id);
  if (knownRoot) {
    return knownRoot;
  }

  const isOwn = message.isOwn || (userId ? message.senderId === userId : false);
  if (!isOwn) {
    return null;
  }

  const trimmed = message.content.trim();
  if (!trimmed) {
    return null;
  }

  const pendingIndex = pendingThreadSends.findIndex(
    (pending) => pending.content === trimmed && Date.now() - pending.sentAt < 60_000,
  );

  if (pendingIndex < 0) {
    return null;
  }

  const pending = pendingThreadSends.splice(pendingIndex, 1)[0];
  registerThreadReplyMessage(message.id, pending.threadRootId);
  return pending.threadRootId;
}

export function isThreadReply(message: Pick<MessageItem, 'id' | 'threadRootId'>): boolean {
  return Boolean(message.threadRootId) || threadReplyMessageIds.has(message.id);
}

export function filterMainChatMessages(messages: MessageItem[]): MessageItem[] {
  return messages.filter((message) => !isThreadReply(message));
}

export const DELETED_MESSAGE_TEXT = 'This message was deleted.';

export function isDeletedMessage(
  message: Pick<MessageItem, 'content' | 'deletedForEveryone'>,
): boolean {
  return message.deletedForEveryone || message.content.trim() === DELETED_MESSAGE_TEXT;
}

export function isAlreadyDeletedForEveryoneError(error: string): boolean {
  return /already deleted/i.test(error);
}

export function markMessageDeletedForEveryone(message: MessageItem): MessageItem {
  return {
    ...message,
    content: DELETED_MESSAGE_TEXT,
    media: [],
    messageType: 'TEXT',
    deletedForEveryone: true,
    poll: null,
  };
}

function readDeletedForEveryone(record: Record<string, unknown>): boolean {
  if (readString(record.deletedForEveryoneAt)) {
    return true;
  }

  if (record.deletedForEveryone === true || record.isDeletedForEveryone === true) {
    return true;
  }

  const content =
    readString(record.content) ??
    readString(record.text) ??
    readString(record.body) ??
    readString(record.message) ??
    '';

  return content.trim() === DELETED_MESSAGE_TEXT;
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
  inviteId: string | null;
  link: string | null;
  /** User who triggered the notification (e.g. friend-request sender). */
  actorUserId: string | null;
};

export type NotificationAction =
  | { kind: 'calendar'; eventId: string | null }
  | { kind: 'chat'; conversationId: string; messageId: string | null }
  | { kind: 'hubs'; channelId: string | null; inviteId: string | null }
  | { kind: 'none' };

export type PendingFriendItem = {
  id: string;
  userId: string;
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

function readReactionUserId(value: unknown): string {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }

  const record = asRecord(value);

  if (!record) {
    return '';
  }

  return (
    readString(record.id) ??
    readString(record._id) ??
    readString(record.userId) ??
    readString(record.user_id) ??
    ''
  );
}

function readReactionUsername(value: unknown): string {
  if (typeof value === 'string') {
    return '';
  }

  const record = asRecord(value);

  if (!record) {
    return '';
  }

  return (
    readString(record.username) ??
    readString(record.name) ??
    readString(record.displayName) ??
    ''
  );
}

function appendReactionUsers(
  reactions: MessageReaction[],
  emoji: string,
  users: unknown[],
): void {
  for (const user of users) {
    const userId = readReactionUserId(user);

    if (!userId) {
      continue;
    }

    reactions.push({
      emoji,
      userId,
      username: readReactionUsername(user),
    });
  }
}

function normalizeGroupedReactionRecord(
  record: Record<string, unknown>,
  fallbackEmoji?: string,
): MessageReaction[] {
  const reactions: MessageReaction[] = [];
  const emoji =
    readString(record.emoji) ??
    readString(record.reaction) ??
    fallbackEmoji ??
    '👍';
  const user = asRecord(record.user) ?? asRecord(record.sender);
  const userId =
    readString(record.userId) ??
    readString(record.user_id) ??
    readReactionUserId(user);

  if (userId) {
    reactions.push({
      emoji,
      userId,
      username:
        readString(record.username) ??
        readReactionUsername(user),
    });
    return reactions;
  }

  const nestedUsers = [
    ...(Array.isArray(record.users) ? record.users : []),
    ...(Array.isArray(record.userIds) ? record.userIds : []),
    ...(Array.isArray(record.user_ids) ? record.user_ids : []),
    ...(Array.isArray(record.reactors) ? record.reactors : []),
    ...(Array.isArray(record.reactorIds) ? record.reactorIds : []),
    ...(Array.isArray(record.reactor_ids) ? record.reactor_ids : []),
  ];

  appendReactionUsers(reactions, emoji, nestedUsers);
  return reactions;
}

export function mergeMessageReactions(
  previous: MessageReaction[],
  incoming: MessageReaction[],
): MessageReaction[] {
  const merged = new Map<string, MessageReaction>();

  for (const reaction of previous) {
    merged.set(`${reaction.userId}::${reaction.emoji}`, reaction);
  }

  for (const reaction of incoming) {
    const key = `${reaction.userId}::${reaction.emoji}`;
    const existing = merged.get(key);
    merged.set(key, {
      emoji: reaction.emoji,
      userId: reaction.userId,
      username: reaction.username || existing?.username || '',
    });
  }

  return Array.from(merged.values());
}

function normalizeReactions(value: unknown): MessageReaction[] {
  if (Array.isArray(value)) {
    const reactions: MessageReaction[] = [];

    for (const entry of value) {
      const record = asRecord(entry);

      if (!record) {
        continue;
      }

      reactions.push(...normalizeGroupedReactionRecord(record));
    }

    return reactions.filter((reaction) => reaction.userId);
  }

  const record = asRecord(value);

  if (!record) {
    return [];
  }

  const reactions: MessageReaction[] = [];

  for (const [key, entry] of Object.entries(record)) {
    if (Array.isArray(entry)) {
      appendReactionUsers(reactions, key, entry);
      continue;
    }

    const entryRecord = asRecord(entry);

    if (entryRecord) {
      reactions.push(...normalizeGroupedReactionRecord(entryRecord, key));
    }
  }

  return reactions;
}

export function applyReactionPatch(
  message: MessageItem,
  patch: {
    incoming?: MessageItem;
    replaceReactions?: boolean;
    reactions?: MessageReaction[];
    addedReaction?: MessageReaction | null;
    removedReaction?: { emoji: string; userId: string } | null;
  },
): MessageItem {
  if (patch.incoming) {
    return mergeMessageUpdates(message, patch.incoming, {
      replaceReactions: patch.replaceReactions === true,
    });
  }

  if (patch.reactions) {
    return {
      ...message,
      reactions: mergeMessageReactions(message.reactions, patch.reactions),
    };
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

export function mergeServerMessagesWithLocal(
  serverMessages: MessageItem[],
  localMessages: MessageItem[],
): MessageItem[] {
  if (localMessages.length === 0) {
    return serverMessages;
  }

  const localById = new Map(localMessages.map((message) => [message.id, message]));

  return serverMessages.map((serverMessage) => {
    const localMessage = localById.get(serverMessage.id);

    if (!localMessage) {
      return serverMessage;
    }

    return mergeMessageUpdates(serverMessage, localMessage);
  });
}

export function mergeMessageUpdates(
  previous: MessageItem,
  incoming: MessageItem,
  options?: { replaceReactions?: boolean },
): MessageItem {
  if (isDeletedMessage(incoming)) {
    return markMessageDeletedForEveryone({
      ...previous,
      ...incoming,
      senderName: incoming.senderName !== 'Unknown' ? incoming.senderName : previous.senderName,
      senderId: incoming.senderId ?? previous.senderId,
      status: incoming.status ?? previous.status,
    });
  }

  const mergedReactions =
    incoming.reactions.length > 0
      ? options?.replaceReactions
        ? incoming.reactions
        : mergeMessageReactions(previous.reactions, incoming.reactions)
      : previous.reactions;

  return {
    ...previous,
    ...incoming,
    content: incoming.content || previous.content,
    senderName: incoming.senderName !== 'Unknown' ? incoming.senderName : previous.senderName,
    senderId: incoming.senderId ?? previous.senderId,
    reactions: mergedReactions,
    media: incoming.media.length > 0 ? incoming.media : previous.media,
    status: incoming.status ?? previous.status,
    readBy: incoming.readBy.length > 0 ? incoming.readBy : previous.readBy,
    poll: incoming.poll ?? previous.poll,
  };
}

export function parseMessageReactions(value: unknown): MessageReaction[] {
  return normalizeReactions(value);
}

function reactionDisplayName(reaction: MessageReaction, currentUserId: string | null): string {
  if (currentUserId && reaction.userId === currentUserId) {
    return 'You';
  }

  return reaction.username.trim() || 'Someone';
}

export function listReactionAuthors(
  reactions: MessageReaction[],
  emoji: string,
  currentUserId: string | null,
): string[] {
  const names: string[] = [];

  for (const reaction of reactions) {
    if (reaction.emoji !== emoji) {
      continue;
    }

    const name = reactionDisplayName(reaction, currentUserId);

    if (!names.includes(name)) {
      names.push(name);
    }
  }

  return names;
}

export function formatReactionAuthors(
  reactions: MessageReaction[],
  emoji: string,
  currentUserId: string | null,
): string {
  const names = listReactionAuthors(reactions, emoji, currentUserId);

  if (names.length === 0) {
    return '';
  }

  if (names.length === 1) {
    return names[0];
  }

  if (names.length === 2) {
    return `${names[0]} and ${names[1]}`;
  }

  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
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

  if (normalized.includes('voice')) {
    return 'file';
  }

  if (normalized.includes('sticker')) {
    return 'sticker';
  }

  if (normalized.includes('gif')) {
    return 'gif';
  }

  if (
    normalized.includes('video') ||
    normalized.includes('mp4') ||
    normalized.includes('mov') ||
    normalized.includes('avi') ||
    normalized.includes('webm')
  ) {
    return 'video';
  }

  if (
    normalized.includes('file') ||
    normalized.includes('document') ||
    normalized.includes('attachment') ||
    normalized.includes('pdf') ||
    normalized.includes('zip') ||
    normalized.includes('audio') ||
    normalized.includes('text') ||
    normalized.includes('application/')
  ) {
    return 'file';
  }

  if (normalized.includes('image') || normalized.includes('photo')) {
    return 'image';
  }

  return fallback;
}

function normalizeMediaUrl(url: string): string {
  return normalizeUploadUrl(url.trim());
}

function isLikelyMediaUrl(url: string): boolean {
  const normalized = normalizeMediaUrl(url);

  if (!/^https?:\/\//i.test(normalized)) {
    return false;
  }

  if (/\.(gif|webp|png|jpe?g|bmp|svg|avif)(\?|$)/i.test(normalized)) {
    return true;
  }

  return /giphy\.com|tenor\.com|media\.tenor|media\d?\.giphy|klipy\.com|imgur\.com|flexhubs\.in\/api\/|flexhubs\.in\/uploads|cloudinary|amazonaws\.com|supabase\.co/i.test(
    normalized,
  );
}

function isLikelyAttachmentUrl(url: string): boolean {
  const normalized = normalizeMediaUrl(url);

  if (!/^https?:\/\//i.test(normalized)) {
    return false;
  }

  if (isLikelyMediaUrl(normalized)) {
    return true;
  }

  return /\.(zip|txt|pdf|doc|docx|xls|xlsx|ppt|pptx|csv|json|xml|md|rar|7z|tar|gz|mp3|wav|mp4|mov|avi|webm|mkv)(\?|$)/i.test(
    normalized,
  );
}

function readMediaFromObject(
  record: Record<string, unknown>,
  fallbackKind: MessageMediaKind = 'image',
): MessageMedia | null {
  const rawUrl =
    readString(record.url) ??
    readString(record.fileUrl) ??
    readString(record.src) ??
    readString(record.href) ??
    readString(record.mediaUrl) ??
    readString(record.imageUrl) ??
    readString(record.originalUrl) ??
    readString(record.fullUrl);

  if (!rawUrl) {
    return null;
  }

  const url = normalizeMediaUrl(rawUrl);

  let kind = normalizeMediaKind(
    record.type ?? record.kind ?? record.mediaType ?? record.mimeType ?? record.contentType,
    fallbackKind,
  );

  const attachmentName =
    readString(record.name) ?? readString(record.fileName) ?? readString(record.title);

  if (kind === 'image' || kind === 'file') {
    const mimeHint = String(record.mimeType ?? record.contentType ?? '').toLowerCase();
    if (mimeHint.startsWith('video/')) {
      kind = 'video';
    } else if (attachmentName && VIDEO_FILE_PATTERN.test(attachmentName)) {
      kind = 'video';
    } else if (VIDEO_FILE_PATTERN.test(url)) {
      kind = 'video';
    } else if (
      kind === 'image' &&
      (DOCUMENT_FILE_PATTERN.test(url) ||
        (attachmentName ? DOCUMENT_FILE_PATTERN.test(attachmentName) : false))
    ) {
      kind = 'file';
    } else if (kind === 'file' && /\.(gif|webp|png|jpe?g|bmp|svg|avif)(\?|$)/i.test(url)) {
      kind = 'image';
    }
  }

  if (!isLikelyAttachmentUrl(url) && kind !== 'file' && kind !== 'video') {
    return null;
  }

  if (kind !== 'file' && kind !== 'video' && !isLikelyMediaUrl(url)) {
    return null;
  }

  const rawPreview =
    readString(record.previewUrl) ??
    readString(record.thumbnailUrl) ??
    readString(record.thumbUrl) ??
    readString(record.preview) ??
    null;

  return {
    kind,
    url,
    previewUrl: rawPreview ? normalizeMediaUrl(rawPreview) : null,
    name: readString(record.name) ?? readString(record.fileName) ?? readString(record.title),
  };
}

export function extractMessageMedia(record: Record<string, unknown>, content: string): MessageMedia[] {
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

    if (metadataUrl) {
      const url = normalizeMediaUrl(metadataUrl);
      if (isLikelyMediaUrl(url)) {
        const rawPreview =
          readString(metadata.previewUrl) ?? readString(metadata.thumbnailUrl);
        pushMedia({
          kind: normalizeMediaKind(metadata.type ?? metadata.kind ?? record.type, 'gif'),
          url,
          previewUrl: rawPreview ? normalizeMediaUrl(rawPreview) : null,
          name: readString(metadata.name),
        });
      }
    }
  }

  const topLevelUrl =
    readString(record.mediaUrl) ??
    readString(record.gifUrl) ??
    readString(record.stickerUrl) ??
    readString(record.imageUrl) ??
    readString(record.attachmentUrl) ??
    readString(record.fileUrl);

  if (topLevelUrl) {
    const url = normalizeMediaUrl(topLevelUrl);
    if (isLikelyMediaUrl(url)) {
      const rawPreview =
        readString(record.previewUrl) ?? readString(record.thumbnailUrl);
      pushMedia({
        kind: normalizeMediaKind(record.type ?? record.messageType ?? record.kind, 'gif'),
        url,
        previewUrl: rawPreview ? normalizeMediaUrl(rawPreview) : null,
        name: readString(record.name) ?? readString(record.fileName),
      });
    }
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
  if (fileUrl) {
    const url = normalizeMediaUrl(fileUrl);
    const mimeType = readString(record.mimeType)?.toLowerCase() ?? '';
    const messageType = String(record.type ?? record.messageType ?? '').toUpperCase();
    const fileName = readString(record.fileName) ?? readString(record.name);
    const isAttachmentMessage =
      messageType === 'FILE' ||
      messageType === 'VIDEO' ||
      normalizeMediaKind(messageType, 'file') === 'file' ||
      normalizeMediaKind(messageType, 'video') === 'video';

    if (isAttachmentMessage || isLikelyAttachmentUrl(url)) {
      let finalKind: MessageMediaKind = 'file';

      if (isAttachmentMessage) {
        if (
          mimeType.startsWith('video/') ||
          messageType === 'VIDEO' ||
          (fileName && VIDEO_FILE_PATTERN.test(fileName))
        ) {
          finalKind = 'video';
        } else if (mimeType.startsWith('image/')) {
          finalKind = 'image';
        } else if (VIDEO_FILE_PATTERN.test(url)) {
          finalKind = 'video';
        } else if (/\.(gif|webp|png|jpe?g|bmp|svg|avif)(\?|$)/i.test(url)) {
          finalKind = 'image';
        }

        if (finalKind === 'file') {
          pushMedia({
            kind: 'file',
            url,
            previewUrl: null,
            name: fileName,
          });
        } else {
          pushMedia({
            kind: finalKind,
            url,
            previewUrl: null,
            name: fileName,
          });
        }
      } else if (isLikelyMediaUrl(url)) {
        const isStickerMarker = trimmedContent === 'sticker';
        const isSticker =
          isStickerMarker ||
          (messageType === 'GIF' && (mimeType === 'image/png' || mimeType === 'image/webp'));
        const rawPreview =
          readString(record.previewUrl) ?? readString(record.thumbnailUrl);

        pushMedia({
          kind: isSticker ? 'sticker' : messageType === 'GIF' || mimeType.includes('gif') ? 'gif' : 'image',
          url,
          previewUrl: rawPreview ? normalizeMediaUrl(rawPreview) : null,
          name: fileName,
        });
      }
    }
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

export function extractPeerLastReadMessageIds(
  conversation: Record<string, unknown> | null,
  currentUserId: string | null,
): string[] {
  if (!conversation) {
    return [];
  }

  const ids = new Set<string>();

  const addId = (value: unknown) => {
    const id = readString(value);
    if (id) {
      ids.add(id);
    }
  };

  addId(conversation.peerLastReadMessageId);
  addId(conversation.otherLastReadMessageId);
  addId(conversation.lastSeenByOtherMessageId);

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

      if (currentUserId && userId === currentUserId) {
        continue;
      }

      addId(member.lastReadMessageId);
      addId(member.readUpToMessageId);
      addId(member.lastSeenMessageId);
      addId(user.lastReadMessageId);
      addId(user.readUpToMessageId);
    }
  }

  return [...ids];
}

function readMemberDisplayName(member: Record<string, unknown>): string {
  const user = asRecord(member.user) ?? member;

  return (
    readString(user.username) ??
    readString(user.name) ??
    readString(user.displayName) ??
    readString(member.username) ??
    readString(member.name) ??
    readString(member.displayName) ??
    'Someone'
  );
}

export function buildConversationMemberNameIndex(
  conversation: Record<string, unknown> | null,
): Map<string, string> {
  const index = new Map<string, string>();

  if (!conversation) {
    return index;
  }

  for (const key of ['members', 'participants', 'users', 'groupMembers']) {
    const value = conversation[key];

    if (!Array.isArray(value)) {
      continue;
    }

    for (const entry of value) {
      const member = asRecord(entry);

      if (!member) {
        continue;
      }

      const userId = readMemberUserId(member);

      if (!userId) {
        continue;
      }

      index.set(userId, readMemberDisplayName(member));
    }
  }

  const peerUserId =
    readString(conversation.peerUserId) ??
    readString(conversation.otherUserId) ??
    readString(conversation.directUserId);

  if (peerUserId) {
    const peerName =
      readString(conversation.title) ??
      readString(conversation.displayName) ??
      readString(conversation.name);

    if (peerName) {
      index.set(peerUserId, peerName);
    }
  }

  return index;
}

export function enrichMessageReadReceipts(
  readers: MessageReadReceipt[],
  nameIndex: Map<string, string>,
): MessageReadReceipt[] {
  return readers.map((reader) => {
    const resolvedName =
      (reader.name.trim() && reader.name !== 'Someone' ? reader.name : null) ??
      nameIndex.get(reader.userId) ??
      reader.name;

    return {
      ...reader,
      name: resolvedName.trim() || 'Someone',
    };
  });
}

function readMemberUserId(member: Record<string, unknown>): string | null {
  const user = asRecord(member.user) ?? member;

  return readString(user.id) ?? readString(member.userId) ?? readString(member.id);
}

function readMemberLastReadMessageId(member: Record<string, unknown>): string | null {
  const user = asRecord(member.user) ?? member;

  return (
    readString(member.lastReadMessageId) ??
    readString(member.readUpToMessageId) ??
    readString(member.lastSeenMessageId) ??
    readString(user.lastReadMessageId) ??
    readString(user.readUpToMessageId) ??
    readString(user.lastSeenMessageId)
  );
}

export function memberHasReadMessage(
  lastReadMessageId: string | null,
  messageId: string,
  messages: MessageItem[],
): boolean {
  if (!lastReadMessageId) {
    return false;
  }

  const messageIndex = messages.findIndex((message) => message.id === messageId);
  const readIndex = messages.findIndex((message) => message.id === lastReadMessageId);

  if (messageIndex < 0 || readIndex < 0) {
    return false;
  }

  return readIndex >= messageIndex;
}

export function normalizeMessageReadReceipts(
  value: unknown,
  nameIndex?: Map<string, string>,
): MessageReadReceipt[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const readers: MessageReadReceipt[] = [];

  for (const [index, entry] of value.entries()) {
    if (typeof entry === 'string') {
      const userId = entry.trim();

      if (!userId) {
        continue;
      }

      readers.push({
        userId,
        name: nameIndex?.get(userId) ?? 'Someone',
        readAt: null,
      });
      continue;
    }

    const record = asRecord(entry);
    if (!record) {
      continue;
    }

    const user =
      asRecord(record.user) ??
      asRecord(record.member) ??
      asRecord(record.reader) ??
      record;
    const userId =
      readString(record.userId) ??
      readString(user.id) ??
      readString(record.id) ??
      `reader-${index}`;
    const name =
      readString(record.name) ??
      readString(record.displayName) ??
      readString(record.username) ??
      readMemberDisplayName(asRecord(record.user) ? record : { user: record });
    const readAt =
      readString(record.readAt) ??
      readString(record.seenAt) ??
      readString(record.readAtUtc) ??
      null;

    readers.push({
      userId,
      name: nameIndex?.get(userId) ?? name,
      readAt,
    });
  }

  const unique = new Map<string, MessageReadReceipt>();

  for (const reader of readers) {
    unique.set(reader.userId, reader);
  }

  const deduped = [...unique.values()];

  return nameIndex ? enrichMessageReadReceipts(deduped, nameIndex) : deduped;
}

export function extractReadersFromConversation(
  conversation: Record<string, unknown> | null,
  messageId: string,
  messages: MessageItem[],
  currentUserId: string | null,
): MessageReadReceipt[] {
  if (!conversation) {
    return [];
  }

  const readers: MessageReadReceipt[] = [];
  const seenUserIds = new Set<string>();

  const addReader = (userId: string | null, name: string, readAt: string | null = null) => {
    if (!userId || (currentUserId && userId === currentUserId) || seenUserIds.has(userId)) {
      return;
    }

    seenUserIds.add(userId);
    readers.push({ userId, name, readAt });
  };

  const nameIndex = buildConversationMemberNameIndex(conversation);
  const peerLastReadId =
    readString(conversation.peerLastReadMessageId) ??
    readString(conversation.otherLastReadMessageId) ??
    readString(conversation.lastSeenByOtherMessageId);

  if (peerLastReadId && memberHasReadMessage(peerLastReadId, messageId, messages)) {
    const peerUserId =
      readString(conversation.peerUserId) ??
      readString(conversation.otherUserId) ??
      readString(conversation.directUserId);

    if (peerUserId && peerUserId !== currentUserId) {
      addReader(
        peerUserId,
        readString(conversation.title) ??
          readString(conversation.displayName) ??
          readString(conversation.name) ??
          nameIndex.get(peerUserId) ??
          'Someone',
      );
    }
  }

  for (const key of ['members', 'participants', 'users', 'groupMembers']) {
    const value = conversation[key];
    if (!Array.isArray(value)) {
      continue;
    }

    for (const entry of value) {
      const member = asRecord(entry);
      if (!member) {
        continue;
      }

      const userId = readMemberUserId(member);
      if (!userId || (currentUserId && userId === currentUserId)) {
        continue;
      }

      const lastReadMessageId = readMemberLastReadMessageId(member);
      if (!memberHasReadMessage(lastReadMessageId, messageId, messages)) {
        continue;
      }

      addReader(
        userId,
        nameIndex.get(userId) ?? readMemberDisplayName(member),
        readString(member.readAt) ?? readString(member.seenAt),
      );
    }
  }

  return enrichMessageReadReceipts(readers, nameIndex);
}

export function resolveMessageReadBy(
  message: Pick<MessageItem, 'id' | 'isOwn' | 'status' | 'readBy'>,
  conversation: Record<string, unknown> | null,
  messages: MessageItem[],
  currentUserId: string | null,
): MessageReadReceipt[] {
  if (!message.isOwn || message.status !== 'seen') {
    return [];
  }

  const nameIndex = buildConversationMemberNameIndex(conversation);

  if (message.readBy.length > 0) {
    return enrichMessageReadReceipts(message.readBy, nameIndex);
  }

  return extractReadersFromConversation(conversation, message.id, messages, currentUserId);
}

export function formatMessageSeenByLabel(readers: MessageReadReceipt[]): string {
  if (readers.length === 0) {
    return '';
  }

  return `Seen by ${formatMessageSeenByDetail(readers)}`;
}

export function formatMessageSeenByDetail(readers: MessageReadReceipt[]): string {
  if (readers.length === 0) {
    return '';
  }

  if (readers.length === 1) {
    return readers[0].name;
  }

  if (readers.length === 2) {
    return `${readers[0].name} and ${readers[1].name}`;
  }

  const remaining = readers.length - 2;
  return `${readers[0].name}, ${readers[1].name}, and ${remaining} other${remaining === 1 ? '' : 's'}`;
}

export function applyMessageReadReceipts(
  messages: MessageItem[],
  peerLastReadIds: string[],
): MessageItem[] {
  if (messages.length === 0) {
    return messages;
  }

  let farthestSeenIndex = -1;

  for (const id of peerLastReadIds) {
    const index = messages.findIndex((message) => message.id === id);
    if (index > farthestSeenIndex) {
      farthestSeenIndex = index;
    }
  }

  return messages.map((message, index) => {
    if (!message.isOwn) {
      return message;
    }

    if (message.status === 'seen') {
      return message;
    }

    const seen = farthestSeenIndex >= 0 && index <= farthestSeenIndex;
    return {
      ...message,
      status: seen ? 'seen' : message.status === 'sending' ? 'sending' : 'delivered',
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

const PREVIEW_EMOJI_PREFIX = /^(\p{Extended_Pictographic}\uFE0F?\s*)+/u;

function stripLeadingPreviewEmoji(text: string): string {
  return text.replace(PREVIEW_EMOJI_PREFIX, '').trim();
}

function decoratePreviewLabel(label: string): string {
  const trimmed = stripLeadingPreviewEmoji(label.trim());
  if (!trimmed) {
    return trimmed;
  }

  if (/^gif$/i.test(trimmed)) {
    return 'GIF';
  }

  if (/^sticker$/i.test(trimmed)) {
    return 'Sticker';
  }

  if (/^poll$/i.test(trimmed)) {
    return 'Poll';
  }

  if (/^(photo|image)$/i.test(trimmed)) {
    return 'Photo';
  }

  return trimmed;
}

export function decoratePreviewText(preview: string): string {
  const trimmed = preview.trim();
  if (!trimmed) {
    return '';
  }

  const separator = trimmed.indexOf(': ');
  if (separator > 0 && separator < 48) {
    const sender = trimmed.slice(0, separator);
    const rest = trimmed.slice(separator + 2);
    return `${sender}: ${decoratePreviewLabel(rest)}`;
  }

  return decoratePreviewLabel(trimmed);
}

export function formatMessagePreview(
  message: Pick<MessageItem, 'content' | 'media' | 'messageType' | 'deletedForEveryone' | 'poll'>,
  currentUserId: string | null = null,
): string {
  if (isDeletedMessage(message)) {
    return DELETED_MESSAGE_TEXT;
  }

  const callLog = parseCallLogContent(message.content);

  if (callLog) {
    return decoratePreviewText(formatCallLogPreview(callLog, currentUserId));
  }

  if (isPollMessage(message)) {
    return 'Poll';
  }

  const trimmedContent =
    message.content.trim() === 'sticker' ? '' : message.content.trim();

  if (trimmedContent && message.media.length === 0) {
    return trimmedContent;
  }

  if (message.media.length > 0) {
    const primary = message.media[0];
    const label =
      primary.kind === 'sticker'
        ? 'Sticker'
        : primary.kind === 'gif'
          ? 'GIF'
          : primary.kind === 'file'
            ? primary.name ?? 'File'
            : 'Photo';
    return trimmedContent ? `${trimmedContent} (${label})` : label;
  }

  const type = String(message.messageType ?? '').toLowerCase();
  if (type.includes('sticker')) return 'Sticker';
  if (type.includes('gif')) return 'GIF';
  if (type.includes('file')) return 'File';
  if (type.includes('image')) return 'Photo';
  if (type.includes('poll')) return 'Poll';

  return trimmedContent;
}

export function isStickerMessage(
  message: Pick<MessageItem, 'content' | 'media' | 'messageType'>,
): boolean {
  const messageType = String(message.messageType ?? '').toUpperCase();
  const content = message.content.trim().toLowerCase();

  if (messageType === 'STICKER' || content === 'sticker') {
    return true;
  }

  return message.media.length > 0 && message.media.every((item) => item.kind === 'sticker');
}

export function shouldShowUploadProgress(
  message: Pick<MessageItem, 'isOwn' | 'status' | 'media' | 'messageType' | 'content'>,
): boolean {
  if (!message.isOwn || message.status !== 'sending') {
    return false;
  }

  const media = message.media ?? [];
  if (media.length === 0) {
    return false;
  }

  if (isStickerMessage(message)) {
    return false;
  }

  const messageType = String(message.messageType ?? '').toUpperCase();
  if (
    messageType === 'GIF' ||
    messageType === 'STICKER' ||
    messageType === 'TEXT' ||
    messageType === 'VOICE'
  ) {
    return false;
  }

  if (media.some((item) => item.kind === 'gif' || item.kind === 'sticker')) {
    return false;
  }

  return media.some(
    (item) => item.kind === 'image' || item.kind === 'video' || item.kind === 'file',
  );
}

function messageContentMatchesMediaUrl(
  content: string,
  media: MessageMedia[],
): boolean {
  const trimmed = content.trim();

  if (!trimmed) {
    return false;
  }

  return media.some((item) => item.url === trimmed || item.previewUrl === trimmed);
}

export function isMediaOnlyMessage(
  message: Pick<MessageItem, 'content' | 'media' | 'messageType' | 'deletedForEveryone'>,
): boolean {
  if (isDeletedMessage(message)) {
    return false;
  }

  if (isStickerMessage(message)) {
    return message.media.length > 0;
  }

  let trimmedContent =
    message.content.trim() === 'sticker' ? '' : message.content.trim();

  if (trimmedContent && messageContentMatchesMediaUrl(trimmedContent, message.media)) {
    trimmedContent = '';
  }

  if (trimmedContent || message.media.length === 0) {
    return false;
  }

  return message.media.every(
    (item) =>
      item.kind === 'gif' ||
      item.kind === 'sticker' ||
      item.kind === 'image' ||
      item.kind === 'video' ||
      isVoiceMediaAttachment(item, message.messageType),
  );
}

export function isVoiceMediaAttachment(
  item: Pick<MessageMedia, 'url' | 'name'>,
  messageType?: string | null,
): boolean {
  if (String(messageType ?? '').toUpperCase() === 'VOICE') {
    return true;
  }

  const name = item.name?.toLowerCase() ?? '';
  return (
    name.includes('voice') ||
    /\.(webm|ogg|mp3|m4a|wav)(\?|$)/i.test(item.url)
  );
}

export function isVoiceMessage(
  message: Pick<MessageItem, 'messageType' | 'media'>,
): boolean {
  if (String(message.messageType ?? '').toUpperCase() === 'VOICE') {
    return true;
  }

  return (message.media ?? []).some((item) => isVoiceMediaAttachment(item, message.messageType));
}

export function isVoiceOnlyMessage(
  message: Pick<MessageItem, 'content' | 'media' | 'messageType' | 'deletedForEveryone'>,
): boolean {
  if (isDeletedMessage(message) || !isVoiceMessage(message) || message.media.length === 0) {
    return false;
  }

  let trimmedContent =
    message.content.trim() === 'sticker' ? '' : message.content.trim();

  if (trimmedContent && messageContentMatchesMediaUrl(trimmedContent, message.media)) {
    trimmedContent = '';
  }

  return !trimmedContent;
}

export function isPollMessage(
  message: Pick<MessageItem, 'poll' | 'messageType'>,
): boolean {
  if (message.poll) {
    return true;
  }

  return String(message.messageType ?? '').toUpperCase() === 'POLL';
}

export function isCallLogMessage(
  message: Pick<MessageItem, 'content' | 'messageType'>,
): boolean {
  return isCallLogContent(message);
}

export { parseCallLogContent } from './calls';

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

  const deletedForEveryone = readDeletedForEveryone(record);

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

  const rawMedia = deletedForEveryone ? [] : extractMessageMedia(record, content);
  const attachmentMimeType = readString(record.mimeType) ?? readString(record.contentType);
  const stickerMessage =
    String(messageType ?? '').toUpperCase() === 'STICKER' ||
    content.trim().toLowerCase() === 'sticker';
  const media = (stickerMessage
    ? rawMedia.map((item) =>
        item.kind === 'file' ? item : { ...item, kind: 'sticker' as const },
      )
    : rawMedia
  ).map((item) => withResolvedAttachmentKind(item, attachmentMimeType));

  const statusRaw = String(record.status ?? record.deliveryStatus ?? record.readStatus ?? '').toLowerCase();
  let status: MessageItem['status'] = null;
  const readBy = normalizeMessageReadReceipts(record.readBy ?? record.seenBy ?? record.readReceipts);
  const hasReaders = readBy.length > 0;

  if (
    statusRaw.includes('seen') ||
    statusRaw.includes('read') ||
    record.isRead === true ||
    record.read === true ||
    record.seen === true ||
    Boolean(readString(record.readAt)) ||
    Boolean(readString(record.seenAt)) ||
    hasReaders
  ) {
    status = 'seen';
  } else if (
    statusRaw.includes('deliver') ||
    statusRaw.includes('sent') ||
    statusRaw.includes('success')
  ) {
    status = 'delivered';
  } else if (statusRaw.includes('pending') || statusRaw.includes('sending')) {
    status = 'sending';
  }

  return {
    id: readString(record.id) ?? readString(record.messageId) ?? `message-${index}`,
    content,
    senderId: sender ? readString(sender.id) : readString(record.senderId),
    senderName,
    senderInitials: initialsFromName(senderName),
    senderAvatarUrl: resolveAvatarUrl(sender) ?? resolveAvatarUrl(record),
    createdAt:
      readString(record.createdAt) ??
      readString(record.sentAt) ??
      readString(record.timestamp) ??
      '',
    editedAt: readString(record.editedAt),
    pinnedAt: readString(record.pinnedAt),
    isOwn: record.isOwn === true || record.isMine === true || record.mine === true,
    status,
    readBy,
    reactions: normalizeReactions(
      record.reactions ??
        record.reactionsSummary ??
        record.messageReactions ??
        record.reactionSummary ??
        record.reactionList ??
        asRecord(record.metadata)?.reactions,
    ),
    replyToMessageId: readString(record.replyToId) ?? readString(record.replyToMessageId) ?? undefined,
    replyToMessage: (() => {
      const replyRecord = readReplyToRecord(record);
      return replyRecord ? normalizeMessage(replyRecord, 0) : undefined;
    })(),
    messageType,
    media,
    poll: deletedForEveryone ? null : normalizeMessagePoll(record),
    threadRootId:
      readString(record.threadRootId) ??
      readString(record.threadRootMessageId) ??
      readString(record.threadParentId) ??
      readString(record.parentMessageId) ??
      readString(record.parentThreadId) ??
      (() => {
        const threadRoot = asRecord(record.threadRoot);
        return threadRoot ? readString(threadRoot.id) : null;
      })() ??
      threadRootByMessageId.get(readString(record.id) ?? '') ??
      undefined,
    threadReplyCount: typeof record.threadReplyCount === 'number' 
      ? record.threadReplyCount 
      : typeof record.repliesCount === 'number' 
        ? record.repliesCount 
        : Array.isArray(record.replies) ? record.replies.length : 0,
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

function extractThreadMessageItems(payload: unknown): unknown[] {
  const direct = extractArray(payload, ['messages', 'items', 'replies', 'thread']);

  if (direct.length > 0) {
    return direct;
  }

  const record = asRecord(payload);

  if (!record) {
    return [];
  }

  const nestedData = asRecord(record.data);

  if (nestedData) {
    const nested = extractArray(nestedData, ['messages', 'items', 'replies', 'thread']);

    if (nested.length > 0) {
      return nested;
    }
  }

  const nestedThread = asRecord(record.thread);

  if (nestedThread) {
    return extractArray(nestedThread, ['messages', 'items', 'replies']);
  }

  return [];
}

export function normalizeMessageThread(payload: unknown, rootMessageId?: string): MessageItem[] {
  const items = extractThreadMessageItems(payload);

  return enrichMessageReplies(
    items
      .map(asRecord)
      .filter((item): item is Record<string, unknown> => item !== null)
      .map((item, index) => {
        const message = normalizeMessage(item, index);
        if (!rootMessageId || message.threadRootId) {
          return message;
        }

        return { ...message, threadRootId: rootMessageId };
      })
      .filter((message) => !rootMessageId || message.id !== rootMessageId),
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
        inviteId:
          readString(record.inviteId) ??
          readString(data?.inviteId) ??
          readString(data?.hubInviteId) ??
          readString(record.hubInviteId) ??
          null,
        link:
          readString(record.link) ??
          readString(record.url) ??
          readString(record.href) ??
          (data ? readString(data.link) : null) ??
          null,
        actorUserId:
          readString(record.actorUserId) ??
          readString(record.fromUserId) ??
          readString(record.senderUserId) ??
          readString(record.userId) ??
          readString(data?.actorUserId) ??
          readString(data?.fromUserId) ??
          readString(data?.userId) ??
          (asRecord(record.user) ? readString(asRecord(record.user)?.id) : null) ??
          (asRecord(record.fromUser) ? readString(asRecord(record.fromUser)?.id) : null) ??
          (asRecord(data?.user) ? readString(asRecord(data?.user)?.id) : null) ??
          null,
      };
    });
}

export function resolveFriendRequestUserId(
  notification: NotificationItem,
  conversations: ReadonlyArray<{ kind: string; title: string; peerUserId: string | null }> = [],
): string | null {
  if (notification.actorUserId) {
    return notification.actorUserId;
  }

  const body = notification.body.trim();
  const sentMatch = body.match(/^(.+?)\s+sent you a friend request/i);

  if (sentMatch) {
    const name = sentMatch[1].trim();
    const direct = conversations.find(
      (conversation) => conversation.kind === 'direct' && conversation.title === name,
    );

    if (direct?.peerUserId) {
      return direct.peerUserId;
    }
  }

  return null;
}

function notificationHaystack(notification: NotificationItem): string {
  return `${notification.type} ${notification.title} ${notification.body} ${notification.link ?? ''}`.toLowerCase();
}

export function isHubInviteNotification(notification: NotificationItem): boolean {
  const type = notification.type.toLowerCase();
  const haystack = notificationHaystack(notification);

  return (
    (type.includes('hub') && type.includes('invite')) ||
    haystack.includes('hub invite') ||
    (haystack.includes('invited you') && haystack.includes('hub'))
  );
}

export function isGroupInviteNotification(notification: NotificationItem): boolean {
  const type = notification.type.toLowerCase();
  const haystack = notificationHaystack(notification);

  return (
    (type.includes('group') && type.includes('invite')) ||
    haystack.includes('group invitation') ||
    haystack.includes('group invite')
  );
}

export function isCalendarRelatedNotification(notification: NotificationItem): boolean {
  if (isHubInviteNotification(notification) || isGroupInviteNotification(notification)) {
    return false;
  }

  if (notification.eventId) {
    return true;
  }

  const type = notification.type.toLowerCase();
  if (
    type.includes('calendar') ||
    type.includes('event') ||
    type.includes('reminder') ||
    (type.includes('invite') && (type.includes('calendar') || type.includes('event')))
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
  if (isHubInviteNotification(notification) || isGroupInviteNotification(notification)) {
    return {
      kind: 'hubs',
      channelId: notification.channelId ?? notification.conversationId,
      inviteId: notification.inviteId,
    };
  }

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

function resolveConversationIdFromReference(
  conversations: import('./chat').ConversationItem[],
  id: string | null | undefined,
): string | null {
  if (!id?.trim()) {
    return null;
  }

  const normalizedId = id.trim();

  const byPrimaryId = conversations.find((item) => item.id === normalizedId);

  if (byPrimaryId) {
    return byPrimaryId.id;
  }

  const byPeerUserId = conversations.find(
    (item) =>
      item.kind === 'direct' &&
      !item.isSelf &&
      item.peerUserId?.toLowerCase() === normalizedId.toLowerCase(),
  );

  if (byPeerUserId) {
    return byPeerUserId.id;
  }

  const byHubChannelId = conversations.find(
    (item) => item.kind === 'hub' && item.channelId === normalizedId,
  );

  if (byHubChannelId) {
    return byHubChannelId.id;
  }

  return null;
}

export function resolveNotificationConversationId(
  notification: NotificationItem,
  conversations: import('./chat').ConversationItem[],
): string | null {
  if (notification.conversationId) {
    const resolved = resolveConversationIdFromReference(
      conversations,
      notification.conversationId,
    );

    if (resolved) {
      return resolved;
    }
  }

  if (notification.channelId) {
    const resolved = resolveConversationIdFromReference(conversations, notification.channelId);

    if (resolved) {
      return resolved;
    }
  }

  const title = notification.title.trim();

  if (title) {
    const exactDirectMatch = conversations.find(
      (conversation) =>
        conversation.kind === 'direct' &&
        conversation.title.trim().toLowerCase() === title.toLowerCase(),
    );

    if (exactDirectMatch) {
      return exactDirectMatch.id;
    }
  }

  return notification.conversationId ?? null;
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

      const userId =
        readString(user.id) ??
        readString(record.userId) ??
        readString(record.fromUserId) ??
        '';

      return {
        id: readString(record.id) ?? userId ?? `friend-${index}`,
        userId,
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
      const user = asRecord(record.user) ?? record;
      const name =
        readString(user.name) ??
        readString(user.displayName) ??
        readString(user.username) ??
        readString(record.name) ??
        readString(record.displayName) ??
        readString(record.username) ??
        'Teammate';

      return {
        id:
          readString(user.id) ??
          readString(record.userId) ??
          readString(record.id) ??
          `member-${index}`,
        name,
        username: readString(user.username) ?? readString(record.username) ?? '',
        avatarUrl: resolveAvatarUrl(user) ?? resolveAvatarUrl(record),
        initials: initialsFromName(name),
        statusMessage: readUserStatusMessage(record),
      };
    });
}

export function validateMessageDraft(content: string): { ok: true } | { ok: false; error: string } {
  if (content.length > 4000) {
    return { ok: false, error: 'Message must be 4000 characters or fewer.' };
  }

  return { ok: true };
}

export function validateScheduleMessageContent(
  content: string,
): { ok: true; content: string } | { ok: false; error: string } {
  const trimmed = content.trim();

  if (!trimmed) {
    return { ok: false, error: 'Scheduled messages must include text.' };
  }

  const draftValidation = validateMessageDraft(trimmed);
  if (!draftValidation.ok) {
    return draftValidation;
  }

  return { ok: true, content: trimmed };
}

export function buildCreatePollPayload(input: {
  question: string;
  options: string[];
  allowMultiple?: boolean;
  expiresAt?: string | null;
}): Record<string, unknown> {
  const options = input.options.map((option) => option.trim()).filter(Boolean);

  return {
    question: input.question.trim(),
    options,
    optionTexts: options,
    pollOptions: options.map((text) => ({ text, label: text })),
    allowMultiple: input.allowMultiple === true,
    ...(input.expiresAt ? { expiresAt: input.expiresAt } : {}),
  };
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
