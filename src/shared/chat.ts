import { resolveAvatarUrl } from './profile';
import { decoratePreviewText, formatMessagePreview, normalizeMessage } from './messages';

export type ConversationKind = 'direct' | 'hub';

export type PresenceStatus = 'online' | 'away' | 'dnd' | 'offline';

export type ConversationItem = {
  id: string;
  kind: ConversationKind;
  title: string;
  subtitle: string;
  messagePreview: string;
  draftPreview: string | null;
  isDraftPreview: boolean;
  timestamp: string;
  avatarUrl: string | null;
  avatarInitials: string;
  isPinned: boolean;
  isSelf: boolean;
  status: PresenceStatus | null;
  unreadCount: number;
  peerUserId: string | null;
  channelId: string | null;
  notificationsSnoozed?: boolean;
};

export type ConversationsPayload = {
  conversations: ConversationItem[];
};

export type UnreadCountPayload = {
  count: number;
};

const BROKEN_DIRECT_TITLES = new Set([
  'your account',
  'conversation',
  'direct message',
  'unknown user',
  'unknown',
]);

export function isBrokenDirectTitle(
  title: string,
  selfDisplayName?: string | null,
): boolean {
  const normalized = title.trim().toLowerCase();

  if (!normalized) {
    return true;
  }

  if (BROKEN_DIRECT_TITLES.has(normalized)) {
    return true;
  }

  const normalizedSelf = selfDisplayName?.trim().toLowerCase();

  if (normalizedSelf && normalized === normalizedSelf) {
    return true;
  }

  return normalized.includes('yourself');
}

export function sanitizeDirectDisplayName(
  title: string,
  selfDisplayName?: string | null,
  fallback = 'Direct message',
): string {
  const trimmed = title.trim();

  if (!isBrokenDirectTitle(trimmed, selfDisplayName)) {
    return trimmed;
  }

  const trimmedFallback = fallback.trim();

  if (trimmedFallback && !isBrokenDirectTitle(trimmedFallback, selfDisplayName)) {
    return trimmedFallback;
  }

  return 'Direct message';
}

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

function isTruthyFlag(value: unknown): boolean {
  return value === true || value === 1 || value === 'true' || value === '1';
}

const CONVERSATION_SNOOZE_KEYS = ['snoozed', 'isSnoozed', 'notificationsSnoozed'] as const;

function conversationSnoozeSources(
  record: Record<string, unknown>,
): Record<string, unknown>[] {
  return [
    record,
    asRecord(record.notificationSettings),
    asRecord(asRecord(record.membership)?.notificationSettings),
    asRecord(asRecord(record.member)?.notificationSettings),
    asRecord(asRecord(record.currentMember)?.notificationSettings),
  ].filter((item): item is Record<string, unknown> => item !== null);
}

export function readConversationSnoozeState(
  record: Record<string, unknown> | null | undefined,
): boolean | null {
  if (!record) {
    return null;
  }

  let sawSignal = false;

  for (const source of conversationSnoozeSources(record)) {
    for (const key of CONVERSATION_SNOOZE_KEYS) {
      if (source[key] === undefined || source[key] === null) {
        continue;
      }

      sawSignal = true;
      if (isTruthyFlag(source[key])) {
        return true;
      }
    }
  }

  return sawSignal ? false : null;
}

export function readConversationSnoozed(record: Record<string, unknown> | null | undefined): boolean {
  return readConversationSnoozeState(record) === true;
}

export const CONVERSATION_SNOOZE_OPTIONS = [
  { value: '30m', label: '30 minutes' },
  { value: '1h', label: '1 hour' },
  { value: '2h', label: '2 hours' },
  { value: '4h', label: '4 hours' },
  { value: '8h', label: '8 hours' },
  { value: '24h', label: '24 hours' },
  { value: 'tomorrow', label: 'Until tomorrow 9:00 AM' },
  { value: 'forever', label: 'Forever' },
] as const;

export function conversationSnoozeUntil(duration: string): string | null {
  if (duration === 'off' || duration === 'forever') {
    return null;
  }

  if (duration === 'tomorrow') {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    return tomorrow.toISOString();
  }

  const match = duration.match(/^(\d+)(m|h)$/);

  if (!match) {
    return null;
  }

  const amount = Number(match[1]);
  const until = new Date();

  if (match[2] === 'm') {
    until.setMinutes(until.getMinutes() + amount);
  } else {
    until.setHours(until.getHours() + amount);
  }

  return until.toISOString();
}

export function formatConversationSnoozeUntil(until: string | null, forever = false): string {
  if (forever || !until) {
    return 'Snoozed indefinitely';
  }

  const date = new Date(until);

  if (Number.isNaN(date.getTime())) {
    return 'Snoozed';
  }

  return `Snoozed until ${date.toLocaleString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
    day: 'numeric',
  })}`;
}

export function buildConversationSnoozePayload(duration: string): Record<string, unknown> {
  if (duration === 'off') {
    return {
      snoozed: false,
      snoozedForever: false,
      snoozedUntil: null,
      duration: 'off',
      snoozeDuration: 'off',
    };
  }

  if (duration === 'forever') {
    return {
      snoozed: true,
      snoozedForever: true,
      snoozedUntil: null,
      duration: 'forever',
      snoozeDuration: 'forever',
    };
  }

  const snoozedUntil = conversationSnoozeUntil(duration);

  return {
    snoozed: true,
    snoozedForever: false,
    snoozedUntil,
    duration,
    snoozeDuration: duration,
  };
}

export function withConversationSnoozed(
  record: Record<string, unknown> | null,
  snoozed: boolean,
): Record<string, unknown> | null {
  if (!record) {
    return record;
  }

  const existing = asRecord(record.notificationSettings) ?? {};

  return {
    ...record,
    notificationSettings: {
      ...existing,
      snoozed,
    },
  };
}

function initialsFromName(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return name.slice(0, 2).toUpperCase();
}

function readMemberCount(record: Record<string, unknown>): number | null {
  const explicit =
    (typeof record.memberCount === 'number' && Number.isFinite(record.memberCount)
      ? record.memberCount
      : null) ??
    (typeof record.participantCount === 'number' && Number.isFinite(record.participantCount)
      ? record.participantCount
      : null);

  if (explicit !== null) {
    return explicit;
  }

  let largest = 0;

  for (const key of ['members', 'participants', 'users', 'groupMembers']) {
    const value = record[key];

    if (Array.isArray(value)) {
      largest = Math.max(largest, value.length);
    }
  }

  return largest > 0 ? largest : null;
}

function inferKind(record: Record<string, unknown>): ConversationKind {
  const type = String(record.type ?? record.kind ?? record.conversationType ?? '').toUpperCase();

  if (
    type === 'DIRECT' ||
    type === 'DM' ||
    type === 'PRIVATE' ||
    type === 'ONE_TO_ONE' ||
    type === 'ONE-TO-ONE'
  ) {
    return 'direct';
  }

  if (record.isDirect === true || record.isDm === true || record.isOneToOne === true) {
    return 'direct';
  }

  const memberCount = readMemberCount(record);

  if (memberCount !== null && memberCount <= 2) {
    return 'direct';
  }

  if (
    type.includes('HUB') ||
    type.includes('CHANNEL') ||
    type.includes('GROUP') ||
    record.isHub === true ||
    record.isChannel === true ||
    record.isGroup === true ||
    Boolean(record.hubId)
  ) {
    return 'hub';
  }

  if (Boolean(record.channelId) && memberCount !== null && memberCount > 2) {
    return 'hub';
  }

  if (memberCount !== null && memberCount > 2) {
    return 'hub';
  }

  return 'direct';
}

function readConversationUnread(record: Record<string, unknown>): number {
  const direct =
    readNumber(record.unreadCount) ??
    readNumber(record.unread) ??
    readNumber(record.unreadMessagesCount) ??
    readNumber(record.unreadMessages);

  if (direct !== null) {
    return direct;
  }

  const membership =
    asRecord(record.membership) ?? asRecord(record.member) ?? asRecord(record.currentMember);

  if (membership) {
    return readNumber(membership.unreadCount) ?? readNumber(membership.unread) ?? 0;
  }

  return 0;
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

export function mapApiPresenceToStatus(value: string | null | undefined): PresenceStatus | null {
  if (!value) {
    return null;
  }

  return inferPresence({ status: value });
}

function readDirectPeerUserId(
  record: Record<string, unknown>,
  viewerUserId: string | null = readViewerUserId(record),
): string | null {
  if (inferKind(record) !== 'direct') {
    return null;
  }

  const memberIds: string[] = [];

  for (const key of ['members', 'participants', 'users']) {
    const value = record[key];

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
        memberIds.push(userId);
      }
    }
  }

  const viewerId = viewerUserId;

  if (viewerId && memberIds.length > 0) {
    const peerId = memberIds.find((id) => id !== viewerId);

    if (peerId) {
      return peerId;
    }
  }

  if (memberIds.length === 2) {
    return memberIds.find((id) => id !== viewerId) ?? memberIds[1];
  }

  for (const key of ['otherUser', 'peer', 'recipient', 'participant', 'partner', 'dmUser'] as const) {
    const nestedUser = asRecord(record[key]);

    if (!nestedUser) {
      continue;
    }

    const nestedId =
      readString(nestedUser.id) ??
      readString(nestedUser.userId) ??
      readString(nestedUser._id);

    if (nestedId && nestedId !== viewerId) {
      return nestedId;
    }
  }

  const directId =
    readString(record.otherUserId) ??
    readString(record.peerUserId) ??
    readString(record.recipientId) ??
    readString(record.targetUserId) ??
    readString(record.dmUserId) ??
    readString(record.partnerId) ??
    readString(record.participantId);

  if (directId && directId !== viewerId) {
    return directId;
  }

  const fallbackUser = asRecord(record.user);
  const fallbackUserId =
    readString(fallbackUser?.id) ??
    readString(fallbackUser?.userId) ??
    readString(fallbackUser?._id);

  if (fallbackUserId && fallbackUserId !== viewerId && !memberIds.includes(fallbackUserId)) {
    return fallbackUserId;
  }

  return null;
}

function readDraftPreview(record: Record<string, unknown>): string | null {
  const direct =
    readString(record.draftPreview) ??
    readString(record.draft_preview) ??
    readString(record.messageDraft) ??
    readString(record.messageDraftPreview) ??
    readString(record.draftContent);

  if (direct) {
    return direct;
  }

  const draft = asRecord(record.draft) ?? asRecord(record.messageDraft);
  return draft
    ? readString(draft.content) ?? readString(draft.text) ?? readString(draft.body)
    : null;
}

function buildConversationSubtitle(messagePreview: string, draftPreview: string | null): {
  subtitle: string;
  isDraftPreview: boolean;
} {
  const trimmedDraft = draftPreview?.trim();
  if (trimmedDraft) {
    return {
      subtitle: `Draft: ${trimmedDraft}`,
      isDraftPreview: true,
    };
  }

  return {
    subtitle: messagePreview,
    isDraftPreview: false,
  };
}

export function applyDraftPreviewToConversation(
  conversation: ConversationItem,
  draftPreview: string | null,
): ConversationItem {
  const { subtitle, isDraftPreview } = buildConversationSubtitle(
    conversation.messagePreview,
    draftPreview,
  );

  return {
    ...conversation,
    draftPreview: draftPreview?.trim() || null,
    subtitle,
    isDraftPreview,
  };
}

export function seedDraftPreviewCache(
  conversations: ConversationItem[],
  cache: Record<string, string>,
): void {
  for (const conversation of conversations) {
    const preview = conversation.draftPreview?.trim();

    if (preview) {
      cache[conversation.id] = preview;
    }
  }
}

export function mergeConversationDraftPreviews(
  conversations: ConversationItem[],
  draftPreviews: Readonly<Record<string, string | null | undefined>>,
  activeConversationId?: string | null,
  activeDraft?: string,
): ConversationItem[] {
  return conversations.map((conversation) => {
    if (activeConversationId && conversation.id === activeConversationId) {
      return applyDraftPreviewToConversation(conversation, activeDraft?.trim() || null);
    }

    const cached = draftPreviews[conversation.id];

    if (cached !== undefined) {
      return applyDraftPreviewToConversation(conversation, cached?.trim() || null);
    }

    return conversation;
  });
}

function readMessageSenderName(record: Record<string, unknown>): string | null {
  const sender = asRecord(record.sender) ?? asRecord(record.user) ?? asRecord(record.author);

  return (
    readString(record.senderName) ??
    (sender
      ? readString(sender.name) ??
        readString(sender.displayName) ??
        readString(sender.username)
      : null)
  );
}

function prefixGroupPreview(senderName: string | null | undefined, preview: string): string {
  const trimmedPreview = preview.trim();
  const trimmedSender = senderName?.trim();

  if (!trimmedPreview || !trimmedSender || trimmedSender === 'Unknown') {
    return trimmedPreview;
  }

  const separator = trimmedPreview.indexOf(': ');
  if (separator > 0 && separator < 48) {
    const existingSender = trimmedPreview.slice(0, separator).trim();
    if (existingSender.toLowerCase() === trimmedSender.toLowerCase()) {
      return trimmedPreview;
    }
  }

  return `${trimmedSender}: ${trimmedPreview}`;
}

export function buildConversationListPreview(
  kind: ConversationKind,
  preview: string,
  senderName?: string | null,
): string {
  const trimmed = preview.trim();

  if (!trimmed) {
    return '';
  }

  if (kind !== 'hub') {
    return decoratePreviewText(trimmed);
  }

  return decoratePreviewText(prefixGroupPreview(senderName, trimmed));
}

function readLastMessagePreview(record: Record<string, unknown>): string {
  const kind = inferKind(record);
  const lastMessage = asRecord(record.lastMessage) ?? asRecord(record.latestMessage);

  if (lastMessage) {
    const normalized = normalizeMessage(lastMessage, 0);
    const preview = formatMessagePreview(normalized);

    if (preview) {
      const senderName = readMessageSenderName(lastMessage) ?? normalized.senderName;
      return buildConversationListPreview(kind, preview, senderName);
    }
  }

  const fallback =
    readString(record.preview) ??
    readString(record.lastMessagePreview) ??
    readString(record.subtitle) ??
    '';

  return buildConversationListPreview(kind, fallback);
}

function readMemberPeople(record: Record<string, unknown>): Record<string, unknown>[] {
  const participants = Array.isArray(record.participants) ? record.participants : [];
  const members = Array.isArray(record.members) ? record.members : [];
  const users = Array.isArray(record.users) ? record.users : [];

  return [...participants, ...members, ...users]
    .map(asRecord)
    .filter((item): item is Record<string, unknown> => item !== null);
}

function readViewerUserId(record: Record<string, unknown>): string | null {
  return (
    readString(record.viewerId) ??
    readString(record.currentUserId) ??
    readString(asRecord(record.membership)?.userId)
  );
}

function readDirectConversationPeerTitle(
  record: Record<string, unknown>,
  viewerId: string | null = readViewerUserId(record),
): string | null {
  for (const member of readMemberPeople(record)) {
    const user = asRecord(member.user) ?? member;
    const memberId =
      readString(user.id) ??
      readString(member.userId) ??
      readString(member.id);

    if (viewerId && memberId === viewerId) {
      continue;
    }

    const name =
      readString(user.username) ??
      readString(user.name) ??
      readString(user.displayName) ??
      readString(member.username) ??
      readString(member.name) ??
      readString(member.displayName);

    if (name) {
      return name;
    }
  }

  return null;
}

function readConversationTitle(
  record: Record<string, unknown>,
  viewerUserId: string | null = readViewerUserId(record),
): string {
  if (inferKind(record) === 'direct') {
    const peerTitle = readDirectConversationPeerTitle(record, viewerUserId);

    if (peerTitle && !isBrokenDirectTitle(peerTitle)) {
      return peerTitle;
    }
  }

  const directName =
    readString(record.name) ??
    readString(record.title) ??
    readString(record.displayName);

  if (directName && !isBrokenDirectTitle(directName)) {
    return directName;
  }

  const member = readMemberPeople(record)[0];

  if (member) {
    const user = asRecord(member.user) ?? member;

    const memberName =
      readString(user.username) ??
      readString(user.name) ??
      readString(user.displayName) ??
      readString(member.username) ??
      readString(member.name) ??
      readString(member.displayName);

    if (memberName && !isBrokenDirectTitle(memberName)) {
      return memberName;
    }
  }

  return inferKind(record) === 'direct' ? 'Direct message' : 'Conversation';
}

function readConversationId(record: Record<string, unknown>, index: number): string {
  const nested = asRecord(record.conversation);
  const id =
    readString(record.id) ??
    readString(record.conversationId) ??
    readString(record._id) ??
    readString(nested?.id);

  return id ?? `conversation-${index}`;
}

function readAvatarPeerRecord(
  record: Record<string, unknown>,
  viewerUserId: string | null,
): Record<string, unknown> | null {
  for (const key of ['otherUser', 'peer', 'recipient', 'participant', 'partner', 'dmUser'] as const) {
    const nested = asRecord(record[key]);

    if (nested) {
      return nested;
    }
  }

  for (const member of readMemberPeople(record)) {
    const user = asRecord(member.user) ?? member;
    const memberId =
      readString(user.id) ??
      readString(member.userId) ??
      readString(member.id);

    if (viewerUserId && memberId === viewerUserId) {
      continue;
    }

    return user;
  }

  return null;
}

function readAvatar(
  record: Record<string, unknown>,
  viewerUserId: string | null = readViewerUserId(record),
): { url: string | null; initials: string } {
  const title = readConversationTitle(record, viewerUserId);
  const conversationUrl = resolveAvatarUrl(record);

  if (conversationUrl) {
    return { url: conversationUrl, initials: initialsFromName(title) };
  }

  const peerRecord = readAvatarPeerRecord(record, viewerUserId);

  if (peerRecord) {
    const peerUrl = resolveAvatarUrl(peerRecord);
    const peerName =
      readString(peerRecord.name) ??
      readString(peerRecord.displayName) ??
      readString(peerRecord.username) ??
      title;

    return {
      url: peerUrl,
      initials: initialsFromName(peerName),
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

  const collected: Record<string, unknown>[] = [];

  for (const key of [
    'conversations',
    'direct',
    'directMessages',
    'hubs',
    'channels',
    'groups',
    'items',
    'results',
  ]) {
    const value = record[key];

    if (Array.isArray(value)) {
      const fromHubList = key === 'hubs' || key === 'channels' || key === 'groups';
      collected.push(
        ...value
          .map(asRecord)
          .filter((item): item is Record<string, unknown> => item !== null)
          .map((item) =>
            fromHubList
              ? {
                  ...item,
                  isHub: item.isHub === false ? item.isHub : true,
                  isGroup: key === 'groups' ? true : item.isGroup,
                }
              : item,
          ),
      );
    }
  }

  if (collected.length > 0) {
    return collected;
  }

  const nestedData = asRecord(record.data);

  if (nestedData) {
    const nested = extractConversationRecords(nestedData);

    if (nested.length > 0) {
      return nested;
    }
  }

  return [];
}

export function readDirectPeerDisplayName(
  record: Record<string, unknown>,
  viewerUserId?: string | null,
): string | null {
  const viewerId = viewerUserId ?? readViewerUserId(record);
  const peerTitle = readDirectConversationPeerTitle(record, viewerId);

  if (peerTitle && !isBrokenDirectTitle(peerTitle)) {
    return peerTitle;
  }

  return null;
}

function readConversationPinned(record: Record<string, unknown>): boolean {
  if (
    record.isPinned === true ||
    record.pinned === true ||
    record.favorite === true ||
    record.isFavorite === true ||
    record.isFavorited === true
  ) {
    return true;
  }

  if (readString(record.favoritedAt)) {
    return true;
  }

  const membership =
    asRecord(record.membership) ?? asRecord(record.member) ?? asRecord(record.currentMember);

  if (
    membership &&
    (membership.isFavorite === true ||
      membership.favorite === true ||
      membership.isFavorited === true ||
      readString(membership.favoritedAt))
  ) {
    return true;
  }

  return false;
}

function flattenConversationRecord(record: Record<string, unknown>): Record<string, unknown> {
  const nested = asRecord(record.conversation);

  if (!nested) {
    return record;
  }

  const merged: Record<string, unknown> = { ...nested };

  for (const key of [
    'isFavorite',
    'favorite',
    'favoritedAt',
    'isFavorited',
    'isPinned',
    'pinned',
    'unreadCount',
    'unread',
    'lastMessage',
    'latestMessage',
    'draft',
    'notificationSettings',
    'membership',
    'member',
    'currentMember',
  ] as const) {
    if (record[key] !== undefined && record[key] !== null) {
      merged[key] = record[key];
    }
  }

  merged.id = readString(record.id) ?? readString(nested.id) ?? readString(record.conversationId) ?? merged.id;

  return merged;
}

export function normalizeConversation(
  record: Record<string, unknown>,
  index: number,
  viewerUserId?: string | null,
): ConversationItem {
  const source = flattenConversationRecord(record);
  const viewerId = viewerUserId ?? readViewerUserId(source);
  const title = readConversationTitle(source, viewerId);
  const avatar = readAvatar(source, viewerId);
  const messagePreview = readLastMessagePreview(source);
  const draftPreview = readDraftPreview(source);
  const { subtitle, isDraftPreview } = buildConversationSubtitle(messagePreview, draftPreview);

  return {
    id: readConversationId(source, index),
    kind: inferKind(source),
    title,
    subtitle,
    messagePreview,
    draftPreview: draftPreview?.trim() || null,
    isDraftPreview,
    timestamp: readTimestamp(source),
    avatarUrl: avatar.url,
    avatarInitials: avatar.initials,
    isPinned: readConversationPinned(source),
    isSelf: source.isSelf === true || source.isYourself === true || title.toLowerCase().includes('yourself'),
    status: inferPresence(source),
    unreadCount: readConversationUnread(source),
    peerUserId: readDirectPeerUserId(source, viewerId),
    channelId: readHubChannelId(source),
    notificationsSnoozed: readConversationSnoozed(source),
  };
}

export function readHubChannelId(
  source: Record<string, unknown> | null | undefined,
  fallbackId?: string | null,
): string | null {
  const record = source ?? {};
  const channel = asRecord(record.channel);
  const hub = asRecord(record.hub);

  return (
    readString(record.channelId) ??
    readString(record.hubId) ??
    readString(channel?.id) ??
    readString(hub?.id) ??
    (fallbackId?.trim() ? fallbackId.trim() : null)
  );
}

export function findConversationByAnyId(
  conversations: ConversationItem[],
  id: string | null | undefined,
): ConversationItem | null {
  if (!id) {
    return null;
  }

  const normalizedId = id.trim();

  if (!normalizedId) {
    return null;
  }

  const byPrimaryId = conversations.find((item) => item.id === normalizedId);

  if (byPrimaryId) {
    return byPrimaryId;
  }

  const byPeerUserId = findDirectConversationForUser(conversations, normalizedId);

  if (byPeerUserId) {
    return byPeerUserId;
  }

  const byHubChannelId = conversations.find(
    (item) => item.kind === 'hub' && item.channelId === normalizedId,
  );

  if (byHubChannelId) {
    return byHubChannelId;
  }

  return null;
}

export function resolveTypingConversationId(
  rawConversationId: string,
  conversations: ConversationItem[],
  senderUserId?: string | null,
): string {
  const matched =
    findConversationByAnyId(conversations, rawConversationId) ??
    (senderUserId ? findDirectConversationForUser(conversations, senderUserId) : null);

  return matched?.id ?? rawConversationId;
}

export function resolveConversationForMessage(
  conversations: ConversationItem[],
  rawConversationId: string,
  senderUserId?: string | null,
): { conversationId: string; conversation: ConversationItem | null } {
  const conversation =
    findConversationByAnyId(conversations, rawConversationId) ??
    (senderUserId ? findDirectConversationForUser(conversations, senderUserId) : null);

  return {
    conversationId: conversation?.id ?? rawConversationId,
    conversation,
  };
}

export function normalizeConversations(
  payload: unknown,
  viewerUserId?: string | null,
): ConversationItem[] {
  return dedupeDirectConversations(
    extractConversationRecords(payload).map((record, index) =>
      normalizeConversation(record, index, viewerUserId),
    ),
  );
}

export function mergeConversationLists(
  existing: ConversationItem[],
  incoming: ConversationItem[],
): ConversationItem[] {
  const byId = new Map<string, ConversationItem>();

  for (const conversation of existing) {
    byId.set(conversation.id, conversation);
  }

  for (const conversation of incoming) {
    const previous = byId.get(conversation.id);
    byId.set(conversation.id, {
      ...previous,
      ...conversation,
      isPinned: conversation.isPinned,
    });
  }

  return [...byId.values()];
}

function conversationRecency(conversation: ConversationItem): number {
  const time = Date.parse(conversation.timestamp);
  return Number.isNaN(time) ? 0 : time;
}

function directDedupeKey(conversation: ConversationItem): string | null {
  if (conversation.kind !== 'direct' || conversation.isSelf || !conversation.peerUserId) {
    return null;
  }

  return `user:${conversation.peerUserId.toLowerCase()}`;
}

export function dedupeDirectConversations(conversations: ConversationItem[]): ConversationItem[] {
  const byId = new Map<string, ConversationItem>();

  for (const conversation of conversations) {
    byId.set(conversation.id, conversation);
  }

  const byPeer = new Map<string, ConversationItem>();
  const passthrough: ConversationItem[] = [];

  for (const conversation of byId.values()) {
    const key = directDedupeKey(conversation);

    if (!key) {
      passthrough.push(conversation);
      continue;
    }

    const existing = byPeer.get(key);

    if (!existing) {
      byPeer.set(key, conversation);
      continue;
    }

    const keepExisting = conversationRecency(existing) >= conversationRecency(conversation);
    const picked = keepExisting ? existing : conversation;
    byPeer.set(key, {
      ...picked,
      isPinned: existing.isPinned || conversation.isPinned,
    });
  }

  const brokenTitleByKey = new Map<string, ConversationItem>();
  const finalPassthrough: ConversationItem[] = [];

  for (const conversation of passthrough) {
    if (
      conversation.kind !== 'direct' ||
      conversation.isSelf ||
      conversation.peerUserId ||
      !isBrokenDirectTitle(conversation.title)
    ) {
      finalPassthrough.push(conversation);
      continue;
    }

    const key = conversation.title.trim().toLowerCase();
    const existing = brokenTitleByKey.get(key);

    if (!existing || conversationRecency(conversation) > conversationRecency(existing)) {
      brokenTitleByKey.set(key, conversation);
    }
  }

  return [...finalPassthrough, ...brokenTitleByKey.values(), ...byPeer.values()];
}

export function repairConversationPeerIds(
  conversations: ConversationItem[],
  currentUserId: string | null,
): ConversationItem[] {
  if (!currentUserId) {
    return conversations;
  }

  return conversations.map((conversation) => {
    if (
      conversation.kind !== 'direct' ||
      conversation.isSelf ||
      !conversation.peerUserId ||
      conversation.peerUserId !== currentUserId
    ) {
      return conversation;
    }

    return {
      ...conversation,
      peerUserId: null,
    };
  });
}

export function findDirectConversationForUser(
  conversations: ConversationItem[],
  userId: string,
): ConversationItem | null {
  const normalizedId = userId.toLowerCase();

  const matches = conversations.filter(
    (conversation) =>
      conversation.kind === 'direct' &&
      !conversation.isSelf &&
      conversation.peerUserId?.toLowerCase() === normalizedId,
  );

  if (matches.length === 0) {
    return null;
  }

  return [...matches].sort((left, right) => conversationRecency(right) - conversationRecency(left))[0];
}

export type DirectChatMetadata = {
  peerUserId: string;
  displayName: string;
};

export function applyStoredDirectChatMetadata(
  conversations: ConversationItem[],
  metadataByConversationId: Readonly<Record<string, DirectChatMetadata>>,
  selfDisplayName?: string | null,
): ConversationItem[] {
  return conversations.map((conversation) => {
    const stored = metadataByConversationId[conversation.id];

    if (!stored || conversation.kind !== 'direct' || conversation.isSelf) {
      return conversation;
    }

    if (isBrokenDirectTitle(stored.displayName, selfDisplayName)) {
      return conversation;
    }

    return patchDirectConversationMetadata(
      conversation,
      stored.peerUserId,
      stored.displayName,
      selfDisplayName,
    );
  });
}

export function findConversationForPeerUserId(
  conversations: ConversationItem[],
  userId: string,
  metadataByConversationId: Readonly<Record<string, DirectChatMetadata>> = {},
): ConversationItem | null {
  const byPeer = findDirectConversationForUser(conversations, userId);

  if (byPeer) {
    return byPeer;
  }

  for (const conversation of conversations) {
    if (conversation.kind !== 'direct' || conversation.isSelf) {
      continue;
    }

    const stored = metadataByConversationId[conversation.id];

    if (stored?.peerUserId === userId) {
      return patchDirectConversationMetadata(conversation, stored.peerUserId, stored.displayName);
    }
  }

  return null;
}

export function teammateHasDirectChat(
  conversations: ConversationItem[],
  teammate: { id: string; name: string; username?: string },
  metadataByConversationId: Readonly<Record<string, DirectChatMetadata>> = {},
): boolean {
  return Boolean(findConversationForPeerUserId(conversations, teammate.id, metadataByConversationId));
}

export function findDirectConversationForTeammate(
  conversations: ConversationItem[],
  teammate: { id: string; name: string; username?: string },
): ConversationItem | null {
  return findDirectConversationForUser(conversations, teammate.id);
}

export function filterTeammatesWithoutDirectChat<T extends { id: string; name: string; username?: string }>(
  teammates: T[],
  conversations: ConversationItem[],
  metadataByConversationId: Readonly<Record<string, DirectChatMetadata>> = {},
): T[] {
  return teammates.filter(
    (teammate) => !teammateHasDirectChat(conversations, teammate, metadataByConversationId),
  );
}

export function patchDirectConversationMetadata(
  conversation: ConversationItem,
  peerUserId: string,
  title: string,
  selfDisplayName?: string | null,
): ConversationItem {
  const resolvedTitle = sanitizeDirectDisplayName(title, selfDisplayName, conversation.title);

  return {
    ...conversation,
    kind: 'direct',
    peerUserId,
    title: resolvedTitle,
    avatarInitials: initialsFromName(resolvedTitle),
  };
}

export function reconcileDirectConversations(
  conversations: ConversationItem[],
  currentUserId: string | null,
  currentUserDisplayName: string,
  teammatesById: ReadonlyMap<string, { name: string; username?: string }>,
): ConversationItem[] {
  const normalizedSelfName = currentUserDisplayName.trim().toLowerCase();

  return conversations.map((conversation) => {
    if (conversation.kind !== 'direct' || conversation.isSelf) {
      return conversation;
    }

    let peerUserId =
      conversation.peerUserId && conversation.peerUserId !== currentUserId
        ? conversation.peerUserId
        : null;

    if (!peerUserId) {
      for (const [teammateId, teammate] of teammatesById.entries()) {
        if (teammateId === currentUserId) {
          continue;
        }

        const teammateName = teammate.name.trim().toLowerCase();
        const teammateUsername = teammate.username?.trim().toLowerCase() ?? '';
        const title = conversation.title.trim().toLowerCase();

        if (
          (teammateName && title === teammateName) ||
          (teammateUsername && title === teammateUsername)
        ) {
          peerUserId = teammateId;
          break;
        }
      }
    }

    if (peerUserId) {
      const teammate = teammatesById.get(peerUserId);
      const teammateName = teammate?.name.trim() || teammate?.username?.trim() || '';
      const displayName =
        teammateName && !isBrokenDirectTitle(teammateName, currentUserDisplayName)
          ? teammateName
          : conversation.title;

      if (
        !isBrokenDirectTitle(displayName, currentUserDisplayName) &&
        (conversation.peerUserId !== peerUserId ||
          isBrokenDirectTitle(conversation.title, currentUserDisplayName) ||
          conversation.title.trim().toLowerCase() === normalizedSelfName)
      ) {
        return patchDirectConversationMetadata(
          conversation,
          peerUserId,
          displayName,
          currentUserDisplayName,
        );
      }

      if (conversation.peerUserId !== peerUserId) {
        return { ...conversation, peerUserId };
      }
    }

    if (isBrokenDirectTitle(conversation.title, currentUserDisplayName)) {
      return {
        ...conversation,
        peerUserId: peerUserId ?? conversation.peerUserId,
        title: 'Direct message',
      };
    }

    if (normalizedSelfName && conversation.title.trim().toLowerCase() === normalizedSelfName) {
      return {
        ...conversation,
        peerUserId: null,
        title: 'Direct message',
      };
    }

    return conversation;
  });
}

export function dropBrokenDirectConversations(
  conversations: ConversationItem[],
  currentUserId: string | null,
  currentUserDisplayName: string,
): ConversationItem[] {
  const normalizedSelfName = currentUserDisplayName.trim().toLowerCase();

  return conversations.filter((conversation) => {
    if (conversation.kind !== 'direct' || conversation.isSelf) {
      return true;
    }

    if (conversation.peerUserId && conversation.peerUserId !== currentUserId) {
      return true;
    }

    if (!normalizedSelfName) {
      return !isBrokenDirectTitle(conversation.title, currentUserDisplayName);
    }

    return (
      conversation.title.trim().toLowerCase() !== normalizedSelfName &&
      !isBrokenDirectTitle(conversation.title, currentUserDisplayName)
    );
  });
}

export function buildPlaceholderDirectConversation(
  conversationId: string,
  peerUserId: string,
  title: string,
): ConversationItem {
  return {
    id: conversationId,
    kind: 'direct',
    title,
    subtitle: '',
    messagePreview: '',
    draftPreview: null,
    isDraftPreview: false,
    timestamp: new Date().toISOString(),
    avatarUrl: null,
    avatarInitials: initialsFromName(title),
    isPinned: false,
    isSelf: false,
    status: null,
    unreadCount: 0,
    peerUserId,
    channelId: null,
    notificationsSnoozed: false,
  };
}

function collectHubMembers(record: Record<string, unknown>): Record<string, unknown>[] {
  const rawMembers = [record.groupMembers, record.members, record.participants, record.users].find((value) =>
    Array.isArray(value),
  );

  if (!Array.isArray(rawMembers)) {
    return [];
  }

  return rawMembers.map(asRecord).filter((item): item is Record<string, unknown> => item !== null);
}

function isHubAdminMember(member: Record<string, unknown>): boolean {
  const user = asRecord(member.user);
  const role = String(member.role ?? user?.role ?? '').toUpperCase();
  return (
    role === 'ADMIN' ||
    role === 'OWNER' ||
    member.isAdmin === true ||
    user?.isAdmin === true
  );
}

function statsFromHubRecord(record: Record<string, unknown>): { memberCount: number; adminCount: number } {
  const nestedCount = asRecord(record._count) ?? asRecord(record.count);
  const members = collectHubMembers(record);
  const memberCount =
    readNumber(record.memberCount) ??
    readNumber(record.membersCount) ??
    readNumber(record.participantCount) ??
    readNumber(nestedCount?.members) ??
    readNumber(nestedCount?.memberCount) ??
    (members.length > 0 ? members.length : 0);
  const admins = members.filter(isHubAdminMember);
  const adminCount =
    readNumber(record.adminCount) ??
    readNumber(record.adminsCount) ??
    (admins.length > 0 ? admins.length : 0);

  return { memberCount, adminCount };
}

export function readHubMemberStats(hub: Record<string, unknown> | null): {
  memberCount: number;
  adminCount: number;
} {
  if (!hub) {
    return { memberCount: 0, adminCount: 0 };
  }

  const sources = [hub, asRecord(hub.conversation), asRecord(hub.channel), asRecord(hub.group), asRecord(hub.details)];
  let memberCount = 0;
  let adminCount = 0;

  for (const source of sources) {
    if (!source) {
      continue;
    }

    const stats = statsFromHubRecord(source);
    memberCount = Math.max(memberCount, stats.memberCount);
    adminCount = Math.max(adminCount, stats.adminCount);
  }

  if (memberCount > 0 && adminCount === 0) {
    adminCount = 1;
  }

  return { memberCount, adminCount };
}

export function formatHubMemberSubtitle(memberCount: number, adminCount: number): string {
  const membersLabel = `${memberCount} member${memberCount === 1 ? '' : 's'}`;
  const adminsLabel = `${adminCount} admin${adminCount === 1 ? '' : 's'}`;
  return `${membersLabel} · ${adminsLabel}`;
}

export function normalizeUnreadCount(payload: unknown): number {
  if (typeof payload === 'number') {
    return payload;
  }

  const record = asRecord(payload);

  if (!record) {
    return 0;
  }

  const nested = asRecord(record.data);

  return (
    readNumber(record.count) ??
    readNumber(record.unreadCount) ??
    readNumber(record.unread) ??
    readNumber(record.total) ??
    (nested ? readNumber(nested.count) ?? readNumber(nested.unreadCount) ?? readNumber(nested.unread) : null) ??
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
