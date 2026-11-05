import type { ConversationItem } from '../../../shared/chat';
import { formatNotificationDisplayBody } from '../../../shared/calls';
import type { MessageItem, NotificationItem, PendingFriendItem } from '../../../shared/messages';
import {
  isCalendarRelatedNotification,
  isHubInviteNotification,
  isScheduledMessageNotification,
  isGroupInviteNotification,
  resolveFriendRequestUserId,
} from '../../../shared/messages';
import type { FlexHubsNotificationData, NotificationPayloadType } from './FlexHubsDesktopNotification';

const URL_PATTERN = /https?:\/\/[^\s]+/i;

function haystack(notification: Pick<NotificationItem, 'type' | 'title' | 'body'>): string {
  return `${notification.type} ${notification.title} ${notification.body}`.toLowerCase();
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
  }
  return (name.trim().slice(0, 2) || 'U').toUpperCase();
}

const GENERIC_NOTIFICATION_TITLES = new Set([
  'notification',
  'new message',
  'friend request',
]);

function parseFriendRequestSenderName(
  notification: NotificationItem,
  conversations: ConversationItem[],
): string {
  const body = notification.body.trim();
  const sentMatch = body.match(/^(.+?)\s+sent you a friend request/i);

  if (sentMatch?.[1]) {
    return sentMatch[1].trim();
  }

  if (notification.actorUserId) {
    const byPeer = conversations.find(
      (conversation) => conversation.peerUserId === notification.actorUserId,
    );

    if (byPeer?.title.trim()) {
      return byPeer.title.trim();
    }
  }

  const title = notification.title.trim();
  if (title && !GENERIC_NOTIFICATION_TITLES.has(title.toLowerCase())) {
    return title;
  }

  return 'Someone';
}

function parseSenderName(
  notification: NotificationItem,
  conversations: ConversationItem[] = [],
): string {
  const body = notification.body.trim();
  const sentMatch = body.match(/^(.+?)\s+sent you a friend request/i);

  if (sentMatch?.[1]) {
    return sentMatch[1].trim();
  }

  const colonMatch = body.match(/^([^:\n]{1,64}):\s/);
  if (colonMatch?.[1]) {
    return colonMatch[1].trim();
  }

  const title = notification.title.trim();
  if (title && !GENERIC_NOTIFICATION_TITLES.has(title.toLowerCase())) {
    return title;
  }

  if (notification.actorUserId && conversations.length > 0) {
    const byPeer = conversations.find(
      (conversation) => conversation.peerUserId === notification.actorUserId,
    );

    if (byPeer?.title.trim()) {
      return byPeer.title.trim();
    }
  }

  return 'Someone';
}

function bodyWithoutSenderPrefix(body: string): string {
  return body.replace(/^([^:\n]{1,64}):\s/, '').trim();
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function inferTypeFromBody(body: string): NotificationPayloadType | null {
  const lower = body.toLowerCase();

  if (lower.includes('deleted a message') || lower.includes('message was deleted')) {
    return 'message_deleted';
  }
  if (lower.includes('missed video call')) {
    return 'missed_call';
  }
  if (lower.includes('missed voice call') || lower.includes('missed call')) {
    return 'missed_call';
  }
  if (lower.includes('is now away') || lower.includes('is now online') || lower.includes('is now busy') || lower.includes('do not disturb')) {
    return 'status_change';
  }
  if (lower.includes('reacted to your message') || lower.includes('reacted to a message')) {
    return 'reaction';
  }
  if (lower.includes('replied to your message') || lower.includes('replied in thread') || lower.includes('replied to you')) {
    return 'thread_reply';
  }
  if (lower.includes('mentioned you') || lower.includes('@you')) {
    return 'mention';
  }
  if (
    lower.includes('added you to') ||
    lower.includes('invited you to join') ||
    lower.includes('hub invite') ||
    lower.includes('group invitation') ||
    lower.includes('group invite')
  ) {
    return 'hub_invite';
  }
  if (lower.includes('friend request') || lower.includes('sent you a friend request')) {
    return 'friend_request';
  }
  if (lower.includes('invited you to a meeting') || lower.includes('calendar event') || lower.includes('team sync')) {
    return 'calendar_event';
  }
  if (lower.includes('voice message') || lower.includes('voice note')) {
    return 'voice_note';
  }
  if (lower.includes('created a poll') || lower.includes('poll:')) {
    return 'poll';
  }
  if (lower.includes('shared a photo') || lower.includes('sent an image') || lower.includes('sent a gif')) {
    return lower.includes('video') ? 'video_attachment' : 'image_attachment';
  }
  if (lower.includes('shared a video') || lower.includes('sent a video')) {
    return 'video_attachment';
  }
  if (lower.includes('shared') && lower.includes('file')) {
    return lower.match(/\d+\s+files?/) ? 'multiple_files' : 'document_attachment';
  }
  if (/\.(pdf|docx?|xlsx?|pptx?|zip|txt)\b/i.test(body)) {
    return 'document_attachment';
  }
  if (URL_PATTERN.test(body)) {
    return 'text_link';
  }

  return null;
}

export function resolveNotificationPresentationType(
  notification: NotificationItem,
): NotificationPayloadType {
  const stack = haystack(notification);
  const inferred = inferTypeFromBody(notification.body);

  if (notification.type.toLowerCase().includes('system') || stack.includes('subscription') || stack.includes('workspace')) {
    return 'system_notification';
  }
  if (isHubInviteNotification(notification) || isGroupInviteNotification(notification)) {
    return 'hub_invite';
  }
  if (
    stack.includes('added you to') &&
    (stack.includes('hub') || stack.includes('channel') || stack.includes('group'))
  ) {
    return 'hub_invite';
  }
  if (isCalendarRelatedNotification(notification) && !isScheduledMessageNotification(notification)) {
    return 'calendar_event';
  }
  if (stack.includes('reaction') || stack.includes('reacted')) {
    return 'reaction';
  }
  if (stack.includes('mention') || notification.body.includes('@')) {
    return 'mention';
  }
  if (stack.includes('reply') || stack.includes('replied')) {
    return 'thread_reply';
  }
  if (
    stack.includes('friend request') ||
    stack.includes('sent you a friend request')
  ) {
    return 'friend_request';
  }
  if (stack.includes('missed') && stack.includes('call')) {
    return 'missed_call';
  }
  if (stack.includes('voice message') || stack.includes('voice note')) {
    return 'voice_note';
  }
  if (stack.includes('poll')) {
    return 'poll';
  }
  if (stack.includes('deleted')) {
    return 'message_deleted';
  }
  if (stack.includes('status') || stack.includes(' is now ')) {
    return 'status_change';
  }
  if (stack.includes('photo') || stack.includes('image') || stack.includes('gif')) {
    return stack.includes('video') ? 'video_attachment' : 'image_attachment';
  }
  if (stack.includes('video')) {
    return 'video_attachment';
  }
  if (stack.includes('file') || stack.includes('.pdf')) {
    return stack.match(/\d+\s+files?/) ? 'multiple_files' : 'document_attachment';
  }

  return inferred ?? 'text_message';
}

function resolveAvatar(
  notification: NotificationItem,
  conversations: ConversationItem[],
): { avatarUrl: string | null; avatarInitials: string; title: string } {
  const presentationType = resolveNotificationPresentationType(notification);
  const senderName =
    presentationType === 'friend_request'
      ? parseFriendRequestSenderName(notification, conversations)
      : parseSenderName(notification, conversations);
  const conversation = notification.conversationId
    ? conversations.find((item) => item.id === notification.conversationId)
    : null;

  const directMatch =
    conversations.find(
      (item) =>
        item.kind === 'direct' &&
        item.title.trim().toLowerCase() === senderName.toLowerCase(),
    ) ??
    (notification.actorUserId
      ? conversations.find(
          (item) => item.kind === 'direct' && item.peerUserId === notification.actorUserId,
        )
      : undefined);

  const avatarUrl = directMatch?.avatarUrl ?? conversation?.avatarUrl ?? null;
  const avatarInitials =
    directMatch?.avatarInitials ??
    conversation?.avatarInitials ??
    initialsFromName(senderName);

  let title = senderName;
  if (conversation && conversation.kind !== 'direct') {
    if (
      resolveNotificationPresentationType(notification) === 'mention' ||
      resolveNotificationPresentationType(notification) === 'thread_reply'
    ) {
      title = senderName;
    } else if (notification.title.trim().toLowerCase() === 'new message') {
      title = senderName;
    }
  }

  return { avatarUrl, avatarInitials, title };
}

function parseReaction(body: string): { emoji: string; count: number } | undefined {
  const emojiMatch = body.match(/(\p{Extended_Pictographic}|[\u{1F300}-\u{1FAFF}]|[\u2600-\u27BF])/u);
  const countMatch = body.match(/(\d+)\s*$/);
  if (!emojiMatch) {
    return undefined;
  }
  return {
    emoji: emojiMatch[0],
    count: countMatch ? Number(countMatch[1]) : 1,
  };
}

function parseThreadQuote(body: string): { quote: string; reply: string } | undefined {
  const lower = body.toLowerCase();
  if (!lower.includes('replied')) {
    return undefined;
  }

  const cleaned = bodyWithoutSenderPrefix(body);
  const youMatch = cleaned.match(/you[\s\S]*?(.+)/i);
  if (youMatch) {
    return {
      quote: 'You',
      reply: youMatch[1]?.trim() || cleaned,
    };
  }

  return {
    quote: 'Your message',
    reply: cleaned,
  };
}

export function mapNotificationItemToFlexHubsData(
  notification: NotificationItem,
  options: {
    conversations: ConversationItem[];
    onClick?: () => void;
    onAcceptFriend?: () => void;
    onDeclineFriend?: () => void;
    friendActionLoading?: boolean;
  },
): FlexHubsNotificationData {
  const type = resolveNotificationPresentationType(notification);
  const formattedBody = formatNotificationDisplayBody(notification.body);
  const { avatarUrl, avatarInitials, title } = resolveAvatar(notification, options.conversations);
  const contentBody = bodyWithoutSenderPrefix(formattedBody);

  const data: FlexHubsNotificationData = {
    id: notification.id,
    type,
    title,
    body: contentBody,
    timestamp: notification.createdAt,
    isUnread: !notification.isRead,
    avatarUrl,
    avatarInitials,
    onClick: options.onClick,
    priority: type === 'mention' || type === 'thread_reply' || type === 'friend_request' ? 'high' : 'medium',
  };

  if (type === 'system_notification') {
    data.isSystem = true;
    data.title = notification.title.trim() || 'FlexHubs';
    data.body = formattedBody;
  }

  if (type === 'mention') {
    data.priority = 'high';
    const conversation = notification.conversationId
      ? options.conversations.find((item) => item.id === notification.conversationId)
      : null;
    if (conversation && conversation.kind !== 'direct') {
      data.subtitle = conversation.title;
    }
  }

  if (
    !data.subtitle &&
    notification.conversationId &&
    (type === 'group_chat' ||
      type === 'hub_message' ||
      type === 'text_message' ||
      type === 'large_media' ||
      type === 'image_attachment' ||
      type === 'video_attachment' ||
      type === 'document_attachment' ||
      type === 'voice_note' ||
      type === 'text_link')
  ) {
    const conversation = options.conversations.find((item) => item.id === notification.conversationId);
    if (conversation && conversation.kind !== 'direct') {
      data.subtitle = conversation.title;
    }
  }

  if (type === 'thread_reply') {
    data.body = parseThreadQuote(formattedBody)?.reply || contentBody || 'Replied in thread';
  }

  if (type === 'reaction') {
    const reaction = parseReaction(formattedBody);
    data.body = reaction
      ? `Reacted to your message ${reaction.emoji}`
      : 'Reacted to your message';
  }

  if (type === 'friend_request') {
    data.title = parseFriendRequestSenderName(notification, options.conversations);
    data.avatarInitials = initialsFromName(data.title);
    data.body = 'Sent you a friend request';
  }

  if (type === 'hub_invite') {
    const addedMatch = formattedBody.match(/^(.+?)\s+added you to\s+(.+)$/i);
    const joinMatch = formattedBody.match(/^(.+?)\s+invited you to join\s+(.+)$/i);
    if (joinMatch) {
      data.title = joinMatch[2].trim();
      data.body = `${joinMatch[1].trim()} invited you to join`;
    } else if (addedMatch) {
      data.title = addedMatch[2].trim();
      data.body = `${addedMatch[1].trim()} added you to this hub`;
    } else {
      data.title = notification.title.trim() || 'Hub invitation';
      data.body = formattedBody || 'Invited you to join a hub';
    }
  }

  if (type === 'calendar_event') {
    data.body =
      contentBody ||
      formattedBody ||
      'Invited you to a meeting';
  }

  if (type === 'missed_call') {
    data.body = formattedBody.toLowerCase().includes('video')
      ? 'Missed video call'
      : 'Missed voice call';
  }

  if (type === 'status_change') {
    data.body = formattedBody.replace(/^([^:\n]{1,64}):\s/, '').trim() || formattedBody;
  }

  if (type === 'message_deleted') {
    data.body = 'Deleted a message';
  }

  if (type === 'voice_note') {
    data.body = 'Voice message';
  }

  if (type === 'poll') {
    data.body = contentBody.replace(/^created a poll:\s*/i, '').trim() || contentBody || 'New poll';
  }

  if (type === 'document_attachment') {
    data.body = contentBody || 'Sent a file';
  }

  if (type === 'image_attachment' || type === 'large_media') {
    data.body = contentBody || 'Shared a photo';
  }

  if (type === 'video_attachment') {
    data.body = contentBody || 'Shared a video';
  }

  const mediaTypes = new Set([
    'image_attachment',
    'large_media',
    'video_attachment',
    'multiple_files',
    'mixed_content',
  ]);

  if (mediaTypes.has(type)) {
    const link = notification.link?.trim();
    if (link && /^https?:\/\//i.test(link)) {
      data.mediaPreviewUrl = link;
      data.mediaPreviewCount = 1;
      data.mediaIsVideo = type === 'video_attachment';
    }
  }

  return data;
}

export type ActivityKind =
  | 'message'
  | 'reaction'
  | 'mention'
  | 'reply'
  | 'request'
  | 'calendar'
  | 'file'
  | 'voice'
  | 'photo'
  | 'hub-invite';

export function mapActivityListItemToFlexHubsData(
  item: {
    id: string;
    title: string;
    body: string;
    createdAt: string;
    kind: ActivityKind;
    notification: NotificationItem | null;
    isUnread: boolean;
    respondFriendRequestId?: string | null;
    respondUserId?: string | null;
  },
  conversations: ConversationItem[],
  options: {
    onClick?: () => void;
    onRespondFriend?: (id: string, status: 'ACCEPTED' | 'DECLINED') => void;
    isProcessing?: boolean;
  },
): FlexHubsNotificationData {
  if (item.notification) {
    const mapped = mapNotificationItemToFlexHubsData(item.notification, {
      conversations,
      onClick: options.onClick,
    });

    mapped.timestamp = item.createdAt;
    mapped.isUnread = item.isUnread;
    return mapped;
  }

  if (item.kind === 'hub-invite') {
    return {
      id: item.id,
      type: 'hub_invite',
      title: item.title,
      body: item.body?.trim() || 'Accept or decline this invitation',
      timestamp: item.createdAt,
      isUnread: item.isUnread,
      avatarInitials: initialsFromName(item.title),
      priority: 'high',
      onClick: options.onClick,
    };
  }

  if (item.kind === 'request') {
    const nameFromBody = item.body.match(/^(.+?)\s+sent you a friend request/i)?.[1]?.trim();
    const title =
      (item.title && item.title.toLowerCase() !== 'friend request' ? item.title : null) ??
      nameFromBody ??
      'Someone';

    return {
      id: item.id,
      type: 'friend_request',
      title,
      body: 'Accept or decline this request',
      timestamp: item.createdAt,
      isUnread: item.isUnread,
      avatarInitials: initialsFromName(title),
      priority: 'high',
      onClick: options.onClick,
    };
  }

  return {
    id: item.id,
    type: 'text_message',
    title: item.title,
    body: item.body,
    timestamp: item.createdAt,
    isUnread: item.isUnread,
    avatarInitials: initialsFromName(item.title),
    onClick: options.onClick,
  };
}

export function mapPendingFriendToFlexHubsData(item: PendingFriendItem): FlexHubsNotificationData {
  const nameFromBody = item.body.match(/^(.+?)\s+sent you a friend request/i)?.[1]?.trim();
  const title =
    (item.title && item.title.toLowerCase() !== 'friend request' ? item.title : null) ??
    nameFromBody ??
    'Someone';

  return {
    id: `pending-${item.id}`,
    type: 'friend_request',
    title,
    body: 'Sent you a friend request',
    timestamp: item.createdAt,
    isUnread: true,
    avatarInitials: initialsFromName(item.title),
    priority: 'high',
  };
}

export function mapMessageToNotificationData(
  message: MessageItem,
  conversationTitle?: string,
  groupContext?: boolean,
): FlexHubsNotificationData {
  let type: NotificationPayloadType = 'text_message';

  if (message.deletedForEveryone || message.content.trim() === 'This message was deleted.') {
    type = 'message_deleted';
  }

  const media = message.media.map((entry) => ({
    kind:
      entry.kind === 'gif' || entry.kind === 'sticker' ? ('image' as const) : entry.kind,
    url: entry.url,
    previewUrl: entry.previewUrl,
    name: entry.name ?? undefined,
  }));

  const imageMedia = media.filter((entry) => entry.kind === 'image');
  const videoMedia = media.filter((entry) => entry.kind === 'video');
  const fileMedia = media.filter((entry) => entry.kind === 'file');
  const voiceHint =
    /voice message|voice note|audio message/i.test(message.content) ||
    message.messageType?.toLowerCase().includes('voice') === true;

  if (message.poll) {
    type = 'poll';
  } else if (voiceHint) {
    type = 'voice_note';
  } else if (videoMedia.length > 0) {
    type = 'video_attachment';
  } else if (fileMedia.length > 0 && imageMedia.length > 0) {
    type = 'mixed_content';
  } else if (fileMedia.length > 1) {
    type = 'multiple_files';
  } else if (fileMedia.length === 1) {
    type = 'document_attachment';
  } else if (imageMedia.length > 1) {
    type = 'image_attachment';
  } else if (imageMedia.length === 1) {
    type = imageMedia[0].url ? 'large_media' : 'image_attachment';
  }

  if (message.threadRootId && !message.isOwn) {
    type = 'thread_reply';
  }

  if (message.content.includes('@')) {
    type = 'mention';
  }

  if (groupContext && conversationTitle) {
    type = 'group_chat';
  }

  if (URL_PATTERN.test(message.content) && type === 'text_message') {
    type = 'text_link';
  }

  let body = message.content.trim();
  if (type === 'voice_note') {
    body = 'Voice message';
  } else if (type === 'poll' && message.poll) {
    body = message.poll.question;
  } else if (type === 'thread_reply') {
    body = message.content.trim() || 'Replied in thread';
  } else if (type === 'image_attachment' || type === 'large_media') {
    body = body || 'Shared a photo';
  } else if (type === 'video_attachment') {
    body = 'Shared a video';
  } else if (type === 'document_attachment' || type === 'multiple_files' || type === 'mixed_content') {
    body = body || 'Sent a file';
  } else if (type === 'text_link' && URL_PATTERN.test(message.content)) {
    body = message.content.trim();
  }

  let mediaPreviewUrl: string | null = null;
  let mediaPreviewCount = 0;
  let mediaIsVideo = false;

  if (videoMedia.length > 0) {
    mediaPreviewUrl = videoMedia[0].previewUrl ?? videoMedia[0].url ?? null;
    mediaPreviewCount = videoMedia.length;
    mediaIsVideo = true;
  } else if (imageMedia.length > 0) {
    mediaPreviewUrl = imageMedia[0].previewUrl ?? imageMedia[0].url ?? null;
    mediaPreviewCount = imageMedia.length;
  }

  return {
    id: message.id,
    type,
    priority: type === 'mention' || type === 'thread_reply' ? 'high' : 'medium',
    title: message.senderName,
    subtitle: groupContext && conversationTitle ? conversationTitle : undefined,
    body,
    timestamp: message.createdAt,
    avatarInitials: message.senderInitials,
    mediaPreviewUrl,
    mediaPreviewCount: mediaPreviewCount > 0 ? mediaPreviewCount : undefined,
    mediaIsVideo: mediaIsVideo || undefined,
  };
}

export function resolveFriendRequestUserIdFromNotification(
  notification: NotificationItem,
  conversations: ConversationItem[],
): string | null {
  return resolveFriendRequestUserId(notification, conversations);
}
