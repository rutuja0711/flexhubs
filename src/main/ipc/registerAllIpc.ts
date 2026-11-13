// Generated IPC registration module — split by namespace in follow-up commits.

import { ipcMain, shell, desktopCapturer, app } from 'electron';
import { ensureMacMediaPermissions, readMediaAppName } from '../platform/macMediaPermissions';
import {
  describeMacScreenCaptureFailure,
  ensureMacScreenCaptureAccess,
  markMacScreenCaptureSessionVerified,
} from '../platform/macScreenCapture';
import type { RegisterAccountInput } from '../../shared/auth';

import { performLogin } from '../authLogin';
import { performGetMe } from '../authMe';
import {
  clearPersistedAuthSession,
  readPersistedAuthSession,
  writePersistedAuthSession,
} from '../desktopAuthStorage';
import {
  bootstrapAuthenticatedMediaRequestToken,
  installAuthenticatedMediaRequestInterceptor,
  setAuthenticatedMediaRequestToken,
} from '../authenticatedMediaRequest';
import {
  fetchInviteRegistrationDetails,
  performForgotPassword,
  performRegister,
  performRegisterIndividual,
  performRegisterWorkspace,
  performResetPassword,
  performSendIndividualOtp,
  performVerifyIndividualOtp,
  performVerifyResetCode,
} from '../authApi';
import { fetchConversations, fetchUnreadCount } from '../chatBootstrap';
import {
  addMessageReaction,
  removeMessageReaction,
  createDirectConversation,
  deleteMessage,
  editMessage,
  fetchConversationBootstrap,
  fetchConversationMessages,
  fetchMessageDraft,
  fetchMessageThread,
  clearMessageDraft,
  forwardMessage,
  markConversationRead,
  pinMessage,
  saveMessageDraft,
  sendMessage,
  unpinMessage,
  summarizeUnreadMessages,
  translateUnreadMessages,
} from '../conversationApi';
import {
  acceptHubInvite,
  acceptHubInviteById,
  blockUser,
  createChannel,
  declineHubInvite,
  deleteChannel,
  fetchBlockedUsers,
  fetchCalendarEvents,
  fetchChannelInvites,
  fetchChannels,
  fetchFiles,
  fetchFriendRelationship,
  fetchFriends,
  fetchHubInvites,
  fetchSavedMessages,
  respondFriendRequest,
  revokeChannelInvite,
  saveMessage,
  sendFriendRequest,
  unblockUser,
  unsaveMessage,
  fetchMessageConversation,
  updateChannelDescription,
  updateChannelName,
  updateChannelSettings,
} from '../featuresApi';
import {
  fetchNotifications,
  fetchOrganizationMembers,
  fetchPendingFriends,
  markAllNotificationsRead,
  markNotificationRead,
} from '../notificationsApi';
import {
  fetchGlobalSearch,
  fetchMessageSearch,
  fetchUserSearch,
} from '../searchApi';
import {
  readAllPersistedCalendarEventTags,
  readPersistedCalendarEventTags,
  writePersistedCalendarEventTags,
} from '../desktopCalendarTagStorage';
import {
  readPersistedDesktopLegalVersion,
  writePersistedDesktopLegalVersion,
} from '../desktopLegalStorage';
import { deliverDesktopNotification } from '../notifications/deliverDesktopNotification';
import { updateApplicationBadge } from '../appBadge';
import {
  closeNotificationWindow,
  setNotificationHostWindowProvider,
} from '../notifications/notificationWindow';
import {
  setRealtimeHandlers,
  startRealtimeStream,
  stopRealtimeStream,
  probeRealtimeServerStatus,
  setRealtimeHeartbeatStatus,
  flushRealtimeHeartbeat,
} from '../realtimeStream';
import {
  sendTypingIndicator,
  fetchRealtimePresence,
  fetchRealtimeClientConfig,
  fetchRealtimeToken,
} from '../realtimeApi';
import {
  endGroupMeeting,
  declineMeetingInvite,
  fetchCallHistory,
  fetchCallToken,
  fetchDeclinedMeetingInvites,
  fetchMeetingJoinRequests,
  inviteMeetingParticipant,
  logCallHistory,
  muteMeetingParticipant,
  notifyGroupMeeting,
  removeMeetingParticipant,
  requestMeetingJoin,
  respondMeetingJoinRequest,
} from '../callsApi';
import {
  fetchAvatarStyles,
  fetchNotificationSettings,
  fetchOrganizationMembersDetailed,
  fetchUserById,
  fetchUserStatus,
  updateNotificationSettings,
  updateUserProfile,
  updateUserStatus,
  updateUserTimezone,
  uploadProfileImage,
} from '../userApi';
import { fetchAuthenticatedMedia } from '../mediaApi';
import { prepareFileDragFromUrl, startPreparedFileDrag } from '../startFileDrag';
import {
  fetchTrendingGifs,
  searchGifs,
  fetchTrendingStickers,
  searchStickers,
} from '../gifsApi';
import {
  createCalendarEvent,
  fetchCalendarEventById,
  updateCalendarEvent,
  deleteCalendarEvent,
  deletePushSubscriptions,
  enhanceMessageText,
  fetchCalendarMentionableUsers,
  fetchPushVapidPublicKey,
  fetchScheduledMessages,
  generateMessageText,
  generateAiReply,
  parseFlexCommand,
  respondToCalendarEvent,
  subscribePushNotifications,
  transcribeAudioFile,
  unsubscribePushEndpoint,
} from '../extrasApi';
import { createOrgOrder, createUpgradeOrder, fetchOrgSubscription, fetchPaymentPlans, fetchPlanCompliance, verifyOrgSubscription, verifyUpgradeSubscription } from '../paymentsApi';
import {
  acceptOrganizationInvite,
  createOrganizationRole,
  declineOrganizationInvite,
  deleteOrganizationRole,
  createOrganization,
  fetchMyOrganizationInvites,
  fetchOrgInvoiceById,
  fetchOrgInvoices,
  fetchOrganizationInvites,
  fetchOrganizationMembersAdmin,
  fetchOrganizationRoles,
  fetchOrganizationSeats,
  leaveOrganization,
  removeOrganizationMember,
  revokeOrganizationInvite,
  sendOrganizationInvite,
  updateOrganizationRole,
} from '../organizationsApi';
import {
  fetchSuperAdminOrganizations,
  fetchSuperAdminStats,
  suspendSuperAdminOrganization,
} from '../superadminApi';
import type { RealtimeClientConfig, RealtimeConnectionStatus } from '../../shared/realtime';

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

import {
  disconnectMainCallSignaling,
  initMainCallSignaling,
  isMainCallSignalingReady,
  refreshMainCallSignalingAuth,
  sendMainCallSignal,
  setCallSignalingWindowProvider,
  subscribeMainCallChannel,
  unsubscribeMainCallChannel,
} from '../callSignalingMain';


export type MainIpcWindowDeps = {
  getMainWindow: () => import('electron').BrowserWindow | null;
  setCallWindowPresentation: (enabled: boolean, mode?: string) => void;
  ensureMainWindowVisible: () => void;
};

export function registerAllIpc(deps: MainIpcWindowDeps): void {
  ipcMain.handle('auth:login', (_event, credentials) => performLogin(credentials));
  ipcMain.handle('auth:me', (_event, token: string) => performGetMe(token));
  ipcMain.handle('auth:read-session', () => readPersistedAuthSession());
  ipcMain.handle('auth:write-session', (_event, payload: { token: string; user: unknown }) => {
    const token = typeof payload?.token === 'string' ? payload.token.trim() : '';
  
    if (!token) {
      return { ok: false as const };
    }
  
    writePersistedAuthSession({ token, user: payload.user ?? null });
    setAuthenticatedMediaRequestToken(token);
    return { ok: true as const };
  });
  ipcMain.handle('auth:clear-session', () => {
    clearPersistedAuthSession();
    setAuthenticatedMediaRequestToken(null);
    return { ok: true as const };
  });
  ipcMain.handle('auth:register', (_event, payloadJson: string) => {
    try {
      return performRegister(JSON.parse(payloadJson) as RegisterAccountInput);
    } catch {
      return { ok: false, error: 'Invalid registration payload.' };
    }
  });
  ipcMain.handle('auth:register-workspace', (_event, payloadJson: string) => {
    try {
      return performRegisterWorkspace(JSON.parse(payloadJson) as Record<string, unknown>);
    } catch {
      return { ok: false, error: 'Invalid workspace registration payload.' };
    }
  });
  ipcMain.handle('auth:invite-details', (_event, inviteToken: string) =>
    fetchInviteRegistrationDetails(inviteToken),
  );
  ipcMain.handle('auth:forgot-password', (_event, email: string) => performForgotPassword(email));
  ipcMain.handle('auth:verify-reset-code', (_event, payloadJson: string) => {
    try {
      const payload = JSON.parse(payloadJson) as { email: string; code: string };
      return performVerifyResetCode(payload);
    } catch {
      return { ok: false, error: 'Invalid verification payload.' };
    }
  });
  ipcMain.handle('auth:reset-password', (_event, payloadJson: string) => {
    try {
      const payload = JSON.parse(payloadJson) as {
        email: string;
        code: string;
        password: string;
        confirmPassword: string;
      };
      return performResetPassword(payload);
    } catch {
      return { ok: false, error: 'Invalid reset password payload.' };
    }
  });
  ipcMain.handle('auth:send-individual-otp', (_event, email: string) => performSendIndividualOtp(email));
  ipcMain.handle('auth:verify-individual-otp', (_event, payloadJson: string) => {
    try {
      const payload = JSON.parse(payloadJson) as { email: string; code: string };
      return performVerifyIndividualOtp(payload);
    } catch {
      return { ok: false, error: 'Invalid verification payload.' };
    }
  });
  ipcMain.handle('auth:register-individual', (_event, payloadJson: string) => {
    try {
      const payload = JSON.parse(payloadJson) as {
        email: string;
        username: string;
        password: string;
        confirmPassword: string;
        emailVerificationCode: string;
      };
      return performRegisterIndividual(payload);
    } catch {
      return { ok: false, error: 'Invalid registration payload.' };
    }
  });
  ipcMain.handle('payments:create-org-order', (_event, token: string | null, payloadJson: string) => {
    try {
      const input = JSON.parse(payloadJson) as import('../shared/workspace').CreateOrgOrderInput;
      return createOrgOrder(token, input);
    } catch {
      return { ok: false, error: 'Invalid workspace order payload.' };
    }
  });
  ipcMain.handle('payments:verify-org-subscription', (_event, token: string | null, payloadJson: string) => {
    try {
      const input = JSON.parse(payloadJson) as import('../shared/workspace').VerifySignupInput;
      return verifyOrgSubscription(token, input);
    } catch {
      return { ok: false, error: 'Invalid workspace verification payload.' };
    }
  });
  ipcMain.handle('payments:plans', (_event, token: string | null) => fetchPaymentPlans(token));
  ipcMain.handle('payments:org-subscription', (_event, token: string) => fetchOrgSubscription(token));
  ipcMain.handle(
    'payments:plan-compliance',
    (_event, token: string | null, planId: string, teamSize: number) =>
      fetchPlanCompliance(token, planId, teamSize),
  );
  ipcMain.handle('payments:create-order', (_event, token: string, payloadJson: string) => {
    try {
      const input = JSON.parse(payloadJson) as import('../shared/workspace').CreateOrgOrderInput;
      return createUpgradeOrder(token, input);
    } catch {
      return { ok: false, error: 'Invalid upgrade order payload.' };
    }
  });
  ipcMain.handle('payments:verify-upgrade', (_event, token: string, payloadJson: string) => {
    try {
      const input = JSON.parse(payloadJson) as {
        paymentId: string;
        orderId: string;
        signature: string;
        planId: string;
        billingPeriod: string;
        teamSize: number;
      };
      return verifyUpgradeSubscription(token, input);
    } catch {
      return { ok: false, error: 'Invalid upgrade verification payload.' };
    }
  });
  ipcMain.handle('org:members', (_event, token: string) => fetchOrganizationMembersAdmin(token));
  ipcMain.handle('org:remove-member', (_event, token: string, userId: string) =>
    removeOrganizationMember(token, userId),
  );
  ipcMain.handle('org:leave', (_event, token: string) => leaveOrganization(token));
  ipcMain.handle('org:roles', (_event, token: string) => fetchOrganizationRoles(token));
  ipcMain.handle('org:create-role', (_event, token: string, name: string) => createOrganizationRole(token, name));
  ipcMain.handle('org:update-role', (_event, token: string, roleId: string, name: string) =>
    updateOrganizationRole(token, roleId, name),
  );
  ipcMain.handle('org:delete-role', (_event, token: string, roleId: string) =>
    deleteOrganizationRole(token, roleId),
  );
  ipcMain.handle('org:invites', (_event, token: string) => fetchOrganizationInvites(token));
  ipcMain.handle('org:send-invite', (_event, token: string, email: string, roleId: string | null) =>
    sendOrganizationInvite(token, email, roleId),
  );
  ipcMain.handle('org:revoke-invite', (_event, token: string, inviteId: string) =>
    revokeOrganizationInvite(token, inviteId),
  );
  ipcMain.handle('org:my-invites', (_event, token: string) => fetchMyOrganizationInvites(token));
  ipcMain.handle('org:accept-invite', (_event, token: string, inviteId: string) =>
    acceptOrganizationInvite(token, inviteId),
  );
  ipcMain.handle('org:decline-invite', (_event, token: string, inviteId: string) =>
    declineOrganizationInvite(token, inviteId),
  );
  ipcMain.handle('org:seats', (_event, token: string) => fetchOrganizationSeats(token));
  ipcMain.handle('org:invoices', (_event, token: string) => fetchOrgInvoices(token));
  ipcMain.handle('org:invoice', (_event, token: string, invoiceId: string) =>
    fetchOrgInvoiceById(token, invoiceId),
  );
  ipcMain.handle('superadmin:stats', (_event, token: string) => fetchSuperAdminStats(token));
  ipcMain.handle('superadmin:organizations', (_event, token: string, page: number, pageSize?: number) =>
    fetchSuperAdminOrganizations(token, page, pageSize),
  );
  ipcMain.handle('superadmin:suspend', (_event, token: string, organizationId: string) =>
    suspendSuperAdminOrganization(token, organizationId),
  );
  
  ipcMain.handle('chat:summarize-unread', (_event, token: string, conversationId: string) =>
    summarizeUnreadMessages(token, conversationId),
  );
  ipcMain.handle('desktop:prepare-file-drag', (_event, token: string, url: string, fileName: string) =>
    prepareFileDragFromUrl(token, url, fileName),
  );
  ipcMain.on('desktop:start-file-drag-path', (event, filePath: string) => {
    startPreparedFileDrag(event.sender, filePath);
  });
  ipcMain.handle('chat:translate-unread', (_event, token: string, conversationId: string) =>
    translateUnreadMessages(token, conversationId),
  );
  
  ipcMain.handle('chat:conversations', (_event, token: string, viewerUserId?: string | null) =>
    fetchConversations(token, viewerUserId),
  );
  ipcMain.handle('chat:unread-count', (_event, token: string) => fetchUnreadCount(token));
  ipcMain.handle('chat:conversation-bootstrap', (_event, token: string, conversationId: string) =>
    fetchConversationBootstrap(token, conversationId),
  );
  ipcMain.handle(
    'chat:conversation-messages',
    (_event, token: string, conversationId: string, before?: string, limit?: number) =>
      fetchConversationMessages(token, conversationId, { before, limit }),
  );
  ipcMain.handle('chat:message-draft', (_event, token: string, conversationId: string) =>
    fetchMessageDraft(token, conversationId),
  );
  ipcMain.handle(
    'chat:save-draft',
    (
      _event,
      token: string,
      conversationId: string,
      content: string,
      replyToId?: string | null,
    ) => saveMessageDraft(token, conversationId, content, replyToId),
  );
  ipcMain.handle('chat:clear-draft', (_event, token: string, conversationId: string) =>
    clearMessageDraft(token, conversationId),
  );
  ipcMain.handle('chat:mark-read', (_event, token: string, conversationId: string) =>
    markConversationRead(token, conversationId),
  );
  ipcMain.handle('chat:notifications', (_event, token: string) => fetchNotifications(token));
  ipcMain.handle('chat:notifications-read-all', (_event, token: string) =>
    markAllNotificationsRead(token),
  );
  ipcMain.handle('chat:notification-read', (_event, token: string, notificationId: string) =>
    markNotificationRead(token, notificationId),
  );
  ipcMain.handle('chat:friends-pending', (_event, token: string) => fetchPendingFriends(token));
  ipcMain.handle('chat:organization-members', (_event, token: string) =>
    fetchOrganizationMembers(token),
  );
  ipcMain.handle('chat:send-message', (_event, token: string, conversationId: string, content: string, replyToId?: string, threadRootId?: string, mediaJson?: string) => {
    if (mediaJson) {
      return sendMessage(token, conversationId, content, replyToId, threadRootId, mediaJson);
    }
  
    return import('../conversationApi').then((m) =>
      m.sendMessageStream(token, conversationId, content, replyToId, threadRootId),
    );
  });
  ipcMain.handle('gifs:trending', (_event, token: string, limit?: number) =>
    fetchTrendingGifs(token, limit),
  );
  ipcMain.handle('gifs:search', (_event, token: string, query: string, limit?: number) =>
    searchGifs(token, query, limit),
  );
  ipcMain.handle('gifs:stickers-trending', (_event, token: string, limit?: number) =>
    fetchTrendingStickers(token, limit),
  );
  ipcMain.handle('gifs:stickers-search', (_event, token: string, query: string, limit?: number) =>
    searchStickers(token, query, limit),
  );
  ipcMain.handle('chat:message-thread', (_event, token: string, conversationId: string, messageId: string) =>
    fetchMessageThread(token, conversationId, messageId),
  );
  ipcMain.handle('chat:create-direct', (_event, token: string, userId: string) =>
    createDirectConversation(token, userId),
  );
  ipcMain.handle(
    'chat:add-reaction',
    (_event, token: string, conversationId: string, messageId: string, emoji: string) =>
      addMessageReaction(token, conversationId, messageId, emoji),
  );
  ipcMain.handle(
    'chat:remove-reaction',
    (_event, token: string, conversationId: string, messageId: string, emoji: string) =>
      removeMessageReaction(token, conversationId, messageId, emoji),
  );
  ipcMain.handle(
    'chat:edit-message',
    (_event, token: string, conversationId: string, messageId: string, content: string) =>
      editMessage(token, conversationId, messageId, content),
  );
  ipcMain.handle(
    'chat:delete-message',
    (
      _event,
      token: string,
      conversationId: string,
      messageId: string,
      scope: 'me' | 'everyone',
    ) => deleteMessage(token, conversationId, messageId, scope),
  );
  ipcMain.handle(
    'chat:rename-conversation',
    (_event, token: string, conversationId: string, name: string) =>
      import('../conversationApi').then((m) => m.renameConversation(token, conversationId, name)),
  );
  ipcMain.handle(
    'chat:update-conversation-notification-settings',
    (_event, token: string, conversationId: string, settingsJson: string) => {
      let settings: Record<string, unknown> = {};
  
      try {
        const parsed = JSON.parse(settingsJson) as unknown;
        settings = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
      } catch {
        return Promise.resolve({ ok: false, error: 'Invalid notification settings.', status: 400 });
      }
  
      return import('../conversationApi').then((m) =>
        m.updateConversationNotificationSettings(token, conversationId, settings),
      );
    },
  );
  ipcMain.handle(
    'chat:set-conversation-favorite',
    (_event, token: string, conversationId: string, favorite: boolean) =>
      import('../conversationApi').then((m) =>
        m.setConversationFavorite(token, conversationId, favorite),
      ),
  );
  ipcMain.handle(
    'chat:add-conversation-members',
    (_event, token: string, conversationId: string, userIds: string[]) =>
      import('../conversationApi').then((m) => m.addConversationMembers(token, conversationId, userIds)),
  );
  ipcMain.handle(
    'chat:remove-conversation-member',
    (_event, token: string, conversationId: string, userId: string) =>
      import('../conversationApi').then((m) => m.removeConversationMember(token, conversationId, userId)),
  );
  ipcMain.handle('chat:leave-conversation', (_event, token: string, conversationId: string, isHub: boolean) =>
    import('../conversationApi').then((m) => m.leaveConversation(token, conversationId, isHub)),
  );
  ipcMain.handle('chat:delete-conversation', (_event, token: string, conversationId: string) =>
    import('../conversationApi').then((m) => m.deleteConversation(token, conversationId)),
  );
  ipcMain.handle('chat:clear-conversation-history', (_event, token: string, conversationId: string) =>
    import('../conversationApi').then((m) => m.clearConversationHistory(token, conversationId)),
  );
  ipcMain.handle('chat:create-group', (_event, token: string, name: string, userIds: string[]) =>
    import('../conversationApi').then((m) => m.createGroupConversation(token, name, userIds)),
  );
  ipcMain.handle('chat:self-conversation', (_event, token: string) =>
    import('../conversationApi').then((m) => m.fetchSelfConversation(token)),
  );
  ipcMain.handle('chat:get-conversation', (_event, token: string, conversationId: string) =>
    import('../conversationApi').then((m) => m.fetchConversationById(token, conversationId)),
  );
  ipcMain.handle('chat:mark-unread', (_event, token: string, conversationId: string) =>
    import('../conversationApi').then((m) => m.markConversationUnread(token, conversationId)),
  );
  ipcMain.handle('chat:pinned-messages', (_event, token: string, conversationId: string) =>
    import('../conversationApi').then((m) => m.fetchPinnedMessages(token, conversationId)),
  );
  ipcMain.handle(
    'chat:get-message',
    (_event, token: string, conversationId: string, messageId: string) =>
      import('../conversationApi').then((m) => m.fetchMessageById(token, conversationId, messageId)),
  );
  ipcMain.handle(
    'chat:mention-suggestions',
    (_event, token: string, conversationId: string, query: string) =>
      import('../conversationApi').then((m) => m.fetchMentionSuggestions(token, conversationId, query)),
  );
  ipcMain.handle(
    'chat:create-poll',
    (_event, token: string, conversationId: string, payloadJson: string) => {
      try {
        const payload = JSON.parse(payloadJson) as Record<string, unknown>;
        return import('../conversationApi').then((m) =>
          m.createPollMessage(token, conversationId, payload),
        );
      } catch {
        return { ok: false, error: 'Invalid poll payload.' };
      }
    },
  );
  ipcMain.handle(
    'chat:vote-poll',
    (_event, token: string, conversationId: string, messageId: string, optionId: string) =>
      import('../conversationApi').then((m) =>
        m.votePollMessage(token, conversationId, messageId, optionId),
      ),
  );
  ipcMain.handle(
    'chat:conversation-scheduled-messages',
    (_event, token: string, conversationId: string) =>
      import('../conversationApi').then((m) =>
        m.fetchConversationScheduledMessages(token, conversationId),
      ),
  );
  ipcMain.handle(
    'chat:create-conversation-scheduled-message',
    (_event, token: string, conversationId: string, payloadJson: string) => {
      try {
        const payload = JSON.parse(payloadJson) as Record<string, unknown>;
        return import('../conversationApi').then((m) =>
          m.createConversationScheduledMessage(token, conversationId, payload),
        );
      } catch {
        return { ok: false, error: 'Invalid scheduled message payload.' };
      }
    },
  );
  ipcMain.handle(
    'chat:delete-conversation-scheduled-message',
    (_event, token: string, conversationId: string, scheduledId: string) =>
      import('../conversationApi').then((m) =>
        m.deleteConversationScheduledMessage(token, conversationId, scheduledId),
      ),
  );
  ipcMain.handle(
    'chat:update-member-role',
    (_event, token: string, conversationId: string, userId: string, role: string) =>
      import('../conversationApi').then((m) =>
        m.updateConversationMemberRole(token, conversationId, userId, role),
      ),
  );
  ipcMain.handle(
    'chat:get-conversation-notification-settings',
    (_event, token: string, conversationId: string) =>
      import('../conversationApi').then((m) =>
        m.fetchConversationNotificationSettings(token, conversationId),
      ),
  );
  ipcMain.handle('org:create', (_event, token: string | null, payloadJson: string) => {
    try {
      const payload = JSON.parse(payloadJson) as Record<string, unknown>;
      return createOrganization(payload, token);
    } catch {
      return { ok: false, error: 'Invalid organization payload.' };
    }
  });
  ipcMain.handle('user:profile', (_event, token: string, userId: string) =>
    fetchUserById(token, userId),
  );
  ipcMain.handle('features:message-conversation', (_event, token: string, messageId: string) =>
    fetchMessageConversation(token, messageId),
  );
  ipcMain.handle(
    'chat:forward-message',
    (
      _event,
      token: string,
      conversationId: string,
      messageId: string,
      targetConversationIdsJson: string,
    ) => {
      let targetConversationIds: string[] = [];
  
      try {
        const parsed = JSON.parse(targetConversationIdsJson) as unknown;
        targetConversationIds = Array.isArray(parsed)
          ? parsed.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
          : [];
      } catch {
        targetConversationIds = [];
      }
  
      return forwardMessage(token, conversationId, messageId, targetConversationIds);
    },
  );
  ipcMain.handle(
    'chat:pin-message',
    (_event, token: string, conversationId: string, messageId: string) =>
      pinMessage(token, conversationId, messageId),
  );
  ipcMain.handle(
    'chat:unpin-message',
    (_event, token: string, conversationId: string, messageId: string) =>
      unpinMessage(token, conversationId, messageId),
  );
  ipcMain.handle(
    'features:save-message',
    (_event, token: string, conversationId: string, messageId: string) =>
      saveMessage(token, conversationId, messageId),
  );
  ipcMain.handle('search:global', (_event, token: string, query: string) =>
    fetchGlobalSearch(token, query),
  );
  ipcMain.handle('search:users', (_event, token: string, query: string) =>
    fetchUserSearch(token, query),
  );
  ipcMain.handle('search:messages', (_event, token: string, conversationId: string, query: string) =>
    fetchMessageSearch(token, conversationId, query),
  );
  ipcMain.handle('features:saved-messages', (_event, token: string) => fetchSavedMessages(token));
  ipcMain.handle(
    'features:files',
    (_event, token: string, filter: string, conversationId?: string) =>
      fetchFiles(token, filter, conversationId),
  );
  ipcMain.handle('features:calendar', (_event, token: string) => fetchCalendarEvents(token));
  ipcMain.handle('extras:calendar-mentionable-users', (_event, token: string) =>
    fetchCalendarMentionableUsers(token),
  );
  ipcMain.handle('extras:calendar-event-by-id', (_event, token: string, eventId: string) =>
    fetchCalendarEventById(token, eventId),
  );
  ipcMain.handle('calendar:get-event-tags', (_event, eventId: string) =>
    readPersistedCalendarEventTags(eventId),
  );
  ipcMain.handle('calendar:set-event-tags', (_event, eventId: string, snapshot: unknown) => {
    writePersistedCalendarEventTags(
      eventId,
      snapshot as import('../shared/calendarEventTags').CalendarEventTagSnapshot,
    );
  });
  ipcMain.handle('calendar:get-all-event-tags', () => readAllPersistedCalendarEventTags());
  ipcMain.handle('extras:create-calendar-event', (_event, token: string, payloadJson: string) => {
    try {
      const input = JSON.parse(payloadJson) as import('../shared/extras').CreateCalendarEventInput;
      return createCalendarEvent(token, input);
    } catch {
      return { ok: false, error: 'Invalid calendar event payload.' };
    }
  });
  ipcMain.handle('extras:update-calendar-event', (_event, token: string, payloadJson: string) => {
    try {
      const input = JSON.parse(payloadJson) as import('../shared/extras').UpdateCalendarEventInput;
      return updateCalendarEvent(token, input);
    } catch {
      return { ok: false, error: 'Invalid calendar event payload.' };
    }
  });
  ipcMain.handle(
    'extras:respond-calendar-event',
    (_event, token: string, eventId: string, accept: boolean) =>
      respondToCalendarEvent(token, eventId, accept),
  );
  ipcMain.handle('extras:delete-calendar-event', (_event, token: string, eventId: string) =>
    deleteCalendarEvent(token, eventId),
  );
  ipcMain.handle('extras:scheduled-messages', (_event, token: string) =>
    fetchScheduledMessages(token),
  );
  ipcMain.handle('extras:ai-enhance', (_event, token: string, text: string) =>
    enhanceMessageText(token, text),
  );
  ipcMain.handle('extras:ai-generate', (_event, token: string, description: string) =>
    generateMessageText(token, description),
  );
  ipcMain.handle('extras:ai-reply', (_event, token: string, messageContent: string) =>
    generateAiReply(token, messageContent),
  );
  ipcMain.handle(
    'extras:ai-flex-command',
    (_event, token: string, input: string, conversationId?: string) =>
      parseFlexCommand(token, input, conversationId),
  );
  ipcMain.handle(
    'extras:ai-transcribe',
    (_event, token: string, fileName: string, mimeType: string, base64Data: string) =>
      transcribeAudioFile(token, fileName, mimeType, base64Data),
  );
  ipcMain.handle('extras:push-vapid-key', (_event, token: string) => fetchPushVapidPublicKey(token));
  ipcMain.handle('extras:push-subscribe', (_event, token: string, subscriptionJson: string) => {
    try {
      const subscription = JSON.parse(subscriptionJson) as unknown;
      return subscribePushNotifications(token, subscription);
    } catch {
      return { ok: false, error: 'Invalid push subscription payload.' };
    }
  });
  ipcMain.handle('extras:push-unsubscribe', (_event, token: string, endpoint: string) =>
    unsubscribePushEndpoint(token, endpoint),
  );
  ipcMain.handle('extras:push-delete-subscriptions', (_event, token: string) =>
    deletePushSubscriptions(token),
  );
  ipcMain.handle('features:channels', (_event, token: string) => fetchChannels(token));
  ipcMain.handle('features:hub-invites', (_event, token: string) => fetchHubInvites(token));
  ipcMain.handle('features:friends', (_event, token: string) => fetchFriends(token));
  ipcMain.handle('features:accept-hub-invite', (_event, token: string, channelId: string) =>
    acceptHubInvite(token, channelId),
  );
  ipcMain.handle('features:accept-hub-invite-by-id', (_event, token: string, inviteId: string) =>
    acceptHubInviteById(token, inviteId),
  );
  ipcMain.handle('features:decline-hub-invite', (_event, token: string, inviteId: string) =>
    declineHubInvite(token, inviteId),
  );
  ipcMain.handle('features:blocks', (_event, token: string) => fetchBlockedUsers(token));
  ipcMain.handle('features:block-user', (_event, token: string, userId: string) =>
    blockUser(token, userId),
  );
  ipcMain.handle('features:unblock-user', (_event, token: string, userId: string) =>
    unblockUser(token, userId),
  );
  ipcMain.handle('features:friend-relationship', (_event, token: string, userId: string) =>
    fetchFriendRelationship(token, userId),
  );
  ipcMain.handle('features:create-channel', (_event, token: string, payloadJson: string) => {
    let input: import('../shared/features').CreateChannelInput = { name: '' };
  
    try {
      const parsed = JSON.parse(payloadJson) as unknown;
      if (parsed && typeof parsed === 'object') {
        input = parsed as import('../shared/features').CreateChannelInput;
      }
    } catch {
      return Promise.resolve({ ok: false, error: 'Invalid channel payload.', status: 400 });
    }
  
    return createChannel(token, input);
  });
  ipcMain.handle(
    'features:update-channel-name',
    (_event, token: string, channelId: string, name: string) =>
      updateChannelName(token, channelId, name),
  );
  ipcMain.handle(
    'features:update-channel-description',
    (_event, token: string, channelId: string, description: string) =>
      updateChannelDescription(token, channelId, description),
  );
  ipcMain.handle(
    'features:update-channel-settings',
    (_event, token: string, channelId: string, settingsJson: string) => {
      let settings: Record<string, unknown> = {};
  
      try {
        const parsed = JSON.parse(settingsJson) as unknown;
        settings = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
      } catch {
        return Promise.resolve({ ok: false, error: 'Invalid channel settings.', status: 400 });
      }
  
      return updateChannelSettings(token, channelId, settings);
    },
  );
  ipcMain.handle('features:channel-invites', (_event, token: string, channelId: string) =>
    fetchChannelInvites(token, channelId),
  );
  ipcMain.handle(
    'features:revoke-channel-invite',
    (_event, token: string, channelId: string, inviteId: string) =>
      revokeChannelInvite(token, channelId, inviteId),
  );
  ipcMain.handle('features:delete-channel', (_event, token: string, channelId: string) =>
    deleteChannel(token, channelId),
  );
  ipcMain.handle('features:friend-request', (_event, token: string, userId: string) =>
    sendFriendRequest(token, userId),
  );
  ipcMain.handle(
    'features:respond-friend-request',
    (_event, token: string, requestId: string, status: 'ACCEPTED' | 'DECLINED') =>
      respondFriendRequest(token, requestId, status),
  );
  ipcMain.handle(
    'features:unsave-message',
    (_event, token: string, conversationId: string, messageId: string) =>
      unsaveMessage(token, conversationId, messageId),
  );
  ipcMain.handle('user:avatar-styles', (_event, token: string) => fetchAvatarStyles(token));
  ipcMain.handle('user:notification-settings', (_event, token: string) =>
    fetchNotificationSettings(token),
  );
  ipcMain.handle(
    'user:update-notification-settings',
    (_event, token: string, updatesJson: string) => {
      let updates: Record<string, unknown> = {};
  
      try {
        const parsed = JSON.parse(updatesJson) as unknown;
        updates = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
      } catch {
        updates = {};
      }
  
      return updateNotificationSettings(token, updates);
    },
  );
  ipcMain.handle('user:update-profile', (_event, token: string, updatesJson: string) => {
    let updates: Record<string, unknown> = {};
  
    try {
      const parsed = JSON.parse(updatesJson) as unknown;
      updates = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
    } catch {
      updates = {};
    }
  
    return updateUserProfile(token, updates);
  });
  ipcMain.handle('user:status', (_event, token: string) => fetchUserStatus(token));
  ipcMain.handle(
    'user:update-status',
    async (_event, token: string, status: string, message?: string) => {
      setRealtimeHeartbeatStatus(status);
      const result = await updateUserStatus(token, {
        status: status as import('../shared/profile').UserPresenceStatus,
        message,
      });
      if (result.ok && status.toUpperCase() !== 'OFFLINE') {
        flushRealtimeHeartbeat();
      }
      return result;
    },
  );
  ipcMain.handle('user:update-timezone', (_event, token: string, timezone: string) =>
    updateUserTimezone(token, timezone),
  );
  ipcMain.handle(
    'user:upload-image',
    (_event, token: string, fileName: string, mimeType: string, base64Data: string) =>
      uploadProfileImage(token, fileName, mimeType, base64Data),
  );
  ipcMain.handle('media:fetch-authenticated', (_event, token: string, url: string) =>
    fetchAuthenticatedMedia(token, url),
  );
  ipcMain.handle('shell:open-external', async (_event, url: string) => {
    if (typeof url !== 'string' || !/^https?:\/\//i.test(url.trim())) {
      return { ok: false as const, error: 'Invalid URL.' };
    }
  
    try {
      await shell.openExternal(url.trim());
      return { ok: true as const, data: { ok: true as const } };
    } catch (error) {
      return {
        ok: false as const,
        error: error instanceof Error ? error.message : 'Unable to open link.',
      };
    }
  });
  ipcMain.handle('user:organization-members-detailed', (_event, token: string) =>
    fetchOrganizationMembersDetailed(token),
  );
  ipcMain.handle('realtime:config', (_event, token: string) => fetchRealtimeClientConfig(token));
  
  ipcMain.handle('call-signaling:init', async (_event, config: RealtimeClientConfig) => {
    try {
      await initMainCallSignaling(config);
      return { ok: true as const, data: { ok: true as const } };
    } catch (error) {
      return {
        ok: false as const,
        error: error instanceof Error ? error.message : 'Call signaling failed to initialize.',
      };
    }
  });
  
  ipcMain.handle('call-signaling:refresh-auth', async (_event, config: RealtimeClientConfig) => {
    try {
      await refreshMainCallSignalingAuth(config);
      return { ok: true as const, data: { ok: true as const } };
    } catch (error) {
      return {
        ok: false as const,
        error: error instanceof Error ? error.message : 'Call signaling auth refresh failed.',
      };
    }
  });
  
  ipcMain.handle(
    'call-signaling:subscribe',
    async (_event, channelName: string, mode: 'direct' | 'hub') => {
      try {
        await subscribeMainCallChannel(channelName, mode);
        return { ok: true as const, data: { ok: true as const } };
      } catch (error) {
        return {
          ok: false as const,
          error: error instanceof Error ? error.message : 'Could not subscribe to call channel.',
        };
      }
    },
  );
  
  ipcMain.handle(
    'call-signaling:send',
    async (_event, channelName: string, event: string, payload: unknown) => {
      try {
        await sendMainCallSignal(channelName, event, payload);
        return { ok: true as const, data: { ok: true as const } };
      } catch (error) {
        return {
          ok: false as const,
          error: error instanceof Error ? error.message : 'Could not send call signal.',
        };
      }
    },
  );
  
  ipcMain.handle('call-signaling:unsubscribe', async (_event, channelName: string) => {
    try {
      await unsubscribeMainCallChannel(channelName);
      return { ok: true as const, data: { ok: true as const } };
    } catch (error) {
      return {
        ok: false as const,
        error: error instanceof Error ? error.message : 'Could not unsubscribe from call channel.',
      };
    }
  });
  
  ipcMain.handle('call-signaling:disconnect', async () => {
    await disconnectMainCallSignaling();
    return { ok: true as const, data: { ok: true as const } };
  });
  
  ipcMain.handle('call-signaling:is-ready', () => ({
    ok: true as const,
    data: isMainCallSignalingReady(),
  }));
  ipcMain.handle('realtime:access-token', (_event, token: string) => fetchRealtimeToken(token));
  ipcMain.handle('realtime:start', async (_event, token: string) => {
    await startRealtimeStream(token);
    return { ok: true as const };
  });
  ipcMain.handle('realtime:server-status', async (_event, token: string) => {
    const snapshot = await probeRealtimeServerStatus(token);
  
    if (!snapshot) {
      return { ok: false as const, error: 'Unable to load realtime status.' };
    }
  
    return { ok: true as const, data: snapshot };
  });
  ipcMain.handle('realtime:set-heartbeat-status', (_event, status: string) => {
    setRealtimeHeartbeatStatus(status);
    if (status.toUpperCase() !== 'OFFLINE') {
      flushRealtimeHeartbeat();
    }
    return { ok: true as const };
  });

  ipcMain.handle('realtime:stop', () => {
    stopRealtimeStream();
    return { ok: true as const };
  });
  ipcMain.handle(
    'realtime:typing',
    (_event, token: string, conversationId: string, isTyping: boolean) =>
      sendTypingIndicator(token, conversationId, isTyping),
  );
  ipcMain.handle('realtime:presence', (_event, token: string, userIdsJson: string) => {
    let userIds: string[] = [];
  
    try {
      const parsed = JSON.parse(userIdsJson) as unknown;
      userIds = Array.isArray(parsed)
        ? parsed.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
        : [];
    } catch {
      userIds = [];
    }
  
    return fetchRealtimePresence(token, userIds);
  });
  
  ipcMain.handle('calls:token', (_event, token: string, payloadJson: string) => {
    try {
      const payload = JSON.parse(payloadJson) as {
        conversationId?: string;
        roomName?: string;
        video: boolean;
      };
      return fetchCallToken(token, payload);
    } catch {
      return { ok: false as const, error: 'Invalid call token payload.' };
    }
  });
  
  ipcMain.handle('calls:ensure-media-permissions', async (_event, video: boolean) => {
    const result = await ensureMacMediaPermissions(Boolean(video));
  
    if (!result.ok) {
      return { ok: false as const, error: result.error };
    }
  
    return { ok: true as const, data: { ok: true as const } };
  });
  
  ipcMain.handle('calls:ensure-screen-capture', async () => ensureMacScreenCaptureAccess());
  
  ipcMain.handle('calls:describe-screen-capture-failure', () => ({
    ok: true as const,
    data: describeMacScreenCaptureFailure(),
  }));
  
  ipcMain.handle(
    'screen-share:list-sources',
    async (_event, kind: 'screen' | 'window') => {
      const access = await ensureMacScreenCaptureAccess();
  
      if (!access.ok) {
        return { ok: false as const, error: describeMacScreenCaptureFailure() };
      }
  
      try {
        const types = kind === 'screen' ? (['screen'] as const) : (['window'] as const);
        const sources = await desktopCapturer.getSources({
          types: [...types],
          thumbnailSize: { width: 320, height: 180 },
          fetchWindowIcons: true,
        });
  
        markMacScreenCaptureSessionVerified();
  
        return {
          ok: true as const,
          data: sources.map((source) => ({
            id: source.id,
            name: source.name,
            thumbnailDataUrl: source.thumbnail.isEmpty() ? '' : source.thumbnail.toDataURL(),
            kind,
          })),
        };
      } catch (error) {
        console.error('[ScreenShare] Failed to list capture sources.', error);
        return {
          ok: false as const,
          error: describeMacScreenCaptureFailure(),
        };
      }
    },
  );
  
  ipcMain.handle(
    'window:set-call-always-on-top',
    (_event, enabled: boolean, mode?: string) => {
      deps.setCallWindowPresentation(Boolean(enabled), mode);
      return { ok: true as const };
    },
  );
  
  ipcMain.handle('window:move-call-by', (_event, deltaX: number, deltaY: number) => {
    if (!deps.getMainWindow() || deps.getMainWindow().isDestroyed()) {
      return { ok: false as const };
    }
  
    const [x, y] = deps.getMainWindow().getPosition();
    deps.getMainWindow().setPosition(Math.round(x + Number(deltaX)), Math.round(y + Number(deltaY)));
    return { ok: true as const };
  });
  
  ipcMain.handle('window:focus-call', () => {
    deps.ensureMainWindowVisible();
    return { ok: true as const };
  });
  
  ipcMain.handle('window:ensure-visible', () => {
    deps.ensureMainWindowVisible();
    return { ok: true as const };
  });
  
  ipcMain.handle('app:get-name', () => readMediaAppName());
  ipcMain.handle('app:get-desktop-legal-context', () => ({
    isPackaged: app.isPackaged,
    version: app.getVersion(),
    acceptedLegalVersion: readPersistedDesktopLegalVersion(),
  }));
  
  ipcMain.handle('app:accept-desktop-legal', (_event, version: number) => {
    if (!Number.isFinite(version)) {
      return { ok: false as const };
    }
  
    writePersistedDesktopLegalVersion(version);
    return { ok: true as const };
  });
  ipcMain.handle('app:quit', () => {
    app.quit();
  });
  
  ipcMain.handle('calls:log', (_event, token: string, payloadJson: string) => {
    try {
      const payload = JSON.parse(payloadJson) as Parameters<typeof logCallHistory>[1];
      return logCallHistory(token, payload);
    } catch {
      return { ok: false as const, error: 'Invalid call log payload.' };
    }
  });
  
  ipcMain.handle('calls:notify-meeting', (_event, token: string, payloadJson: string) => {
    try {
      const payload = JSON.parse(payloadJson) as Parameters<typeof notifyGroupMeeting>[1];
      return notifyGroupMeeting(token, payload);
    } catch {
      return { ok: false as const, error: 'Invalid meeting notify payload.' };
    }
  });
  
  ipcMain.handle(
    'calls:mute-participant',
    (_event, token: string, conversationId: string, participantIdentity: string, muted: boolean) =>
      muteMeetingParticipant(token, conversationId, participantIdentity, muted),
  );
  
  ipcMain.handle(
    'calls:remove-participant',
    (_event, token: string, conversationId: string, participantIdentity: string) =>
      removeMeetingParticipant(token, conversationId, participantIdentity),
  );
  
  ipcMain.handle('calls:end-meeting', (_event, token: string, conversationId: string) =>
    endGroupMeeting(token, conversationId),
  );
  
  ipcMain.handle('calls:join-request', (_event, token: string, payloadJson: string) => {
    try {
      const payload = JSON.parse(payloadJson) as { conversationId: string; callId?: string };
      return requestMeetingJoin(token, payload);
    } catch {
      return { ok: false as const, error: 'Invalid join request payload.' };
    }
  });
  
  ipcMain.handle('calls:join-requests', (_event, token: string, conversationId: string) =>
    fetchMeetingJoinRequests(token, conversationId),
  );
  
  ipcMain.handle('calls:join-request-respond', (_event, token: string, payloadJson: string) => {
    try {
      const payload = JSON.parse(payloadJson) as {
        conversationId: string;
        requestId: string;
        approved: boolean;
        callId?: string;
        participantIdentity?: string;
      };
      return respondMeetingJoinRequest(token, payload);
    } catch {
      return { ok: false as const, error: 'Invalid join response payload.' };
    }
  });
  
  ipcMain.handle('calls:history', (_event, token: string, filter?: 'all' | 'missed') =>
    fetchCallHistory(token, filter ?? 'all'),
  );
  
  ipcMain.handle('calls:decline-invite', (_event, token: string, payloadJson: string) => {
    try {
      const payload = JSON.parse(payloadJson) as { conversationId: string; callId: string };
      return declineMeetingInvite(token, payload);
    } catch {
      return { ok: false as const, error: 'Invalid decline invite payload.' };
    }
  });
  
  ipcMain.handle('calls:invite-meeting-participant', (_event, token: string, payloadJson: string) => {
    try {
      const payload = JSON.parse(payloadJson) as {
        conversationId: string;
        callId: string;
        userId: string;
      };
      return inviteMeetingParticipant(token, payload);
    } catch {
      return { ok: false as const, error: 'Invalid meeting invite payload.' };
    }
  });
  
  ipcMain.handle(
    'calls:declined-invites',
    (_event, token: string, conversationId: string, callId: string) =>
      fetchDeclinedMeetingInvites(token, conversationId, callId),
  );
  
  ipcMain.handle('renderer:debug-log', (_event, message: string) => {
    if (typeof message === 'string' && message.trim()) {
      console.log(message);
    }
  
    return { ok: true };
  });
}