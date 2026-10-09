import { contextBridge, ipcRenderer } from 'electron';
import type { ApiResult } from './shared/api';
import type { ConversationsPayload, UnreadCountPayload } from './shared/chat';
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
  createOrgOrder: (
    token: string | null,
    payloadJson: string,
  ): Promise<ApiResult<import('./shared/workspace').OrgOrderResult>> =>
    ipcRenderer.invoke('payments:create-org-order', token, payloadJson),
  verifyOrgSubscription: (
    token: string | null,
    payloadJson: string,
  ): Promise<ApiResult<import('./shared/workspace').WorkspaceCreationResult>> =>
    ipcRenderer.invoke('payments:verify-org-subscription', token, payloadJson),
  getPaymentPlans: (
    token: string | null,
  ): Promise<ApiResult<import('./shared/payments').PaymentPlanItem[]>> =>
    ipcRenderer.invoke('payments:plans', token),
  getOrgSubscription: (
    token: string,
  ): Promise<ApiResult<import('./shared/payments').OrgSubscriptionInfo | null>> =>
    ipcRenderer.invoke('payments:org-subscription', token),
  getPlanCompliance: (
    token: string | null,
    planId: string,
    teamSize: number,
  ): Promise<ApiResult<import('./shared/payments').PlanComplianceInfo>> =>
    ipcRenderer.invoke('payments:plan-compliance', token, planId, teamSize),
  createUpgradeOrder: (
    token: string,
    payloadJson: string,
  ): Promise<ApiResult<import('./shared/workspace').OrgOrderResult>> =>
    ipcRenderer.invoke('payments:create-order', token, payloadJson),
  verifyUpgradeSubscription: (
    token: string,
    payloadJson: string,
  ): Promise<ApiResult<{ ok: true }>> =>
    ipcRenderer.invoke('payments:verify-upgrade', token, payloadJson),
  getOrganizationMembersAdmin: (
    token: string,
  ): Promise<ApiResult<import('./shared/profile').OrganizationMemberItem[]>> =>
    ipcRenderer.invoke('org:members', token),
  removeOrganizationMember: (token: string, userId: string): Promise<ApiResult<{ ok: true }>> =>
    ipcRenderer.invoke('org:remove-member', token, userId),
  leaveOrganizationWorkspace: (token: string): Promise<ApiResult<{ ok: true }>> =>
    ipcRenderer.invoke('org:leave', token),
  getOrganizationRoles: (
    token: string,
  ): Promise<ApiResult<import('./shared/organization').OrganizationRoleItem[]>> =>
    ipcRenderer.invoke('org:roles', token),
  createOrganizationRole: (
    token: string,
    name: string,
  ): Promise<ApiResult<import('./shared/organization').OrganizationRoleItem[]>> =>
    ipcRenderer.invoke('org:create-role', token, name),
  updateOrganizationRole: (
    token: string,
    roleId: string,
    name: string,
  ): Promise<ApiResult<import('./shared/organization').OrganizationRoleItem[]>> =>
    ipcRenderer.invoke('org:update-role', token, roleId, name),
  deleteOrganizationRole: (
    token: string,
    roleId: string,
  ): Promise<ApiResult<import('./shared/organization').OrganizationRoleItem[]>> =>
    ipcRenderer.invoke('org:delete-role', token, roleId),
  getOrganizationInvites: (
    token: string,
  ): Promise<ApiResult<import('./shared/organization').OrganizationInviteItem[]>> =>
    ipcRenderer.invoke('org:invites', token),
  sendOrganizationInvite: (
    token: string,
    email: string,
    roleId: string | null,
  ): Promise<ApiResult<import('./shared/organization').OrganizationInviteItem[]>> =>
    ipcRenderer.invoke('org:send-invite', token, email, roleId),
  revokeOrganizationInvite: (
    token: string,
    inviteId: string,
  ): Promise<ApiResult<import('./shared/organization').OrganizationInviteItem[]>> =>
    ipcRenderer.invoke('org:revoke-invite', token, inviteId),
  getMyOrganizationInvites: (
    token: string,
  ): Promise<ApiResult<import('./shared/organization').OrganizationInviteItem[]>> =>
    ipcRenderer.invoke('org:my-invites', token),
  acceptOrganizationInvite: (token: string, inviteId: string): Promise<ApiResult<{ ok: true }>> =>
    ipcRenderer.invoke('org:accept-invite', token, inviteId),
  declineOrganizationInvite: (token: string, inviteId: string): Promise<ApiResult<{ ok: true }>> =>
    ipcRenderer.invoke('org:decline-invite', token, inviteId),
  getOrganizationSeats: (
    token: string,
  ): Promise<ApiResult<import('./shared/organization').OrganizationSeatsInfo>> =>
    ipcRenderer.invoke('org:seats', token),
  getOrgInvoices: (
    token: string,
  ): Promise<ApiResult<import('./shared/organization').OrgInvoiceItem[]>> =>
    ipcRenderer.invoke('org:invoices', token),
  getOrgInvoiceById: (
    token: string,
    invoiceId: string,
  ): Promise<ApiResult<import('./shared/organization').OrgInvoiceItem>> =>
    ipcRenderer.invoke('org:invoice', token, invoiceId),
  getSuperAdminStats: (
    token: string,
  ): Promise<ApiResult<import('./shared/superadmin').SuperAdminStats>> =>
    ipcRenderer.invoke('superadmin:stats', token),
  getSuperAdminOrganizations: (
    token: string,
    page: number,
    pageSize?: number,
  ): Promise<ApiResult<import('./shared/superadmin').SuperAdminOrganizationsPage>> =>
    ipcRenderer.invoke('superadmin:organizations', token, page, pageSize),
  suspendSuperAdminOrganization: (
    token: string,
    organizationId: string,
  ): Promise<ApiResult<{ ok: true }>> =>
    ipcRenderer.invoke('superadmin:suspend', token, organizationId),
  getConversations: (
    token: string,
    viewerUserId?: string | null,
  ): Promise<ApiResult<ConversationsPayload>> =>
    ipcRenderer.invoke('chat:conversations', token, viewerUserId ?? null),
  summarizeUnreadMessages: (
    token: string,
    conversationId: string,
  ): Promise<ApiResult<{ summary: string }>> =>
    ipcRenderer.invoke('chat:summarize-unread', token, conversationId),
  prepareChatFileDrag: (
    token: string,
    url: string,
    fileName: string,
  ): Promise<{ ok: true; filePath: string } | { ok: false; error: string }> =>
    ipcRenderer.invoke('desktop:prepare-file-drag', token, url, fileName),
  startChatFileDragFromPath: (filePath: string): void => {
    ipcRenderer.send('desktop:start-file-drag-path', filePath);
  },
  translateUnreadMessages: (
    token: string,
    conversationId: string,
  ): Promise<ApiResult<{ translation: string }>> =>
    ipcRenderer.invoke('chat:translate-unread', token, conversationId),
  getUnreadCount: (token: string): Promise<ApiResult<UnreadCountPayload>> =>
    ipcRenderer.invoke('chat:unread-count', token),
  getConversationBootstrap: (
    token: string,
    conversationId: string,
  ): Promise<ApiResult<ConversationBootstrap>> =>
    ipcRenderer.invoke('chat:conversation-bootstrap', token, conversationId),
  getConversationMessages: (
    token: string,
    conversationId: string,
    before?: string,
    limit?: number,
  ): Promise<ApiResult<import('./shared/messages').MessageHistoryPage>> =>
    ipcRenderer.invoke('chat:conversation-messages', token, conversationId, before, limit),
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
    mediaJson?: string,
  ): Promise<ApiResult<MessageItem>> =>
    ipcRenderer.invoke('chat:send-message', token, conversationId, content, replyToId, threadRootId, mediaJson),
  getTrendingGifs: (token: string, limit?: number): Promise<ApiResult<import('./shared/gifs').GifPickerItem[]>> =>
    ipcRenderer.invoke('gifs:trending', token, limit),
  searchGifs: (
    token: string,
    query: string,
    limit?: number,
  ): Promise<ApiResult<import('./shared/gifs').GifPickerItem[]>> =>
    ipcRenderer.invoke('gifs:search', token, query, limit),
  getTrendingStickers: (
    token: string,
    limit?: number,
  ): Promise<ApiResult<import('./shared/gifs').GifPickerItem[]>> =>
    ipcRenderer.invoke('gifs:stickers-trending', token, limit),
  searchStickers: (
    token: string,
    query: string,
    limit?: number,
  ): Promise<ApiResult<import('./shared/gifs').GifPickerItem[]>> =>
    ipcRenderer.invoke('gifs:stickers-search', token, query, limit),
  createDirectConversation: (
    token: string,
    userId: string,
  ): Promise<ApiResult<{ conversationId: string; conversation: import('./shared/chat').ConversationItem | null }>> =>
    ipcRenderer.invoke('chat:create-direct', token, userId),
  addMessageReaction: (
    token: string,
    conversationId: string,
    messageId: string,
    emoji: string,
  ): Promise<ApiResult<MessageItem>> =>
    ipcRenderer.invoke('chat:add-reaction', token, conversationId, messageId, emoji),
  removeMessageReaction: (
    token: string,
    conversationId: string,
    messageId: string,
    emoji: string,
  ): Promise<ApiResult<MessageItem>> =>
    ipcRenderer.invoke('chat:remove-reaction', token, conversationId, messageId, emoji),
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
  renameConversation: (token: string, conversationId: string, name: string): Promise<ApiResult<unknown>> =>
    ipcRenderer.invoke('chat:rename-conversation', token, conversationId, name),
  updateConversationNotificationSettings: (
    token: string,
    conversationId: string,
    settingsJson: string,
  ): Promise<ApiResult<{ ok: true }>> =>
    ipcRenderer.invoke('chat:update-conversation-notification-settings', token, conversationId, settingsJson),
  setConversationFavorite: (
    token: string,
    conversationId: string,
    favorite: boolean,
  ): Promise<ApiResult<{ ok: true }>> =>
    ipcRenderer.invoke('chat:set-conversation-favorite', token, conversationId, favorite),
  addConversationMembers: (token: string, conversationId: string, userIds: string[]): Promise<ApiResult<unknown>> =>
    ipcRenderer.invoke('chat:add-conversation-members', token, conversationId, userIds),
  removeConversationMember: (token: string, conversationId: string, userId: string): Promise<ApiResult<unknown>> =>
    ipcRenderer.invoke('chat:remove-conversation-member', token, conversationId, userId),
  leaveConversation: (token: string, conversationId: string, isHub: boolean): Promise<ApiResult<unknown>> =>
    ipcRenderer.invoke('chat:leave-conversation', token, conversationId, isHub),
  deleteConversation: (token: string, conversationId: string): Promise<ApiResult<unknown>> =>
    ipcRenderer.invoke('chat:delete-conversation', token, conversationId),
  clearConversationHistory: (token: string, conversationId: string): Promise<ApiResult<unknown>> =>
    ipcRenderer.invoke('chat:clear-conversation-history', token, conversationId),
  createGroupConversation: (
    token: string,
    name: string,
    userIds: string[],
  ): Promise<ApiResult<{ conversationId: string }>> =>
    ipcRenderer.invoke('chat:create-group', token, name, userIds),
  getSelfConversation: (token: string): Promise<ApiResult<{ conversationId: string }>> =>
    ipcRenderer.invoke('chat:self-conversation', token),
  getConversationById: (token: string, conversationId: string): Promise<ApiResult<unknown>> =>
    ipcRenderer.invoke('chat:get-conversation', token, conversationId),
  markConversationUnread: (token: string, conversationId: string): Promise<ApiResult<{ ok: true }>> =>
    ipcRenderer.invoke('chat:mark-unread', token, conversationId),
  getPinnedMessages: (token: string, conversationId: string): Promise<ApiResult<MessageItem[]>> =>
    ipcRenderer.invoke('chat:pinned-messages', token, conversationId),
  getMessageById: (
    token: string,
    conversationId: string,
    messageId: string,
  ): Promise<ApiResult<MessageItem>> =>
    ipcRenderer.invoke('chat:get-message', token, conversationId, messageId),
  getMentionSuggestions: (
    token: string,
    conversationId: string,
    query: string,
  ): Promise<ApiResult<unknown[]>> =>
    ipcRenderer.invoke('chat:mention-suggestions', token, conversationId, query),
  createPollMessage: (
    token: string,
    conversationId: string,
    payloadJson: string,
  ): Promise<ApiResult<MessageItem>> =>
    ipcRenderer.invoke('chat:create-poll', token, conversationId, payloadJson),
  votePollMessage: (
    token: string,
    conversationId: string,
    messageId: string,
    optionId: string,
  ): Promise<ApiResult<MessageItem>> =>
    ipcRenderer.invoke('chat:vote-poll', token, conversationId, messageId, optionId),
  getConversationScheduledMessages: (
    token: string,
    conversationId: string,
  ): Promise<ApiResult<unknown[]>> =>
    ipcRenderer.invoke('chat:conversation-scheduled-messages', token, conversationId),
  createConversationScheduledMessage: (
    token: string,
    conversationId: string,
    payloadJson: string,
  ): Promise<ApiResult<unknown>> =>
    ipcRenderer.invoke('chat:create-conversation-scheduled-message', token, conversationId, payloadJson),
  deleteConversationScheduledMessage: (
    token: string,
    conversationId: string,
    scheduledId: string,
  ): Promise<ApiResult<{ ok: true }>> =>
    ipcRenderer.invoke('chat:delete-conversation-scheduled-message', token, conversationId, scheduledId),
  updateConversationMemberRole: (
    token: string,
    conversationId: string,
    userId: string,
    role: string,
  ): Promise<ApiResult<unknown>> =>
    ipcRenderer.invoke('chat:update-member-role', token, conversationId, userId, role),
  getConversationNotificationSettings: (
    token: string,
    conversationId: string,
  ): Promise<ApiResult<Record<string, unknown>>> =>
    ipcRenderer.invoke('chat:get-conversation-notification-settings', token, conversationId),
  registerAccount: (payloadJson: string): Promise<LoginResult> =>
    ipcRenderer.invoke('auth:register', payloadJson),
  registerWorkspaceAccount: (payloadJson: string): Promise<LoginResult> =>
    ipcRenderer.invoke('auth:register-workspace', payloadJson),
  getInviteRegistrationDetails: (inviteToken: string): Promise<ApiResult<unknown>> =>
    ipcRenderer.invoke('auth:invite-details', inviteToken),
  forgotPassword: (email: string): Promise<ApiResult<{ message?: string; delivered?: boolean }>> =>
    ipcRenderer.invoke('auth:forgot-password', email),
  verifyResetCode: (payloadJson: string): Promise<ApiResult<{ message?: string }>> =>
    ipcRenderer.invoke('auth:verify-reset-code', payloadJson),
  resetPassword: (payloadJson: string): Promise<ApiResult<{ message?: string }>> =>
    ipcRenderer.invoke('auth:reset-password', payloadJson),
  sendIndividualOtp: (email: string): Promise<ApiResult<{ message?: string; delivered?: boolean }>> =>
    ipcRenderer.invoke('auth:send-individual-otp', email),
  verifyIndividualOtp: (
    payloadJson: string,
  ): Promise<ApiResult<{ message?: string; verificationToken?: string; token?: string }>> =>
    ipcRenderer.invoke('auth:verify-individual-otp', payloadJson),
  registerIndividualAccount: (payloadJson: string): Promise<LoginResult> =>
    ipcRenderer.invoke('auth:register-individual', payloadJson),
  createOrganizationWorkspace: (
    token: string | null,
    payloadJson: string,
  ): Promise<ApiResult<unknown>> => ipcRenderer.invoke('org:create', token, payloadJson),
  getUserProfile: (token: string, userId: string): Promise<ApiResult<unknown>> =>
    ipcRenderer.invoke('user:profile', token, userId),
  getMessageConversation: (
    token: string,
    messageId: string,
  ): Promise<ApiResult<{ conversationId: string }>> =>
    ipcRenderer.invoke('features:message-conversation', token, messageId),
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
  markNotificationRead: (
    token: string,
    notificationId: string,
  ): Promise<ApiResult<{ ok: true }>> =>
    ipcRenderer.invoke('chat:notification-read', token, notificationId),
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
  getFiles: (
    token: string,
    filter: string,
    conversationId?: string,
  ): Promise<ApiResult<FileItem[]>> =>
    ipcRenderer.invoke('features:files', token, filter, conversationId),
  getCalendarEvents: (token: string): Promise<ApiResult<CalendarEventItem[]>> =>
    ipcRenderer.invoke('features:calendar', token),
  getCalendarMentionableUsers: (
    token: string,
  ): Promise<ApiResult<import('./shared/extras').CalendarMentionableUser[]>> =>
    ipcRenderer.invoke('extras:calendar-mentionable-users', token),
  getCalendarEventById: (
    token: string,
    eventId: string,
  ): Promise<ApiResult<import('./shared/extras').CalendarEventItem>> =>
    ipcRenderer.invoke('extras:calendar-event-by-id', token, eventId),
  getCalendarEventTags: (
    eventId: string,
  ): Promise<import('./shared/calendarEventTags').CalendarEventTagSnapshot | null> =>
    ipcRenderer.invoke('calendar:get-event-tags', eventId),
  setCalendarEventTags: (
    eventId: string,
    snapshot: import('./shared/calendarEventTags').CalendarEventTagSnapshot,
  ): Promise<void> => ipcRenderer.invoke('calendar:set-event-tags', eventId, snapshot),
  getAllCalendarEventTags: (): Promise<
    Record<string, import('./shared/calendarEventTags').CalendarEventTagSnapshot>
  > => ipcRenderer.invoke('calendar:get-all-event-tags'),
  createCalendarEvent: (
    token: string,
    payloadJson: string,
  ): Promise<ApiResult<import('./shared/extras').CalendarEventItem>> =>
    ipcRenderer.invoke('extras:create-calendar-event', token, payloadJson),
  updateCalendarEvent: (
    token: string,
    payloadJson: string,
  ): Promise<ApiResult<import('./shared/extras').CalendarEventItem>> =>
    ipcRenderer.invoke('extras:update-calendar-event', token, payloadJson),
  respondToCalendarEvent: (
    token: string,
    eventId: string,
    accept: boolean,
  ): Promise<ApiResult<{ ok: true }>> =>
    ipcRenderer.invoke('extras:respond-calendar-event', token, eventId, accept),
  deleteCalendarEvent: (token: string, eventId: string): Promise<ApiResult<{ ok: true }>> =>
    ipcRenderer.invoke('extras:delete-calendar-event', token, eventId),
  getScheduledMessages: (
    token: string,
  ): Promise<ApiResult<import('./shared/extras').ScheduledMessageItem[]>> =>
    ipcRenderer.invoke('extras:scheduled-messages', token),
  enhanceMessageText: (token: string, text: string): Promise<ApiResult<import('./shared/extras').AiTextResult>> =>
    ipcRenderer.invoke('extras:ai-enhance', token, text),
  generateMessageText: (
    token: string,
    description: string,
  ): Promise<ApiResult<import('./shared/extras').AiTextResult>> =>
    ipcRenderer.invoke('extras:ai-generate', token, description),
  parseFlexCommand: (
    token: string,
    input: string,
    conversationId?: string,
  ): Promise<ApiResult<import('./shared/extras').AiTextResult>> =>
    ipcRenderer.invoke('extras:ai-flex-command', token, input, conversationId),
  transcribeAudioFile: (
    token: string,
    fileName: string,
    mimeType: string,
    base64Data: string,
  ): Promise<ApiResult<import('./shared/extras').AiTextResult>> =>
    ipcRenderer.invoke('extras:ai-transcribe', token, fileName, mimeType, base64Data),
  getPushVapidPublicKey: (
    token: string,
  ): Promise<ApiResult<import('./shared/extras').PushVapidKeyResult>> =>
    ipcRenderer.invoke('extras:push-vapid-key', token),
  subscribePushNotifications: (
    token: string,
    subscriptionJson: string,
  ): Promise<ApiResult<{ ok: true }>> =>
    ipcRenderer.invoke('extras:push-subscribe', token, subscriptionJson),
  unsubscribePushEndpoint: (token: string, endpoint: string): Promise<ApiResult<{ ok: true }>> =>
    ipcRenderer.invoke('extras:push-unsubscribe', token, endpoint),
  deletePushSubscriptions: (token: string): Promise<ApiResult<{ ok: true }>> =>
    ipcRenderer.invoke('extras:push-delete-subscriptions', token),
  getChannels: (token: string): Promise<ApiResult<ChannelItem[]>> =>
    ipcRenderer.invoke('features:channels', token),
  getHubInvites: (token: string): Promise<ApiResult<HubInviteItem[]>> =>
    ipcRenderer.invoke('features:hub-invites', token),
  getFriends: (token: string): Promise<ApiResult<FriendItem[]>> =>
    ipcRenderer.invoke('features:friends', token),
  acceptHubInvite: (token: string, channelId: string): Promise<ApiResult<{ ok: true }>> =>
    ipcRenderer.invoke('features:accept-hub-invite', token, channelId),
  acceptHubInviteById: (token: string, inviteId: string): Promise<ApiResult<{ ok: true }>> =>
    ipcRenderer.invoke('features:accept-hub-invite-by-id', token, inviteId),
  declineHubInvite: (token: string, inviteId: string): Promise<ApiResult<{ ok: true }>> =>
    ipcRenderer.invoke('features:decline-hub-invite', token, inviteId),
  getBlockedUsers: (token: string): Promise<ApiResult<BlockedUserItem[]>> =>
    ipcRenderer.invoke('features:blocks', token),
  blockUser: (token: string, userId: string): Promise<ApiResult<{ success: true }>> =>
    ipcRenderer.invoke('features:block-user', token, userId),
  unblockUser: (token: string, userId: string): Promise<ApiResult<{ success: true }>> =>
    ipcRenderer.invoke('features:unblock-user', token, userId),
  getFriendRelationship: (token: string, userId: string): Promise<ApiResult<FriendRelationship>> =>
    ipcRenderer.invoke('features:friend-relationship', token, userId),
  createChannel: (
    token: string,
    payloadJson: string,
  ): Promise<ApiResult<CreatedChannelResult>> =>
    ipcRenderer.invoke('features:create-channel', token, payloadJson),
  updateChannelName: (
    token: string,
    channelId: string,
    name: string,
  ): Promise<ApiResult<{ ok: true }>> =>
    ipcRenderer.invoke('features:update-channel-name', token, channelId, name),
  updateChannelDescription: (
    token: string,
    channelId: string,
    description: string,
  ): Promise<ApiResult<{ ok: true }>> =>
    ipcRenderer.invoke('features:update-channel-description', token, channelId, description),
  updateChannelSettings: (
    token: string,
    channelId: string,
    settingsJson: string,
  ): Promise<ApiResult<{ ok: true }>> =>
    ipcRenderer.invoke('features:update-channel-settings', token, channelId, settingsJson),
  getChannelInvites: (token: string, channelId: string): Promise<ApiResult<ChannelInviteItem[]>> =>
    ipcRenderer.invoke('features:channel-invites', token, channelId),
  revokeChannelInvite: (
    token: string,
    channelId: string,
    inviteId: string,
  ): Promise<ApiResult<{ ok: true }>> =>
    ipcRenderer.invoke('features:revoke-channel-invite', token, channelId, inviteId),
  deleteChannel: (token: string, channelId: string): Promise<ApiResult<{ ok: true }>> =>
    ipcRenderer.invoke('features:delete-channel', token, channelId),
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
  getAvatarStyles: (token: string): Promise<ApiResult<import('./shared/profile').AvatarStyleItem[]>> =>
    ipcRenderer.invoke('user:avatar-styles', token),
  getNotificationSettings: (token: string): Promise<ApiResult<import('./shared/profile').ProfileSettings>> =>
    ipcRenderer.invoke('user:notification-settings', token),
  updateNotificationSettings: (
    token: string,
    updatesJson: string,
  ): Promise<ApiResult<import('./shared/profile').ProfileSettings>> =>
    ipcRenderer.invoke('user:update-notification-settings', token, updatesJson),
  updateUserProfile: (token: string, updatesJson: string): Promise<ApiResult<unknown>> =>
    ipcRenderer.invoke('user:update-profile', token, updatesJson),
  updateUserStatus: (
    token: string,
    status: string,
    message?: string,
  ): Promise<ApiResult<{ ok: true }>> =>
    ipcRenderer.invoke('user:update-status', token, status, message),
  updateUserTimezone: (token: string, timezone: string): Promise<ApiResult<{ ok: true }>> =>
    ipcRenderer.invoke('user:update-timezone', token, timezone),
  uploadProfileImage: (
    token: string,
    fileName: string,
    mimeType: string,
    base64Data: string,
  ): Promise<ApiResult<{ url: string }>> =>
    ipcRenderer.invoke('user:upload-image', token, fileName, mimeType, base64Data),
  fetchAuthenticatedMedia: (
    token: string,
    url: string,
  ): Promise<ApiResult<{ mimeType: string; bytes: Uint8Array }>> =>
    ipcRenderer.invoke('media:fetch-authenticated', token, url),
  openExternalUrl: (url: string): Promise<ApiResult<{ ok: true }>> =>
    ipcRenderer.invoke('shell:open-external', url),
  getOrganizationMembersDetailed: (
    token: string,
  ): Promise<ApiResult<import('./shared/profile').OrganizationMemberItem[]>> =>
    ipcRenderer.invoke('user:organization-members-detailed', token),
  startRealtime: (token: string): Promise<{ ok: true }> =>
    ipcRenderer.invoke('realtime:start', token),
  stopRealtime: (): Promise<{ ok: true }> => ipcRenderer.invoke('realtime:stop'),
  sendTyping: (
    token: string,
    conversationId: string,
    isTyping: boolean,
  ): Promise<ApiResult<{ ok: true }>> =>
    ipcRenderer.invoke('realtime:typing', token, conversationId, isTyping),
  getUserPresence: (
    token: string,
    userIds: string[],
  ): Promise<ApiResult<import('./shared/realtime').PresenceItem[]>> =>
    ipcRenderer.invoke('realtime:presence', token, JSON.stringify(userIds)),
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
  getRealtimeConfig: (
    token: string,
  ): Promise<ApiResult<import('./shared/realtime').RealtimeClientConfig>> =>
    ipcRenderer.invoke('realtime:config', token),
  getRealtimeAccessToken: (token: string): Promise<ApiResult<string>> =>
    ipcRenderer.invoke('realtime:access-token', token),
  initCallSignaling: (
    config: import('./shared/realtime').RealtimeClientConfig,
  ): Promise<ApiResult<{ ok: true }>> => ipcRenderer.invoke('call-signaling:init', config),
  refreshCallSignalingAuth: (
    config: import('./shared/realtime').RealtimeClientConfig,
  ): Promise<ApiResult<{ ok: true }>> => ipcRenderer.invoke('call-signaling:refresh-auth', config),
  subscribeCallSignalingChannel: (
    channelName: string,
    mode: 'direct' | 'hub',
  ): Promise<ApiResult<{ ok: true }>> =>
    ipcRenderer.invoke('call-signaling:subscribe', channelName, mode),
  sendCallSignaling: (
    channelName: string,
    event: string,
    payload: unknown,
  ): Promise<ApiResult<{ ok: true }>> =>
    ipcRenderer.invoke('call-signaling:send', channelName, event, payload),
  unsubscribeCallSignalingChannel: (channelName: string): Promise<ApiResult<{ ok: true }>> =>
    ipcRenderer.invoke('call-signaling:unsubscribe', channelName),
  disconnectCallSignaling: (): Promise<ApiResult<{ ok: true }>> =>
    ipcRenderer.invoke('call-signaling:disconnect'),
  onCallSignalingBroadcast: (
    callback: (payload: { channelName: string; event: string; payload: unknown }) => void,
  ): (() => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      payload: { channelName: string; event: string; payload: unknown },
    ) => {
      callback(payload);
    };

    ipcRenderer.on('call-signaling:broadcast', handler);

    return () => {
      ipcRenderer.removeListener('call-signaling:broadcast', handler);
    };
  },
  getCallToken: (
    token: string,
    payloadJson: string,
  ): Promise<ApiResult<import('./shared/calls').CallTokenResult>> =>
    ipcRenderer.invoke('calls:token', token, payloadJson),
  ensureCallMediaPermissions: (video: boolean): Promise<ApiResult<{ ok: true }>> =>
    ipcRenderer.invoke('calls:ensure-media-permissions', video),
  getAppName: (): Promise<string> => ipcRenderer.invoke('app:get-name'),
  ensureScreenCapturePermission: (): Promise<ApiResult<{ ok: true }>> =>
    ipcRenderer.invoke('calls:ensure-screen-capture'),
  describeScreenCaptureFailure: (): Promise<ApiResult<string>> =>
    ipcRenderer.invoke('calls:describe-screen-capture-failure'),
  listScreenCaptureSources: (
    kind: 'screen' | 'window',
  ): Promise<ApiResult<import('./shared/screenShare').ScreenCaptureSource[]>> =>
    ipcRenderer.invoke('screen-share:list-sources', kind),
  setCallAlwaysOnTop: (enabled: boolean, mode?: string): Promise<{ ok: true }> =>
    ipcRenderer.invoke('window:set-call-always-on-top', enabled, mode),
  moveCallWindowBy: (deltaX: number, deltaY: number): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke('window:move-call-by', deltaX, deltaY),
  focusCallWindow: (): Promise<{ ok: true }> => ipcRenderer.invoke('window:focus-call'),
  ensureMainWindowVisible: (): Promise<{ ok: true }> =>
    ipcRenderer.invoke('window:ensure-visible'),
  onCallWindowPresentationChanged: (callback: (mode: string) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, mode: string) => {
      callback(mode);
    };

    ipcRenderer.on('call:window-presentation-changed', handler);

    return () => {
      ipcRenderer.removeListener('call:window-presentation-changed', handler);
    };
  },
  logCall: (token: string, payloadJson: string): Promise<ApiResult<{ message?: unknown }>> =>
    ipcRenderer.invoke('calls:log', token, payloadJson),
  notifyCallMeeting: (
    token: string,
    payloadJson: string,
  ): Promise<ApiResult<{ notified?: number }>> =>
    ipcRenderer.invoke('calls:notify-meeting', token, payloadJson),
  muteCallParticipant: (
    token: string,
    conversationId: string,
    participantIdentity: string,
    muted: boolean,
  ): Promise<ApiResult<{ muted?: boolean }>> =>
    ipcRenderer.invoke('calls:mute-participant', token, conversationId, participantIdentity, muted),
  removeCallParticipant: (
    token: string,
    conversationId: string,
    participantIdentity: string,
  ): Promise<ApiResult<{ removed?: boolean }>> =>
    ipcRenderer.invoke('calls:remove-participant', token, conversationId, participantIdentity),
  endCallMeeting: (
    token: string,
    conversationId: string,
  ): Promise<ApiResult<{ ended?: boolean }>> =>
    ipcRenderer.invoke('calls:end-meeting', token, conversationId),
  requestMeetingJoin: (
    token: string,
    payloadJson: string,
  ): Promise<ApiResult<unknown>> => ipcRenderer.invoke('calls:join-request', token, payloadJson),
  listMeetingJoinRequests: (
    token: string,
    conversationId: string,
  ): Promise<ApiResult<import('./shared/calls').MeetingJoinRequestItem[]>> =>
    ipcRenderer.invoke('calls:join-requests', token, conversationId),
  respondMeetingJoinRequest: (
    token: string,
    payloadJson: string,
  ): Promise<ApiResult<unknown>> =>
    ipcRenderer.invoke('calls:join-request-respond', token, payloadJson),
  getCallHistory: (token: string, filter?: 'all' | 'missed'): Promise<ApiResult<unknown>> =>
    ipcRenderer.invoke('calls:history', token, filter),
  declineCallMeetingInvite: (token: string, payloadJson: string): Promise<ApiResult<unknown>> =>
    ipcRenderer.invoke('calls:decline-invite', token, payloadJson),
  getDeclinedCallMeetingInvites: (
    token: string,
    conversationId: string,
    callId: string,
  ): Promise<ApiResult<unknown>> =>
    ipcRenderer.invoke('calls:declined-invites', token, conversationId, callId),
  setNativeTheme: (mode: 'light' | 'dark'): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke('app:set-theme', mode),
  showDesktopNotification: (
    payload: any
  ): Promise<{ ok: boolean }> => ipcRenderer.invoke('desktop:notify', payload),
  onNotificationRender: (callback: (payload: any) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: any) => callback(payload);
    ipcRenderer.on('notification:render', handler);
    return () => ipcRenderer.removeListener('notification:render', handler);
  },
  sendNotificationAction: (action: string) => ipcRenderer.send('notification:action', action),
  sendNotificationReady: () => ipcRenderer.send('notification:ready'),
  onNotificationToast: (callback: (payload: any) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: any) => callback(payload);
    ipcRenderer.on('notification:toast', handler);
    return () => ipcRenderer.removeListener('notification:toast', handler);
  },
  sendDesktopToastClick: (detail: {
    tag?: string;
    conversationId?: string | null;
    messageId?: string | null;
  }) => ipcRenderer.send('desktop:toast-click', detail),
  setNotificationWindowSize: (size: { width: number; height: number }) =>
    ipcRenderer.send('notification:set-bounds', size),
  logRendererDebug: (message: string): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke('renderer:debug-log', message).catch(() => ({ ok: false })),
  onDesktopNotificationClick: (
    callback: (detail: string | { tag?: string; conversationId?: string | null; messageId?: string | null }) => void,
  ): (() => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      detail: string | { tag?: string; conversationId?: string | null; messageId?: string | null },
    ) => {
      callback(detail);
    };

    ipcRenderer.on('desktop:notify-click', handler);

    return () => {
      ipcRenderer.removeListener('desktop:notify-click', handler);
    };
  },
  checkForUpdates: (): Promise<{
    ok: boolean;
    status?: 'skipped' | 'up-to-date' | 'available';
    skipped?: boolean;
    currentVersion?: string;
    data?: { version?: string; releaseNotes?: unknown };
    error?: string;
  }> => ipcRenderer.invoke('updater:check'),
  downloadUpdate: (): Promise<{ ok: boolean; error?: string; method?: 'in-app' }> =>
    ipcRenderer.invoke('updater:download'),
  quitAndInstallUpdate: (): Promise<void> => ipcRenderer.invoke('updater:quit-and-install'),
  openDesktopReleasePage: (): Promise<{ ok: boolean }> => ipcRenderer.invoke('updater:open-release-page'),
  getAppVersion: (): Promise<string> => ipcRenderer.invoke('updater:get-version'),
  getDesktopLegalContext: (): Promise<{
    isPackaged: boolean;
    version: string;
    acceptedLegalVersion: number | null;
  }> => ipcRenderer.invoke('app:get-desktop-legal-context'),
  acceptDesktopLegal: (version: number): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke('app:accept-desktop-legal', version),
  quitDesktopApp: (): Promise<void> => ipcRenderer.invoke('app:quit'),
  getHardwareAccelerationDisabled: (): Promise<boolean> => ipcRenderer.invoke('app:get-hardware-acceleration-disabled'),
  setHardwareAccelerationDisabled: (disabled: boolean): Promise<void> => ipcRenderer.invoke('app:set-hardware-acceleration-disabled', disabled),
  relaunchApp: (): Promise<void> => ipcRenderer.invoke('app:relaunch'),
  onUpdaterEvent: (eventStr: string, callback: (...args: any[]) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, ...args: any[]) => callback(...args);
    ipcRenderer.on(`updater:${eventStr}`, handler);
    return () => ipcRenderer.removeListener(`updater:${eventStr}`, handler);
  },
});
