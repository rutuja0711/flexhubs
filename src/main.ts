import {
  app,
  BrowserWindow,
  desktopCapturer,
  ipcMain,
  nativeImage,
  nativeTheme,
  Notification,
  screen,
  session,
  shell,
  systemPreferences,
} from 'electron';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { handleSquirrelStartup } from './main/squirrelStartup';
import { initUpdater, setUpdaterMainWindow } from './main/updater';
import { performLogin } from './main/authLogin';
import { performGetMe } from './main/authMe';
import { API_BASE_URL } from './shared/auth';
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
} from './main/authApi';
import { fetchConversations, fetchUnreadCount } from './main/chatBootstrap';
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
} from './main/conversationApi';
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
} from './main/featuresApi';
import {
  fetchNotifications,
  fetchOrganizationMembers,
  fetchPendingFriends,
  markAllNotificationsRead,
  markNotificationRead,
} from './main/notificationsApi';
import {
  fetchGlobalSearch,
  fetchMessageSearch,
  fetchUserSearch,
} from './main/searchApi';
import { deliverDesktopNotification } from './main/notifications/deliverDesktopNotification';
import {
  closeNotificationWindow,
  setNotificationHostWindowProvider,
} from './main/notifications/notificationWindow';
import {
  setRealtimeHandlers,
  startRealtimeStream,
  stopRealtimeStream,
} from './main/realtimeStream';
import {
  sendTypingIndicator,
  fetchRealtimePresence,
  fetchRealtimeClientConfig,
  fetchRealtimeToken,
} from './main/realtimeApi';
import {
  endGroupMeeting,
  declineMeetingInvite,
  fetchCallHistory,
  fetchCallToken,
  fetchDeclinedMeetingInvites,
  fetchMeetingJoinRequests,
  logCallHistory,
  muteMeetingParticipant,
  notifyGroupMeeting,
  removeMeetingParticipant,
  requestMeetingJoin,
  respondMeetingJoinRequest,
} from './main/callsApi';
import {
  fetchAvatarStyles,
  fetchNotificationSettings,
  fetchOrganizationMembersDetailed,
  fetchUserById,
  updateNotificationSettings,
  updateUserProfile,
  updateUserStatus,
  updateUserTimezone,
  uploadProfileImage,
} from './main/userApi';
import { fetchAuthenticatedMedia } from './main/mediaApi';
import {
  fetchTrendingGifs,
  searchGifs,
  fetchTrendingStickers,
  searchStickers,
} from './main/gifsApi';
import {
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  deletePushSubscriptions,
  enhanceMessageText,
  fetchCalendarMentionableUsers,
  fetchPushVapidPublicKey,
  fetchScheduledMessages,
  generateMessageText,
  parseFlexCommand,
  respondToCalendarEvent,
  subscribePushNotifications,
  transcribeAudioFile,
  unsubscribePushEndpoint,
} from './main/extrasApi';
import { createOrgOrder, createUpgradeOrder, fetchOrgSubscription, fetchPaymentPlans, fetchPlanCompliance, verifyOrgSubscription, verifyUpgradeSubscription } from './main/paymentsApi';
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
} from './main/organizationsApi';
import {
  fetchSuperAdminOrganizations,
  fetchSuperAdminStats,
  suspendSuperAdminOrganization,
} from './main/superadminApi';
import type { RealtimeClientConfig, RealtimeConnectionStatus } from './shared/realtime';

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
} from './main/callSignalingMain';

let mainWindow: BrowserWindow | null = null;
let isQuitting = false;
let callPresentationActive = false;
let savedMainBounds: Electron.Rectangle | null = null;
let savedCallWindowBounds: Electron.Rectangle | null = null;
let callWindowWasNativeFullscreen = false;
const DEFAULT_MIN_SIZE = { width: 960, height: 640 };
function resolveAssetsDir(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'assets');
  }

  const fromAppPath = path.join(app.getAppPath(), 'assets');
  if (fs.existsSync(fromAppPath)) {
    return fromAppPath;
  }

  return path.join(__dirname, '..', '..', 'assets');
}

function resolveAppIconPngPath(): string {
  const assetsDir = resolveAssetsDir();
  const candidates = [
    path.join(assetsDir, 'logo-symbol.png'),
    path.join(assetsDir, 'icon.png'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return candidates[0];
}

function resolveAppIconImage(): Electron.NativeImage | undefined {
  const assetsDir = resolveAssetsDir();
  const candidates = [
    path.join(assetsDir, 'logo-symbol.png'),
    path.join(assetsDir, 'logo-symbol.icns'),
    path.join(assetsDir, 'icon.png'),
    path.join(assetsDir, 'icon.icns'),
  ];

  for (const iconPath of candidates) {
    if (!fs.existsSync(iconPath)) {
      continue;
    }

    const icon = nativeImage.createFromPath(iconPath);
    if (!icon.isEmpty()) {
      return icon;
    }
  }

  return undefined;
}

function resolveAppIconIcnsPath(): string | undefined {
  const icnsPath = path.join(resolveAssetsDir(), 'logo-symbol.icns');
  return fs.existsSync(icnsPath) ? icnsPath : undefined;
}

function buildAppIconIcnsFromPng(): string | undefined {
  if (process.platform !== 'darwin') {
    return undefined;
  }

  const sourcePng = resolveAppIconPngPath();

  if (!fs.existsSync(sourcePng)) {
    return undefined;
  }

  const iconsetDir = path.join(app.getPath('temp'), 'flexhubs-logo-symbol.iconset');
  const outputIcns = path.join(app.getPath('temp'), 'flexhubs-logo-symbol.icns');
  const iconSizes: Array<[number, string]> = [
    [16, '16x16'],
    [32, '16x16@2x'],
    [32, '32x32'],
    [64, '32x32@2x'],
    [128, '128x128'],
    [256, '128x128@2x'],
    [256, '256x256'],
    [512, '256x256@2x'],
    [512, '512x512'],
    [1024, '512x512@2x'],
  ];

  try {
    fs.rmSync(iconsetDir, { recursive: true, force: true });
    fs.mkdirSync(iconsetDir, { recursive: true });

    for (const [size, name] of iconSizes) {
      execSync(
        `sips -z ${size} ${size} "${sourcePng}" --out "${path.join(iconsetDir, `icon_${name}.png`)}"`,
        { stdio: 'ignore' },
      );
    }

    execSync(`iconutil -c icns "${iconsetDir}" -o "${outputIcns}"`, { stdio: 'ignore' });

    return fs.existsSync(outputIcns) ? outputIcns : undefined;
  } catch (error) {
    console.warn('[FlexHubs] Could not build app icon from logo-symbol.png:', error);
    return undefined;
  }
}

function patchDevElectronNotificationIcon(): void {
  if (app.isPackaged || process.platform !== 'darwin') {
    return;
  }

  const sourceIcns = resolveAppIconIcnsPath() ?? buildAppIconIcnsFromPng();

  if (!sourceIcns) {
    return;
  }

  const electronResourcesDir = path.join(path.dirname(path.dirname(process.execPath)), 'Resources');
  const targetIcns = path.join(electronResourcesDir, 'electron.icns');

  if (!fs.existsSync(targetIcns)) {
    return;
  }

  try {
    fs.copyFileSync(sourceIcns, targetIcns);
  } catch (error) {
    console.warn('[FlexHubs] Could not patch Electron notification icon in dev:', error);
  }
}

function applyApplicationIcon(): void {
  const icon = resolveAppIconImage();

  if (!icon) {
    return;
  }

  if (process.platform === 'darwin' && app.dock) {
    app.dock.setIcon(icon);
  }
}

function resolveWindowBackgroundColor(): string {
  return nativeTheme.shouldUseDarkColors ? '#0d0d0d' : '#f3f4f6';
}

function applyNativeTheme(mode: 'light' | 'dark'): void {
  nativeTheme.themeSource = mode;

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setBackgroundColor(resolveWindowBackgroundColor());
  }
}

function notificationOptions(title: string, body: string): Electron.NotificationConstructorOptions {
  const options: Electron.NotificationConstructorOptions = {
    title,
    body,
    silent: false,
  };

  if (process.platform === 'darwin') {
    options.timeoutType = 'never';
  } else if (process.platform === 'win32') {
    (options as Electron.NotificationConstructorOptions & { requireInteraction?: boolean }).requireInteraction =
      true;
  }

  // macOS uses the app bundle icon on the left; setting `icon` adds a right-side thumbnail.
  if (process.platform !== 'darwin') {
    const iconImage = resolveAppIconImage();
    const iconPath = resolveAppIconPngPath();

    if (iconImage && !iconImage.isEmpty()) {
      options.icon = iconImage;
    } else if (fs.existsSync(iconPath)) {
      options.icon = iconPath;
    }
  }

  return options;
}

if (handleSquirrelStartup()) {
  app.quit();
}

ipcMain.handle('auth:login', (_event, credentials) => performLogin(credentials));
ipcMain.handle('auth:me', (_event, token: string) => performGetMe(token));
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
  (_event, token: string, conversationId: string, content: string) =>
    saveMessageDraft(token, conversationId, content),
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

  return import('./main/conversationApi').then((m) =>
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
    import('./main/conversationApi').then((m) => m.renameConversation(token, conversationId, name)),
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

    return import('./main/conversationApi').then((m) =>
      m.updateConversationNotificationSettings(token, conversationId, settings),
    );
  },
);
ipcMain.handle(
  'chat:set-conversation-favorite',
  (_event, token: string, conversationId: string, favorite: boolean) =>
    import('./main/conversationApi').then((m) =>
      m.setConversationFavorite(token, conversationId, favorite),
    ),
);
ipcMain.handle(
  'chat:add-conversation-members',
  (_event, token: string, conversationId: string, userIds: string[]) =>
    import('./main/conversationApi').then((m) => m.addConversationMembers(token, conversationId, userIds)),
);
ipcMain.handle(
  'chat:remove-conversation-member',
  (_event, token: string, conversationId: string, userId: string) =>
    import('./main/conversationApi').then((m) => m.removeConversationMember(token, conversationId, userId)),
);
ipcMain.handle('chat:leave-conversation', (_event, token: string, conversationId: string, isHub: boolean) =>
  import('./main/conversationApi').then((m) => m.leaveConversation(token, conversationId, isHub)),
);
ipcMain.handle('chat:delete-conversation', (_event, token: string, conversationId: string) =>
  import('./main/conversationApi').then((m) => m.deleteConversation(token, conversationId)),
);
ipcMain.handle('chat:clear-conversation-history', (_event, token: string, conversationId: string) =>
  import('./main/conversationApi').then((m) => m.clearConversationHistory(token, conversationId)),
);
ipcMain.handle('chat:create-group', (_event, token: string, name: string, userIds: string[]) =>
  import('./main/conversationApi').then((m) => m.createGroupConversation(token, name, userIds)),
);
ipcMain.handle('chat:self-conversation', (_event, token: string) =>
  import('./main/conversationApi').then((m) => m.fetchSelfConversation(token)),
);
ipcMain.handle('chat:get-conversation', (_event, token: string, conversationId: string) =>
  import('./main/conversationApi').then((m) => m.fetchConversationById(token, conversationId)),
);
ipcMain.handle('chat:mark-unread', (_event, token: string, conversationId: string) =>
  import('./main/conversationApi').then((m) => m.markConversationUnread(token, conversationId)),
);
ipcMain.handle('chat:pinned-messages', (_event, token: string, conversationId: string) =>
  import('./main/conversationApi').then((m) => m.fetchPinnedMessages(token, conversationId)),
);
ipcMain.handle(
  'chat:get-message',
  (_event, token: string, conversationId: string, messageId: string) =>
    import('./main/conversationApi').then((m) => m.fetchMessageById(token, conversationId, messageId)),
);
ipcMain.handle(
  'chat:mention-suggestions',
  (_event, token: string, conversationId: string, query: string) =>
    import('./main/conversationApi').then((m) => m.fetchMentionSuggestions(token, conversationId, query)),
);
ipcMain.handle(
  'chat:create-poll',
  (_event, token: string, conversationId: string, payloadJson: string) => {
    try {
      const payload = JSON.parse(payloadJson) as Record<string, unknown>;
      return import('./main/conversationApi').then((m) =>
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
    import('./main/conversationApi').then((m) =>
      m.votePollMessage(token, conversationId, messageId, optionId),
    ),
);
ipcMain.handle(
  'chat:conversation-scheduled-messages',
  (_event, token: string, conversationId: string) =>
    import('./main/conversationApi').then((m) =>
      m.fetchConversationScheduledMessages(token, conversationId),
    ),
);
ipcMain.handle(
  'chat:create-conversation-scheduled-message',
  (_event, token: string, conversationId: string, payloadJson: string) => {
    try {
      const payload = JSON.parse(payloadJson) as Record<string, unknown>;
      return import('./main/conversationApi').then((m) =>
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
    import('./main/conversationApi').then((m) =>
      m.deleteConversationScheduledMessage(token, conversationId, scheduledId),
    ),
);
ipcMain.handle(
  'chat:update-member-role',
  (_event, token: string, conversationId: string, userId: string, role: string) =>
    import('./main/conversationApi').then((m) =>
      m.updateConversationMemberRole(token, conversationId, userId, role),
    ),
);
ipcMain.handle(
  'chat:get-conversation-notification-settings',
  (_event, token: string, conversationId: string) =>
    import('./main/conversationApi').then((m) =>
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
ipcMain.handle('features:respond-friend-request', (_event, token: string, userId: string, status: 'ACCEPTED' | 'DECLINED') =>
  respondFriendRequest(token, userId, status),
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
ipcMain.handle(
  'user:update-status',
  (_event, token: string, status: string, message?: string) =>
    updateUserStatus(token, {
      status: status as import('../shared/profile').UserPresenceStatus,
      message,
    }),
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
    setCallWindowPresentation(Boolean(enabled), mode);
    return { ok: true as const };
  },
);

ipcMain.handle('window:move-call-by', (_event, deltaX: number, deltaY: number) => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return { ok: false as const };
  }

  const [x, y] = mainWindow.getPosition();
  mainWindow.setPosition(Math.round(x + Number(deltaX)), Math.round(y + Number(deltaY)));
  return { ok: true as const };
});

ipcMain.handle('window:focus-call', () => {
  ensureMainWindowVisible();
  return { ok: true as const };
});

ipcMain.handle('window:ensure-visible', () => {
  ensureMainWindowVisible();
  return { ok: true as const };
});

ipcMain.handle('app:get-name', () => readMediaAppName());
ipcMain.handle('app:get-desktop-legal-context', () => ({
  isPackaged: app.isPackaged,
  version: app.getVersion(),
}));
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
      participantIdentity: string;
      callId: string;
      accept: boolean;
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

setRealtimeHandlers({
  onEvent: (event) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('realtime:event', event);
    }
  },
  onStatus: (status: RealtimeConnectionStatus) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('realtime:status', status);
    }
  },
});

const createWindow = (): void => {
  const appIcon = resolveAppIconImage();

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    fullscreenable: true,
    backgroundColor: resolveWindowBackgroundColor(),
    show: false,
    autoHideMenuBar: true,
    ...(appIcon ? { icon: appIcon } : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
      spellcheck: false,
    },
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    void mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    void mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  setCallSignalingWindowProvider(() => mainWindow);
  setUpdaterMainWindow(mainWindow);

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('[FlexHubs] Main window render process gone:', details);
  });

  mainWindow.on('unresponsive', () => {
    console.warn('[FlexHubs] Main window became unresponsive.');
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    mainWindow?.center();
    applyApplicationIcon();
  });

  mainWindow.on('enter-full-screen', () => {
    callWindowWasNativeFullscreen = true;
  });

  mainWindow.on('leave-full-screen', () => {
    if (!callPresentationActive || !callWindowWasNativeFullscreen) {
      return;
    }

    callWindowWasNativeFullscreen = false;

    if (savedCallWindowBounds) {
      mainWindow?.setBounds(savedCallWindowBounds);
      savedCallWindowBounds = null;
    }

    notifyCallWindowPresentation('floating');
  });

  mainWindow.on('closed', () => {
    setUpdaterMainWindow(null);
    mainWindow = null;
    stopRealtimeStream();
    closeNotificationWindow();
  });

  mainWindow.on('hide', () => {
    applyApplicationIcon();
  });

  if (process.platform === 'darwin') {
    mainWindow.on('close', (event) => {
      if (isQuitting) {
        return;
      }

      event.preventDefault();
      closeNotificationWindow();
      mainWindow?.hide();
      applyApplicationIcon();
    });
  }
};

setNotificationHostWindowProvider(() => mainWindow);

function isAllowedSessionPermission(permission: string): boolean {
  return (
    permission === 'notifications' ||
    permission === 'media' ||
    permission === 'audioCapture' ||
    permission === 'videoCapture' ||
    permission === 'display-capture' ||
    permission === 'screenCapture'
  );
}

async function ensureMacMediaPermissions(
  video: boolean,
): Promise<{ ok: true } | { ok: false; error: string; appName: string }> {
  const appName = app.isPackaged ? app.getName() : 'Electron';

  if (process.platform !== 'darwin') {
    return { ok: true, appName };
  }

  const micStatus = systemPreferences.getMediaAccessStatus('microphone');
  let micGranted = micStatus === 'granted';

  if (!micGranted) {
    micGranted = await systemPreferences.askForMediaAccess('microphone');
  }

  if (!micGranted) {
    return {
      ok: false,
      appName,
      error: `Microphone access is required. Enable ${appName} in System Settings → Privacy & Security → Microphone.`,
    };
  }

  if (!video) {
    return { ok: true, appName };
  }

  const cameraStatus = systemPreferences.getMediaAccessStatus('camera');
  let cameraGranted = cameraStatus === 'granted';

  if (!cameraGranted) {
    cameraGranted = await systemPreferences.askForMediaAccess('camera');
  }

  if (!cameraGranted) {
    return {
      ok: false,
      appName,
      error: `Camera access is required. Enable ${appName} in System Settings → Privacy & Security → Camera.`,
    };
  }

  return { ok: true, appName };
}

function readMediaAppName(): string {
  return app.isPackaged ? app.getName() : 'Electron';
}

function buildMacScreenCaptureHint(): string {
  const appName = readMediaAppName();

  return `Enable Screen Recording for ${appName} in System Settings → Privacy & Security, then quit and reopen the app.`;
}

async function probeMacScreenCaptureSources(): Promise<number> {
  const sources = await Promise.race([
    desktopCapturer.getSources({
      types: ['screen', 'window'],
      thumbnailSize: { width: 1, height: 1 },
    }),
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Screen capture probe timed out')), 2500);
    }),
  ]);

  return sources.length;
}

async function ensureMacScreenCaptureAccess(): Promise<{ ok: true } | { ok: false; error: string }> {
  if (process.platform !== 'darwin') {
    return { ok: true };
  }

  const execPath = process.execPath;
  const reportedStatus = systemPreferences.getMediaAccessStatus('screen');

  console.log(`[ScreenShare] execPath: ${execPath}`);
  console.log(`[ScreenShare] getMediaAccessStatus('screen'): ${reportedStatus}`);

  if (reportedStatus === 'granted') {
    return { ok: true };
  }

  try {
    const sourceCount = await probeMacScreenCaptureSources();
    console.log(`[ScreenShare] Permission probe found ${sourceCount} capture source(s).`);

    if (sourceCount > 0) {
      return { ok: true };
    }
  } catch (error) {
    console.warn('[ScreenShare] Permission probe inconclusive.', error);
  }

  // macOS can report "denied" even after the user grants access (stale TCC cache,
  // wrong binary in the list, or dev app launched from Cursor/Terminal).
  // Let getDisplayMedia attempt capture instead of blocking with a false negative.
  console.warn('[ScreenShare] Proceeding despite inconclusive permission probe.');
  return { ok: true };
}

function describeMacScreenCaptureFailure(): string {
  if (process.platform !== 'darwin') {
    return 'Could not share your screen. Please try again.';
  }

  return buildMacScreenCaptureHint();
}

function resolveNotificationSettingsAppName(): string {
  if (process.platform === 'darwin' && !app.isPackaged) {
    return 'Electron';
  }

  return app.getName();
}

function buildNotificationBlockedMessage(): string {
  const appName = resolveNotificationSettingsAppName();
  let message = `Enable ${appName} in System Settings → Notifications.`;

  if (process.platform === 'darwin' && !app.isPackaged) {
    message +=
      ' Dev mode uses unsigned Electron; macOS may still block alerts until notifications are enabled for Electron or you run a signed build.';
  }

  return message;
}

function logScreenCaptureStartupHint(): void {
  if (process.platform !== 'darwin') {
    return;
  }

  const status = systemPreferences.getMediaAccessStatus('screen');
  console.log(`[ScreenShare] Startup check — status: ${status}, binary: ${process.execPath}`);

  if (status !== 'granted') {
    console.log(
      '[ScreenShare] If screen share fails, add the binary above in System Settings → Privacy & Security → Screen & System Audio Recording.',
    );
  }
}

function logNotificationStartupHint(): void {
  if (!Notification.isSupported()) {
    console.warn('[FlexHubs] Native notifications are not supported on this device.');
    return;
  }

  console.log('[FlexHubs] Native notifications are supported in the main process.');

  if (process.platform !== 'darwin') {
    return;
  }

  const appName = resolveNotificationSettingsAppName();
  console.log(
    `[FlexHubs] Desktop alerts — enable "${appName}" in System Settings → Notifications (binary: ${process.execPath}).`,
  );

  if (!app.isPackaged) {
    console.log(
      '[FlexHubs] Dev note: npm start runs unsigned Electron. If alerts never appear, enable Electron in Notifications or test with a signed packaged build.',
    );
  }
}

function setupDisplayMediaHandler(): void {
  // Screen share uses the in-app FlexHubs picker (ScreenSharePicker) + desktopCapturer.
  session.defaultSession.setDisplayMediaRequestHandler((_request, callback) => {
    callback({});
  });
}

function restoreCallWindowBounds(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  if (callWindowWasNativeFullscreen) {
    if (mainWindow.isFullScreen()) {
      mainWindow.setFullScreen(false);
    }
    callWindowWasNativeFullscreen = false;
  }

  if (savedCallWindowBounds) {
    mainWindow.setBounds(savedCallWindowBounds);
    savedCallWindowBounds = null;
  }
}

function ensureMainWindowVisible(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }

  if (!mainWindow.isVisible()) {
    mainWindow.show();
  }

  mainWindow.focus();
}

function notifyCallWindowPresentation(mode: string): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  mainWindow.webContents.send('call:window-presentation-changed', mode);
}

function setCallWindowPresentation(active: boolean, mode = 'floating'): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  if (!active || mode === 'idle') {
    const hadCallPresentation = callPresentationActive;
    callPresentationActive = false;

    if (savedMainBounds) {
      mainWindow.setMinimumSize(DEFAULT_MIN_SIZE.width, DEFAULT_MIN_SIZE.height);
      mainWindow.setBounds(savedMainBounds);
      savedMainBounds = null;
    }

    if (hadCallPresentation || savedCallWindowBounds || callWindowWasNativeFullscreen) {
      restoreCallWindowBounds();
    }

    mainWindow.setAlwaysOnTop(false);
    mainWindow.setVisibleOnAllWorkspaces(false);
    return;
  }

  callPresentationActive = true;

  // Incoming ring: show the in-app overlay without resizing/unmaximizing the window.
  if (mode === 'ringing') {
    mainWindow.setAlwaysOnTop(false);
    mainWindow.setVisibleOnAllWorkspaces(false);

    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }

    mainWindow.show();
    mainWindow.focus();
    notifyCallWindowPresentation(mode);
    return;
  }

  // In-call layout (floating / minimized / fullscreen) is handled in-app via CSS overlays.
  // Never pin during active calls so users can switch to other apps freely.
  mainWindow.setAlwaysOnTop(false);
  mainWindow.setVisibleOnAllWorkspaces(false);

  if (savedMainBounds) {
    mainWindow.setMinimumSize(DEFAULT_MIN_SIZE.width, DEFAULT_MIN_SIZE.height);
    mainWindow.setBounds(savedMainBounds);
    savedMainBounds = null;
  }

  notifyCallWindowPresentation(mode);
}

if (process.platform === 'win32') {
  app.setAppUserModelId(app.name);
}

const hardwareConfigPath = path.join(app.getPath('userData'), 'flexhubs-hardware.json');
try {
  if (fs.existsSync(hardwareConfigPath)) {
    const config = JSON.parse(fs.readFileSync(hardwareConfigPath, 'utf8'));
    if (config.disableHardwareAcceleration === true) {
      app.disableHardwareAcceleration();
    }
  }
} catch (e) {
  // Ignore config errors
}

ipcMain.handle('app:get-hardware-acceleration-disabled', () => {
  try {
    if (fs.existsSync(hardwareConfigPath)) {
      const config = JSON.parse(fs.readFileSync(hardwareConfigPath, 'utf8'));
      return config.disableHardwareAcceleration === true;
    }
  } catch (e) {}
  return false;
});

ipcMain.handle('app:set-hardware-acceleration-disabled', (_event, disabled: boolean) => {
  try {
    fs.writeFileSync(hardwareConfigPath, JSON.stringify({ disableHardwareAcceleration: disabled }));
  } catch (e) {}
});

ipcMain.handle('app:relaunch', () => {
  app.relaunch();
  app.quit();
});

app.whenReady().then(() => {
  console.log('[FlexHubs] API base URL:', API_BASE_URL);
  console.log('[FlexHubs] Call debug: lines starting with [Calls] appear here after login.');

  initUpdater();

  patchDevElectronNotificationIcon();
  applyApplicationIcon();

  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(isAllowedSessionPermission(permission));
  });

  session.defaultSession.setPermissionCheckHandler((_webContents, permission) => {
    return isAllowedSessionPermission(permission);
  });

  setupDisplayMediaHandler();
  logScreenCaptureStartupHint();
  logNotificationStartupHint();

  ipcMain.handle('app:set-theme', (_event, mode: 'light' | 'dark') => {
    if (mode !== 'light' && mode !== 'dark') {
      return { ok: false };
    }

    applyNativeTheme(mode);
    return { ok: true };
  });

  const focusMainWindowFromNotification = (payload: {
    tag?: string;
    conversationId?: string | null;
    messageId?: string | null;
  }) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.show();
      mainWindow.focus();
      applyApplicationIcon();
      mainWindow.webContents.send('desktop:notify-click', {
        tag: payload.tag ?? '',
        conversationId: payload.conversationId ?? null,
        messageId: payload.messageId ?? null,
      });
    }
  };

  ipcMain.on('desktop:toast-click', (_event, payload: { tag?: string; conversationId?: string | null; messageId?: string | null }) => {
    focusMainWindowFromNotification(payload ?? {});
  });

  ipcMain.handle(
    'desktop:notify',
    (_event, payload: any) =>
      new Promise<{ ok: boolean; error?: string }>((resolve) => {
        try {
          const onClick = () => {
            focusMainWindowFromNotification({
              tag: payload?.tag ?? '',
              conversationId: payload?.conversationId ?? null,
              messageId: payload?.messageId ?? null,
            });
          };

          const result = deliverDesktopNotification(mainWindow, payload ?? {}, onClick);
          resolve({ ok: result.ok });
        } catch (error) {
          console.warn('[FlexHubs] Desktop notification failed:', error);
          resolve({ ok: false, error: 'Failed to show notification' });
        }
      }),
  );

  createWindow();

  app.on('activate', () => {
    applyApplicationIcon();

    if (!mainWindow || mainWindow.isDestroyed()) {
      createWindow();
      return;
    }

    if (!mainWindow.isVisible()) {
      mainWindow.show();
    }

    mainWindow.focus();
    mainWindow.center();
    applyApplicationIcon();
  });

  app.on('browser-window-focus', () => {
    applyApplicationIcon();
  });
});

app.on('before-quit', () => {
  isQuitting = true;
  closeNotificationWindow();
  console.log('[FlexHubs] Application before-quit.');
});

app.on('window-all-closed', () => {
  console.log('[FlexHubs] All windows closed.');
  stopRealtimeStream();

  if (process.platform !== 'darwin') {
    app.quit();
  }
});
