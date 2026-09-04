import type { ApiResult } from '../shared/api';
import type { ConversationsPayload, UnreadCountPayload } from '../shared/chat';
import type { ConversationBootstrap, MessageDraft } from '../shared/messages';
import { clearAuth, getStoredToken } from './authApi';

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

export async function loadConversations(): Promise<ApiResult<ConversationsPayload>> {
  if (!window.electronAPI?.getConversations) {
    return unavailable();
  }

  return withToken((token) => window.electronAPI.getConversations(token));
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
  await markAllNotificationsRead();
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
): Promise<ApiResult<{ conversationId: string }>> {
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
): Promise<ApiResult<import('../shared/messages').MessageItem>> {
  if (!window.electronAPI?.sendMessage) {
    return unavailable();
  }

  return withToken((token) => window.electronAPI.sendMessage(token, conversationId, content, replyToId, threadRootId));
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


export async function renameConversation(conversationId: string, name: string): Promise<ApiResult<unknown>> {
  if (!window.electronAPI?.renameConversation) return unavailable();
  return withToken((token) => window.electronAPI.renameConversation(token, conversationId, name));
}

export async function addConversationMembers(conversationId: string, userIds: string[]): Promise<ApiResult<unknown>> {
  if (!window.electronAPI?.addConversationMembers) return unavailable();
  return withToken((token) => window.electronAPI.addConversationMembers(token, conversationId, userIds));
}

export async function removeConversationMember(conversationId: string, userId: string): Promise<ApiResult<unknown>> {
  if (!window.electronAPI?.removeConversationMember) return unavailable();
  return withToken((token) => window.electronAPI.removeConversationMember(token, conversationId, userId));
}

export async function leaveConversation(conversationId: string): Promise<ApiResult<unknown>> {
  if (!window.electronAPI?.leaveConversation) return unavailable();
  return withToken((token) => window.electronAPI.leaveConversation(token, conversationId));
}

export async function deleteConversation(conversationId: string): Promise<ApiResult<unknown>> {
  if (!window.electronAPI?.deleteConversation) return unavailable();
  return withToken((token) => window.electronAPI.deleteConversation(token, conversationId));
}

export async function clearConversationHistory(conversationId: string): Promise<ApiResult<unknown>> {
  if (!window.electronAPI?.clearConversationHistory) return unavailable();
  return withToken((token) => window.electronAPI.clearConversationHistory(token, conversationId));
}
