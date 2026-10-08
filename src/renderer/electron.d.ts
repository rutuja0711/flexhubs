import type { LoginCredentials, LoginResult } from '../shared/auth';
import type { ApiResult } from '../shared/api';
import type { ConversationsPayload, UnreadCountPayload } from '../shared/chat';
import type {
  BlockedUserItem,
  CalendarEventItem,
  ChannelInviteItem,
  ChannelItem,
  CreatedChannelResult,
  FileItem,
  FriendItem,
  FriendRelationship,
  HubInviteItem,
  SavedMessageItem,
} from '../shared/features';
import type { GlobalSearchResult, MessageSearchResult, SearchPerson } from '../shared/search';
import type { ConversationBootstrap, MessageDraft, MessageItem } from '../shared/messages';
import type { RealtimeConnectionStatus } from '../shared/realtime';
import type { OrganizationMemberItem, ProfileSettings } from '../shared/profile';

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
      createOrgOrder: (
        token: string | null,
        payloadJson: string,
      ) => Promise<ApiResult<import('../shared/workspace').OrgOrderResult>>;
      verifyOrgSubscription: (
        token: string | null,
        payloadJson: string,
      ) => Promise<ApiResult<import('../shared/workspace').WorkspaceCreationResult>>;
      getPaymentPlans: (
        token: string | null,
      ) => Promise<ApiResult<import('../shared/payments').PaymentPlanItem[]>>;
      getOrgSubscription: (
        token: string,
      ) => Promise<ApiResult<import('../shared/payments').OrgSubscriptionInfo | null>>;
      getPlanCompliance: (
        token: string | null,
        planId: string,
        teamSize: number,
      ) => Promise<ApiResult<import('../shared/payments').PlanComplianceInfo>>;
      createUpgradeOrder: (
        token: string,
        payloadJson: string,
      ) => Promise<ApiResult<import('../shared/workspace').OrgOrderResult>>;
      verifyUpgradeSubscription: (
        token: string,
        payloadJson: string,
      ) => Promise<ApiResult<{ ok: true }>>;
      getOrganizationMembersAdmin: (
        token: string,
      ) => Promise<ApiResult<OrganizationMemberItem[]>>;
      removeOrganizationMember: (token: string, userId: string) => Promise<ApiResult<{ ok: true }>>;
      leaveOrganizationWorkspace: (token: string) => Promise<ApiResult<{ ok: true }>>;
      getOrganizationRoles: (
        token: string,
      ) => Promise<ApiResult<import('../shared/organization').OrganizationRoleItem[]>>;
      createOrganizationRole: (
        token: string,
        name: string,
      ) => Promise<ApiResult<import('../shared/organization').OrganizationRoleItem[]>>;
      updateOrganizationRole: (
        token: string,
        roleId: string,
        name: string,
      ) => Promise<ApiResult<import('../shared/organization').OrganizationRoleItem[]>>;
      deleteOrganizationRole: (
        token: string,
        roleId: string,
      ) => Promise<ApiResult<import('../shared/organization').OrganizationRoleItem[]>>;
      getOrganizationInvites: (
        token: string,
      ) => Promise<ApiResult<import('../shared/organization').OrganizationInviteItem[]>>;
      sendOrganizationInvite: (
        token: string,
        email: string,
        roleId: string | null,
      ) => Promise<ApiResult<import('../shared/organization').OrganizationInviteItem[]>>;
      revokeOrganizationInvite: (
        token: string,
        inviteId: string,
      ) => Promise<ApiResult<import('../shared/organization').OrganizationInviteItem[]>>;
      getMyOrganizationInvites: (
        token: string,
      ) => Promise<ApiResult<import('../shared/organization').OrganizationInviteItem[]>>;
      acceptOrganizationInvite: (token: string, inviteId: string) => Promise<ApiResult<{ ok: true }>>;
      declineOrganizationInvite: (token: string, inviteId: string) => Promise<ApiResult<{ ok: true }>>;
      getOrganizationSeats: (
        token: string,
      ) => Promise<ApiResult<import('../shared/organization').OrganizationSeatsInfo>>;
      getOrgInvoices: (
        token: string,
      ) => Promise<ApiResult<import('../shared/organization').OrgInvoiceItem[]>>;
      getOrgInvoiceById: (
        token: string,
        invoiceId: string,
      ) => Promise<ApiResult<import('../shared/organization').OrgInvoiceItem>>;
      getSuperAdminStats: (
        token: string,
      ) => Promise<ApiResult<import('../shared/superadmin').SuperAdminStats>>;
      getSuperAdminOrganizations: (
        token: string,
        page: number,
        pageSize?: number,
      ) => Promise<ApiResult<import('../shared/superadmin').SuperAdminOrganizationsPage>>;
      suspendSuperAdminOrganization: (
        token: string,
        organizationId: string,
      ) => Promise<ApiResult<{ ok: true }>>;
      getConversations: (
        token: string,
        viewerUserId?: string | null,
      ) => Promise<ApiResult<ConversationsPayload>>;
      summarizeUnreadMessages: (
        token: string,
        conversationId: string,
      ) => Promise<ApiResult<{ summary: string }>>;
      prepareChatFileDrag: (
        token: string,
        url: string,
        fileName: string,
      ) => Promise<{ ok: true; filePath: string } | { ok: false; error: string }>;
      startChatFileDragFromPath: (filePath: string) => void;
      translateUnreadMessages: (
        token: string,
        conversationId: string,
      ) => Promise<ApiResult<{ translation: string }>>;
      getUnreadCount: (token: string) => Promise<ApiResult<UnreadCountPayload>>;
      getConversationBootstrap: (
        token: string,
        conversationId: string,
      ) => Promise<ApiResult<ConversationBootstrap>>;
      getConversationMessages: (
        token: string,
        conversationId: string,
        before?: string,
        limit?: number,
      ) => Promise<ApiResult<import('../shared/messages').MessageHistoryPage>>;
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
        mediaJson?: string,
      ) => Promise<ApiResult<MessageItem>>;
      getTrendingGifs: (
        token: string,
        limit?: number,
      ) => Promise<ApiResult<import('../shared/gifs').GifPickerItem[]>>;
      searchGifs: (
        token: string,
        query: string,
        limit?: number,
      ) => Promise<ApiResult<import('../shared/gifs').GifPickerItem[]>>;
      getTrendingStickers: (
        token: string,
        limit?: number,
      ) => Promise<ApiResult<import('../shared/gifs').GifPickerItem[]>>;
      searchStickers: (
        token: string,
        query: string,
        limit?: number,
      ) => Promise<ApiResult<import('../shared/gifs').GifPickerItem[]>>;
      createDirectConversation: (
        token: string,
        userId: string,
      ) => Promise<ApiResult<{ conversationId: string; conversation: import('../shared/chat').ConversationItem | null }>>;
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
      markNotificationRead: (
        token: string,
        notificationId: string,
      ) => Promise<ApiResult<{ ok: true }>>;
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
      unsaveMessage: (
        token: string,
        conversationId: string,
        messageId: string,
      ) => Promise<ApiResult<SavedMessageItem[]>>;
      renameConversation: (token: string, conversationId: string, name: string) => Promise<ApiResult<unknown>>;
      updateConversationNotificationSettings: (
        token: string,
        conversationId: string,
        settingsJson: string,
      ) => Promise<ApiResult<{ ok: true }>>;
      setConversationFavorite: (
        token: string,
        conversationId: string,
        favorite: boolean,
      ) => Promise<ApiResult<{ ok: true; favorite: boolean }>>;
      addConversationMembers: (token: string, conversationId: string, userIds: string[]) => Promise<ApiResult<unknown>>;
      removeConversationMember: (token: string, conversationId: string, userId: string) => Promise<ApiResult<unknown>>;
      leaveConversation: (token: string, conversationId: string, isHub: boolean) => Promise<ApiResult<unknown>>;
      deleteConversation: (token: string, conversationId: string) => Promise<ApiResult<unknown>>;
      clearConversationHistory: (token: string, conversationId: string) => Promise<ApiResult<unknown>>;
      createGroupConversation: (
        token: string,
        name: string,
        userIds: string[],
      ) => Promise<ApiResult<{ conversationId: string }>>;
      getSelfConversation: (token: string) => Promise<ApiResult<{ conversationId: string }>>;
      getConversationById: (token: string, conversationId: string) => Promise<ApiResult<unknown>>;
      markConversationUnread: (token: string, conversationId: string) => Promise<ApiResult<{ ok: true }>>;
      getPinnedMessages: (token: string, conversationId: string) => Promise<ApiResult<MessageItem[]>>;
      getMessageById: (
        token: string,
        conversationId: string,
        messageId: string,
      ) => Promise<ApiResult<MessageItem>>;
      getMentionSuggestions: (
        token: string,
        conversationId: string,
        query: string,
      ) => Promise<ApiResult<unknown[]>>;
      createPollMessage: (
        token: string,
        conversationId: string,
        payloadJson: string,
      ) => Promise<ApiResult<MessageItem>>;
      votePollMessage: (
        token: string,
        conversationId: string,
        messageId: string,
        optionId: string,
      ) => Promise<ApiResult<MessageItem>>;
      getConversationScheduledMessages: (
        token: string,
        conversationId: string,
      ) => Promise<ApiResult<unknown[]>>;
      createConversationScheduledMessage: (
        token: string,
        conversationId: string,
        payloadJson: string,
      ) => Promise<ApiResult<import('../shared/extras').ScheduledMessageItem>>;
      deleteConversationScheduledMessage: (
        token: string,
        conversationId: string,
        scheduledId: string,
      ) => Promise<ApiResult<{ ok: true }>>;
      updateConversationMemberRole: (
        token: string,
        conversationId: string,
        userId: string,
        role: string,
      ) => Promise<ApiResult<unknown>>;
      getConversationNotificationSettings: (
        token: string,
        conversationId: string,
      ) => Promise<ApiResult<Record<string, unknown>>>;
      registerAccount: (payloadJson: string) => Promise<LoginResult>;
      registerWorkspaceAccount: (payloadJson: string) => Promise<LoginResult>;
      getInviteRegistrationDetails: (inviteToken: string) => Promise<ApiResult<unknown>>;
      forgotPassword: (email: string) => Promise<ApiResult<{ message?: string; delivered?: boolean }>>;
      verifyResetCode: (payloadJson: string) => Promise<ApiResult<{ message?: string }>>;
      resetPassword: (payloadJson: string) => Promise<ApiResult<{ message?: string }>>;
      sendIndividualOtp: (
        email: string,
      ) => Promise<ApiResult<{ message?: string; delivered?: boolean }>>;
      verifyIndividualOtp: (
        payloadJson: string,
      ) => Promise<ApiResult<{ message?: string; verificationToken?: string; token?: string }>>;
      registerIndividualAccount: (payloadJson: string) => Promise<LoginResult>;
      createOrganizationWorkspace: (
        token: string | null,
        payloadJson: string,
      ) => Promise<ApiResult<unknown>>;
      getUserProfile: (token: string, userId: string) => Promise<ApiResult<unknown>>;
      getMessageConversation: (
        token: string,
        messageId: string,
      ) => Promise<ApiResult<{ conversationId: string }>>;
      getFiles: (
        token: string,
        filter: string,
        conversationId?: string,
      ) => Promise<ApiResult<FileItem[]>>;
      getCalendarEvents: (token: string) => Promise<ApiResult<CalendarEventItem[]>>;
      getCalendarMentionableUsers: (
        token: string,
      ) => Promise<ApiResult<import('../shared/extras').CalendarMentionableUser[]>>;
      getCalendarEventById: (
        token: string,
        eventId: string,
      ) => Promise<ApiResult<import('../shared/extras').CalendarEventItem>>;
      getCalendarEventTags: (
        eventId: string,
      ) => Promise<import('../shared/calendarEventTags').CalendarEventTagSnapshot | null>;
      setCalendarEventTags: (
        eventId: string,
        snapshot: import('../shared/calendarEventTags').CalendarEventTagSnapshot,
      ) => Promise<void>;
      getAllCalendarEventTags: () => Promise<
        Record<string, import('../shared/calendarEventTags').CalendarEventTagSnapshot>
      >;
      createCalendarEvent: (
        token: string,
        payloadJson: string,
      ) => Promise<ApiResult<import('../shared/extras').CalendarEventItem>>;
      updateCalendarEvent: (
        token: string,
        payloadJson: string,
      ) => Promise<ApiResult<import('../shared/extras').CalendarEventItem>>;
      respondToCalendarEvent: (
        token: string,
        eventId: string,
        accept: boolean,
      ) => Promise<ApiResult<{ ok: true }>>;
      deleteCalendarEvent: (token: string, eventId: string) => Promise<ApiResult<{ ok: true }>>;
      getScheduledMessages: (
        token: string,
      ) => Promise<ApiResult<import('../shared/extras').ScheduledMessageItem[]>>;
      enhanceMessageText: (
        token: string,
        text: string,
      ) => Promise<ApiResult<import('../shared/extras').AiTextResult>>;
      generateMessageText: (
        token: string,
        description: string,
      ) => Promise<ApiResult<import('../shared/extras').AiTextResult>>;
      parseFlexCommand: (
        token: string,
        input: string,
        conversationId?: string,
      ) => Promise<ApiResult<import('../shared/extras').AiTextResult>>;
      transcribeAudioFile: (
        token: string,
        fileName: string,
        mimeType: string,
        base64Data: string,
      ) => Promise<ApiResult<import('../shared/extras').AiTextResult>>;
      getPushVapidPublicKey: (
        token: string,
      ) => Promise<ApiResult<import('../shared/extras').PushVapidKeyResult>>;
      subscribePushNotifications: (
        token: string,
        subscriptionJson: string,
      ) => Promise<ApiResult<{ ok: true }>>;
      unsubscribePushEndpoint: (token: string, endpoint: string) => Promise<ApiResult<{ ok: true }>>;
      deletePushSubscriptions: (token: string) => Promise<ApiResult<{ ok: true }>>;
      getChannels: (token: string) => Promise<ApiResult<ChannelItem[]>>;
      getHubInvites: (token: string) => Promise<ApiResult<HubInviteItem[]>>;
      getFriends: (token: string) => Promise<ApiResult<FriendItem[]>>;
      acceptHubInvite: (token: string, channelId: string) => Promise<ApiResult<{ ok: true }>>;
      acceptHubInviteById: (token: string, inviteId: string) => Promise<ApiResult<{ ok: true }>>;
      declineHubInvite: (token: string, inviteId: string) => Promise<ApiResult<{ ok: true }>>;
      getBlockedUsers: (token: string) => Promise<ApiResult<BlockedUserItem[]>>;
      blockUser: (token: string, userId: string) => Promise<ApiResult<{ success: true }>>;
      unblockUser: (token: string, userId: string) => Promise<ApiResult<{ success: true }>>;
      getFriendRelationship: (token: string, userId: string) => Promise<ApiResult<FriendRelationship>>;
      createChannel: (token: string, payloadJson: string) => Promise<ApiResult<CreatedChannelResult>>;
      updateChannelName: (
        token: string,
        channelId: string,
        name: string,
      ) => Promise<ApiResult<{ ok: true }>>;
      updateChannelDescription: (
        token: string,
        channelId: string,
        description: string,
      ) => Promise<ApiResult<{ ok: true }>>;
      updateChannelSettings: (
        token: string,
        channelId: string,
        settingsJson: string,
      ) => Promise<ApiResult<{ ok: true }>>;
      getChannelInvites: (token: string, channelId: string) => Promise<ApiResult<ChannelInviteItem[]>>;
      revokeChannelInvite: (
        token: string,
        channelId: string,
        inviteId: string,
      ) => Promise<ApiResult<{ ok: true }>>;
      deleteChannel: (token: string, channelId: string) => Promise<ApiResult<{ ok: true }>>;
      sendFriendRequest: (token: string, userId: string) => Promise<ApiResult<{ ok: true }>>;
      respondFriendRequest: (token: string, userId: string, status: 'ACCEPTED' | 'DECLINED') => Promise<ApiResult<{ ok: true }>>;
      getAvatarStyles: (token: string) => Promise<ApiResult<import('../shared/profile').AvatarStyleItem[]>>;
      getNotificationSettings: (token: string) => Promise<ApiResult<ProfileSettings>>;
      updateNotificationSettings: (
        token: string,
        updatesJson: string,
      ) => Promise<ApiResult<ProfileSettings>>;
      updateUserProfile: (token: string, updatesJson: string) => Promise<ApiResult<unknown>>;
      updateUserStatus: (
        token: string,
        status: string,
        message?: string,
      ) => Promise<ApiResult<{ ok: true }>>;
      updateUserTimezone: (token: string, timezone: string) => Promise<ApiResult<{ ok: true }>>;
      uploadProfileImage: (
        token: string,
        fileName: string,
        mimeType: string,
        base64Data: string,
      ) => Promise<ApiResult<{ url: string }>>;
      fetchAuthenticatedMedia: (
        token: string,
        url: string,
      ) => Promise<ApiResult<{ mimeType: string; bytes: Uint8Array }>>;
      openExternalUrl: (url: string) => Promise<ApiResult<{ ok: true }>>;
      getOrganizationMembersDetailed: (
        token: string,
      ) => Promise<ApiResult<OrganizationMemberItem[]>>;
      startRealtime: (token: string) => Promise<{ ok: true }>;
      stopRealtime: () => Promise<{ ok: true }>;
      sendTyping: (
        token: string,
        conversationId: string,
        isTyping: boolean,
      ) => Promise<ApiResult<{ ok: true }>>;
      getUserPresence: (
        token: string,
        userIds: string[],
      ) => Promise<ApiResult<import('../shared/realtime').PresenceItem[]>>;
      onRealtimeEvent: (callback: (event: unknown) => void) => () => void;
      onRealtimeStatus: (callback: (status: RealtimeConnectionStatus) => void) => () => void;
      getRealtimeConfig: (
        token: string,
      ) => Promise<ApiResult<import('../shared/realtime').RealtimeClientConfig>>;
      getRealtimeAccessToken: (token: string) => Promise<ApiResult<string>>;
      initCallSignaling: (
        config: import('../shared/realtime').RealtimeClientConfig,
      ) => Promise<ApiResult<{ ok: true }>>;
      refreshCallSignalingAuth: (
        config: import('../shared/realtime').RealtimeClientConfig,
      ) => Promise<ApiResult<{ ok: true }>>;
      subscribeCallSignalingChannel: (
        channelName: string,
        mode: 'direct' | 'hub',
      ) => Promise<ApiResult<{ ok: true }>>;
      sendCallSignaling: (
        channelName: string,
        event: string,
        payload: unknown,
      ) => Promise<ApiResult<{ ok: true }>>;
      unsubscribeCallSignalingChannel: (channelName: string) => Promise<ApiResult<{ ok: true }>>;
      disconnectCallSignaling: () => Promise<ApiResult<{ ok: true }>>;
      onCallSignalingBroadcast: (
        callback: (payload: { channelName: string; event: string; payload: unknown }) => void,
      ) => () => void;
      getCallToken: (
        token: string,
        payloadJson: string,
      ) => Promise<ApiResult<import('../shared/calls').CallTokenResult>>;
      ensureCallMediaPermissions: (video: boolean) => Promise<ApiResult<{ ok: true }>>;
      getAppName: () => Promise<string>;
      ensureScreenCapturePermission: () => Promise<ApiResult<{ ok: true }>>;
      describeScreenCaptureFailure: () => Promise<ApiResult<string>>;
      listScreenCaptureSources: (
        kind: import('../shared/screenShare').ScreenCaptureSourceKind,
      ) => Promise<ApiResult<import('../shared/screenShare').ScreenCaptureSource[]>>;
      setCallAlwaysOnTop: (enabled: boolean, mode?: string) => Promise<{ ok: true }>;
      moveCallWindowBy: (deltaX: number, deltaY: number) => Promise<{ ok: boolean }>;
      focusCallWindow: () => Promise<{ ok: true }>;
      ensureMainWindowVisible: () => Promise<{ ok: true }>;
      onCallWindowPresentationChanged: (callback: (mode: string) => void) => () => void;
      logCall: (
        token: string,
        payloadJson: string,
      ) => Promise<ApiResult<{ message?: unknown }>>;
      notifyCallMeeting: (
        token: string,
        payloadJson: string,
      ) => Promise<ApiResult<{ notified?: number }>>;
      muteCallParticipant: (
        token: string,
        conversationId: string,
        participantIdentity: string,
        muted: boolean,
      ) => Promise<ApiResult<{ muted?: boolean }>>;
      removeCallParticipant: (
        token: string,
        conversationId: string,
        participantIdentity: string,
      ) => Promise<ApiResult<{ removed?: boolean }>>;
      endCallMeeting: (
        token: string,
        conversationId: string,
      ) => Promise<ApiResult<{ ended?: boolean }>>;
      requestMeetingJoin: (
        token: string,
        payloadJson: string,
      ) => Promise<ApiResult<unknown>>;
      listMeetingJoinRequests: (
        token: string,
        conversationId: string,
      ) => Promise<ApiResult<import('../shared/calls').MeetingJoinRequestItem[]>>;
      respondMeetingJoinRequest: (
        token: string,
        payloadJson: string,
      ) => Promise<ApiResult<unknown>>;
      getCallHistory: (token: string, filter?: 'all' | 'missed') => Promise<ApiResult<unknown>>;
      declineCallMeetingInvite: (
        token: string,
        payloadJson: string,
      ) => Promise<ApiResult<unknown>>;
      getDeclinedCallMeetingInvites: (
        token: string,
        conversationId: string,
        callId: string,
      ) => Promise<ApiResult<unknown>>;
      setNativeTheme: (mode: 'light' | 'dark') => Promise<{ ok: boolean }>;
      showDesktopNotification: (
        payload: any
      ) => Promise<{ ok: boolean; error?: string }>;
      logRendererDebug: (message: string) => Promise<{ ok: boolean }>;
      onDesktopNotificationClick: (
        callback: (
          detail: string | { tag?: string; conversationId?: string | null; messageId?: string | null },
        ) => void,
      ) => () => void;
      onNotificationRender: (callback: (payload: any) => void) => () => void;
      sendNotificationAction: (action: string) => void;
      sendNotificationReady: () => void;
      onNotificationToast: (callback: (payload: import('./ui/notifications/FlexHubsDesktopNotification').FlexHubsNotificationData & {
        tag?: string;
        conversationId?: string | null;
        messageId?: string | null;
      }) => void) => (() => void);
      sendDesktopToastClick: (detail: {
        tag?: string;
        conversationId?: string | null;
        messageId?: string | null;
      }) => void;
      setNotificationWindowSize?: (size: { width: number; height: number }) => void;
      checkForUpdates: () => Promise<{
        ok: boolean;
        status?: 'skipped' | 'up-to-date' | 'available';
        skipped?: boolean;
        currentVersion?: string;
        data?: { version?: string; releaseNotes?: unknown };
        error?: string;
      }>;
      downloadUpdate: () => Promise<{ ok: boolean; error?: string }>;
      quitAndInstallUpdate: () => Promise<void>;
      openDesktopReleasePage?: () => Promise<{ ok: boolean }>;
      getAppVersion: () => Promise<string>;
      getDesktopLegalContext: () => Promise<{
        isPackaged: boolean;
        version: string;
        acceptedLegalVersion: number | null;
      }>;
      acceptDesktopLegal: (version: number) => Promise<{ ok: boolean }>;
      quitDesktopApp: () => Promise<void>;
      getHardwareAccelerationDisabled: () => Promise<boolean>;
      setHardwareAccelerationDisabled: (disabled: boolean) => Promise<void>;
      relaunchApp: () => Promise<void>;
      onUpdaterEvent: (event: string, callback: (...args: any[]) => void) => () => void;
    };
  }
}

export {};
