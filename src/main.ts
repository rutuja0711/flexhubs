import {
  app,
  BrowserWindow,
  desktopCapturer,
  ipcMain,
  Menu,
  type MenuItemConstructorOptions,
  nativeImage,
  nativeTheme,
  Notification,
  powerSaveBlocker,
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
import {
  clearPersistedAuthSession,
  readPersistedAuthSession,
  writePersistedAuthSession,
} from './main/desktopAuthStorage';
import {
  bootstrapAuthenticatedMediaRequestToken,
  installAuthenticatedMediaRequestInterceptor,
  setAuthenticatedMediaRequestToken,
} from './main/authenticatedMediaRequest';
import { API_BASE_URL } from './shared/auth';
import { DESKTOP_APP_BUNDLE_ID } from './shared/desktopAppId';
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
import {
  readAllPersistedCalendarEventTags,
  readPersistedCalendarEventTags,
  writePersistedCalendarEventTags,
} from './main/desktopCalendarTagStorage';
import {
  readPersistedDesktopLegalVersion,
  writePersistedDesktopLegalVersion,
} from './main/desktopLegalStorage';
import { deliverDesktopNotification } from './main/notifications/deliverDesktopNotification';
import { setBadgeHostWindow } from './main/appBadge';
import {
  closeNotificationWindow,
  setNotificationHostWindowProvider,
} from './main/notifications/notificationWindow';
import {
  setRealtimeHandlers,
  startRealtimeStream,
  stopRealtimeStream,
  probeRealtimeServerStatus,
  setRealtimeHeartbeatStatus,
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
  inviteMeetingParticipant,
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
import { prepareFileDragFromUrl, startPreparedFileDrag } from './main/startFileDrag';
import {
  fetchTrendingGifs,
  searchGifs,
  fetchTrendingStickers,
  searchStickers,
} from './main/gifsApi';
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
import { registerAllIpc } from './main/ipc/registerAllIpc';
import {
  describeMacScreenCaptureFailure,
  ensureMacScreenCaptureAccess,
  markMacScreenCaptureSessionVerified,
} from './main/platform/macScreenCapture';
import { ensureMacMediaPermissions, readMediaAppName } from './main/platform/macMediaPermissions';

let mainWindow: BrowserWindow | null = null;
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
  const candidate = path.join(assetsDir, 'logo-symbol.png');
  return fs.existsSync(candidate) ? candidate : path.join(assetsDir, 'logo-symbol.png');
}

function resolveAppIconImage(): Electron.NativeImage | undefined {
  const assetsDir = resolveAssetsDir();
  const candidates = [
    path.join(assetsDir, 'logo-symbol.png'),
    path.join(assetsDir, 'logo-symbol.icns'),
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

const hardwareConfigPath = path.join(app.getPath('userData'), 'flexhubs-hardware.json');
/** Avoid repeated macOS Screen Recording probes (each probe can re-open the system prompt). */
let displaySleepBlockerId: number | null = null;

function readSavedHardwareAccelerationDisabled(): boolean | null {
  try {
    if (!fs.existsSync(hardwareConfigPath)) {
      return null;
    }

    const config = JSON.parse(fs.readFileSync(hardwareConfigPath, 'utf8')) as {
      disableHardwareAcceleration?: boolean;
    };

    if (typeof config.disableHardwareAcceleration === 'boolean') {
      return config.disableHardwareAcceleration;
    }
  } catch {
    // ignore corrupt config
  }

  return null;
}

/** Default on for performance; users can disable in settings if they hit display glitches. */
function isHardwareAccelerationDisabled(): boolean {
  const saved = readSavedHardwareAccelerationDisabled();
  if (saved !== null) {
    return saved;
  }

  return false;
}

function applyStableDisplayProfile(): void {
  if (!isHardwareAccelerationDisabled()) {
    return;
  }

  app.commandLine.appendSwitch('disable-gpu');
  app.commandLine.appendSwitch('disable-gpu-compositing');
  app.commandLine.appendSwitch('disable-gpu-sandbox');
  app.disableHardwareAcceleration();
  console.log('[FlexHubs] Stable display profile: hardware GPU acceleration disabled.');
}

applyStableDisplayProfile();

function updateDisplaySleepBlocker(): void {
  const shouldPreventSleep = Boolean(
    mainWindow &&
      !mainWindow.isDestroyed() &&
      mainWindow.isVisible() &&
      !mainWindow.isMinimized(),
  );

  if (shouldPreventSleep) {
    if (displaySleepBlockerId === null || !powerSaveBlocker.isStarted(displaySleepBlockerId)) {
      displaySleepBlockerId = powerSaveBlocker.start('prevent-display-sleep');
    }
    return;
  }

  if (displaySleepBlockerId !== null && powerSaveBlocker.isStarted(displaySleepBlockerId)) {
    powerSaveBlocker.stop(displaySleepBlockerId);
  }
  displaySleepBlockerId = null;
}


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
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    if (!mainWindow.isVisible()) {
      mainWindow.show();
    }
    mainWindow.focus();
    applyApplicationIcon();
    return;
  }

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
  setBadgeHostWindow(mainWindow);

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('[FlexHubs] Main window render process gone:', details);
  });

  mainWindow.on('unresponsive', () => {
    console.warn('[FlexHubs] Main window became unresponsive.');
  });

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error(
      '[FlexHubs] Main window failed to load:',
      errorCode,
      errorDescription,
      validatedURL,
    );
    if (!app.isPackaged && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      void mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
  });

  let devForceShowTimer: ReturnType<typeof setTimeout> | undefined;
  if (!app.isPackaged) {
    devForceShowTimer = setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
        console.warn(
          '[FlexHubs] Dev: main window still hidden after 5s — showing anyway (check Vite on port 5173).',
        );
        mainWindow.show();
        void mainWindow.webContents.openDevTools({ mode: 'detach' });
      }
    }, 5000);
  }

  mainWindow.once('ready-to-show', () => {
    if (devForceShowTimer) {
      clearTimeout(devForceShowTimer);
    }
    mainWindow?.show();
    applyApplicationIcon();
    updateDisplaySleepBlocker();
    if (!app.isPackaged && mainWindow && !mainWindow.isDestroyed()) {
      void mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
  });

  mainWindow.webContents.on('did-finish-load', () => {
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
      mainWindow.show();
      applyApplicationIcon();
    }

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('desktop:request-badge-sync');
    }
  });

  if (app.isPackaged) {
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
        console.warn('[FlexHubs] Main window still hidden after load — showing fallback.');
        mainWindow.show();
        applyApplicationIcon();
      }
    }, 8000);
  }

  mainWindow.on('show', () => {
    updateDisplaySleepBlocker();
  });

  mainWindow.on('hide', () => {
    applyApplicationIcon();
    updateDisplaySleepBlocker();
  });

  mainWindow.on('minimize', () => {
    updateDisplaySleepBlocker();
  });

  mainWindow.on('restore', () => {
    updateDisplaySleepBlocker();
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
    setBadgeHostWindow(null);
    mainWindow = null;
    stopRealtimeStream();
    closeNotificationWindow();
    updateDisplaySleepBlocker();
  });

};

function focusPrimaryWindow(): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.show();
    mainWindow.focus();
    return;
  }

  if (app.isReady()) {
    createWindow();
  }
}

const enableSingleInstanceLock = app.isPackaged;
const singleInstanceLock = enableSingleInstanceLock ? app.requestSingleInstanceLock() : true;

if (!singleInstanceLock) {
  console.log('[FlexHubs] Another instance is already running — exiting.');
  app.quit();
} else if (enableSingleInstanceLock) {
  app.on('second-instance', () => {
    focusPrimaryWindow();
  });
}

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
  applyApplicationIcon();
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


registerAllIpc({
  getMainWindow: () => mainWindow,
  setCallWindowPresentation,
  ensureMainWindowVisible,
});

if (process.platform === 'win32') {
  app.setAppUserModelId(DESKTOP_APP_BUNDLE_ID);
}

ipcMain.handle('app:get-hardware-acceleration-disabled', () => isHardwareAccelerationDisabled());

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
  installAuthenticatedMediaRequestInterceptor();
  bootstrapAuthenticatedMediaRequestToken();
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
    focusPrimaryWindow();

    if (!mainWindow || mainWindow.isDestroyed()) {
      return;
    }

    const notifyPayload = {
      tag: payload.tag ?? '',
      conversationId: payload.conversationId ?? null,
      messageId: payload.messageId ?? null,
    };

    const deliverClick = () => {
      if (!mainWindow || mainWindow.isDestroyed()) {
        return;
      }

      mainWindow.webContents.send('desktop:notify-click', notifyPayload);
    };

    if (mainWindow.webContents.isLoading()) {
      mainWindow.webContents.once('did-finish-load', deliverClick);
    } else {
      deliverClick();
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
          resolve({ ok: result.ok, error: result.ok ? undefined : 'Notification was blocked by the system.' });
        } catch (error) {
          console.warn('[FlexHubs] Desktop notification failed:', error);
          resolve({ ok: false, error: 'Failed to show notification' });
        }
      }),
  );

  setupApplicationMenu();
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
    applyApplicationIcon();
  });

  app.on('browser-window-focus', () => {
    applyApplicationIcon();
  });
});

app.on('before-quit', () => {
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

function setupApplicationMenu(): void {
  const appName = app.getName();
  const isMac = process.platform === 'darwin';
  const template: MenuItemConstructorOptions[] = [];

  if (isMac) {
    template.push({
      label: appName,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    });
  }

  const viewSubmenu: MenuItemConstructorOptions[] = [
    { role: 'reload', accelerator: 'CmdOrCtrl+R' },
    { role: 'forceReload', accelerator: 'CmdOrCtrl+Shift+R' },
  ];

  if (!app.isPackaged) {
    viewSubmenu.push(
      { type: 'separator' },
      { role: 'toggleDevTools', accelerator: isMac ? 'Alt+Command+I' : 'Ctrl+Shift+I' },
    );
  }

  template.push({
    label: 'View',
    submenu: viewSubmenu,
  });

  if (isMac) {
    template.push({ role: 'editMenu' }, { role: 'windowMenu' });
  } else {
    template.push({
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    });

    template.push({
      label: 'Window',
      submenu: [{ role: 'minimize' }, { role: 'zoom' }, { role: 'close' }],
    });
  }

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
