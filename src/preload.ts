import { contextBridge, ipcRenderer } from 'electron';
import type { ApiResult } from './shared/api';
import type { ConversationsPayload, UnreadCountPayload } from './shared/chat';
import type {
  CalendarEventItem,
  ChannelItem,
  FileItem,
  FriendItem,
  HubInviteItem,
  SavedMessageItem,
} from './shared/features';
import type { GlobalSearchResult, MessageSearchResult } from './shared/search';
import type { SearchPerson } from './shared/search';
import type { ConversationBootstrap, MessageDraft, MessageItem } from './shared/messages';
import type { LoginCredentials, LoginResult } from './shared/auth';
import type { RealtimeConnectionStatus } from './shared/realtime';

type NotificationsPayload = {
  notifications: import('./shared/messages').NotificationItem[];
};

type PendingFriendsPayload = {
  pending: import('./shared/messages').PendingFriendItem[];
};

type TeammatesPayload = {
  members: import('./shared/messages').TeammateItem[];
};

contextBridge.exposeInMainWorld('electronAPI', {
  login: (credentials: LoginCredentials): Promise<LoginResult> =>
    ipcRenderer.invoke('auth:login', credentials),
  getCurrentUser: (token: string): Promise<LoginResult> =>
    ipcRenderer.invoke('auth:me', token),
  getConversations: (token: string): Promise<ApiResult<ConversationsPayload>> =>
    ipcRenderer.invoke('chat:conversations', token),
  getUnreadCount: (token: string): Promise<ApiResult<UnreadCountPayload>> =>
    ipcRenderer.invoke('chat:unread-count', token),
  getConversationBootstrap: (
    token: string,
    conversationId: string,
  ): Promise<ApiResult<ConversationBootstrap>> =>
    ipcRenderer.invoke('chat:conversation-bootstrap', token, conversationId),
  getMessageThread: (
    token: string,
    conversationId: string,
    messageId: string,
  ): Promise<ApiResult<MessageItem[]>> =>
    ipcRenderer.invoke('chat:message-thread', token, conversationId, messageId),
  getMessageDraft: (
    token: string,
    conversationId: string,
  ): Promise<ApiResult<MessageDraft>> =>
    ipcRenderer.invoke('chat:message-draft', token, conversationId),
  saveMessageDraft: (
    token: string,
    conversationId: string,
    content: string,
  ): Promise<ApiResult<MessageDraft>> =>
    ipcRenderer.invoke('chat:save-draft', token, conversationId, content),
  clearMessageDraft: (
    token: string,
    conversationId: string,
  ): Promise<ApiResult<{ ok: true }>> =>
    ipcRenderer.invoke('chat:clear-draft', token, conversationId),
  markConversationRead: (
    token: string,
    conversationId: string,
  ): Promise<ApiResult<{ ok: true }>> =>
    ipcRenderer.invoke('chat:mark-read', token, conversationId),
  sendMessage: (
    token: string,
    conversationId: string,
    content: string,
    replyToId?: string,
    threadRootId?: string,
  ): Promise<ApiResult<MessageItem>> =>
    ipcRenderer.invoke('chat:send-message', token, conversationId, content, replyToId, threadRootId),
  createDirectConversation: (
    token: string,
    userId: string,
  ): Promise<ApiResult<{ conversationId: string }>> =>
    ipcRenderer.invoke('chat:create-direct', token, userId),
  addMessageReaction: (
    token: string,
    conversationId: string,
    messageId: string,
    emoji: string,
  ): Promise<ApiResult<MessageItem>> =>
    ipcRenderer.invoke('chat:add-reaction', token, conversationId, messageId, emoji),
  editMessage: (
    token: string,
    conversationId: string,
    messageId: string,
    content: string,
  ): Promise<ApiResult<MessageItem>> =>
    ipcRenderer.invoke('chat:edit-message', token, conversationId, messageId, content),
  deleteMessage: (
    token: string,
    conversationId: string,
    messageId: string,
    scope: 'me' | 'everyone',
  ): Promise<ApiResult<{ messageId: string; scope: 'me' | 'everyone' }>> =>
    ipcRenderer.invoke('chat:delete-message', token, conversationId, messageId, scope),
  forwardMessage: (
    token: string,
    conversationId: string,
    messageId: string,
    targetConversationIds: string[],
  ): Promise<ApiResult<{ messages: MessageItem[] }>> =>
    ipcRenderer.invoke(
      'chat:forward-message',
      token,
      conversationId,
      messageId,
      JSON.stringify(targetConversationIds),
    ),
  pinMessage: (
    token: string,
    conversationId: string,
    messageId: string,
  ): Promise<ApiResult<MessageItem>> =>
    ipcRenderer.invoke('chat:pin-message', token, conversationId, messageId),
  unpinMessage: (
    token: string,
    conversationId: string,
    messageId: string,
  ): Promise<ApiResult<MessageItem>> =>
    ipcRenderer.invoke('chat:unpin-message', token, conversationId, messageId),
  unsaveMessage: (token: string, messageId: string): Promise<ApiResult<unknown>> =>
    ipcRenderer.invoke('chat:unsave-message', token, messageId),
  renameConversation: (token: string, conversationId: string, name: string): Promise<ApiResult<unknown>> =>
    ipcRenderer.invoke('chat:rename-conversation', token, conversationId, name),
  addConversationMembers: (token: string, conversationId: string, userIds: string[]): Promise<ApiResult<unknown>> =>
    ipcRenderer.invoke('chat:add-conversation-members', token, conversationId, userIds),
  removeConversationMember: (token: string, conversationId: string, userId: string): Promise<ApiResult<unknown>> =>
    ipcRenderer.invoke('chat:remove-conversation-member', token, conversationId, userId),
  leaveConversation: (token: string, conversationId: string): Promise<ApiResult<unknown>> =>
    ipcRenderer.invoke('chat:leave-conversation', token, conversationId),
  deleteConversation: (token: string, conversationId: string): Promise<ApiResult<unknown>> =>
    ipcRenderer.invoke('chat:delete-conversation', token, conversationId),
  clearConversationHistory: (token: string, conversationId: string): Promise<ApiResult<unknown>> =>
    ipcRenderer.invoke('chat:clear-conversation-history', token, conversationId),
  saveMessage: (
    token: string,
    conversationId: string,
    messageId: string,
  ): Promise<ApiResult<SavedMessageItem[]>> =>
    ipcRenderer.invoke('features:save-message', token, conversationId, messageId),
  getNotifications: (token: string): Promise<ApiResult<NotificationsPayload>> =>
    ipcRenderer.invoke('chat:notifications', token),
  markAllNotificationsRead: (token: string): Promise<ApiResult<{ ok: true }>> =>
    ipcRenderer.invoke('chat:notifications-read-all', token),
  getPendingFriends: (token: string): Promise<ApiResult<PendingFriendsPayload>> =>
    ipcRenderer.invoke('chat:friends-pending', token),
  getOrganizationMembers: (token: string): Promise<ApiResult<TeammatesPayload>> =>
    ipcRenderer.invoke('chat:organization-members', token),
  globalSearch: (token: string, query: string): Promise<ApiResult<GlobalSearchResult>> =>
    ipcRenderer.invoke('search:global', token, query),
  userSearch: (token: string, query: string): Promise<ApiResult<SearchPerson[]>> =>
    ipcRenderer.invoke('search:users', token, query),
  messageSearch: (
    token: string,
    conversationId: string,
    query: string,
  ): Promise<ApiResult<MessageSearchResult>> =>
    ipcRenderer.invoke('search:messages', token, conversationId, query),
  getSavedMessages: (token: string): Promise<ApiResult<SavedMessageItem[]>> =>
    ipcRenderer.invoke('features:saved-messages', token),
  getFiles: (token: string, filter: string): Promise<ApiResult<FileItem[]>> =>
    ipcRenderer.invoke('features:files', token, filter),
  getCalendarEvents: (token: string): Promise<ApiResult<CalendarEventItem[]>> =>
    ipcRenderer.invoke('features:calendar', token),
  getChannels: (token: string): Promise<ApiResult<ChannelItem[]>> =>
    ipcRenderer.invoke('features:channels', token),
  getHubInvites: (token: string): Promise<ApiResult<HubInviteItem[]>> =>
    ipcRenderer.invoke('features:hub-invites', token),
  getFriends: (token: string): Promise<ApiResult<FriendItem[]>> =>
    ipcRenderer.invoke('features:friends', token),
  acceptHubInvite: (token: string, channelId: string): Promise<ApiResult<{ ok: true }>> =>
    ipcRenderer.invoke('features:accept-hub-invite', token, channelId),
  sendFriendRequest: (token: string, userId: string): Promise<ApiResult<{ ok: true }>> =>
    ipcRenderer.invoke('features:friend-request', token, userId),
  respondFriendRequest: (token: string, userId: string, status: 'ACCEPTED' | 'DECLINED'): Promise<ApiResult<{ ok: true }>> =>
    ipcRenderer.invoke('features:respond-friend-request', token, userId, status),
  unsaveMessage: (
    token: string,
    conversationId: string,
    messageId: string,
  ): Promise<ApiResult<SavedMessageItem[]>> =>
    ipcRenderer.invoke('features:unsave-message', token, conversationId, messageId),
  startRealtime: (token: string): Promise<{ ok: true }> =>
    ipcRenderer.invoke('realtime:start', token),
  stopRealtime: (): Promise<{ ok: true }> => ipcRenderer.invoke('realtime:stop'),
  sendTyping: (
    token: string,
    conversationId: string,
    isTyping: boolean,
  ): Promise<ApiResult<{ ok: true }>> =>
    ipcRenderer.invoke('realtime:typing', token, conversationId, isTyping),
  onRealtimeEvent: (callback: (event: unknown) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: unknown) => {
      callback(payload);
    };

    ipcRenderer.on('realtime:event', handler);

    return () => {
      ipcRenderer.removeListener('realtime:event', handler);
    };
  },
  onRealtimeStatus: (callback: (status: RealtimeConnectionStatus) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, status: RealtimeConnectionStatus) => {
      callback(status);
    };

    ipcRenderer.on('realtime:status', handler);

    return () => {
      ipcRenderer.removeListener('realtime:status', handler);
    };
  },
});
