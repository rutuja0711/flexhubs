import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  CalendarEventItem,
  FileItem,
  SavedMessageItem,
} from '../shared/features';
import type { MainView } from '../shared/nav';
import type { SearchPerson } from '../shared/search';
import { getCurrentUser, getStoredUser } from './authApi';
import {
  acceptHubInvite,
  addMessageReaction,
  createDirectChat,
  deleteChatMessage,
  editChatMessage,
  forwardChatMessage,
  loadBellPanelData,
  loadCalendarEvents,
  loadChannels,
  loadChatBootstrap,
  loadConversationBootstrap,
  loadConversations,
  loadFiles,
  loadFriends,
  loadHubInvites,
  loadMessageDraft,
  loadNotifications,
  loadOrganizationMembers,
  loadPendingFriends,
  loadSavedMessages,
  loadUnreadCount,
  markConversationRead,
  pinChatMessage,
  refreshBellPanelData,
  saveChatDraft,
  saveChatMessage,
  sendChatMessage,
  sendTypingUpdate,
  clearChatDraft,
  unpinChatMessage,
  respondFriendRequest,
  unsaveChatMessage,
} from './chatApi';
import { ActivityView } from './chat/ActivityView';
import { CalendarView } from './chat/CalendarView';
import { ChatSidebar } from './chat/ChatSidebar';
import { ChatWelcome } from './chat/ChatWelcome';
import { ConversationThread } from './chat/ConversationThread';
import { FilesView } from './chat/FilesView';
import { HubsView } from './chat/HubsView';
import { NavRail } from './chat/NavRail';
import { SavedView } from './chat/SavedView';
import type { ConversationItem } from '../shared/chat';
import type {
  MessageItem,
  NotificationItem,
  PendingFriendItem,
  TeammateItem,
} from '../shared/messages';
import { resolveNotificationConversationId } from '../shared/messages';
import {
  extractConversationId,
  extractMessageFromRealtimePayload,
  extractPresenceUpdate,
  extractTypingUpdate,
  isConversationUpdateEvent,
  isMessageDeleteEvent,
  isMessageUpdateEvent,
  isNewMessageEvent,
  isPresenceEvent,
  isTypingChannelEvent,
  isTypingEvent,
  isUnreadUpdateEvent,
  parseRealtimeEvent,
} from '../shared/realtime';
import { getUserDisplayName, getUserId, getWorkspaceName, getWorkspaceShortName } from '../shared/user';
import {
  startRealtime,
  stopRealtime,
  subscribeRealtimeEvent,
} from './realtimeApi';

const UNREAD_POLL_MS = 120_000;
const BELL_POLL_MS = 30_000;
const DRAFT_SAVE_MS = 600;
const TYPING_STOP_MS = 3_000;
const TYPING_LABEL_MS = 5_000;

type FileFilter = 'all' | 'images' | 'docs' | 'other';

function sortConversations(items: ConversationItem[]): ConversationItem[] {
  return [...items].sort((left, right) => {
    if (left.isPinned !== right.isPinned) {
      return left.isPinned ? -1 : 1;
    }

    const leftTime = Date.parse(left.timestamp);
    const rightTime = Date.parse(right.timestamp);

    if (!Number.isNaN(leftTime) && !Number.isNaN(rightTime) && leftTime !== rightTime) {
      return rightTime - leftTime;
    }

    return left.title.localeCompare(right.title);
  });
}

function findConversationForPerson(
  conversations: ConversationItem[],
  person: SearchPerson,
): ConversationItem | null {
  const normalizedName = person.name.toLowerCase();
  const normalizedUsername = person.username.toLowerCase();

  return (
    conversations.find((conversation) => {
      if (conversation.kind !== 'direct') {
        return false;
      }

      const title = conversation.title.toLowerCase();
      return title === normalizedName || (normalizedUsername && title.includes(normalizedUsername));
    }) ?? null
  );
}

function markOwnMessages(messages: MessageItem[], userId: string | null): MessageItem[] {
  if (!userId) {
    return messages;
  }

  return messages.map((message) => ({
    ...message,
    isOwn: message.senderId === userId || message.isOwn,
  }));
}

function preserveMessageOwnership(
  updated: MessageItem,
  previous: MessageItem | undefined,
  userId: string | null,
): MessageItem {
  const isOwn = previous?.isOwn ?? (userId ? updated.senderId === userId : updated.isOwn);

  return { ...updated, isOwn };
}

type ChatPageProps = {
  onSessionExpired: () => void;
};

export default function ChatPage({ onSessionExpired }: ChatPageProps) {
  const [user, setUser] = useState<unknown | null>(() => getStoredUser());
  const workspaceName = getWorkspaceName(user);
  const workspaceShortName = getWorkspaceShortName(user);
  const selfLabel = `${getUserDisplayName(user)} (Yourself)`;

  const [mainView, setMainView] = useState<MainView>('chat');
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [teammates, setTeammates] = useState<TeammateItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [draft, setDraft] = useState('');
  const [draftError, setDraftError] = useState('');
  const [typingLabel, setTypingLabel] = useState('');
  const [threadLoading, setThreadLoading] = useState(false);
  const [threadError, setThreadError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState('');
  const [panelNotifications, setPanelNotifications] = useState<NotificationItem[]>([]);
  const [panelPendingFriends, setPanelPendingFriends] = useState<PendingFriendItem[]>([]);

  const [activityNotifications, setActivityNotifications] = useState<NotificationItem[]>([]);
  const [activityPendingFriends, setActivityPendingFriends] = useState<PendingFriendItem[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState('');

  const [savedItems, setSavedItems] = useState<SavedMessageItem[]>([]);
  const [savedLoading, setSavedLoading] = useState(false);
  const [savedError, setSavedError] = useState('');

  const [fileItems, setFileItems] = useState<FileItem[]>([]);
  const [fileFilter, setFileFilter] = useState<FileFilter>('all');
  const [filesLoading, setFilesLoading] = useState(false);
  const [filesError, setFilesError] = useState('');

  const [calendarEvents, setCalendarEvents] = useState<CalendarEventItem[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarError, setCalendarError] = useState('');

  const [hubsChannels, setHubsChannels] = useState<import('../shared/features').ChannelItem[]>([]);
  const [hubsInvites, setHubsInvites] = useState<import('../shared/features').HubInviteItem[]>([]);
  const [hubsFriends, setHubsFriends] = useState<import('../shared/features').FriendItem[]>([]);
  const [hubsLoading, setHubsLoading] = useState(false);
  const [hubsError, setHubsError] = useState('');

  const [newConversationOpen, setNewConversationOpen] = useState(false);

  const markReadTimerRef = useRef<number | null>(null);
  const refreshConversationsTimerRef = useRef<number | null>(null);
  const draftSaveTimerRef = useRef<number | null>(null);
  const typingStopTimerRef = useRef<number | null>(null);
  const typingLabelTimerRef = useRef<number | null>(null);
  const lastSavedDraftRef = useRef('');
  const isTypingActiveRef = useRef(false);
  const selectedIdRef = useRef<string | null>(null);
  const userIdRef = useRef<string | null>(null);

  selectedIdRef.current = selectedId;
  userIdRef.current = getUserId(user);

  const selectedConversation = useMemo(
    () => conversations.find((item) => item.id === selectedId) ?? null,
    [conversations, selectedId],
  );

  const handleUnauthorized = useCallback(
    (status?: number) => {
      if (status === 401) {
        onSessionExpired();
        return true;
      }

      return false;
    },
    [onSessionExpired],
  );

  const refreshUnreadCount = useCallback(async () => {
    const result = await loadUnreadCount();

    if (handleUnauthorized(result.status)) {
      return;
    }

    if (result.ok) {
      setUnreadCount(result.data.count);
    }
  }, [handleUnauthorized]);

  const loadActivityData = useCallback(async () => {
    setActivityLoading(true);
    setActivityError('');

    const [notificationsResult, pendingResult] = await Promise.all([
      loadNotifications(),
      loadPendingFriends(),
    ]);

    if (handleUnauthorized(notificationsResult.status ?? pendingResult.status)) {
      return;
    }

    if (!notificationsResult.ok) {
      setActivityError(notificationsResult.error);
      setActivityLoading(false);
      return;
    }

    setActivityNotifications(notificationsResult.data);
    setActivityPendingFriends(pendingResult.ok ? pendingResult.data : []);
    setActivityLoading(false);
  }, [handleUnauthorized]);

  const loadBellPanel = useCallback(
    async (markAllRead: boolean) => {
      setNotificationsLoading(true);
      setNotificationsError('');

      const { notifications, pending } = markAllRead
        ? await loadBellPanelData()
        : await refreshBellPanelData();

      if (handleUnauthorized(notifications.status ?? pending.status)) {
        return;
      }

      if (!notifications.ok) {
        setNotificationsError(notifications.error);
        setNotificationsLoading(false);
        return;
      }

      setPanelNotifications(notifications.data);
      setPanelPendingFriends(pending.ok ? pending.data : []);
      setNotificationsLoading(false);
      void refreshUnreadCount();
    },
    [handleUnauthorized, refreshUnreadCount],
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');

    const meResult = await getCurrentUser();

    if (!meResult.ok) {
      if (handleUnauthorized(meResult.status)) {
        return;
      }
    } else {
      setUser(meResult.data.user ?? meResult.data);
    }

    const [bootstrap, membersResult] = await Promise.all([
      loadChatBootstrap(),
      loadOrganizationMembers(),
    ]);

    const { conversations: conversationsResult, unreadCount: unreadCountResult } = bootstrap;

    if (!conversationsResult.ok) {
      if (handleUnauthorized(conversationsResult.status)) {
        return;
      }

      setError(conversationsResult.error);
      setConversations([]);
      setLoading(false);
      return;
    }

    setConversations(sortConversations(conversationsResult.data.conversations));

    if (unreadCountResult.ok) {
      setUnreadCount(unreadCountResult.data.count);
    } else if (handleUnauthorized(unreadCountResult.status)) {
      return;
    }

    if (membersResult.ok) {
      setTeammates(membersResult.data);
    }

    setLoading(false);
  }, [handleUnauthorized]);

  const loadThread = useCallback(
    async (conversationId: string) => {
      setThreadLoading(true);
      setThreadError('');
      setDraftError('');

      const [bootstrapResult, draftResult] = await Promise.all([
        loadConversationBootstrap(conversationId),
        loadMessageDraft(conversationId),
      ]);

      if (handleUnauthorized(bootstrapResult.status ?? draftResult.status)) {
        return;
      }

      if (!bootstrapResult.ok) {
        setThreadError(bootstrapResult.error);
        setMessages([]);
        setThreadLoading(false);
        return;
      }

      setMessages(markOwnMessages(bootstrapResult.data.messages, getUserId(user)));

      if (draftResult.ok) {
        setDraft(draftResult.data.content);
        lastSavedDraftRef.current = draftResult.data.content;
      } else if (!draftResult.ok && draftResult.status !== 404) {
        setDraftError(draftResult.error);
      } else {
        setDraft('');
      }

      setThreadLoading(false);

      if (markReadTimerRef.current) {
        window.clearTimeout(markReadTimerRef.current);
      }

      markReadTimerRef.current = window.setTimeout(() => {
        void markConversationRead(conversationId).then((result) => {
          handleUnauthorized(result.status);
          void refreshUnreadCount();
        });
      }, 100);
    },
    [handleUnauthorized, refreshUnreadCount, user],
  );

  const loadSavedData = useCallback(async () => {
    setSavedLoading(true);
    setSavedError('');

    const result = await loadSavedMessages();

    if (handleUnauthorized(result.status)) {
      setSavedLoading(false);
      return;
    }

    if (!result.ok) {
      setSavedError(result.error);
      setSavedLoading(false);
      return;
    }

    setSavedItems(result.data);
    setSavedLoading(false);
  }, [handleUnauthorized]);

  const loadFilesData = useCallback(
    async (filter: FileFilter) => {
      setFilesLoading(true);
      setFilesError('');

      const result = await loadFiles(filter);

      if (handleUnauthorized(result.status)) {
        return;
      }

      if (!result.ok) {
        setFilesError(result.error);
        setFilesLoading(false);
        return;
      }

      setFileItems(result.data);
      setFilesLoading(false);
    },
    [handleUnauthorized],
  );

  const loadCalendarData = useCallback(async () => {
    setCalendarLoading(true);
    setCalendarError('');

    const result = await loadCalendarEvents();

    if (handleUnauthorized(result.status)) {
      return;
    }

    if (!result.ok) {
      setCalendarError(result.error);
      setCalendarLoading(false);
      return;
    }

    setCalendarEvents(result.data);
    setCalendarLoading(false);
  }, [handleUnauthorized]);

  const loadHubsData = useCallback(async () => {
    setHubsLoading(true);
    setHubsError('');

    const [channelsResult, invitesResult, friendsResult] = await Promise.all([
      loadChannels(),
      loadHubInvites(),
      loadFriends(),
    ]);

    if (handleUnauthorized(channelsResult.status ?? invitesResult.status ?? friendsResult.status)) {
      return;
    }

    if (!channelsResult.ok) {
      setHubsError(channelsResult.error);
      setHubsLoading(false);
      return;
    }

    setHubsChannels(channelsResult.data);
    setHubsInvites(invitesResult.ok ? invitesResult.data : []);
    setHubsFriends(friendsResult.ok ? friendsResult.data : []);
    setHubsLoading(false);
  }, [handleUnauthorized]);

  const refreshConversations = useCallback(async () => {
    const result = await loadConversations();

    if (handleUnauthorized(result.status)) {
      return;
    }

    if (result.ok) {
      setConversations(sortConversations(result.data.conversations));
    }
  }, [handleUnauthorized]);

  const scheduleConversationsRefresh = useCallback(() => {
    if (refreshConversationsTimerRef.current) {
      window.clearTimeout(refreshConversationsTimerRef.current);
    }

    refreshConversationsTimerRef.current = window.setTimeout(() => {
      void refreshConversations();
    }, 400);
  }, [refreshConversations]);

  const handleRealtimeEvent = useCallback(
    (rawEvent: unknown) => {
      const event = parseRealtimeEvent(rawEvent);
      const type = event.type;
      const conversationId = extractConversationId(event.payload);
      const incomingMessage = extractMessageFromRealtimePayload(event.payload);
      const activeConversationId = selectedIdRef.current;
      const userId = userIdRef.current;

      if (incomingMessage && conversationId && isNewMessageEvent(type)) {
        if (conversationId === activeConversationId) {
          setMessages((current) => {
            if (current.some((message) => message.id === incomingMessage.id)) {
              return current;
            }

            return [...current, markOwnMessages([incomingMessage], userId)[0]];
          });
        }

        scheduleConversationsRefresh();
        void refreshUnreadCount();
        return;
      }

      if (incomingMessage && conversationId && isMessageUpdateEvent(type)) {
        if (conversationId === activeConversationId) {
          setMessages((current) =>
            current.map((message) =>
              message.id === incomingMessage.id
                ? preserveMessageOwnership(incomingMessage, message, userId)
                : message,
            ),
          );
        }

        scheduleConversationsRefresh();
        return;
      }

      if (isMessageDeleteEvent(type) && conversationId === activeConversationId) {
        const messageId =
          typeof event.payload === 'object' &&
          event.payload &&
          'messageId' in event.payload &&
          typeof (event.payload as { messageId: unknown }).messageId === 'string'
            ? (event.payload as { messageId: string }).messageId
            : incomingMessage?.id;

        if (messageId) {
          setMessages((current) => current.filter((message) => message.id !== messageId));
        }

        scheduleConversationsRefresh();
        return;
      }

      if (isConversationUpdateEvent(type)) {
        scheduleConversationsRefresh();
        return;
      }

      if (isUnreadUpdateEvent(type)) {
        void refreshUnreadCount();

        if (notificationsOpen) {
          void loadBellPanel(false);
        }
        return;
      }

      if (isPresenceEvent(type)) {
        if (extractPresenceUpdate(event.payload)) {
          scheduleConversationsRefresh();
        }
        return;
      }

      if (isTypingEvent(type) || isTypingChannelEvent(rawEvent)) {
        const typing = extractTypingUpdate(event.payload, activeConversationId);

        if (!typing || typing.userId === userId) {
          return;
        }

        if (activeConversationId && typing.conversationId !== activeConversationId) {
          return;
        }

        if (typingLabelTimerRef.current) {
          window.clearTimeout(typingLabelTimerRef.current);
        }

        if (!typing.isTyping) {
          setTypingLabel('');
          return;
        }

        setTypingLabel(
          typing.username ? `${typing.username} is typing...` : 'Someone is typing...',
        );

        typingLabelTimerRef.current = window.setTimeout(() => {
          setTypingLabel('');
        }, TYPING_LABEL_MS);
        return;
      }

      if (type === 'unknown' && incomingMessage && conversationId) {
        if (conversationId === activeConversationId) {
          setMessages((current) => {
            if (current.some((message) => message.id === incomingMessage.id)) {
              return current;
            }

            return [...current, markOwnMessages([incomingMessage], userId)[0]];
          });
        }

        scheduleConversationsRefresh();
        void refreshUnreadCount();
      }
    },
    [loadBellPanel, notificationsOpen, refreshUnreadCount, scheduleConversationsRefresh],
  );

  useEffect(() => {
    void startRealtime();

    const unsubscribe = subscribeRealtimeEvent(handleRealtimeEvent);

    return () => {
      unsubscribe();
      void stopRealtime();

      if (refreshConversationsTimerRef.current) {
        window.clearTimeout(refreshConversationsTimerRef.current);
      }

      if (draftSaveTimerRef.current) {
        window.clearTimeout(draftSaveTimerRef.current);
      }

      if (typingStopTimerRef.current) {
        window.clearTimeout(typingStopTimerRef.current);
      }

      if (typingLabelTimerRef.current) {
        window.clearTimeout(typingLabelTimerRef.current);
      }
    };
  }, [handleRealtimeEvent]);

  const stopTyping = useCallback((conversationId: string) => {
    if (typingStopTimerRef.current) {
      window.clearTimeout(typingStopTimerRef.current);
      typingStopTimerRef.current = null;
    }

    if (!isTypingActiveRef.current) {
      return;
    }

    isTypingActiveRef.current = false;
    void sendTypingUpdate(conversationId, false);
  }, []);

  const pulseTyping = useCallback(
    (conversationId: string) => {
      if (!isTypingActiveRef.current) {
        isTypingActiveRef.current = true;
        void sendTypingUpdate(conversationId, true);
      }

      if (typingStopTimerRef.current) {
        window.clearTimeout(typingStopTimerRef.current);
      }

      typingStopTimerRef.current = window.setTimeout(() => {
        stopTyping(conversationId);
      }, TYPING_STOP_MS);
    },
    [stopTyping],
  );

  const handleDraftChange = useCallback(
    (value: string) => {
      setDraft(value);

      if (!selectedId) {
        return;
      }

      if (value.trim()) {
        pulseTyping(selectedId);
      } else {
        stopTyping(selectedId);
      }
    },
    [pulseTyping, selectedId, stopTyping],
  );

  useEffect(() => {
    if (!selectedId) {
      return;
    }

    if (draftSaveTimerRef.current) {
      window.clearTimeout(draftSaveTimerRef.current);
    }

    draftSaveTimerRef.current = window.setTimeout(() => {
      if (draft === lastSavedDraftRef.current) {
        return;
      }

      if (!draft.trim()) {
        if (lastSavedDraftRef.current.trim()) {
          void clearChatDraft(selectedId).then((result) => {
            if (result.ok) {
              lastSavedDraftRef.current = '';
            }
          });
        }

        return;
      }

      void saveChatDraft(selectedId, draft).then((result) => {
        if (result.ok) {
          lastSavedDraftRef.current = draft;
        }
      });
    }, DRAFT_SAVE_MS);

    return () => {
      if (draftSaveTimerRef.current) {
        window.clearTimeout(draftSaveTimerRef.current);
      }
    };
  }, [draft, selectedId]);

  useEffect(() => {
    setTypingLabel('');
    lastSavedDraftRef.current = '';

    return () => {
      if (selectedId && isTypingActiveRef.current) {
        stopTyping(selectedId);
      }
    };
  }, [selectedId, stopTyping]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void refreshUnreadCount();
    }, UNREAD_POLL_MS);

    return () => window.clearInterval(intervalId);
  }, [refreshUnreadCount]);

  useEffect(() => {
    if (!notificationsOpen) {
      return;
    }

    void loadBellPanel(true);

    const intervalId = window.setInterval(() => {
      void loadBellPanel(false);
    }, BELL_POLL_MS);

    return () => window.clearInterval(intervalId);
  }, [notificationsOpen, loadBellPanel]);

  useEffect(() => {
    if (mainView !== 'activity') {
      return;
    }

    void loadActivityData();
  }, [mainView, loadActivityData]);

  useEffect(() => {
    if (mainView === 'saved') {
      void loadSavedData();
    }

    if (mainView === 'files') {
      void loadFilesData(fileFilter);
    }

    if (mainView === 'calendar') {
      void loadCalendarData();
    }

    if (mainView === 'hubs') {
      void loadHubsData();
    }
  }, [fileFilter, loadCalendarData, loadFilesData, loadSavedData, loadHubsData, mainView]);

  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      setDraft('');
      setThreadError('');
      return;
    }

    void loadThread(selectedId);
  }, [selectedId, loadThread]);

  useEffect(
    () => () => {
      if (markReadTimerRef.current) {
        window.clearTimeout(markReadTimerRef.current);
      }
    },
    [],
  );

  const handleSelectConversation = (conversationId: string) => {
    setMainView('chat');
    setSelectedId(conversationId);
  };

  const handleOpenDirectChat = useCallback(
    async (userId: string) => {
      const result = await createDirectChat(userId);

      if (!result.ok) {
        if (handleUnauthorized(result.status)) {
          return;
        }

        setError(result.error);
        return;
      }

      handleSelectConversation(result.data.conversationId);
      void loadData();
    },
    [handleUnauthorized, loadData],
  );

  const handleSelectPerson = async (person: SearchPerson) => {
    const existing = findConversationForPerson(conversations, person);

    if (existing) {
      handleSelectConversation(existing.id);
      return;
    }

    await handleOpenDirectChat(person.id);
  };

  const handleMessageSelf = () => {
    const selfConversation = conversations.find((conversation) => conversation.isSelf);

    if (selfConversation) {
      handleSelectConversation(selfConversation.id);
    }
  };

  const handleTeammateSelect = async (memberId: string) => {
    const teammate = teammates.find((member) => member.id === memberId);

    if (!teammate) {
      return;
    }

    const existing = conversations.find(
      (conversation) =>
        conversation.kind === 'direct' &&
        conversation.title.toLowerCase() === teammate.name.toLowerCase(),
    );

    if (existing) {
      handleSelectConversation(existing.id);
      return;
    }

    await handleOpenDirectChat(memberId);
  };

  const handleNotificationClick = (notification: NotificationItem) => {
    const conversationId = resolveNotificationConversationId(notification, conversations);

    if (!conversationId) {
      return;
    }

    setNotificationsOpen(false);
    handleSelectConversation(conversationId);
  };

  const handleSendMessage = async (replyToId?: string) => {
    if (!selectedId || !draft.trim() || isSending) {
      return;
    }

    setIsSending(true);
    setDraftError('');

    const content = draft.trim();
    const result = await sendChatMessage(selectedId, content, replyToId);

    if (handleUnauthorized(result.status)) {
      setIsSending(false);
      return;
    }

    if (!result.ok) {
      setDraftError(result.error);
      setIsSending(false);
      return;
    }

    setDraft('');
    lastSavedDraftRef.current = '';
    stopTyping(selectedId);
    void clearChatDraft(selectedId);
    setIsSending(false);
    void loadThread(selectedId);
  };

  const handleAddReaction = async (messageId: string, emoji: string) => {
    if (!selectedId) {
      return;
    }

    const result = await addMessageReaction(selectedId, messageId, emoji);

    if (!result.ok) {
      if (handleUnauthorized(result.status)) {
        return;
      }

      setThreadError(result.error);
      return;
    }

    setMessages((current) =>
      current.map((message) =>
        message.id === messageId
          ? preserveMessageOwnership(result.data, message, getUserId(user))
          : message,
      ),
    );
  };

  const showActionMessage = (message: string) => {
    setActionMessage(message);
    window.setTimeout(() => setActionMessage(''), 3000);
  };

  const handleEditMessage = async (messageId: string, content: string) => {
    if (!selectedId) {
      return;
    }

    const result = await editChatMessage(selectedId, messageId, content);

    if (!result.ok) {
      if (handleUnauthorized(result.status)) {
        return;
      }

      setThreadError(result.error);
      return;
    }

    setMessages((current) =>
      current.map((message) =>
        message.id === messageId
          ? preserveMessageOwnership(result.data, message, getUserId(user))
          : message,
      ),
    );
    showActionMessage('Message updated.');
  };

  const handleDeleteMessage = async (messageId: string, scope: 'me' | 'everyone') => {
    if (!selectedId) {
      return;
    }

    const result = await deleteChatMessage(selectedId, messageId, scope);

    if (!result.ok) {
      if (handleUnauthorized(result.status)) {
        return;
      }

      setThreadError(result.error);
      return;
    }

    if (result.data.scope === 'everyone') {
      setMessages((current) =>
        current.map((message) =>
          message.id === messageId
            ? { ...message, content: 'This message was deleted.' }
            : message,
        ),
      );
    } else {
      setMessages((current) => current.filter((message) => message.id !== messageId));
    }

    showActionMessage(scope === 'everyone' ? 'Message deleted for everyone.' : 'Message deleted.');
  };

  const handleReplyMessage = (_messageId: string) => {
    showActionMessage('Reply coming soon.');
  };

  const handleReplyInThread = (_messageId: string) => {
    showActionMessage('Reply in thread coming soon.');
  };

  const handleForwardMessage = async (
    messageId: string,
    targetConversationId: string,
  ): Promise<string | null> => {
    if (!selectedId) {
      return 'No conversation selected.';
    }

    const result = await forwardChatMessage(selectedId, messageId, [targetConversationId]);

    if (!result.ok) {
      if (handleUnauthorized(result.status)) {
        return result.error;
      }

      return result.error;
    }

    const conversationsResult = await loadConversations();

    if (conversationsResult.ok) {
      setConversations(sortConversations(conversationsResult.data.conversations));
    }

    setMainView('chat');

    if (selectedId === targetConversationId) {
      const forwarded = markOwnMessages(result.data.messages, getUserId(user));

      if (forwarded.length > 0) {
        setMessages((current) => {
          const existingIds = new Set(current.map((message) => message.id));
          const next = forwarded.filter((message) => !existingIds.has(message.id));
          return next.length > 0 ? [...current, ...next] : current;
        });
      }

      void loadThread(targetConversationId);
    } else {
      setSelectedId(targetConversationId);
    }

    showActionMessage('Message forwarded.');
    return null;
  };

  const handlePinMessage = async (messageId: string, isPinned: boolean) => {
    if (!selectedId) {
      return;
    }

    const result = isPinned
      ? await unpinChatMessage(selectedId, messageId)
      : await pinChatMessage(selectedId, messageId);

    if (!result.ok) {
      if (handleUnauthorized(result.status)) {
        return;
      }

      setThreadError(result.error);
      return;
    }

    setMessages((current) =>
      current.map((message) =>
        message.id === messageId
          ? preserveMessageOwnership(result.data, message, getUserId(user))
          : message,
      ),
    );
    showActionMessage(isPinned ? 'Message unpinned.' : 'Message pinned.');
  };

  const handleSaveMessage = async (messageId: string) => {
    if (!selectedId) {
      return;
    }

    const result = await saveChatMessage(selectedId, messageId);

    if (!result.ok) {
      if (handleUnauthorized(result.status)) {
        return;
      }

      setThreadError(result.error);
      return;
    }

    setSavedItems(result.data);
    setSavedError('');
    showActionMessage('Message saved.');
  };

  const handleUnsaveMessage = async (messageId: string) => {
    if (!selectedId) {
      return;
    }

    const result = await unsaveChatMessage(selectedId, messageId);

    if (!result.ok) {
      if (handleUnauthorized(result.status)) {
        return;
      }

      setThreadError(result.error);
      return;
    }

    setSavedItems(result.data);
    setSavedError('');
    showActionMessage('Message unsaved.');
  };

  const handleRespondFriendRequest = async (userId: string, status: 'ACCEPTED' | 'DECLINED') => {
    const result = await respondFriendRequest(userId, status);

    if (!result.ok) {
      if (handleUnauthorized(result.status)) {
        return;
      }
      setActivityError(result.error);
      return;
    }

    showActionMessage(`Friend request ${status.toLowerCase()}.`);
    void loadActivityData();
  };

  const renderMainPanel = () => {
    if (mainView === 'activity') {
      return (
        <ActivityView
          notifications={activityNotifications}
          pendingFriends={activityPendingFriends}
          loading={activityLoading}
          error={activityError}
          onRetry={() => {
            void loadActivityData();
          }}
          onNotificationClick={handleNotificationClick}
          onRespondFriend={(userId, status) => {
            void handleRespondFriendRequest(userId, status);
          }}
        />
      );
    }

    if (mainView === 'saved') {
      return (
        <SavedView
          items={savedItems}
          loading={savedLoading}
          error={savedError}
          onRetry={() => {
            void loadSavedData();
          }}
          onSelect={(item) => {
            if (item.conversationId) {
              handleSelectConversation(item.conversationId);
            }
          }}
        />
      );
    }

    if (mainView === 'files') {
      return (
        <FilesView
          items={fileItems}
          loading={filesLoading}
          error={filesError}
          activeFilter={fileFilter}
          onFilterChange={(filter) => {
            setFileFilter(filter);
          }}
          onRetry={() => {
            void loadFilesData(fileFilter);
          }}
        />
      );
    }

    if (mainView === 'calendar') {
      return (
        <CalendarView
          events={calendarEvents}
          loading={calendarLoading}
          error={calendarError}
          onRetry={() => {
            void loadCalendarData();
          }}
        />
      );
    }

    if (mainView === 'hubs') {
      return (
        <HubsView
          channels={hubsChannels}
          invites={hubsInvites}
          friends={hubsFriends}
          loading={hubsLoading}
          error={hubsError}
          onRetry={() => {
            void loadHubsData();
          }}
          onAcceptInvite={async (channelId) => {
            const result = await acceptHubInvite(channelId);
            if (result.ok) {
              void loadHubsData();
              showActionMessage('Invite accepted.');
            } else {
              setHubsError(result.error);
            }
          }}
          onOpenChannel={(_channelId) => {
            showActionMessage('Open channel coming soon.');
          }}
        />
      );
    }

    if (selectedConversation) {
      return (
        <ConversationThread
          conversation={selectedConversation}
          conversations={conversations}
          messages={messages}
          draft={draft}
          loading={threadLoading}
          error={threadError}
          draftError={draftError}
          typingLabel={typingLabel}
          actionMessage={actionMessage}
          isSending={isSending}
          onDraftChange={handleDraftChange}
          onSend={(replyToMessageId) => {
            void handleSendMessage(replyToMessageId);
          }}
          onUnauthorized={handleUnauthorized}
          currentUserId={getUserId(user)}
          onAddReaction={(messageId, emoji) => {
            void handleAddReaction(messageId, emoji);
          }}
          onReplyMessage={handleReplyMessage}
          onReplyInThread={handleReplyInThread}
          onEditMessage={(messageId, content) => {
            void handleEditMessage(messageId, content);
          }}
          onDeleteMessage={(messageId, scope) => {
            void handleDeleteMessage(messageId, scope);
          }}
          onForwardMessage={(messageId, targetConversationId) =>
            handleForwardMessage(messageId, targetConversationId)
          }
          onPinMessage={(messageId, isPinned) => {
            void handlePinMessage(messageId, isPinned);
          }}
          onSaveMessage={(messageId) => {
            void handleSaveMessage(messageId);
          }}
          onUnsaveMessage={(messageId) => {
            void handleUnsaveMessage(messageId);
          }}
        />
      );
    }

    return (
      <ChatWelcome
        workspaceName={workspaceShortName}
        onFindPeople={() => setNewConversationOpen(true)}
      />
    );
  };

  return (
    <div className="flex h-full bg-app-chat-bg">
      <NavRail
        unreadCount={unreadCount}
        user={user}
        activeView={mainView}
        onNavigate={setMainView}
      />

      <ChatSidebar
        workspaceName={workspaceName}
        selfLabel={selfLabel}
        conversations={conversations}
        teammates={teammates}
        unreadCount={unreadCount}
        loading={loading}
        error={error}
        selectedId={selectedId}
        notificationsOpen={notificationsOpen}
        notificationsLoading={notificationsLoading}
        notificationsError={notificationsError}
        panelNotifications={panelNotifications}
        panelPendingFriends={panelPendingFriends}
        onSelect={handleSelectConversation}
        onRetry={() => {
          void loadData();
        }}
        onToggleNotifications={() => {
          setNotificationsOpen((current) => !current);
        }}
        onCloseNotifications={() => setNotificationsOpen(false)}
        onTeammateSelect={handleTeammateSelect}
        onSelectPerson={(person) => {
          void handleSelectPerson(person);
        }}
        onMessageSelf={handleMessageSelf}
        onNotificationClick={handleNotificationClick}
        newConversationOpen={newConversationOpen}
        onNewConversationOpenChange={setNewConversationOpen}
        onMessageUser={(userId) => {
          void handleOpenDirectChat(userId);
        }}
      />

      <main className="relative flex min-w-0 flex-1 flex-col">
        {renderMainPanel()}
      </main>
    </div>
  );
}
