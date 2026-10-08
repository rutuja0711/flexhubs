import { normalizeCalendarEventsDetailed } from './extras';
import { normalizeMessage, extractMessageMedia } from './messages';

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
  savedAt: string;
  messageAt: string;
  conversationTitle: string;
  senderName: string;
  conversationId: string | null;
  messageId: string | null;
  mediaUrl?: string;
};

export type FileItem = {
  id: string;
  name: string;
  sharedBy: string;
  conversationName: string;
  conversationId: string | null;
  messageId: string | null;
  createdAt: string;
  filter: string;
  url?: string;
  mimeType?: string;
};

export type CalendarEventInvitee = {
  userId?: string | null;
  username: string;
  name: string;
  status: string;
  avatarUrl?: string | null;
};

export type CalendarTaggedHub = {
  conversationId?: string | null;
  channelId?: string | null;
  name: string;
  slug?: string;
};

export type CalendarEventItem = {
  id: string;
  title: string;
  startsAt: string;
  endsAt?: string | null;
  mentionUserIds?: string[];
  createdAt?: string;
  createdById?: string | null;
  createdByAvatarUrl?: string | null;
  description: string;
  notes?: string;
  status?: string | null;
  myResponseStatus?: string | null;
  sharedBy?: string;
  invitees?: CalendarEventInvitee[];
  conversationId?: string | null;
  conversationName?: string;
  channelId?: string | null;
  taggedHubs?: CalendarTaggedHub[];
  isOwner?: boolean;
  canRespond?: boolean;
  canDelete?: boolean;
};

export type ChannelItem = {
  id: string;
  slug: string;
  name: string;
  memberCount: number;
  description: string;
  isMember: boolean;
  pendingInviteId: string | null;
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

export type BlockedUserItem = {
  id: string;
  username: string;
  email: string;
  avatar: string | null;
};

export type FriendRelationship = {
  isFriend: boolean;
  sameOrganization: boolean;
  canMessage: boolean;
  requestSent: boolean;
  requestReceived: boolean;
  requestId: string | null;
  /** Viewer has blocked this user (or block is active on viewer side). */
  isBlocked: boolean;
  /** This user blocked the viewer. */
  isBlockedByUser: boolean;
  blockedYou: boolean;
  blockedByMe: boolean;
};

export type ChannelInviteItem = {
  id: string;
  userId: string;
  email: string;
  username: string;
  createdAt: string;
};

export type CreateChannelInput = {
  name: string;
  slug?: string;
  description?: string;
  memberIds?: string[];
};

export type CreatedChannelResult = {
  conversationId: string;
  channel: ChannelItem;
};

export function slugifyChannelName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function normalizeSavedMessages(payload: unknown): SavedMessageItem[] {
  return extractArray(payload, ['saved', 'items', 'messages', 'data'])
    .map(asRecord)
    .filter((item): item is Record<string, unknown> => item !== null)
    .map((record, index) => {
      const message = asRecord(record.message);
      const sender = message ? asRecord(message.sender) : null;
      const conversationTitle =
        readString(record.conversationTitle) ??
        readString(asRecord(record.conversation)?.name) ??
        readString(asRecord(record.conversation)?.title) ??
        'Chat';
      const senderName = sender
        ? readString(sender.username) ??
          readString(sender.name) ??
          readString(sender.displayName)
        : readString(record.senderName) ?? readString(record.senderUsername);

      let source = 'Unknown';

      if (conversationTitle && senderName) {
        source = `${conversationTitle} · ${senderName}`;
      } else if (conversationTitle) {
        source = conversationTitle;
      } else if (senderName) {
        source = senderName;
      }

      const savedAt = readString(record.savedAt) ?? readString(record.createdAt) ?? '';
      const messageAt =
        (message ? readString(message.createdAt) ?? readString(message.sentAt) : null) ??
        readString(record.messageAt) ??
        '';

      let mediaUrl: string | undefined = undefined;
      let contentText = '';
      
      if (message) {
        const normalized = normalizeMessage(message, index);
        if (normalized.media && normalized.media.length > 0) {
           mediaUrl = normalized.media[0].url;
           // If content is just empty, give it a default so it doesn't look completely empty
           if (!normalized.content.trim()) {
              contentText = normalized.media[0].kind === 'image' || normalized.media[0].kind === 'gif' ? 'Photo' : 'Attachment';
           }
        }
        if (!contentText) contentText = normalized.content;
      }
      
      const rawContent = readString(record.content) ?? readString(record.text) ?? readString(record.preview) ?? '';
      
      if (!mediaUrl) {
         // Fallback to outer record
         const recordMedia = extractMessageMedia(record, rawContent);
         if (recordMedia.length > 0) {
            mediaUrl = recordMedia[0].url;
            if (!contentText.trim()) {
               contentText = recordMedia[0].kind === 'image' || recordMedia[0].kind === 'gif' ? 'Photo' : 'Attachment';
            }
         }
      }

      if (!contentText) contentText = rawContent;

      return {
        id: readString(record.id) ?? `saved-${index}`,
        content: contentText,
        source,
        createdAt: savedAt,
        savedAt,
        messageAt,
        conversationTitle,
        senderName: senderName ?? '',
        conversationId:
          readString(record.conversationId) ??
          readString(asRecord(record.conversation)?.id) ??
          (message ? readString(message.conversationId) : null),
        messageId:
          readString(record.messageId) ??
          readString(record.message_id) ??
          (message ? readString(message.id) : null),
        mediaUrl,
      };
    });
}

export function normalizeFiles(payload: unknown): FileItem[] {
  return extractArray(payload, ['files', 'items', 'data'])
    .map(asRecord)
    .filter((item): item is Record<string, unknown> => item !== null)
    .map((record, index) => {
      const message = asRecord(record.message);
      const conversation = asRecord(record.conversation);
      const sender =
        asRecord(record.sender) ??
        asRecord(record.user) ??
        asRecord(record.uploader) ??
        (message ? asRecord(message.sender) : null);

      const sharedBy =
        readString(record.sharedBy) ??
        readString(record.senderUsername) ??
        readString(record.senderName) ??
        readString(record.uploadedBy) ??
        (sender
          ? readString(sender.displayName) ??
            readString(sender.name) ??
            readString(sender.username)
          : null) ??
        '';

      return {
        id:
          readString(record.id) ??
          (message ? readString(message.id) : null) ??
          `file-${index}`,
        name: readString(record.fileName) ?? readString(record.name) ?? 'File',
        sharedBy,
        conversationName:
          readString(record.conversationTitle) ??
          readString(record.conversationName) ??
          readString(conversation?.title) ??
          readString(conversation?.name) ??
          readString(record.channelName) ??
          readString(record.hubName) ??
          '',
        conversationId:
          readString(record.conversationId) ??
          readString(conversation?.id) ??
          (message ? readString(message.conversationId) : null),
        messageId:
          readString(record.messageId) ?? (message ? readString(message.id) : null),
        createdAt: readString(record.createdAt) ?? readString(record.uploadedAt) ?? '',
        filter: readString(record.filter) ?? readString(record.type) ?? 'all',
        url:
          readString(record.url) ??
          readString(record.fileUrl) ??
          readString(record.downloadUrl) ??
          (message ? readString(message.fileUrl) : null) ??
          undefined,
        mimeType:
          readString(record.mimeType) ??
          readString(record.contentType) ??
          (message ? readString(message.mimeType) : null) ??
          undefined,
      };
    });
}

export function normalizeCalendarEvents(payload: unknown): CalendarEventItem[] {
  return normalizeCalendarEventsDetailed(payload).map((event) => ({
    id: event.id,
    title: event.title,
    startsAt: event.startsAt,
    createdAt: event.createdAt,
    createdById: event.createdById,
    createdByAvatarUrl: event.createdByAvatarUrl,
    description: event.description || event.notes,
    notes: event.notes,
    status: event.status,
    myResponseStatus: event.myResponseStatus,
    sharedBy: event.sharedBy,
    invitees: event.invitees,
    mentionUserIds: event.mentionUserIds,
    conversationId: event.conversationId,
    conversationName: event.conversationName,
    channelId: event.channelId,
    taggedHubs: event.taggedHubs,
    isOwner: event.isOwner,
    canRespond: event.canRespond,
    canDelete: event.canDelete,
  }));
}

export function normalizeChannels(payload: unknown): ChannelItem[] {
  return extractArray(payload, ['channels', 'hubs', 'items', 'data'])
    .map(asRecord)
    .filter((item): item is Record<string, unknown> => item !== null)
    .map((record, index) => ({
      id: readString(record.id) ?? readString(record.channelId) ?? `channel-${index}`,
      slug: readString(record.slug) ?? '',
      name: readString(record.name) ?? readString(record.title) ?? 'Hub',
      memberCount: typeof record.memberCount === 'number' ? record.memberCount : 0,
      description: readString(record.description) ?? '',
      isMember: record.isMember === true,
      pendingInviteId: readString(record.pendingInviteId),
    }));
}

function normalizeChannelRecord(record: Record<string, unknown>, index: number): ChannelItem {
  return {
    id: readString(record.id) ?? readString(record.channelId) ?? `channel-${index}`,
    slug: readString(record.slug) ?? '',
    name: readString(record.name) ?? readString(record.title) ?? 'Hub',
    memberCount: typeof record.memberCount === 'number' ? record.memberCount : 0,
    description: readString(record.description) ?? '',
    isMember: record.isMember === true,
    pendingInviteId: readString(record.pendingInviteId),
  };
}

export function normalizeCreatedChannel(payload: unknown): CreatedChannelResult {
  const record = asRecord(payload);
  const conversation = asRecord(record?.conversation) ?? record ?? {};
  const channel = normalizeChannelRecord(conversation, 0);

  return {
    conversationId: channel.id,
    channel,
  };
}

export function normalizeBlockedUsers(payload: unknown): BlockedUserItem[] {
  return extractArray(payload, ['users', 'blocks', 'items', 'data'])
    .map(asRecord)
    .filter((item): item is Record<string, unknown> => item !== null)
    .map((record, index) => {
      const nestedUser = asRecord(record.user) ?? asRecord(record.blockedUser);
      const userId =
        readString(record.userId) ??
        readString(record.blockedUserId) ??
        readString(record.blockedId) ??
        readString(nestedUser?.id) ??
        readString(record.id) ??
        `blocked-${index}`;

      return {
        id: userId,
        username:
          readString(record.username) ??
          readString(nestedUser?.username) ??
          readString(nestedUser?.name) ??
          '',
        email: readString(record.email) ?? readString(nestedUser?.email) ?? '',
        avatar: readString(record.avatar) ?? readString(nestedUser?.avatar),
      };
    });
}

export function normalizeFriendRelationship(payload: unknown): FriendRelationship {
  const record = asRecord(payload) ?? {};
  const isBlockedByUser =
    record.isBlockedByUser === true ||
    record.blockedByUser === true ||
    record.hasBlockedYou === true ||
    record.blockedYou === true;
  const blockedByMe =
    record.blockedByMe === true ||
    record.viewerBlocked === true ||
    record.hasBlocked === true ||
    (record.isBlocked === true && !isBlockedByUser);
  const isBlocked = record.isBlocked === true || blockedByMe || isBlockedByUser;

  return {
    isFriend: record.isFriend === true,
    sameOrganization: record.sameOrganization === true,
    canMessage: record.canMessage === true,
    requestSent: record.requestSent === true,
    requestReceived: record.requestReceived === true,
    requestId: readString(record.requestId),
    isBlocked,
    isBlockedByUser,
    blockedYou: isBlockedByUser,
    blockedByMe,
  };
}

export function normalizeChannelInvites(payload: unknown): ChannelInviteItem[] {
  return extractArray(payload, ['invites', 'items', 'data'])
    .map(asRecord)
    .filter((item): item is Record<string, unknown> => item !== null)
    .map((record, index) => {
      const user = asRecord(record.user) ?? record;

      return {
        id: readString(record.id) ?? `invite-${index}`,
        userId: readString(record.userId) ?? readString(user.id) ?? '',
        email: readString(record.email) ?? readString(user.email) ?? '',
        username: readString(record.username) ?? readString(user.username) ?? '',
        createdAt: readString(record.createdAt) ?? '',
      };
    });
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
