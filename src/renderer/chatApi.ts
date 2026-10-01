import type { ApiResult } from '../shared/api';
import type { GifPickerItem } from '../shared/gifs';
import { buildFileMessagePayload, buildMediaMessagePayload } from '../shared/gifs';
import type { ConversationsPayload, ConversationItem, UnreadCountPayload } from '../shared/chat';
import type { ConversationBootstrap, MessageDraft } from '../shared/messages';
import { buildProfileUpdatePayload } from '../shared/profile';
import { clearAuth, getStoredToken, getStoredUser } from './authApi';
import { getUserId } from '../shared/user';
import { uploadFileToApi } from './uploadApi';

async function withToken<T>(
  request: (token: string) => Promise<ApiResult<T>>,
): Promise<ApiResult<T>> {
  const token = getStoredToken();

  if (!token) {
    return {
      ok: false,
      error: 'No saved session.',
      status: 401,
    };
  }

  const result = await request(token);

  if (!result.ok && result.status === 401) {
    clearAuth();
  }

  return result;
}

function unavailable<T>(): ApiResult<T> {
  return {
    ok: false,
    error: 'Desktop API is not available.',
  };
}

export async function summarizeUnreadMessages(conversationId: string): Promise<ApiResult<{ summary: string }>> {
  if (!window.electronAPI?.summarizeUnreadMessages) {
    return unavailable();
  }
  return withToken((token) => window.electronAPI.summarizeUnreadMessages(token, conversationId));
}

export async function translateUnreadMessages(conversationId: string): Promise<ApiResult<{ translation: string }>> {
  if (!window.electronAPI?.translateUnreadMessages) {
    return unavailable();
  }
  return withToken((token) => window.electronAPI.translateUnreadMessages(token, conversationId));
}

export async function loadConversations(): Promise<ApiResult<ConversationsPayload>> {
  if (!window.electronAPI?.getConversations) {
    return unavailable();
  }

  const viewerUserId = getUserId(getStoredUser());

  return withToken((token) => window.electronAPI.getConversations(token, viewerUserId));
}

export async function loadUnreadCount(): Promise<ApiResult<UnreadCountPayload>> {
  if (!window.electronAPI?.getUnreadCount) {
    return unavailable();
  }

  return withToken((token) => window.electronAPI.getUnreadCount(token));
}

export async function loadChatBootstrap(): Promise<{
  conversations: ApiResult<ConversationsPayload>;
  unreadCount: ApiResult<UnreadCountPayload>;
}> {
  const [conversations, unreadCount] = await Promise.all([
    loadConversations(),
    loadUnreadCount(),
  ]);

  return { conversations, unreadCount };
}

export async function loadConversationBootstrap(
  conversationId: string,
): Promise<ApiResult<ConversationBootstrap>> {
  if (!window.electronAPI?.getConversationBootstrap) {
    return unavailable();
  }

  return withToken((token) => window.electronAPI.getConversationBootstrap(token, conversationId));
}

export async function hydrateThreadReplyRegistry(
  conversationId: string,
  messages: import('../shared/messages').MessageItem[],
): Promise<void> {
  const { registerThreadReplyMessages } = await import('../shared/messages');
  const { mergeThreadReplies } = await import('./threadRepliesStore');
  const roots = messages.filter((message) => (message.threadReplyCount ?? 0) > 0);

  if (roots.length === 0) {
    return;
  }

  const results = await Promise.all(
    roots.map((root) => loadMessageThread(conversationId, root.id)),
  );

  results.forEach((result, index) => {
    if (result.ok) {
      registerThreadReplyMessages(result.data, roots[index].id);
      mergeThreadReplies(conversationId, roots[index].id, result.data);
    }
  });
}

export async function loadMessageThread(
  conversationId: string,
  messageId: string,
): Promise<ApiResult<import('../shared/messages').MessageItem[]>> {
  if (!window.electronAPI?.getMessageThread) {
    return unavailable();
  }

  return withToken((token) =>
    window.electronAPI.getMessageThread(token, conversationId, messageId),
  );
}

export async function loadMessageDraft(
  conversationId: string,
): Promise<ApiResult<MessageDraft>> {
  if (!window.electronAPI?.getMessageDraft) {
    return unavailable();
  }

  return withToken((token) => window.electronAPI.getMessageDraft(token, conversationId));
}

export async function saveChatDraft(
  conversationId: string,
  content: string,
): Promise<ApiResult<MessageDraft>> {
  if (!window.electronAPI?.saveMessageDraft) {
    return unavailable();
  }

  return withToken((token) => window.electronAPI.saveMessageDraft(token, conversationId, content));
}

export async function clearChatDraft(
  conversationId: string,
): Promise<ApiResult<{ ok: true }>> {
  if (!window.electronAPI?.clearMessageDraft) {
    return unavailable();
  }

  return withToken((token) => window.electronAPI.clearMessageDraft(token, conversationId));
}

export async function sendTypingUpdate(
  conversationId: string,
  isTyping: boolean,
): Promise<ApiResult<{ ok: true }>> {
  if (!window.electronAPI?.sendTyping) {
    return unavailable();
  }

  return withToken((token) => window.electronAPI.sendTyping(token, conversationId, isTyping));
}

export async function markConversationRead(
  conversationId: string,
): Promise<ApiResult<{ ok: true }>> {
  if (!window.electronAPI?.markConversationRead) {
    return unavailable();
  }

  return withToken((token) => window.electronAPI.markConversationRead(token, conversationId));
}

export async function loadNotifications(): Promise<
  ApiResult<import('../shared/messages').NotificationItem[]>
> {
  if (!window.electronAPI?.getNotifications) {
    return unavailable();
  }

  const result = await withToken((token) => window.electronAPI.getNotifications(token));

  if (!result.ok) {
    return result;
  }

  return { ok: true, data: result.data.notifications };
}

export async function markAllNotificationsRead(): Promise<ApiResult<{ ok: true }>> {
  if (!window.electronAPI?.markAllNotificationsRead) {
    return unavailable();
  }

  return withToken((token) => window.electronAPI.markAllNotificationsRead(token));
}

export async function markNotificationRead(
  notificationId: string,
): Promise<ApiResult<{ ok: true }>> {
  if (!window.electronAPI?.markNotificationRead) {
    return unavailable();
  }

  return withToken((token) => window.electronAPI.markNotificationRead(token, notificationId));
}

export async function loadUserPresence(
  userIds: string[],
): Promise<ApiResult<import('../shared/realtime').PresenceItem[]>> {
  if (!window.electronAPI?.getUserPresence) {
    return unavailable();
  }

  return withToken((token) => window.electronAPI.getUserPresence(token, userIds));
}

export async function loadPendingFriends(): Promise<
  ApiResult<import('../shared/messages').PendingFriendItem[]>
> {
  if (!window.electronAPI?.getPendingFriends) {
    return unavailable();
  }

  const result = await withToken((token) => window.electronAPI.getPendingFriends(token));

  if (!result.ok) {
    return result;
  }

  return { ok: true, data: result.data.pending };
}

export async function loadOrganizationMembers(): Promise<
  ApiResult<import('../shared/messages').TeammateItem[]>
> {
  if (!window.electronAPI?.getOrganizationMembers) {
    return unavailable();
  }

  const result = await withToken((token) => window.electronAPI.getOrganizationMembers(token));

  if (!result.ok) {
    return result;
  }

  return { ok: true, data: result.data.members };
}

export async function loadBellPanelData(): Promise<{
  notifications: ApiResult<import('../shared/messages').NotificationItem[]>;
  pending: ApiResult<import('../shared/messages').PendingFriendItem[]>;
}> {
  return refreshBellPanelData();
}

export async function refreshBellPanelData(): Promise<{
  notifications: ApiResult<import('../shared/messages').NotificationItem[]>;
  pending: ApiResult<import('../shared/messages').PendingFriendItem[]>;
}> {
  const [notifications, pending] = await Promise.all([
    loadNotifications(),
    loadPendingFriends(),
  ]);

  return { notifications, pending };
}

export async function openBellPanelData(): Promise<{
  notifications: ApiResult<import('../shared/messages').NotificationItem[]>;
  pending: ApiResult<import('../shared/messages').PendingFriendItem[]>;
}> {
  await markAllNotificationsRead();
  return refreshBellPanelData();
}

export async function addMessageReaction(
  conversationId: string,
  messageId: string,
  emoji: string,
): Promise<ApiResult<import('../shared/messages').MessageItem>> {
  if (!window.electronAPI?.addMessageReaction) {
    return unavailable();
  }

  return withToken((token) =>
    window.electronAPI.addMessageReaction(token, conversationId, messageId, emoji),
  );
}

export async function removeMessageReaction(
  conversationId: string,
  messageId: string,
  emoji: string,
): Promise<ApiResult<import('../shared/messages').MessageItem>> {
  if (!window.electronAPI?.removeMessageReaction) {
    return unavailable();
  }

  return withToken((token) =>
    window.electronAPI.removeMessageReaction(token, conversationId, messageId, emoji),
  );
}

export async function editChatMessage(
  conversationId: string,
  messageId: string,
  content: string,
): Promise<ApiResult<import('../shared/messages').MessageItem>> {
  if (!window.electronAPI?.editMessage) {
    return unavailable();
  }

  return withToken((token) =>
    window.electronAPI.editMessage(token, conversationId, messageId, content),
  );
}

export async function deleteChatMessage(
  conversationId: string,
  messageId: string,
  scope: 'me' | 'everyone',
): Promise<ApiResult<{ messageId: string; scope: 'me' | 'everyone' }>> {
  if (!window.electronAPI?.deleteMessage) {
    return unavailable();
  }

  return withToken((token) =>
    window.electronAPI.deleteMessage(token, conversationId, messageId, scope),
  );
}

export async function forwardChatMessage(
  conversationId: string,
  messageId: string,
  targetConversationIds: string[],
): Promise<ApiResult<{ messages: import('../shared/messages').MessageItem[] }>> {
  if (!window.electronAPI?.forwardMessage) {
    return unavailable();
  }

  return withToken((token) =>
    window.electronAPI.forwardMessage(token, conversationId, messageId, targetConversationIds),
  );
}

export async function pinChatMessage(
  conversationId: string,
  messageId: string,
): Promise<ApiResult<import('../shared/messages').MessageItem>> {
  if (!window.electronAPI?.pinMessage) {
    return unavailable();
  }

  return withToken((token) => window.electronAPI.pinMessage(token, conversationId, messageId));
}

export async function unpinChatMessage(
  conversationId: string,
  messageId: string,
): Promise<ApiResult<import('../shared/messages').MessageItem>> {
  if (!window.electronAPI?.unpinMessage) {
    return unavailable();
  }

  return withToken((token) => window.electronAPI.unpinMessage(token, conversationId, messageId));
}

export async function saveChatMessage(
  conversationId: string,
  messageId: string,
): Promise<ApiResult<import('../shared/features').SavedMessageItem[]>> {
  if (!window.electronAPI?.saveMessage) {
    return unavailable();
  }

  return withToken((token) => window.electronAPI.saveMessage(token, conversationId, messageId));
}

export async function createDirectChat(
  userId: string,
): Promise<ApiResult<{ conversationId: string; conversation: ConversationItem | null }>> {
  if (!window.electronAPI?.createDirectConversation) {
    return unavailable();
  }

  return withToken((token) => window.electronAPI.createDirectConversation(token, userId));
}

export async function sendChatMessage(
  conversationId: string,
  content: string,
  replyToId?: string,
  threadRootId?: string,
  mediaJson?: string,
): Promise<ApiResult<import('../shared/messages').MessageItem>> {
  if (!window.electronAPI?.sendMessage) {
    return unavailable();
  }

  return withToken((token) =>
    window.electronAPI.sendMessage(token, conversationId, content, replyToId, threadRootId, mediaJson),
  );
}

export async function sendChatMediaMessage(
  conversationId: string,
  item: GifPickerItem,
  kind: 'gif' | 'sticker',
  replyToId?: string,
  threadRootId?: string,
): Promise<ApiResult<import('../shared/messages').MessageItem>> {
  const mediaPayload = buildMediaMessagePayload(item, kind);

  return sendChatMessage(conversationId, '', replyToId, threadRootId, JSON.stringify(mediaPayload));
}

export async function sendChatFileMessage(
  conversationId: string,
  url: string,
  fileName: string,
  mimeType: string,
  replyToId?: string,
  threadRootId?: string,
  caption?: string,
): Promise<ApiResult<import('../shared/messages').MessageItem>> {
  const mediaPayload = buildFileMessagePayload(url, fileName, mimeType, caption);

  return sendChatMessage(conversationId, '', replyToId, threadRootId, JSON.stringify(mediaPayload));
}

export async function loadGifTrending(): Promise<ApiResult<import('../shared/gifs').GifPickerItem[]>> {
  if (!window.electronAPI?.getTrendingGifs) {
    return unavailable();
  }

  return withToken((token) => window.electronAPI.getTrendingGifs(token));
}

export async function loadGifSearch(
  query: string,
): Promise<ApiResult<import('../shared/gifs').GifPickerItem[]>> {
  if (!window.electronAPI?.searchGifs) {
    return unavailable();
  }

  return withToken((token) => window.electronAPI.searchGifs(token, query));
}

export async function loadStickerTrending(): Promise<
  ApiResult<import('../shared/gifs').GifPickerItem[]>
> {
  if (!window.electronAPI?.getTrendingStickers) {
    return unavailable();
  }

  return withToken((token) => window.electronAPI.getTrendingStickers(token));
}

export async function loadStickerSearch(
  query: string,
): Promise<ApiResult<import('../shared/gifs').GifPickerItem[]>> {
  if (!window.electronAPI?.searchStickers) {
    return unavailable();
  }

  return withToken((token) => window.electronAPI.searchStickers(token, query));
}

export async function loadGlobalSearch(
  query: string,
): Promise<ApiResult<import('../shared/search').GlobalSearchResult>> {
  if (!window.electronAPI?.globalSearch) {
    return unavailable();
  }

  return withToken((token) => window.electronAPI.globalSearch(token, query));
}

export async function loadUserSearch(
  query: string,
): Promise<ApiResult<import('../shared/search').SearchPerson[]>> {
  if (!window.electronAPI?.userSearch) {
    return unavailable();
  }

  return withToken((token) => window.electronAPI.userSearch(token, query));
}

export async function loadMessageSearch(
  conversationId: string,
  query: string,
): Promise<ApiResult<import('../shared/search').MessageSearchResult>> {
  if (!window.electronAPI?.messageSearch) {
    return unavailable();
  }

  return withToken((token) => window.electronAPI.messageSearch(token, conversationId, query));
}

export async function loadSavedMessages(): Promise<
  ApiResult<import('../shared/features').SavedMessageItem[]>
> {
  if (!window.electronAPI?.getSavedMessages) {
    return unavailable();
  }

  return withToken((token) => window.electronAPI.getSavedMessages(token));
}

export async function loadFiles(
  filter: string,
): Promise<ApiResult<import('../shared/features').FileItem[]>> {
  if (!window.electronAPI?.getFiles) {
    return unavailable();
  }

  return withToken((token) => window.electronAPI.getFiles(token, filter));
}

export async function loadConversationFiles(
  conversationId: string,
  filter: 'media' | 'docs' | 'links',
): Promise<ApiResult<import('../shared/features').FileItem[]>> {
  if (!window.electronAPI?.getFiles) {
    return unavailable();
  }

  return withToken((token) => window.electronAPI.getFiles(token, filter, conversationId));
}

export async function loadCalendarEvents(): Promise<
  ApiResult<import('../shared/features').CalendarEventItem[]>
> {
  if (!window.electronAPI?.getCalendarEvents) {
    return unavailable();
  }

  return withToken((token) => window.electronAPI.getCalendarEvents(token));
}

export async function loadChannels(): Promise<
  ApiResult<import('../shared/features').ChannelItem[]>
> {
  if (!window.electronAPI?.getChannels) {
    return unavailable();
  }

  return withToken((token) => window.electronAPI.getChannels(token));
}

export async function loadHubInvites(): Promise<
  ApiResult<import('../shared/features').HubInviteItem[]>
> {
  if (!window.electronAPI?.getHubInvites) {
    return unavailable();
  }

  return withToken((token) => window.electronAPI.getHubInvites(token));
}

export async function loadFriends(): Promise<
  ApiResult<import('../shared/features').FriendItem[]>
> {
  if (!window.electronAPI?.getFriends) {
    return unavailable();
  }

  return withToken((token) => window.electronAPI.getFriends(token));
}

export async function acceptHubInvite(
  channelId: string,
): Promise<ApiResult<{ ok: true }>> {
  if (!window.electronAPI?.acceptHubInvite) {
    return unavailable();
  }

  return withToken((token) => window.electronAPI.acceptHubInvite(token, channelId));
}

export async function acceptHubInviteById(
  inviteId: string,
): Promise<ApiResult<{ ok: true }>> {
  if (!window.electronAPI?.acceptHubInviteById) {
    return unavailable();
  }

  return withToken((token) => window.electronAPI.acceptHubInviteById(token, inviteId));
}

export async function declineHubInvite(
  inviteId: string,
): Promise<ApiResult<{ ok: true }>> {
  if (!window.electronAPI?.declineHubInvite) {
    return unavailable();
  }

  return withToken((token) => window.electronAPI.declineHubInvite(token, inviteId));
}

export async function loadBlockedUsers(): Promise<
  ApiResult<import('../shared/features').BlockedUserItem[]>
> {
  if (!window.electronAPI?.getBlockedUsers) {
    return unavailable();
  }

  return withToken((token) => window.electronAPI.getBlockedUsers(token));
}

export async function blockUser(userId: string): Promise<ApiResult<{ success: true }>> {
  if (!window.electronAPI?.blockUser) {
    return unavailable();
  }

  return withToken((token) => window.electronAPI.blockUser(token, userId));
}

export async function unblockUser(userId: string): Promise<ApiResult<{ success: true }>> {
  if (!window.electronAPI?.unblockUser) {
    return unavailable();
  }

  return withToken((token) => window.electronAPI.unblockUser(token, userId));
}

export async function loadFriendRelationship(
  userId: string,
): Promise<ApiResult<import('../shared/features').FriendRelationship>> {
  if (!window.electronAPI?.getFriendRelationship) {
    return unavailable();
  }

  return withToken((token) => window.electronAPI.getFriendRelationship(token, userId));
}

export async function createHubChannel(
  input: import('../shared/features').CreateChannelInput,
): Promise<ApiResult<import('../shared/features').CreatedChannelResult>> {
  if (!window.electronAPI?.createChannel) {
    return unavailable();
  }

  return withToken((token) => window.electronAPI.createChannel(token, JSON.stringify(input)));
}

export async function renameConversation(conversationId: string, name: string): Promise<ApiResult<unknown>> {
  if (!window.electronAPI?.renameConversation) return unavailable();
  return withToken((token) => window.electronAPI.renameConversation(token, conversationId, name));
}

export async function updateConversationNotificationSettings(
  conversationId: string,
  settings: Record<string, unknown>,
): Promise<ApiResult<{ ok: true }>> {
  if (!window.electronAPI?.updateConversationNotificationSettings) {
    return unavailable();
  }

  return withToken((token) =>
    window.electronAPI.updateConversationNotificationSettings(
      token,
      conversationId,
      JSON.stringify(settings),
    ),
  );
}

export async function setConversationFavorite(
  conversationId: string,
  favorite: boolean,
): Promise<ApiResult<{ ok: true; favorite: boolean }>> {
  if (!window.electronAPI?.setConversationFavorite) {
    return unavailable();
  }

  return withToken((token) =>
    window.electronAPI.setConversationFavorite(token, conversationId, favorite),
  );
}

export async function updateHubChannelName(
  channelId: string,
  name: string,
): Promise<ApiResult<{ ok: true }>> {
  if (!window.electronAPI?.updateChannelName) {
    return unavailable();
  }

  return withToken((token) => window.electronAPI.updateChannelName(token, channelId, name));
}

export async function updateHubChannelDescription(
  channelId: string,
  description: string,
): Promise<ApiResult<{ ok: true }>> {
  if (!window.electronAPI?.updateChannelDescription) {
    return unavailable();
  }

  return withToken((token) => window.electronAPI.updateChannelDescription(token, channelId, description));
}

export async function updateHubChannelSettings(
  channelId: string,
  settings: Record<string, unknown>,
): Promise<ApiResult<{ ok: true }>> {
  if (!window.electronAPI?.updateChannelSettings) {
    return unavailable();
  }

  return withToken((token) =>
    window.electronAPI.updateChannelSettings(token, channelId, JSON.stringify(settings)),
  );
}

export async function loadChannelInvites(
  channelId: string,
): Promise<ApiResult<import('../shared/features').ChannelInviteItem[]>> {
  if (!window.electronAPI?.getChannelInvites) {
    return unavailable();
  }

  return withToken((token) => window.electronAPI.getChannelInvites(token, channelId));
}

export async function revokeHubChannelInvite(
  channelId: string,
  inviteId: string,
): Promise<ApiResult<{ ok: true }>> {
  if (!window.electronAPI?.revokeChannelInvite) {
    return unavailable();
  }

  return withToken((token) => window.electronAPI.revokeChannelInvite(token, channelId, inviteId));
}

export async function deleteHubChannel(channelId: string): Promise<ApiResult<{ ok: true }>> {
  if (!window.electronAPI?.deleteChannel) {
    return unavailable();
  }

  return withToken((token) => window.electronAPI.deleteChannel(token, channelId));
}

export async function sendFriendRequest(
  userId: string,
): Promise<ApiResult<{ ok: true }>> {
  if (!window.electronAPI?.sendFriendRequest) {
    return unavailable();
  }

  return withToken((token) => window.electronAPI.sendFriendRequest(token, userId));
}

export async function respondFriendRequest(
  userId: string,
  status: 'ACCEPTED' | 'DECLINED',
): Promise<ApiResult<{ ok: true }>> {
  if (!window.electronAPI?.respondFriendRequest) {
    return unavailable();
  }

  return withToken((token) => window.electronAPI.respondFriendRequest(token, userId, status));
}

export async function unsaveChatMessage(
  conversationId: string,
  messageId: string,
): Promise<ApiResult<import('../shared/features').SavedMessageItem[]>> {
  if (!window.electronAPI?.unsaveMessage) {
    return unavailable();
  }

  return withToken((token) => window.electronAPI.unsaveMessage(token, conversationId, messageId));
}


export async function addConversationMembers(conversationId: string, userIds: string[]): Promise<ApiResult<unknown>> {
  if (!window.electronAPI?.addConversationMembers) return unavailable();
  return withToken((token) => window.electronAPI.addConversationMembers(token, conversationId, userIds));
}

export async function removeConversationMember(conversationId: string, userId: string): Promise<ApiResult<unknown>> {
  if (!window.electronAPI?.removeConversationMember) return unavailable();
  return withToken((token) => window.electronAPI.removeConversationMember(token, conversationId, userId));
}

export async function leaveConversation(conversationId: string, isHub: boolean): Promise<ApiResult<unknown>> {
  if (!window.electronAPI?.leaveConversation) return unavailable();
  return withToken((token) => window.electronAPI.leaveConversation(token, conversationId, isHub));
}

export async function deleteConversation(conversationId: string): Promise<ApiResult<unknown>> {
  if (!window.electronAPI?.deleteConversation) return unavailable();
  return withToken((token) => window.electronAPI.deleteConversation(token, conversationId));
}

export async function clearConversationHistory(conversationId: string): Promise<ApiResult<unknown>> {
  if (!window.electronAPI?.clearConversationHistory) return unavailable();
  return withToken((token) => window.electronAPI.clearConversationHistory(token, conversationId));
}

export async function loadAvatarStyles(): Promise<
  ApiResult<import('../shared/profile').AvatarStyleItem[]>
> {
  if (!window.electronAPI?.getAvatarStyles) {
    return unavailable();
  }

  return withToken((token) => window.electronAPI.getAvatarStyles(token));
}

export async function loadNotificationSettings(): Promise<
  ApiResult<import('../shared/profile').ProfileSettings>
> {
  if (!window.electronAPI?.getNotificationSettings) {
    return unavailable();
  }

  return withToken((token) => window.electronAPI.getNotificationSettings(token));
}

export async function saveNotificationSettings(
  updates: import('../shared/profile').NotificationPreferenceUpdate,
): Promise<ApiResult<import('../shared/profile').ProfileSettings>> {
  if (!window.electronAPI?.updateNotificationSettings) {
    return unavailable();
  }

  return withToken((token) =>
    window.electronAPI.updateNotificationSettings(token, JSON.stringify(updates)),
  );
}

export async function saveUserProfile(
  updates: Record<string, unknown>,
): Promise<ApiResult<unknown>> {
  if (!window.electronAPI?.updateUserProfile) {
    return unavailable();
  }

  const payload = buildProfileUpdatePayload(updates);

  return withToken((token) => window.electronAPI.updateUserProfile(token, JSON.stringify(payload)));
}

export async function saveUserStatus(
  status: import('../shared/profile').UserPresenceStatus,
  message?: string,
): Promise<ApiResult<{ ok: true }>> {
  if (!window.electronAPI?.updateUserStatus) {
    return unavailable();
  }

  return withToken((token) => window.electronAPI.updateUserStatus(token, status, message));
}

export async function saveUserTimezone(timezone: string): Promise<ApiResult<{ ok: true }>> {
  if (!window.electronAPI?.updateUserTimezone) {
    return unavailable();
  }

  return withToken((token) => window.electronAPI.updateUserTimezone(token, timezone));
}

export async function uploadUserProfileImage(
  file: File,
): Promise<ApiResult<{ url: string }>> {
  return uploadFileToApi(file);
}

export async function loadOrganizationMembersDetailed(): Promise<
  ApiResult<import('../shared/profile').OrganizationMemberItem[]>
> {
  if (!window.electronAPI?.getOrganizationMembersDetailed) {
    return unavailable();
  }

  return withToken((token) => window.electronAPI.getOrganizationMembersDetailed(token));
}

export async function createGroupConversation(
  name: string,
  userIds: string[],
): Promise<ApiResult<{ conversationId: string }>> {
  if (!window.electronAPI?.createGroupConversation) return unavailable();
  return withToken((token) => window.electronAPI.createGroupConversation(token, name, userIds));
}

export async function openSelfConversation(): Promise<ApiResult<{ conversationId: string }>> {
  if (!window.electronAPI?.getSelfConversation) return unavailable();
  return withToken((token) => window.electronAPI.getSelfConversation(token));
}

export async function markConversationUnread(conversationId: string): Promise<ApiResult<{ ok: true }>> {
  if (!window.electronAPI?.markConversationUnread) return unavailable();
  return withToken((token) => window.electronAPI.markConversationUnread(token, conversationId));
}

export async function loadPinnedMessages(conversationId: string): Promise<ApiResult<import('../shared/messages').MessageItem[]>> {
  if (!window.electronAPI?.getPinnedMessages) return unavailable();
  return withToken((token) => window.electronAPI.getPinnedMessages(token, conversationId));
}

export async function loadMentionSuggestions(conversationId: string, query: string): Promise<ApiResult<unknown[]>> {
  if (!window.electronAPI?.getMentionSuggestions) return unavailable();
  return withToken((token) => window.electronAPI.getMentionSuggestions(token, conversationId, query));
}

export async function createPoll(conversationId: string, payload: Record<string, unknown>): Promise<ApiResult<import('../shared/messages').MessageItem>> {
  if (!window.electronAPI?.createPollMessage) return unavailable();
  return withToken((token) => window.electronAPI.createPollMessage(token, conversationId, JSON.stringify(payload)));
}

export async function votePoll(conversationId: string, messageId: string, optionId: string): Promise<ApiResult<import('../shared/messages').MessageItem>> {
  if (!window.electronAPI?.votePollMessage) return unavailable();
  return withToken((token) => window.electronAPI.votePollMessage(token, conversationId, messageId, optionId));
}

export async function loadUserProfile(userId: string): Promise<ApiResult<unknown>> {
  if (!window.electronAPI?.getUserProfile) return unavailable();
  return withToken((token) => window.electronAPI.getUserProfile(token, userId));
}

export async function loadMessageConversation(messageId: string): Promise<ApiResult<{ conversationId: string }>> {
  if (!window.electronAPI?.getMessageConversation) return unavailable();
  return withToken((token) => window.electronAPI.getMessageConversation(token, messageId));
}

export async function loadConversationNotificationSettings(
  conversationId: string,
): Promise<ApiResult<Record<string, unknown>>> {
  if (!window.electronAPI?.getConversationNotificationSettings) return unavailable();
  return withToken((token) => window.electronAPI.getConversationNotificationSettings(token, conversationId));
}

export async function updateMemberRole(
  conversationId: string,
  userId: string,
  role: string,
): Promise<ApiResult<unknown>> {
  if (!window.electronAPI?.updateConversationMemberRole) return unavailable();
  return withToken((token) => window.electronAPI.updateConversationMemberRole(token, conversationId, userId, role));
}

export async function loadConversationById(conversationId: string): Promise<ApiResult<unknown>> {
  if (!window.electronAPI?.getConversationById) return unavailable();
  return withToken((token) => window.electronAPI.getConversationById(token, conversationId));
}

export async function loadMessageById(
  conversationId: string,
  messageId: string,
): Promise<ApiResult<import('../shared/messages').MessageItem>> {
  if (!window.electronAPI?.getMessageById) return unavailable();
  return withToken((token) => window.electronAPI.getMessageById(token, conversationId, messageId));
}

export async function loadConversationScheduledMessages(
  conversationId: string,
): Promise<ApiResult<unknown[]>> {
  if (!window.electronAPI?.getConversationScheduledMessages) return unavailable();
  return withToken((token) => window.electronAPI.getConversationScheduledMessages(token, conversationId));
}

export async function scheduleConversationMessage(
  conversationId: string,
  payload: Record<string, unknown>,
): Promise<ApiResult<unknown>> {
  if (!window.electronAPI?.createConversationScheduledMessage) return unavailable();
  return withToken((token) =>
    window.electronAPI.createConversationScheduledMessage(token, conversationId, JSON.stringify(payload)),
  );
}

export async function deleteConversationScheduledMessage(
  conversationId: string,
  scheduledId: string,
): Promise<ApiResult<{ ok: true }>> {
  if (!window.electronAPI?.deleteConversationScheduledMessage) return unavailable();
  return withToken((token) =>
    window.electronAPI.deleteConversationScheduledMessage(token, conversationId, scheduledId),
  );
}
