import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import { performLogin } from './main/authLogin';
import { performGetMe } from './main/authMe';
import { fetchConversations, fetchUnreadCount } from './main/chatBootstrap';
import {
  addMessageReaction,
  createDirectConversation,
  deleteMessage,
  editMessage,
  fetchConversationBootstrap,
  fetchMessageDraft,
  fetchMessageThread,
  clearMessageDraft,
  forwardMessage,
  markConversationRead,
  pinMessage,
  saveMessageDraft,
  sendMessage,
  unpinMessage,
} from './main/conversationApi';
import {
  acceptHubInvite,
  fetchCalendarEvents,
  fetchChannels,
  fetchFiles,
  fetchFriends,
  fetchHubInvites,
  fetchSavedMessages,
  respondFriendRequest,
  saveMessage,
  sendFriendRequest,
  unsaveMessage,
} from './main/featuresApi';
import {
  fetchNotifications,
  fetchOrganizationMembers,
  fetchPendingFriends,
  markAllNotificationsRead,
} from './main/notificationsApi';
import {
  fetchGlobalSearch,
  fetchMessageSearch,
  fetchUserSearch,
} from './main/searchApi';
import {
  setRealtimeHandlers,
  startRealtimeStream,
  stopRealtimeStream,
} from './main/realtimeStream';
import { sendTypingIndicator } from './main/realtimeApi';
import type { RealtimeConnectionStatus } from '../shared/realtime';

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

let mainWindow: BrowserWindow | null = null;

if (started) {
  app.quit();
}

ipcMain.handle('auth:login', (_event, credentials) => performLogin(credentials));
ipcMain.handle('auth:me', (_event, token: string) => performGetMe(token));
ipcMain.handle('chat:conversations', (_event, token: string) => fetchConversations(token));
ipcMain.handle('chat:unread-count', (_event, token: string) => fetchUnreadCount(token));
ipcMain.handle('chat:conversation-bootstrap', (_event, token: string, conversationId: string) =>
  fetchConversationBootstrap(token, conversationId),
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
ipcMain.handle('chat:friends-pending', (_event, token: string) => fetchPendingFriends(token));
ipcMain.handle('chat:organization-members', (_event, token: string) =>
  fetchOrganizationMembers(token),
);
ipcMain.handle('chat:send-message', (_event, token: string, conversationId: string, content: string, replyToId?: string, threadRootId?: string) =>
  sendMessage(token, conversationId, content, replyToId, threadRootId),
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
  'chat:add-conversation-members',
  (_event, token: string, conversationId: string, userIds: string[]) =>
    import('./main/conversationApi').then((m) => m.addConversationMembers(token, conversationId, userIds)),
);
ipcMain.handle(
  'chat:remove-conversation-member',
  (_event, token: string, conversationId: string, userId: string) =>
    import('./main/conversationApi').then((m) => m.removeConversationMember(token, conversationId, userId)),
);
ipcMain.handle('chat:leave-conversation', (_event, token: string, conversationId: string) =>
  import('./main/conversationApi').then((m) => m.leaveConversation(token, conversationId)),
);
ipcMain.handle('chat:delete-conversation', (_event, token: string, conversationId: string) =>
  import('./main/conversationApi').then((m) => m.deleteConversation(token, conversationId)),
);
ipcMain.handle('chat:clear-conversation-history', (_event, token: string, conversationId: string) =>
  import('./main/conversationApi').then((m) => m.clearConversationHistory(token, conversationId)),
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
ipcMain.handle('features:files', (_event, token: string, filter: string) =>
  fetchFiles(token, filter),
);
ipcMain.handle('features:calendar', (_event, token: string) => fetchCalendarEvents(token));
ipcMain.handle('features:channels', (_event, token: string) => fetchChannels(token));
ipcMain.handle('features:hub-invites', (_event, token: string) => fetchHubInvites(token));
ipcMain.handle('features:friends', (_event, token: string) => fetchFriends(token));
ipcMain.handle('features:accept-hub-invite', (_event, token: string, channelId: string) =>
  acceptHubInvite(token, channelId),
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
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
    stopRealtimeStream();
  });
};

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  stopRealtimeStream();

  if (process.platform !== 'darwin') {
    app.quit();
  }
});
