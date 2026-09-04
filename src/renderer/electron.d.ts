import type { LoginCredentials, LoginResult } from '../shared/auth';
import type { ApiResult } from '../shared/api';
import type { ConversationsPayload, UnreadCountPayload } from '../shared/chat';
import type {
  CalendarEventItem,
  ChannelItem,
  FileItem,
  FriendItem,
  HubInviteItem,
  SavedMessageItem,
} from '../shared/features';
import type { GlobalSearchResult, MessageSearchResult, SearchPerson } from '../shared/search';
import type { ConversationBootstrap, MessageDraft, MessageItem } from '../shared/messages';
import type { RealtimeConnectionStatus } from '../shared/realtime';

type NotificationsPayload = {
  notifications: import('../shared/messages').NotificationItem[];
};

type PendingFriendsPayload = {
  pending: import('../shared/messages').PendingFriendItem[];
};

type TeammatesPayload = {
  members: import('../shared/messages').TeammateItem[];
};

declare global {
  interface Window {
    electronAPI: {
      login: (credentials: LoginCredentials) => Promise<LoginResult>;
      getCurrentUser: (token: string) => Promise<LoginResult>;
      getConversations: (token: string) => Promise<ApiResult<ConversationsPayload>>;
      getUnreadCount: (token: string) => Promise<ApiResult<UnreadCountPayload>>;
      getConversationBootstrap: (
        token: string,
        conversationId: string,
      ) => Promise<ApiResult<ConversationBootstrap>>;
      getMessageThread: (
        token: string,
        conversationId: string,
        messageId: string,
      ) => Promise<ApiResult<MessageItem[]>>;
      getMessageDraft: (
        token: string,
        conversationId: string,
      ) => Promise<ApiResult<MessageDraft>>;
      saveMessageDraft: (
        token: string,
        conversationId: string,
        content: string,
      ) => Promise<ApiResult<MessageDraft>>;
      clearMessageDraft: (
        token: string,
        conversationId: string,
      ) => Promise<ApiResult<{ ok: true }>>;
      markConversationRead: (
        token: string,
        conversationId: string,
      ) => Promise<ApiResult<{ ok: true }>>;
      sendMessage: (
        token: string,
        conversationId: string,
        content: string,
        replyToId?: string,
        threadRootId?: string,
      ) => Promise<ApiResult<MessageItem>>;
      createDirectConversation: (
        token: string,
        userId: string,
      ) => Promise<ApiResult<{ conversationId: string }>>;
      addMessageReaction: (
        token: string,
        conversationId: string,
        messageId: string,
        emoji: string,
      ) => Promise<ApiResult<MessageItem>>;
      editMessage: (
        token: string,
        conversationId: string,
        messageId: string,
        content: string,
      ) => Promise<ApiResult<MessageItem>>;
      deleteMessage: (
        token: string,
        conversationId: string,
        messageId: string,
        scope: 'me' | 'everyone',
      ) => Promise<ApiResult<{ messageId: string; scope: 'me' | 'everyone' }>>;
      forwardMessage: (
        token: string,
        conversationId: string,
        messageId: string,
        targetConversationIds: string[],
      ) => Promise<ApiResult<{ messages: MessageItem[] }>>;
      pinMessage: (
        token: string,
        conversationId: string,
        messageId: string,
      ) => Promise<ApiResult<MessageItem>>;
      unpinMessage: (
        token: string,
        conversationId: string,
        messageId: string,
      ) => Promise<ApiResult<MessageItem>>;
      saveMessage: (
        token: string,
        conversationId: string,
        messageId: string,
      ) => Promise<ApiResult<SavedMessageItem[]>>;
      getNotifications: (token: string) => Promise<ApiResult<NotificationsPayload>>;
      markAllNotificationsRead: (token: string) => Promise<ApiResult<{ ok: true }>>;
      getPendingFriends: (token: string) => Promise<ApiResult<PendingFriendsPayload>>;
      getOrganizationMembers: (token: string) => Promise<ApiResult<TeammatesPayload>>;
      globalSearch: (token: string, query: string) => Promise<ApiResult<GlobalSearchResult>>;
      userSearch: (token: string, query: string) => Promise<ApiResult<SearchPerson[]>>;
      messageSearch: (
        token: string,
        conversationId: string,
        query: string,
      ) => Promise<ApiResult<MessageSearchResult>>;
      getSavedMessages: (token: string) => Promise<ApiResult<SavedMessageItem[]>>;
      unsaveMessage: (token: string, messageId: string) => Promise<ApiResult<unknown>>;
      renameConversation: (token: string, conversationId: string, name: string) => Promise<ApiResult<unknown>>;
      addConversationMembers: (token: string, conversationId: string, userIds: string[]) => Promise<ApiResult<unknown>>;
      removeConversationMember: (token: string, conversationId: string, userId: string) => Promise<ApiResult<unknown>>;
      leaveConversation: (token: string, conversationId: string) => Promise<ApiResult<unknown>>;
      deleteConversation: (token: string, conversationId: string) => Promise<ApiResult<unknown>>;
      clearConversationHistory: (token: string, conversationId: string) => Promise<ApiResult<unknown>>;
      getFiles: (token: string, filter: string) => Promise<ApiResult<FileItem[]>>;
      getCalendarEvents: (token: string) => Promise<ApiResult<CalendarEventItem[]>>;
      getChannels: (token: string) => Promise<ApiResult<ChannelItem[]>>;
      getHubInvites: (token: string) => Promise<ApiResult<HubInviteItem[]>>;
      getFriends: (token: string) => Promise<ApiResult<FriendItem[]>>;
      acceptHubInvite: (token: string, channelId: string) => Promise<ApiResult<{ ok: true }>>;
      sendFriendRequest: (token: string, userId: string) => Promise<ApiResult<{ ok: true }>>;
      respondFriendRequest: (token: string, userId: string, status: 'ACCEPTED' | 'DECLINED') => Promise<ApiResult<{ ok: true }>>;
      unsaveMessage: (
        token: string,
        conversationId: string,
        messageId: string,
      ) => Promise<ApiResult<SavedMessageItem[]>>;
      startRealtime: (token: string) => Promise<{ ok: true }>;
      stopRealtime: () => Promise<{ ok: true }>;
      sendTyping: (
        token: string,
        conversationId: string,
        isTyping: boolean,
      ) => Promise<ApiResult<{ ok: true }>>;
      onRealtimeEvent: (callback: (event: unknown) => void) => () => void;
      onRealtimeStatus: (callback: (status: RealtimeConnectionStatus) => void) => () => void;
    };
  }
}

export {};
