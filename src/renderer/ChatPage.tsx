import { useCallback, useEffect, useMemo, useRef, useState, startTransition } from 'react';
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
  acceptHubInviteById,
  addMessageReaction,
  createDirectChat,
  createGroupConversation,
  createHubChannel,
  clearConversationHistory,
  deleteConversation,
  declineHubInvite,
  deleteChatMessage,
  editChatMessage,
  forwardChatMessage,
  loadCalendarEvents,
  loadChannels,
  loadChatBootstrap,
  hydrateThreadReplyRegistry,
  loadConversationBootstrap,
  loadConversationNotificationSettings,
  loadConversations,
  loadFiles,
  loadFriends,
  loadHubInvites,
  loadMessageDraft,
  loadMessageById,
  loadNotificationSettings,
  loadOrganizationMembers,
  loadPendingFriends,
  loadSavedMessages,
  loadUnreadCount,
  loadUserPresence,
  loadUserProfile,
  markConversationRead,
  markConversationUnread,
  markNotificationRead,
  openSelfConversation,
  pinChatMessage,
  refreshBellPanelData,
  openBellPanelData,
  saveChatDraft,
  saveChatMessage,
  saveNotificationSettings,
  scheduleConversationMessage,
  sendChatMessage,
  sendChatMediaMessage,
  sendChatFileMessage,
  sendTypingUpdate,
  setConversationFavorite,
  clearChatDraft,
  unpinChatMessage,
  updateConversationNotificationSettings,
  respondFriendRequest,
  unsaveChatMessage,
  votePoll,
} from './chatApi';
import { ActivityView } from './chat/ActivityView';
import { CalendarView } from './chat/CalendarView';
import { uploadChatFile } from './extrasApi';
import { ChatSidebar } from './chat/ChatSidebar';
import { ChatWelcome } from './chat/ChatWelcome';
import { ConversationThread } from './chat/ConversationThread';
import { FilesView } from './chat/FilesView';
import { HubsView } from './chat/HubsView';
import { NavRail } from './chat/NavRail';
import { SavedView } from './chat/SavedView';
import { ProfileSettingsView } from './chat/ProfileSettingsView';
import { OrganizationView } from './chat/OrganizationView';
import { OrganizationInviteModal } from './chat/OrganizationInviteModal';
import { NotificationStatusBanner } from './chat/NotificationStatusBanner';
import { PlanComplianceBanner } from './chat/PlanComplianceBanner';
import { loadOrgSubscription, loadPlanCompliance } from './organizationApi';
import {
  readPersistedConversationSnooze,
  writePersistedConversationSnooze,
} from './conversationSnoozeStorage';
import {
  readPersistedDirectChatMetadata,
  readPlanComplianceDismissed,
  writePersistedDirectChatMetadata,
  writePlanComplianceDismissed,
} from './directChatMetadataStorage';
import { clearProfileCache, readPeerProfile, writePeerProfile } from './profileCache';
import { useConfirm } from './ui/ConfirmDialog';
import { useToast } from './ui/Toast';
import type { ConversationItem, DirectChatMetadata } from '../shared/chat';
import { mapApiPresenceToStatus, mergeConversationDraftPreviews, seedDraftPreviewCache, buildPlaceholderDirectConversation, dedupeDirectConversations, mergeConversationLists, repairConversationPeerIds, patchDirectConversationMetadata, applyStoredDirectChatMetadata, findConversationByAnyId, findConversationForPeerUserId, reconcileDirectConversations, dropBrokenDirectConversations, isBrokenDirectTitle, readDirectPeerDisplayName, readConversationSnoozeState, sanitizeDirectDisplayName, withConversationSnoozed, buildConversationSnoozePayload, resolveConversationForMessage, resolveTypingConversationId, buildConversationListPreview } from '../shared/chat';
import type {
  MessageItem,
  NotificationItem,
  PendingFriendItem,
  TeammateItem,
} from '../shared/messages';
import type { GifPickerItem } from '../shared/gifs';
import { applyMessageReadReceipts, applyReactionPatch, buildScheduleMessageBody, clearThreadReplyRegistry, enrichMessageReplies, extractPeerLastReadMessageIds, filterMainChatMessages, findFirstUnreadMessageId, formatMessagePreview, isAlreadyDeletedForEveryoneError, markMessageDeletedForEveryone, mergeMessageUpdates, readLastReadMessageId, registerThreadReplyMessage, resolveNotificationAction, resolveNotificationConversationId, resolveThreadRootId } from '../shared/messages';
import type { AiTextResult } from '../shared/extras';
import { hoursToSnoozePreset, inferFlexIntent } from '../shared/extras';
import type { ProfileSettings } from '../shared/profile';
import { normalizeUserProfile, userCanManageOrganization } from '../shared/profile';
import { scheduleCalendarReminders } from './calendarReminders';
import {
  alertNewDesktopNotifications,
  peekNewNotifications,
  markNotificationSeen,
  seedNotificationSnapshot,
  showCalendarEventReminder,
  showIncomingMessageDesktopNotification,
} from './desktopNotifications';
import { enableDesktopPushNotifications, shouldDeliverDesktopNotifications } from './pushNotifications';
import {
  extractConversationIdFromRealtime,
  extractConversationMemberIds,
  extractMessageDeleteScope,
  extractMessageFromRealtimePayload,
  extractPresenceUpdate,
  extractReactionEvent,
  extractTypingUpdate,
  formatTypingIndicatorLabel,
  isConversationUpdateEvent,
  isSameTypingUser,
  isMessageDeleteEvent,
  isMessageUpdateEvent,
  isNewMessageEvent,
  isPresenceEvent,
  isReactionEvent,
  isTypingChannelEvent,
  isTypingEvent,
  isUnreadUpdateEvent,
  parseRealtimeEvent,
  type RealtimeConnectionStatus,
} from '../shared/realtime';
import { getUserAvatarUrl, getUserDisplayName, getUserId, getUserInitials, getWorkspaceName, getWorkspaceShortName, userInOrganization } from '../shared/user';
import { parseMeetingNotificationBody, type MeetingStartedPayload } from '../shared/calls';
import { useCallManager } from './callManager';
import { isUserCallChannelSubscribed } from './callSignaling';
import { CallOverlay } from './chat/CallOverlay';
import { MediaPreviewHost } from './chat/MediaPreviewHost';
import type { CallPanelLayout } from './call/CallFloatingPanel';
import { FlexAiPanel } from './chat/FlexAiPanel';
import {
  broadcastTypingIndicator,
  setTypingSignalingHandler,
  stopTypingSignaling,
  syncTypingSignalingSubscriptions,
} from './typingSignaling';
import {
  startRealtime,
  stopRealtime,
  subscribeRealtimeEvent,
  subscribeRealtimeStatus,
} from './realtimeApi';
import { startPresenceManager, stopPresenceManager } from './presenceManager';
import {
  getThreadCacheEntry,
  patchThreadCacheMessages,
  writeThreadCacheEntry,
  type ThreadCacheStore,
} from './threadCache';
import { appendThreadReply, clearThreadRepliesStore } from './threadRepliesStore';

// Background refresh intervals (not initial load time).
const UNREAD_POLL_MS = 120_000;
const BELL_POLL_MS = 30_000;
const NOTIFICATION_POLL_MS = 60_000;
const CALENDAR_POLL_MS = 5 * 60_000;
const DRAFT_SAVE_MS = 600;
const TYPING_STOP_MS = 3_000;
const TYPING_LABEL_MS = 5_000;
const THREAD_POLL_MS = 20_000;
const THREAD_POLL_CONNECTED_MS = 5_000;

type FileFilter = 'all' | 'images' | 'docs' | 'other';

type ConversationTypingState = {
  userIds: string[];
  namesByUserId: Record<string, string>;
};

function resolveTyperDisplayName(
  typing: { userId: string; username: string | null },
  teammates: TeammateItem[],
  conversations: ConversationItem[],
): string {
  return (
    typing.username?.trim() ||
    teammates.find((member) => member.id === typing.userId)?.name ||
    conversations.find((item) => item.peerUserId === typing.userId)?.title ||
    'Someone'
  );
}

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

function markOwnMessages(messages: MessageItem[], userId: string | null): MessageItem[] {
  if (!userId) {
    return messages;
  }

  return messages.map((message) => {
    const isOwn = message.senderId === userId || message.isOwn;
    return {
      ...message,
      isOwn,
      status: isOwn ? message.status ?? 'delivered' : message.status,
    };
  });
}

function commitMessages(
  messages: MessageItem[],
  userId: string | null,
  conversation?: Record<string, unknown> | null,
): MessageItem[] {
  const owned = markOwnMessages(messages, userId);
  const withReceipts = applyMessageReadReceipts(
    owned,
    extractPeerLastReadMessageIds(conversation ?? null, userId),
  );
  return enrichMessageReplies(filterMainChatMessages(withReceipts));
}

function appendMessage(current: MessageItem[], message: MessageItem, userId: string | null): MessageItem[] {
  const next = [...current, markOwnMessages([message], userId)[0]];
  return enrichMessageReplies(next);
}

function createLocalMessageId(): string {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function isLocalMessageId(id: string): boolean {
  return id.startsWith('local-');
}

function withDeliveredStatus(message: MessageItem): MessageItem {
  return {
    ...message,
    isOwn: true,
    status: message.status === 'seen' ? 'seen' : 'delivered',
  };
}

function replaceLocalMessage(
  current: MessageItem[],
  localId: string,
  incoming: MessageItem,
  userId: string | null,
): MessageItem[] {
  const delivered = markOwnMessages([withDeliveredStatus(incoming)], userId)[0];

  if (current.some((message) => message.id === delivered.id)) {
    return current.filter((message) => message.id !== localId);
  }

  return enrichMessageReplies(
    current.map((message) =>
      message.id === localId
        ? {
            ...delivered,
            createdAt: message.createdAt,
            media: delivered.media.length > 0 ? delivered.media : message.media,
          }
        : message,
    ),
  );
}

function mergeLocalPendingMessages(
  serverMessages: MessageItem[],
  current: MessageItem[],
): MessageItem[] {
  const pending = current.filter((message) => isLocalMessageId(message.id));

  if (pending.length === 0) {
    return serverMessages;
  }

  const extras = pending.filter((local) => {
    return !serverMessages.some(
      (message) =>
        message.isOwn &&
        message.content === local.content &&
        message.media[0]?.url === local.media[0]?.url,
    );
  });

  return extras.length > 0 ? [...serverMessages, ...extras] : serverMessages;
}

function bumpThreadReplyCount(
  current: MessageItem[],
  threadRootId: string,
): MessageItem[] {
  return current.map((message) =>
    message.id === threadRootId
      ? { ...message, threadReplyCount: (message.threadReplyCount ?? 0) + 1 }
      : message,
  );
}

function mergeIncomingMessage(
  current: MessageItem[],
  incoming: MessageItem,
  userId: string | null,
): MessageItem[] {
  const threadRootId = resolveThreadRootId(incoming, userId);
  if (threadRootId) {
    return bumpThreadReplyCount(
      current.filter((message) => message.id !== incoming.id),
      threadRootId,
    );
  }

  if (current.some((message) => message.id === incoming.id)) {
    return current;
  }

  if (incoming.isOwn || incoming.senderId === userId) {
    const localIndex = current.findIndex(
      (message) =>
        isLocalMessageId(message.id) &&
        message.isOwn &&
        message.content === incoming.content &&
        message.media[0]?.url === incoming.media[0]?.url,
    );

    if (localIndex >= 0) {
      const next = [...current];
      next[localIndex] = {
        ...markOwnMessages([withDeliveredStatus(incoming)], userId)[0],
        createdAt: current[localIndex].createdAt,
      };
      return enrichMessageReplies(next);
    }
  }

  return appendMessage(current, incoming, userId);
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
  const toast = useToast();
  const confirm = useConfirm();
  const [user, setUser] = useState<unknown | null>(() => getStoredUser());
  const workspaceName = getWorkspaceName(user);
  const workspaceShortName = getWorkspaceShortName(user);
  const selfLabel = `${getUserDisplayName(user)} (Yourself)`;

  const [mainView, setMainView] = useState<MainView>('chat');
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [conversationPlaceholders, setConversationPlaceholders] = useState<Record<string, ConversationItem>>({});
  const [teammates, setTeammates] = useState<TeammateItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusMessageId, setFocusMessageId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [draft, setDraft] = useState('');
  const [draftError, setDraftError] = useState('');
  const [typingByConversation, setTypingByConversation] = useState<
    Record<string, ConversationTypingState>
  >({});
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeConnectionStatus>('idle');
  const [threadLoading, setThreadLoading] = useState(false);
  const [threadError, setThreadError] = useState('');
  const [threadUnreadAnchorId, setThreadUnreadAnchorId] = useState<string | null>(null);
  const [activeHubDetails, setActiveHubDetails] = useState<Record<string, unknown> | null>(null);
  const [pinnedMessageIds, setPinnedMessageIds] = useState<string[]>([]);
  const [pinningConversationId, setPinningConversationId] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [flexAiOpen, setFlexAiOpen] = useState(false);
  const [callPanelLayout, setCallPanelLayout] = useState<CallPanelLayout>('floating');
  const [messageScrollRestoreKey, setMessageScrollRestoreKey] = useState(0);
  const callPhaseRef = useRef<'idle' | 'outgoing' | 'incoming' | 'connecting' | 'active' | 'ending'>('idle');

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
  const savedMessageIds = useMemo(() => {
    const ids = new Set<string>();

    for (const item of savedItems) {
      if (item.messageId) {
        ids.add(item.messageId);
      }
    }

    return ids;
  }, [savedItems]);

  const [fileItems, setFileItems] = useState<FileItem[]>([]);
  const [fileFilter, setFileFilter] = useState<FileFilter>('all');
  const [filesLoading, setFilesLoading] = useState(false);
  const [filesError, setFilesError] = useState('');

  const [calendarEvents, setCalendarEvents] = useState<CalendarEventItem[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarError, setCalendarError] = useState('');
  const [highlightCalendarEventId, setHighlightCalendarEventId] = useState<string | null>(null);
  const [openingTeammateId, setOpeningTeammateId] = useState<string | null>(null);
  const [directChatMetadata, setDirectChatMetadata] = useState<Record<string, DirectChatMetadata>>(
    () => readPersistedDirectChatMetadata(),
  );
  const directChatMetadataRef = useRef<Record<string, DirectChatMetadata>>({});
  const [notificationSettings, setNotificationSettings] = useState<ProfileSettings | null>(null);
  const [planComplianceRules, setPlanComplianceRules] = useState<string[]>([]);
  const [planComplianceDismissed, setPlanComplianceDismissed] = useState(() =>
    readPlanComplianceDismissed(),
  );

  const [hubsChannels, setHubsChannels] = useState<import('../shared/features').ChannelItem[]>([]);
  const [hubsInvites, setHubsInvites] = useState<import('../shared/features').HubInviteItem[]>([]);
  const [hubsFriends, setHubsFriends] = useState<import('../shared/features').FriendItem[]>([]);
  const [hubsLoading, setHubsLoading] = useState(false);
  const [joiningChannelId, setJoiningChannelId] = useState<string | null>(null);
  const [hubsError, setHubsError] = useState('');

  const [newConversationOpen, setNewConversationOpen] = useState(false);

  const markReadTimerRef = useRef<number | null>(null);
  const refreshConversationsTimerRef = useRef<number | null>(null);
  const draftSaveTimerRef = useRef<number | null>(null);
  const typingStopTimerRef = useRef<number | null>(null);
  const typingTimersRef = useRef<Map<string, number>>(new Map());
  const lastSavedDraftRef = useRef('');
  const draftRef = useRef('');
  const draftPreviewsRef = useRef<Record<string, string>>({});
  const threadCacheRef = useRef<ThreadCacheStore>({});
  const prefetchInFlightRef = useRef<Set<string>>(new Set());
  const prefetchTimerRef = useRef<Record<string, number>>({});
  const bootstrapStartedRef = useRef(false);
  const isTypingActiveRef = useRef(false);
  const selectedIdRef = useRef<string | null>(null);
  const userIdRef = useRef<string | null>(null);
  const notificationSettingsRef = useRef<ProfileSettings | null>(null);
  const conversationSnoozeRef = useRef<Record<string, boolean>>(readPersistedConversationSnooze());
  const handleNotificationClickRef = useRef<(notification: NotificationItem) => void>(() => {});
  const callMeetingActionsRef = useRef<{
    ingestMeeting: (payload: MeetingStartedPayload) => void;
    notifyMeeting: (payload: MeetingStartedPayload) => void;
  }>({
    ingestMeeting: () => {},
    notifyMeeting: () => {},
  });
  const conversationsRef = useRef(conversations);
  const teammatesRef = useRef(teammates);
  const userRef = useRef(user);
  const handleSelectConversationRef = useRef<
    (conversationId: string, messageId?: string | null, options?: { forceReload?: boolean }) => void
  >(() => {});
  const handleRealtimeEventRef = useRef<(rawEvent: unknown) => void>(() => {});
  const applyTypingUpdateRef = useRef<(typing: NonNullable<ReturnType<typeof extractTypingUpdate>>) => void>(() => {});

  directChatMetadataRef.current = directChatMetadata;

  const rememberDirectChatMetadata = useCallback(
    (conversationId: string, peerUserId: string, displayName: string) => {
      const selfName = getUserDisplayName(userRef.current);
      const trimmedName = sanitizeDirectDisplayName(displayName, selfName, 'Direct message');

      if (isBrokenDirectTitle(trimmedName, selfName)) {
        return;
      }

      setDirectChatMetadata((current) => {
        const existing = current[conversationId];

        if (existing?.peerUserId === peerUserId && existing.displayName === trimmedName) {
          return current;
        }

        return {
          ...current,
          [conversationId]: {
            peerUserId,
            displayName: trimmedName,
          },
        };
      });
    },
    [],
  );

  const seedDirectChatMetadata = useCallback((items: ConversationItem[]) => {
    setDirectChatMetadata((current) => {
      let changed = false;
      const next = { ...current };

      for (const conversation of items) {
        if (conversation.kind !== 'direct' || conversation.isSelf || !conversation.peerUserId) {
          continue;
        }

        const selfName = getUserDisplayName(userRef.current);

        if (isBrokenDirectTitle(conversation.title, selfName)) {
          continue;
        }

        const existing = next[conversation.id];

        if (existing) {
          continue;
        }

        next[conversation.id] = {
          peerUserId: conversation.peerUserId,
          displayName: conversation.title,
        };
        changed = true;
      }

      return changed ? next : current;
    });
  }, []);
  conversationsRef.current = conversations;
  teammatesRef.current = teammates;
  userRef.current = user;
  draftRef.current = draft;

  useEffect(() => {
    writePersistedDirectChatMetadata(directChatMetadata);
  }, [directChatMetadata]);

  const isOrgAdmin = useMemo(() => userCanManageOrganization(user), [user]);

  selectedIdRef.current = selectedId;
  userIdRef.current = getUserId(user);

  const selectedConversation = useMemo(() => {
    if (!selectedId) {
      return null;
    }

    return (
      conversations.find((item) => item.id === selectedId) ??
      conversationPlaceholders[selectedId] ??
      null
    );
  }, [conversationPlaceholders, conversations, selectedId]);

  const hubConversationIds = useMemo(() => {
    const ids = new Set(
      conversations
        .filter((conversation) => conversation.kind === 'hub')
        .map((conversation) => conversation.id),
    );

    if (selectedConversation?.kind === 'hub') {
      ids.add(selectedConversation.id);
    }

    return Array.from(ids);
  }, [conversations, selectedConversation?.id, selectedConversation?.kind]);

  const typingPreviews = useMemo(() => {
    const previews: Record<string, string> = {};

    for (const [conversationId, state] of Object.entries(typingByConversation)) {
      const label = formatTypingIndicatorLabel(
        state.userIds.map((id) => state.namesByUserId[id] ?? 'Someone'),
      );

      if (label) {
        previews[conversationId] = label;
      }
    }

    return previews;
  }, [typingByConversation]);

  const typingLabel = selectedId ? typingPreviews[selectedId] ?? '' : '';

  useEffect(() => {
    if (!selectedId || !conversationPlaceholders[selectedId]) {
      return;
    }

    if (conversations.some((conversation) => conversation.id === selectedId)) {
      setConversationPlaceholders((current) => {
        if (!current[selectedId]) {
          return current;
        }

        const next = { ...current };
        delete next[selectedId];
        return next;
      });
    }
  }, [conversationPlaceholders, conversations, selectedId]);

  const applyDraftPreviews = useCallback((items: ConversationItem[]) => {
    return mergeConversationDraftPreviews(
      items,
      draftPreviewsRef.current,
      selectedIdRef.current,
      draftRef.current,
    );
  }, []);

  const commitConversationList = useCallback(
    (
      items: ConversationItem[],
      options?: { seedFromApi?: boolean; currentUserId?: string | null },
    ) => {
      const viewerId = options?.currentUserId ?? userIdRef.current;
      const selfName = getUserDisplayName(userRef.current);
      const teammateMap = new Map(
        teammatesRef.current.map((teammate) => [
          teammate.id,
          { name: teammate.name, username: teammate.username },
        ]),
      );
      const sorted = sortConversations(
        dropBrokenDirectConversations(
          dedupeDirectConversations(
            repairConversationPeerIds(
              reconcileDirectConversations(
                applyStoredDirectChatMetadata(
                  items,
                  directChatMetadataRef.current,
                  selfName,
                ),
                viewerId,
                selfName,
                teammateMap,
              ),
              viewerId,
            ),
          ),
          viewerId,
          selfName,
        ),
      );

      if (options?.seedFromApi !== false) {
        seedDraftPreviewCache(sorted, draftPreviewsRef.current);
      }

      return applyDraftPreviews(sorted).map((conversation) => {
        if (conversation.notificationsSnoozed) {
          conversationSnoozeRef.current[conversation.id] = true;
        }

        const snoozed = conversationSnoozeRef.current[conversation.id];

        if (snoozed === undefined || conversation.notificationsSnoozed === snoozed) {
          return conversation;
        }

        return { ...conversation, notificationsSnoozed: snoozed };
      });
    },
    [applyDraftPreviews],
  );

  const upsertConversation = useCallback(
    (items: ConversationItem[], conversation: ConversationItem) => {
      const without = items.filter((item) => item.id !== conversation.id);
      return commitConversationList([conversation, ...without], { seedFromApi: false });
    },
    [commitConversationList],
  );

  const prefetchDirectPeerProfile = useCallback(
    (peerUserId: string, conversationId: string, fallbackName?: string) => {
      const selfName = getUserDisplayName(userRef.current);

      const applyProfile = (displayName: string) => {
        const trimmedName = sanitizeDirectDisplayName(displayName, selfName, fallbackName);

        if (isBrokenDirectTitle(trimmedName, selfName)) {
          return;
        }

        rememberDirectChatMetadata(conversationId, peerUserId, trimmedName);
        setConversations((current) =>
          commitConversationList(
            current.map((conversation) =>
              conversation.id === conversationId
                ? patchDirectConversationMetadata(conversation, peerUserId, trimmedName)
                : conversation,
            ),
            { seedFromApi: false, currentUserId: userIdRef.current },
          ),
        );
      };

      const cached = readPeerProfile(peerUserId);

      if (cached) {
        const cachedName = cached.name.trim() || cached.username.trim();

        if (cachedName) {
          applyProfile(cachedName);
        }
      }

      void loadUserProfile(peerUserId).then((result) => {
        if (!result.ok) {
          return;
        }

        const profile = normalizeUserProfile(result.data);
        const displayName = profile.name.trim() || profile.username.trim();

        if (!displayName || isBrokenDirectTitle(displayName, selfName)) {
          return;
        }

        writePeerProfile({
          userId: peerUserId,
          name: profile.name,
          username: profile.username,
          avatarUrl: profile.avatarUrl,
        });

        applyProfile(displayName);
      });
    },
    [commitConversationList, rememberDirectChatMetadata],
  );

  useEffect(() => {
    const selfName = getUserDisplayName(user);
    const repairedPeerIds = new Set<string>();

    for (const conversation of conversations) {
      if (
        conversation.kind !== 'direct' ||
        conversation.isSelf ||
        !conversation.peerUserId ||
        !isBrokenDirectTitle(conversation.title, selfName) ||
        repairedPeerIds.has(conversation.peerUserId)
      ) {
        continue;
      }

      repairedPeerIds.add(conversation.peerUserId);
      prefetchDirectPeerProfile(conversation.peerUserId, conversation.id);
    }
  }, [conversations, prefetchDirectPeerProfile, user]);

  const setDraftPreviewForConversation = useCallback((conversationId: string, preview: string | null) => {
    const trimmed = preview?.trim();

    if (trimmed) {
      draftPreviewsRef.current[conversationId] = trimmed;
      return;
    }

    delete draftPreviewsRef.current[conversationId];
  }, []);

  const syncThreadCache = useCallback(
    (
      conversationId: string,
      entry: {
        messages: MessageItem[];
        pinnedMessageIds: string[];
        activeHubDetails: Record<string, unknown> | null;
        draft: string;
      },
    ) => {
      writeThreadCacheEntry(threadCacheRef.current, conversationId, entry);
    },
    [],
  );

  const hydrateThreadFromCache = useCallback((conversationId: string): boolean => {
    const cached = getThreadCacheEntry(threadCacheRef.current, conversationId);

    if (!cached) {
      return false;
    }

    setMessages(filterMainChatMessages(cached.messages));
    setActiveHubDetails(cached.activeHubDetails);
    setPinnedMessageIds(cached.pinnedMessageIds);
    setDraft(cached.draft);
    lastSavedDraftRef.current = cached.draft;
    setThreadError('');
    setDraftError('');
    setThreadLoading(false);

    const conversationUnread =
      conversationsRef.current.find((item) => item.id === conversationId)?.unreadCount ?? 0;
    setThreadUnreadAnchorId(
      findFirstUnreadMessageId(
        cached.messages,
        conversationUnread,
        readLastReadMessageId(cached.activeHubDetails),
        userIdRef.current,
      ),
    );
    return true;
  }, []);

  const flushDraftSave = useCallback((conversationId: string, content: string) => {
    if (draftSaveTimerRef.current) {
      window.clearTimeout(draftSaveTimerRef.current);
      draftSaveTimerRef.current = null;
    }

    const trimmed = content.trim();

    if (!trimmed) {
      if (lastSavedDraftRef.current.trim()) {
        void clearChatDraft(conversationId).then((result) => {
          if (result.ok) {
            lastSavedDraftRef.current = '';
          }
        });
      }

      return;
    }

    if (trimmed === lastSavedDraftRef.current) {
      return;
    }

    void saveChatDraft(conversationId, trimmed).then((result) => {
      if (result.ok) {
        lastSavedDraftRef.current = trimmed;
      }
    });
  }, []);

  const clearConversationUnread = useCallback(
    (conversationId: string) => {
      setConversations((current) =>
        applyDraftPreviews(
          current.map((conversation) =>
            conversation.id === conversationId ? { ...conversation, unreadCount: 0 } : conversation,
          ),
        ),
      );
    },
    [applyDraftPreviews],
  );

  const touchConversationWithMessage = useCallback(
    (conversationId: string, message: MessageItem, incrementUnread: boolean) => {
      const viewerUserId = userIdRef.current;
      const preview = formatMessagePreview(message);
      const timestamp = message.createdAt || new Date().toISOString();
      const isOwn = message.isOwn || (viewerUserId ? message.senderId === viewerUserId : false);

      setConversations((current) =>
        applyDraftPreviews(
          sortConversations(
            current.map((conversation) => {
              if (conversation.id !== conversationId) {
                return conversation;
              }

              const listPreview = buildConversationListPreview(
                conversation.kind,
                preview,
                message.senderName,
              );

              if (conversation.isDraftPreview) {
                return {
                  ...conversation,
                  messagePreview: listPreview,
                  timestamp,
                  unreadCount:
                    incrementUnread && !isOwn
                      ? Math.max(conversation.unreadCount, 0) + 1
                      : conversation.unreadCount,
                };
              }

              return {
                ...conversation,
                messagePreview: listPreview,
                subtitle: listPreview,
                isDraftPreview: false,
                timestamp,
                unreadCount:
                  incrementUnread && !isOwn
                    ? Math.max(conversation.unreadCount, 0) + 1
                    : conversation.unreadCount,
              };
            }),
          ),
        ),
      );
    },
    [applyDraftPreviews],
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

  const handleSignOut = useCallback(async () => {
    const confirmed = await confirm({
      title: 'Sign out',
      message: 'Are you sure you want to sign out of FlexHubs on this device?',
      confirmLabel: 'Sign out',
      tone: 'danger',
    });

    if (!confirmed) {
      return;
    }

    clearProfileCache();
    onSessionExpired();
  }, [confirm, onSessionExpired]);

  const refreshUnreadCount = useCallback(
    async (notificationItems?: NotificationItem[]) => {
      const [countResult, pendingResult] = await Promise.all([
        loadUnreadCount(),
        loadPendingFriends(),
      ]);

      if (handleUnauthorized(countResult.status ?? pendingResult.status)) {
        return;
      }

      const apiCount = countResult.ok ? countResult.data.count : 0;
      const pendingCount = pendingResult.ok ? pendingResult.data.length : 0;
      const unreadFromNotifications = (notificationItems ?? []).filter((item) => !item.isRead).length;

      setUnreadCount(Math.max(apiCount, unreadFromNotifications) + pendingCount);
    },
    [handleUnauthorized],
  );

  const shouldSuppressNotificationAlerts = useCallback((): boolean => {
    const settings = notificationSettingsRef.current;

    if (settings?.dndEnabled) {
      return true;
    }

    const snoozeUntil = settings?.snoozeUntil;
    return Boolean(snoozeUntil && new Date(snoozeUntil).getTime() > Date.now());
  }, []);

  const applyConversationSnoozed = useCallback((conversationId: string, snoozed: boolean) => {
    conversationSnoozeRef.current[conversationId] = snoozed;
    writePersistedConversationSnooze(conversationId, snoozed);

    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === conversationId && conversation.notificationsSnoozed !== snoozed
          ? { ...conversation, notificationsSnoozed: snoozed }
          : conversation,
      ),
    );

    const patchDetails = (details: Record<string, unknown> | null) =>
      withConversationSnoozed(details, snoozed);

    if (selectedIdRef.current === conversationId) {
      setActiveHubDetails((current) => patchDetails(current));
    }

    const cached = getThreadCacheEntry(threadCacheRef.current, conversationId);

    if (cached) {
      writeThreadCacheEntry(threadCacheRef.current, conversationId, {
        ...cached,
        activeHubDetails: patchDetails(cached.activeHubDetails),
      });
    }
  }, []);

  const hydrateConversationSnooze = useCallback(
    async (conversationId: string) => {
      const result = await loadConversationNotificationSettings(conversationId);

      if (!result.ok) {
        return;
      }

      const state = readConversationSnoozeState(result.data);

      if (state === null) {
        return;
      }

      applyConversationSnoozed(conversationId, state);
    },
    [applyConversationSnoozed],
  );

  const isConversationSnoozed = useCallback((conversationId: string): boolean => {
    return conversationSnoozeRef.current[conversationId] === true;
  }, []);

  const patchMessageReactions = useCallback(
    (
      conversationId: string,
      messageId: string,
      patch: {
        incoming?: MessageItem;
        reactions?: MessageItem['reactions'];
        addedReaction?: MessageItem['reactions'][number] | null;
        removedReaction?: { emoji: string; userId: string } | null;
      },
    ) => {
      const userId = userIdRef.current;

      const apply = (messages: MessageItem[]) => {
        const index = messages.findIndex((message) => message.id === messageId);

        if (index === -1) {
          return messages;
        }

        const updated = applyReactionPatch(messages[index], patch);

        return messages.map((message, currentIndex) =>
          currentIndex === index
            ? preserveMessageOwnership(updated, message, userId)
            : message,
        );
      };

      if (selectedIdRef.current === conversationId) {
        setMessages((current) => apply(current));
      }

      patchThreadCacheMessages(threadCacheRef.current, conversationId, apply);
    },
    [],
  );

  const refreshMessageReactions = useCallback(
    (conversationId: string, messageId: string) => {
      void loadMessageById(conversationId, messageId).then((result) => {
        if (!result.ok) {
          return;
        }

        patchMessageReactions(conversationId, messageId, { incoming: result.data });
      });
    },
    [patchMessageReactions],
  );

  const refreshMessageFromNotification = useCallback(
    (notification: NotificationItem) => {
      if (!notification.conversationId || !notification.messageId) {
        return;
      }

      const normalizedType = notification.type.toLowerCase();
      const normalizedTitle = notification.title.toLowerCase();
      const normalizedBody = notification.body.toLowerCase();
      const isReaction =
        normalizedType.includes('reaction') ||
        normalizedTitle.includes('reaction') ||
        normalizedBody.includes('reacted');

      if (!isReaction) {
        return;
      }

      refreshMessageReactions(notification.conversationId, notification.messageId);
    },
    [refreshMessageReactions],
  );

  const processNotificationAlerts = useCallback(
    async (notifications: NotificationItem[]) => {
      const deliverMeetingAlert = (meeting: MeetingStartedPayload) => {
        if (shouldDeliverDesktopNotifications() && !shouldSuppressNotificationAlerts()) {
          callMeetingActionsRef.current.notifyMeeting(meeting);
        } else {
          callMeetingActionsRef.current.ingestMeeting(meeting);
        }
      };

      if (!shouldDeliverDesktopNotifications() || shouldSuppressNotificationAlerts()) {
        if (!notifications.length) {
          return;
        }

        for (const notification of peekNewNotifications(notifications)) {
          const meeting = parseMeetingNotificationBody(notification.body);

          if (meeting) {
            deliverMeetingAlert(meeting);
            markNotificationSeen(notification);
            continue;
          }

          refreshMessageFromNotification(notification);
          markNotificationSeen(notification);
        }

        seedNotificationSnapshot(notifications);
        return;
      }

      for (const notification of peekNewNotifications(notifications)) {
        refreshMessageFromNotification(notification);

        const meeting = parseMeetingNotificationBody(notification.body);

        if (meeting) {
          deliverMeetingAlert(meeting);
          markNotificationSeen(notification);
          continue;
        }

        const resolvedNotificationConversationId = resolveNotificationConversationId(
          notification,
          conversationsRef.current,
        );
        const isOpenConversation =
          Boolean(resolvedNotificationConversationId) &&
          resolvedNotificationConversationId === selectedIdRef.current;

        if (
          (resolvedNotificationConversationId &&
            isConversationSnoozed(resolvedNotificationConversationId)) ||
          isOpenConversation
        ) {
          markNotificationSeen(notification);
        }
      }

      await alertNewDesktopNotifications(
        notifications,
        (notification) => {
          if (parseMeetingNotificationBody(notification.body)) {
            return;
          }

          handleNotificationClickRef.current(notification);
        },
        undefined,
        (notification) => {
          const conversationId = resolveNotificationConversationId(
            notification,
            conversationsRef.current,
          );

          if (conversationId) {
            const conversation = findConversationByAnyId(
              conversationsRef.current,
              conversationId,
            );

            if (conversation) {
              return conversation;
            }
          }

          const title = notification.title.trim();

          if (title) {
            return (
              conversationsRef.current.find(
                (item) =>
                  item.kind === 'direct' &&
                  item.title.trim().toLowerCase() === title.toLowerCase(),
              ) ?? null
            );
          }

          return null;
        },
      );
    },
    [isConversationSnoozed, refreshMessageFromNotification, shouldSuppressNotificationAlerts],
  );

  const syncNotifications = useCallback(
    async (options?: { seedSnapshot?: boolean; withLoading?: boolean; markAllRead?: boolean }) => {
      if (options?.withLoading) {
        setNotificationsLoading(true);
        setNotificationsError('');
        setActivityLoading(true);
        setActivityError('');
      }

      const { notifications, pending } = options?.markAllRead
        ? await openBellPanelData()
        : await refreshBellPanelData();

      if (handleUnauthorized(notifications.status ?? pending.status)) {
        if (options?.withLoading) {
          setNotificationsLoading(false);
          setActivityLoading(false);
        }
        return;
      }

      if (!notifications.ok) {
        if (options?.withLoading) {
          setNotificationsError(notifications.error);
          setActivityError(notifications.error);
          setNotificationsLoading(false);
          setActivityLoading(false);
        }
        return;
      }

      setPanelNotifications(notifications.data);
      setActivityNotifications(notifications.data);

      if (options?.seedSnapshot) {
        seedNotificationSnapshot(notifications.data);
      } else {
        await processNotificationAlerts(notifications.data);
      }

      if (pending.ok) {
        setPanelPendingFriends(pending.data);
        setActivityPendingFriends(pending.data);
      }

      if (options?.withLoading) {
        setNotificationsLoading(false);
        setActivityLoading(false);
      }

      void refreshUnreadCount(notifications.data);
    },
    [handleUnauthorized, processNotificationAlerts, refreshUnreadCount],
  );

  const loadActivityData = useCallback(async () => {
    await syncNotifications({ withLoading: true, markAllRead: true });
  }, [syncNotifications]);

  const refreshPresence = useCallback(
    async (userIds: string[]) => {
      const unique = [...new Set(userIds.filter((id): id is string => Boolean(id)))];

      if (unique.length === 0) {
        return;
      }

      const result = await loadUserPresence(unique);

      if (!result.ok) {
        handleUnauthorized(result.status);
        return;
      }

      const statusByUserId = new Map(
        result.data.map((item) => [item.userId, mapApiPresenceToStatus(item.status)] as const),
      );

      setConversations((current) =>
        applyDraftPreviews(
          current.map((conversation) => {
            if (!conversation.peerUserId) {
              return conversation;
            }

            const status = statusByUserId.get(conversation.peerUserId);

            if (!status) {
              return conversation;
            }

            return { ...conversation, status };
          }),
        ),
      );
    },
    [applyDraftPreviews, handleUnauthorized],
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
    const meResult = await getCurrentUser();

    if (!meResult.ok) {
      if (handleUnauthorized(meResult.status)) {
        return;
      }
    } else {
      const userPayload = meResult.data.user ?? meResult.data;
      setUser(userPayload);
      const profile = normalizeUserProfile(userPayload);
      startPresenceManager(profile.status, profile.statusMessage);
    }

    const currentUser = meResult.ok ? (meResult.data.user ?? meResult.data) : getStoredUser();
    const inOrg = userInOrganization(currentUser);

    const [bootstrap, membersResult, friendsResult, orgBootstrapResult] = await Promise.all([
      loadChatBootstrap(),
      inOrg ? loadOrganizationMembers() : Promise.resolve(null),
      inOrg ? Promise.resolve(null) : loadFriends(),
      inOrg
        ? loadOrgSubscription().then(async (subscriptionResult) => {
            if (!subscriptionResult.ok || !subscriptionResult.data) {
              return null;
            }

            const complianceResult = await loadPlanCompliance(
              subscriptionResult.data.planId,
              subscriptionResult.data.teamSize,
            );

            return {
              complianceRules: complianceResult.ok ? complianceResult.data.rules : [],
            };
          })
        : Promise.resolve(null),
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

    setConversations(
      commitConversationList(conversationsResult.data.conversations, {
        currentUserId: getUserId(currentUser),
      }),
    );
    seedDirectChatMetadata(conversationsResult.data.conversations);

    if (unreadCountResult.ok) {
      setUnreadCount(unreadCountResult.data.count);
    } else if (handleUnauthorized(unreadCountResult.status)) {
      return;
    }

    if (membersResult?.ok) {
      const currentUserId = getUserId(currentUser);
      const nextTeammates = membersResult.data.filter(
        (member) => member.id && member.id !== currentUserId,
      );
      setTeammates(nextTeammates);
      teammatesRef.current = nextTeammates;
      setConversations((current) =>
        commitConversationList(current, {
          seedFromApi: false,
          currentUserId,
        }),
      );
    }

    if (friendsResult?.ok) {
      setHubsFriends(friendsResult.data);
    }

    if (orgBootstrapResult?.complianceRules.length) {
      setPlanComplianceRules(orgBootstrapResult.complianceRules);
    } else if (!inOrg) {
      setPlanComplianceRules([]);
    }

    const presenceUserIds = [
      ...conversationsResult.data.conversations
        .map((conversation) => conversation.peerUserId)
        .filter((id): id is string => Boolean(id)),
      ...(membersResult?.ok ? membersResult.data.map((member) => member.id) : []),
    ];

    void refreshPresence(presenceUserIds);
    } finally {
      setLoading(false);
    }
  }, [commitConversationList, handleUnauthorized, refreshPresence]);

  const loadThread = useCallback(
    async (conversationId: string) => {
      const cached = getThreadCacheEntry(threadCacheRef.current, conversationId);
      const hasCache = Boolean(cached);

      if (!hasCache) {
        setThreadLoading(true);
        setThreadError('');
        setDraftError('');
        setActiveHubDetails(null);
        setPinnedMessageIds([]);
      }

      try {
        const [bootstrapResult, draftResult] = await Promise.all([
          loadConversationBootstrap(conversationId),
          loadMessageDraft(conversationId),
        ]);

        if (conversationId !== selectedIdRef.current) {
          return;
        }

        if (handleUnauthorized(bootstrapResult.status ?? draftResult.status)) {
          return;
        }

        if (!bootstrapResult.ok) {
          if (!hasCache) {
            setThreadError(bootstrapResult.error);
            setMessages([]);
            setActiveHubDetails(null);
          }

          return;
        }

        const nextMessages = commitMessages(
          bootstrapResult.data.messages,
          getUserId(user),
          bootstrapResult.data.conversation,
        );
        let nextDraft = cached?.draft ?? '';
        const conversationUnread =
          conversationsRef.current.find((item) => item.id === conversationId)?.unreadCount ?? 0;

        const knownSnooze = conversationSnoozeRef.current[conversationId];
        const bootstrapSnooze = readConversationSnoozeState(bootstrapResult.data.conversation);
        if (bootstrapSnooze !== null) {
          conversationSnoozeRef.current[conversationId] = bootstrapSnooze;
          writePersistedConversationSnooze(conversationId, bootstrapSnooze);
        }

        const snoozed = conversationSnoozeRef.current[conversationId] ?? knownSnooze ?? false;
        setActiveHubDetails(
          withConversationSnoozed(bootstrapResult.data.conversation, Boolean(snoozed)),
        );
        setPinnedMessageIds(bootstrapResult.data.pinnedMessageIds);
        setMessages(nextMessages);
        void hydrateThreadReplyRegistry(conversationId, bootstrapResult.data.messages).then(() => {
          if (conversationId !== selectedIdRef.current) {
            return;
          }

          setMessages((current) => filterMainChatMessages(current));
        });
        void hydrateConversationSnooze(conversationId);

        setConversations((current) =>
          commitConversationList(
            current.map((conversation) =>
              conversation.id === conversationId
                ? { ...conversation, isPinned: bootstrapResult.data.isFavorite }
                : conversation,
            ),
            { seedFromApi: false, currentUserId: getUserId(user) },
          ),
        );

        const memberIds = extractConversationMemberIds(bootstrapResult.data.conversation);
        const currentUserId = getUserId(user);

        if (memberIds.length === 2 && currentUserId) {
          const peerUserId = memberIds.find((memberId) => memberId !== currentUserId) ?? null;

          if (peerUserId) {
            const conversationRecord = bootstrapResult.data.conversation;
            const peerTitle =
              (conversationRecord
                ? readDirectPeerDisplayName(conversationRecord, currentUserId)
                : null) ??
              conversationsRef.current.find((item) => item.id === conversationId)?.title ??
              'Direct message';
            rememberDirectChatMetadata(conversationId, peerUserId, peerTitle);
            prefetchDirectPeerProfile(peerUserId, conversationId, peerTitle);

            setConversations((current) =>
              commitConversationList(
                current.map((conversation) =>
                  conversation.id === conversationId &&
                  conversation.kind === 'direct' &&
                  !conversation.isSelf
                    ? { ...conversation, peerUserId }
                    : conversation,
                ),
                { seedFromApi: false, currentUserId },
              ),
            );
          }
        }

        setThreadUnreadAnchorId(
          findFirstUnreadMessageId(
            nextMessages,
            conversationUnread,
            readLastReadMessageId(bootstrapResult.data.conversation),
            getUserId(user),
          ),
        );

        if (draftResult.ok) {
          const content = draftResult.data.content;
          nextDraft = content;
          setDraft(content);
          lastSavedDraftRef.current = content;
          setDraftPreviewForConversation(conversationId, content.trim() || null);
        } else if (!draftResult.ok && draftResult.status !== 404) {
          setDraftError(draftResult.error);
        } else {
          nextDraft = '';
          setDraft('');
          lastSavedDraftRef.current = '';
          setDraftPreviewForConversation(conversationId, null);
        }

        syncThreadCache(conversationId, {
          messages: nextMessages,
          pinnedMessageIds: bootstrapResult.data.pinnedMessageIds,
          activeHubDetails: withConversationSnoozed(
            bootstrapResult.data.conversation,
            Boolean(conversationSnoozeRef.current[conversationId]),
          ),
          draft: nextDraft,
        });

        if (memberIds.length > 0) {
          void refreshPresence(memberIds);
        }

        if (markReadTimerRef.current) {
          window.clearTimeout(markReadTimerRef.current);
        }

        markReadTimerRef.current = window.setTimeout(() => {
          void markConversationRead(conversationId).then((result) => {
            if (result.ok) {
              clearConversationUnread(conversationId);
            }

            handleUnauthorized(result.status);
            void refreshUnreadCount();
          });
        }, 100);
      } finally {
        if (conversationId === selectedIdRef.current) {
          setThreadLoading(false);
        }
      }
    },
    [applyDraftPreviews, clearConversationUnread, commitConversationList, handleUnauthorized, hydrateConversationSnooze, prefetchDirectPeerProfile, rememberDirectChatMetadata, refreshPresence, refreshUnreadCount, setDraftPreviewForConversation, syncThreadCache, user],
  );

  const callManager = useCallManager({
    currentUserId: getUserId(user),
    currentUserLabel: getUserDisplayName(user),
    currentUserAvatar: getUserAvatarUrl(user),
    hubConversationIds,
    onCallLogged: () => {
      const conversationId = selectedIdRef.current;

      if (conversationId) {
        void loadThread(conversationId);
      }

      setMessageScrollRestoreKey((current) => current + 1);
    },
    onError: (message) => {
      toast.error(message);
    },
  });

  useEffect(() => {
    const phase = callManager.session.phase;
    const previousPhase = callPhaseRef.current;

    if (previousPhase !== 'idle' && phase === 'idle') {
      setCallPanelLayout('floating');
      setMessageScrollRestoreKey((current) => current + 1);
    }

    callPhaseRef.current = phase;
  }, [callManager.session.phase]);

  callMeetingActionsRef.current = {
    ingestMeeting: callManager.ingestMeetingNotification,
    notifyMeeting: callManager.notifyMeetingStarted,
  };

  const refreshActiveThreadSilently = useCallback(
    async (conversationId: string) => {
      const result = await loadConversationBootstrap(conversationId);

      if (!result.ok || conversationId !== selectedIdRef.current) {
        return;
      }

      const nextMessages = commitMessages(
        result.data.messages,
        getUserId(user),
        result.data.conversation,
      );

      setMessages((current) => {
        const merged = mergeLocalPendingMessages(nextMessages, current);
        const unchanged =
          current.length === merged.length &&
          current.every((message, index) => {
            const next = merged[index];
            return (
              next &&
              message.id === next.id &&
              message.status === next.status &&
              message.content === next.content &&
              message.editedAt === next.editedAt
            );
          });

        return unchanged ? current : merged;
      });

      const silentSnooze =
        readConversationSnoozeState(result.data.conversation) ??
        conversationSnoozeRef.current[conversationId] ??
        false;
      const silentDetails = withConversationSnoozed(result.data.conversation, Boolean(silentSnooze));

      setActiveHubDetails(silentDetails);
      setPinnedMessageIds(result.data.pinnedMessageIds);

      syncThreadCache(conversationId, {
        messages: nextMessages,
        pinnedMessageIds: result.data.pinnedMessageIds,
        activeHubDetails: silentDetails,
        draft: draftRef.current,
      });

      void hydrateThreadReplyRegistry(conversationId, result.data.messages).then(() => {
        if (conversationId !== selectedIdRef.current) {
          return;
        }

        setMessages((current) => filterMainChatMessages(current));
      });
    },
    [syncThreadCache, user],
  );

  const prefetchThread = useCallback(
    (conversationId: string) => {
      if (
        conversationId === selectedIdRef.current ||
        getThreadCacheEntry(threadCacheRef.current, conversationId) ||
        prefetchInFlightRef.current.has(conversationId)
      ) {
        return;
      }

      if (prefetchTimerRef.current[conversationId]) {
        window.clearTimeout(prefetchTimerRef.current[conversationId]);
      }

      prefetchTimerRef.current[conversationId] = window.setTimeout(() => {
        delete prefetchTimerRef.current[conversationId];

        if (
          conversationId === selectedIdRef.current ||
          getThreadCacheEntry(threadCacheRef.current, conversationId) ||
          prefetchInFlightRef.current.has(conversationId)
        ) {
          return;
        }

        prefetchInFlightRef.current.add(conversationId);

        void Promise.all([
          loadConversationBootstrap(conversationId),
          loadMessageDraft(conversationId),
        ])
          .then(([bootstrapResult, draftResult]) => {
            if (!bootstrapResult.ok) {
              return;
            }

            const draftContent = draftResult.ok ? draftResult.data.content : '';

            writeThreadCacheEntry(threadCacheRef.current, conversationId, {
              messages: commitMessages(
                bootstrapResult.data.messages,
                getUserId(user),
                bootstrapResult.data.conversation,
              ),
              pinnedMessageIds: bootstrapResult.data.pinnedMessageIds,
              activeHubDetails: withConversationSnoozed(
                bootstrapResult.data.conversation,
                Boolean(
                  readConversationSnoozeState(bootstrapResult.data.conversation) ??
                    conversationSnoozeRef.current[conversationId],
                ),
              ),
              draft: draftContent,
            });

            const memberIds = extractConversationMemberIds(bootstrapResult.data.conversation);
            const currentUserId = getUserId(user);
            const peerUserId =
              memberIds.length === 2
                ? memberIds.find((memberId) => memberId !== currentUserId) ?? null
                : null;

            if (peerUserId) {
              const conversationRecord = bootstrapResult.data.conversation;
              const peerTitle =
                (conversationRecord
                  ? readDirectPeerDisplayName(conversationRecord, currentUserId)
                  : null) ??
                conversationsRef.current.find((item) => item.id === conversationId)?.title ??
                'Direct message';
              prefetchDirectPeerProfile(peerUserId, conversationId, peerTitle);
            }
          })
          .finally(() => {
            prefetchInFlightRef.current.delete(conversationId);
          });
      }, 120);
    },
    [prefetchDirectPeerProfile, user],
  );

  const loadSavedData = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setSavedLoading(true);
      setSavedError('');
    }

    const result = await loadSavedMessages();

    if (handleUnauthorized(result.status)) {
      if (!options?.silent) {
        setSavedLoading(false);
      }
      return;
    }

    if (!result.ok) {
      if (!options?.silent) {
        setSavedError(result.error);
        setSavedLoading(false);
      }
      return;
    }

    setSavedItems(result.data);

    if (!options?.silent) {
      setSavedLoading(false);
    }
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
      setCalendarLoading(false);
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

  const openCalendarFromNotification = useCallback(
    (eventId?: string | null) => {
      setNotificationsOpen(false);
      setMainView('calendar');
      setHighlightCalendarEventId(eventId ?? null);
      void loadCalendarData();
    },
    [loadCalendarData],
  );

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
      setConversations((current) =>
        commitConversationList(mergeConversationLists(current, result.data.conversations)),
      );
    }
  }, [commitConversationList, handleUnauthorized]);

  const scheduleConversationsRefresh = useCallback(() => {
    if (refreshConversationsTimerRef.current) {
      window.clearTimeout(refreshConversationsTimerRef.current);
    }

    refreshConversationsTimerRef.current = window.setTimeout(() => {
      void refreshConversations();
    }, 400);
  }, [refreshConversations]);

  const clearTypingUser = useCallback((conversationId: string, typerUserId: string) => {
    const timerKey = `${conversationId}:${typerUserId}`;
    const existingTimer = typingTimersRef.current.get(timerKey);

    if (existingTimer) {
      window.clearTimeout(existingTimer);
      typingTimersRef.current.delete(timerKey);
    }

    setTypingByConversation((current) => {
      const state = current[conversationId];

      if (!state) {
        return current;
      }

      const userIds = state.userIds.filter((id) => id !== typerUserId);

      if (userIds.length === 0) {
        const next = { ...current };
        delete next[conversationId];
        return next;
      }

      const namesByUserId = { ...state.namesByUserId };
      delete namesByUserId[typerUserId];

      return {
        ...current,
        [conversationId]: {
          userIds,
          namesByUserId,
        },
      };
    });
  }, []);

  const applyTypingUpdate = useCallback(
    (typing: NonNullable<ReturnType<typeof extractTypingUpdate>>) => {
      const conversationId = resolveTypingConversationId(
        typing.conversationId,
        conversationsRef.current,
      );
      const timerKey = `${conversationId}:${typing.userId}`;
      const existingTimer = typingTimersRef.current.get(timerKey);

      if (existingTimer) {
        window.clearTimeout(existingTimer);
        typingTimersRef.current.delete(timerKey);
      }

      if (!typing.isTyping) {
        clearTypingUser(conversationId, typing.userId);
        return;
      }

      const displayName = resolveTyperDisplayName(
        typing,
        teammatesRef.current,
        conversationsRef.current,
      );

      setTypingByConversation((current) => {
        const previous = current[conversationId] ?? { userIds: [], namesByUserId: {} };
        const userIds = previous.userIds.includes(typing.userId)
          ? previous.userIds
          : [...previous.userIds, typing.userId];

        return {
          ...current,
          [conversationId]: {
            userIds,
            namesByUserId: {
              ...previous.namesByUserId,
              [typing.userId]: displayName,
            },
          },
        };
      });

      const timeoutId = window.setTimeout(() => {
        typingTimersRef.current.delete(timerKey);
        clearTypingUser(conversationId, typing.userId);
      }, TYPING_LABEL_MS);

      typingTimersRef.current.set(timerKey, timeoutId);
    },
    [clearTypingUser],
  );

  applyTypingUpdateRef.current = applyTypingUpdate;

  const handleRealtimeEvent = useCallback(
    (rawEvent: unknown) => {
      const event = parseRealtimeEvent(rawEvent);
      const type = event.type;
      const conversationId = extractConversationIdFromRealtime(rawEvent, event.payload);
      const userId = userIdRef.current;

      if (isTypingEvent(type) || isTypingChannelEvent(rawEvent)) {
        const typing = extractTypingUpdate(event.payload, conversationId, rawEvent);

        if (typing && !isSameTypingUser(typing.userId, userId)) {
          applyTypingUpdate(typing);
        }

        return;
      }

      const incomingMessage = extractMessageFromRealtimePayload(event.payload);
      const activeConversationId = selectedIdRef.current;

      if (incomingMessage && conversationId && isNewMessageEvent(type)) {
        const message = markOwnMessages([incomingMessage], userId)[0];
        const { conversationId: resolvedConversationId, conversation } = resolveConversationForMessage(
          conversationsRef.current,
          conversationId,
          message.senderId,
        );
        const incrementUnread =
          resolvedConversationId !== activeConversationId &&
          !message.isOwn &&
          message.senderId !== userId;

        if (message.senderId && !message.isOwn) {
          clearTypingUser(resolvedConversationId, message.senderId);
        }

        if (resolvedConversationId === activeConversationId) {
          const incomingThreadRootId = resolveThreadRootId(message, userId);

          if (incomingThreadRootId) {
            appendThreadReply(resolvedConversationId, incomingThreadRootId, message);
          }

          setMessages((current) => mergeIncomingMessage(current, message, userId));

          if (!message.isOwn && message.senderId !== userId) {
            void markConversationRead(resolvedConversationId).then((result) => {
              if (result.ok) {
                clearConversationUnread(resolvedConversationId);
              }
            });
          }
        } else {
          patchThreadCacheMessages(threadCacheRef.current, resolvedConversationId, (current) =>
            mergeIncomingMessage(current, message, userId),
          );

          if (incrementUnread) {
            setUnreadCount((count) => count + 1);

            if (
              !isConversationSnoozed(resolvedConversationId) &&
              !shouldSuppressNotificationAlerts() &&
              shouldDeliverDesktopNotifications()
            ) {
              void showIncomingMessageDesktopNotification(
                message,
                conversation,
                () => handleSelectConversationRef.current(resolvedConversationId, message.id),
                resolvedConversationId,
              );
            }
          }
        }

        if (!resolveThreadRootId(message, userId)) {
          touchConversationWithMessage(resolvedConversationId, message, incrementUnread);
        }

        if (!conversation) {
          scheduleConversationsRefresh();
        }

        void syncNotifications();
        return;
      }

      if (conversationId && (isReactionEvent(type) || extractReactionEvent(event.payload))) {
        const reactionPatch = extractReactionEvent(event.payload);

        if (reactionPatch) {
          patchMessageReactions(conversationId, reactionPatch.messageId, {
            incoming: reactionPatch.message ?? undefined,
            reactions: reactionPatch.reactions ?? undefined,
            addedReaction: reactionPatch.addedReaction,
            removedReaction: reactionPatch.removedReaction,
          });

          if (conversationId === activeConversationId) {
            refreshMessageReactions(conversationId, reactionPatch.messageId);
          }

          void syncNotifications();
          return;
        }
      }

      if (incomingMessage && conversationId && isMessageUpdateEvent(type)) {
        if (conversationId === activeConversationId) {
          setMessages((current) =>
            current.map((message) =>
              message.id === incomingMessage.id
                ? preserveMessageOwnership(
                    mergeMessageUpdates(message, incomingMessage),
                    message,
                    userId,
                  )
                : message,
            ),
          );
        } else {
          patchThreadCacheMessages(threadCacheRef.current, conversationId, (current) =>
            current.map((message) =>
              message.id === incomingMessage.id
                ? preserveMessageOwnership(
                    mergeMessageUpdates(message, incomingMessage),
                    message,
                    userId,
                  )
                : message,
            ),
          );
        }

        scheduleConversationsRefresh();
        return;
      }

      if (isMessageDeleteEvent(type) && conversationId) {
        const messageId =
          typeof event.payload === 'object' &&
          event.payload &&
          'messageId' in event.payload &&
          typeof (event.payload as { messageId: unknown }).messageId === 'string'
            ? (event.payload as { messageId: string }).messageId
            : incomingMessage?.id;

        if (messageId) {
          const deleteScope = extractMessageDeleteScope(event.payload) ?? 'me';
          const applyDelete = (current: MessageItem[]) => {
            if (deleteScope === 'everyone') {
              return current.map((message) =>
                message.id === messageId ? markMessageDeletedForEveryone(message) : message,
              );
            }

            return current.filter((message) => message.id !== messageId);
          };

          if (conversationId === activeConversationId) {
            setMessages(applyDelete);
          } else {
            patchThreadCacheMessages(threadCacheRef.current, conversationId, applyDelete);
          }
        }

        scheduleConversationsRefresh();
        return;
      }

      if (isConversationUpdateEvent(type)) {
        scheduleConversationsRefresh();
        void syncNotifications();
        if (conversationId && conversationId === activeConversationId) {
          void refreshActiveThreadSilently(conversationId);
        }
        return;
      }

      if (isUnreadUpdateEvent(type)) {
        scheduleConversationsRefresh();
        void syncNotifications();
        void refreshUnreadCount();
        if (conversationId && conversationId === activeConversationId) {
          void refreshActiveThreadSilently(conversationId);
        }
        return;
      }

      if (isPresenceEvent(type)) {
        const presenceUpdate = extractPresenceUpdate(event.payload);

        if (presenceUpdate) {
          const status = mapApiPresenceToStatus(presenceUpdate.status);

          if (status) {
            setConversations((current) =>
              applyDraftPreviews(
                current.map((conversation) =>
                  conversation.peerUserId === presenceUpdate.userId
                    ? { ...conversation, status }
                    : conversation,
                ),
              ),
            );
          }
        } else {
          scheduleConversationsRefresh();
        }

        return;
      }

      if (type === 'unknown' && incomingMessage && conversationId) {
        const message = markOwnMessages([incomingMessage], userId)[0];
        const resolvedConversationId = resolveTypingConversationId(
          conversationId,
          conversationsRef.current,
        );
        const incrementUnread =
          conversationId !== activeConversationId && !message.isOwn && message.senderId !== userId;

        if (message.senderId && !message.isOwn) {
          clearTypingUser(resolvedConversationId, message.senderId);
        }

        if (conversationId === activeConversationId) {
          setMessages((current) => mergeIncomingMessage(current, message, userId));
        } else {
          patchThreadCacheMessages(threadCacheRef.current, conversationId, (current) =>
            mergeIncomingMessage(current, message, userId),
          );

          if (incrementUnread) {
            setUnreadCount((count) => count + 1);
          }
        }

        touchConversationWithMessage(conversationId, message, incrementUnread);

        if (!conversationsRef.current.some((item) => item.id === conversationId)) {
          scheduleConversationsRefresh();
        }

        void syncNotifications();
      }
    },
    [applyDraftPreviews, applyTypingUpdate, clearConversationUnread, clearTypingUser, isConversationSnoozed, patchMessageReactions, refreshActiveThreadSilently, refreshMessageReactions, scheduleConversationsRefresh, shouldSuppressNotificationAlerts, syncNotifications, touchConversationWithMessage],
  );

  handleRealtimeEventRef.current = handleRealtimeEvent;

  useEffect(() => {
    setTypingSignalingHandler((typing) => {
      if (isSameTypingUser(typing.userId, userIdRef.current)) {
        return;
      }

      applyTypingUpdateRef.current(typing);
    });

    return () => {
      setTypingSignalingHandler(null);
      void stopTypingSignaling();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const syncTyping = async () => {
      for (let attempt = 0; attempt < 60 && !cancelled; attempt += 1) {
        if (isUserCallChannelSubscribed()) {
          break;
        }

        await new Promise((resolve) => window.setTimeout(resolve, 250));
      }

      if (cancelled) {
        return;
      }

      const conversationIds = selectedId ? [selectedId] : [];
      await syncTypingSignalingSubscriptions(conversationIds);
    };

    void syncTyping();

    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  useEffect(() => {
    void startRealtime();

    const unsubscribeEvents = subscribeRealtimeEvent((event) => {
      handleRealtimeEventRef.current(event);
    });
    const unsubscribeStatus = subscribeRealtimeStatus(setRealtimeStatus);

    return () => {
      unsubscribeEvents();
      unsubscribeStatus();
      setRealtimeStatus('idle');
      void stopRealtime();
      stopPresenceManager();

      if (refreshConversationsTimerRef.current) {
        window.clearTimeout(refreshConversationsTimerRef.current);
      }

      if (draftSaveTimerRef.current) {
        window.clearTimeout(draftSaveTimerRef.current);
      }

      if (typingStopTimerRef.current) {
        window.clearTimeout(typingStopTimerRef.current);
      }

      for (const timeoutId of typingTimersRef.current.values()) {
        window.clearTimeout(timeoutId);
      }
      typingTimersRef.current.clear();

      void stopTypingSignaling();
    };
  }, []);

  useEffect(() => {
    if (!selectedId || mainView !== 'chat') {
      return;
    }

    const pollMs = realtimeStatus === 'connected' ? THREAD_POLL_CONNECTED_MS : THREAD_POLL_MS;
    let pollInFlight = false;

    const intervalId = window.setInterval(() => {
      if (pollInFlight) {
        return;
      }

      pollInFlight = true;
      void Promise.all([
        refreshActiveThreadSilently(selectedId),
        realtimeStatus === 'connected' ? Promise.resolve() : refreshConversations(),
      ]).finally(() => {
        pollInFlight = false;
      });
    }, pollMs);

    return () => window.clearInterval(intervalId);
  }, [mainView, realtimeStatus, refreshActiveThreadSilently, refreshConversations, selectedId]);

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

    const currentUser = userRef.current;
    const currentUserId = getUserId(currentUser);

    if (currentUserId) {
      void broadcastTypingIndicator(conversationId, {
        userId: currentUserId,
        username: getUserDisplayName(currentUser),
        isTyping: false,
      });
    }
  }, []);

  const pulseTyping = useCallback(
    (conversationId: string) => {
      if (!isTypingActiveRef.current) {
        isTypingActiveRef.current = true;
        void sendTypingUpdate(conversationId, true);

        const currentUser = userRef.current;
        const currentUserId = getUserId(currentUser);

        if (currentUserId) {
          void broadcastTypingIndicator(conversationId, {
            userId: currentUserId,
            username: getUserDisplayName(currentUser),
            isTyping: true,
          });
        }
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
              setDraftPreviewForConversation(selectedId, null);
              setConversations((current) => applyDraftPreviews(current));
            }
          });
        }

        return;
      }

      void saveChatDraft(selectedId, draft).then((result) => {
        if (result.ok) {
          lastSavedDraftRef.current = draft;
          setDraftPreviewForConversation(selectedId, draft.trim());
          setConversations((current) => applyDraftPreviews(current));
        }
      });
    }, DRAFT_SAVE_MS);

    return () => {
      if (draftSaveTimerRef.current) {
        window.clearTimeout(draftSaveTimerRef.current);
      }
    };
  }, [applyDraftPreviews, draft, selectedId, setDraftPreviewForConversation]);

  useEffect(() => {
    if (!selectedId) {
      return;
    }

    setDraftPreviewForConversation(selectedId, draft.trim() || null);
    setConversations((current) => applyDraftPreviews(current));
  }, [applyDraftPreviews, draft, selectedId, setDraftPreviewForConversation]);

  useEffect(() => {
    lastSavedDraftRef.current = '';

    return () => {
      if (selectedId && isTypingActiveRef.current) {
        stopTyping(selectedId);
      }
    };
  }, [selectedId, stopTyping]);

  useEffect(() => {
    if (bootstrapStartedRef.current) {
      return;
    }

    bootstrapStartedRef.current = true;

    void loadData();
    void loadCalendarData();
    void refreshUnreadCount();
    void loadNotificationSettings().then((result) => {
      if (result.ok) {
        notificationSettingsRef.current = result.data;
        setNotificationSettings(result.data);
      }
    });
    void syncNotifications({ seedSnapshot: true });

    window.setTimeout(() => {
      void (async () => {
        if (typeof Notification === 'undefined') {
          return;
        }

        if (Notification.permission === 'default') {
          await Notification.requestPermission();
        }

        if (Notification.permission === 'denied') {
          return;
        }

        if (!shouldDeliverDesktopNotifications()) {
          await enableDesktopPushNotifications();
        }
      })();
    }, 1500);
  }, [loadCalendarData, loadData, refreshUnreadCount, syncNotifications]);

  useEffect(() => {
    if (mainView !== 'chat') {
      return;
    }

    void loadNotificationSettings().then((result) => {
      if (result.ok) {
        notificationSettingsRef.current = result.data;
        setNotificationSettings(result.data);
      }
    });
  }, [mainView]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void syncNotifications();
    }, NOTIFICATION_POLL_MS);

    return () => window.clearInterval(intervalId);
  }, [syncNotifications]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void loadCalendarData();
    }, CALENDAR_POLL_MS);

    return () => window.clearInterval(intervalId);
  }, [loadCalendarData]);

  useEffect(() => {
    return scheduleCalendarReminders(calendarEvents, (event) => {
      void showCalendarEventReminder(
        event.title || 'Calendar event',
        event.startsAt ? `Starting now · ${event.title}` : 'Your event is starting now.',
        () => openCalendarFromNotification(event.id),
      );
    });
  }, [calendarEvents, openCalendarFromNotification]);

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

    void syncNotifications({ withLoading: true, markAllRead: true });

    const intervalId = window.setInterval(() => {
      void syncNotifications();
    }, BELL_POLL_MS);

    return () => window.clearInterval(intervalId);
  }, [notificationsOpen, syncNotifications]);

  useEffect(() => {
    if (mainView !== 'activity') {
      return;
    }

    void loadActivityData();

    const intervalId = window.setInterval(() => {
      void syncNotifications();
    }, BELL_POLL_MS);

    return () => window.clearInterval(intervalId);
  }, [loadActivityData, mainView, syncNotifications]);

  useEffect(() => {
    void loadSavedData({ silent: true });
  }, [loadSavedData]);

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
    clearThreadReplyRegistry();
    clearThreadRepliesStore();

    if (!selectedId) {
      setMessages([]);
      setDraft('');
      setThreadError('');
      return;
    }

    void loadThread(selectedId);
  }, [selectedId, loadThread]);

  useEffect(() => {
    if (!selectedId || threadLoading) {
      return;
    }

    syncThreadCache(selectedId, {
      messages,
      pinnedMessageIds,
      activeHubDetails,
      draft,
    });
  }, [activeHubDetails, draft, messages, pinnedMessageIds, selectedId, syncThreadCache, threadLoading]);

  useEffect(
    () => () => {
      if (markReadTimerRef.current) {
        window.clearTimeout(markReadTimerRef.current);
      }
    },
    [],
  );

  const handleSelectConversation = (
    conversationId: string,
    messageId?: string | null,
    options?: { forceReload?: boolean },
  ) => {
    const outgoingId = selectedIdRef.current;
    const outgoingDraft = draftRef.current;

    if (outgoingId && outgoingId !== conversationId) {
      setDraftPreviewForConversation(outgoingId, outgoingDraft.trim() || null);
      flushDraftSave(outgoingId, outgoingDraft);
      setConversations((current) => applyDraftPreviews(current));
    }

    const shouldUseCache = !options?.forceReload;
    const hasCachedThread = shouldUseCache && hydrateThreadFromCache(conversationId);

    if (!hasCachedThread) {
      setThreadLoading(true);
      setMessages([]);
      setActiveHubDetails(null);
      setPinnedMessageIds([]);
      setDraft('');
      setThreadError('');
      setThreadUnreadAnchorId(null);
    }

    setMainView('chat');
    setSelectedId(conversationId);

    if (messageId) {
      setFocusMessageId(messageId);
    }
  };

  const handleNavigate = useCallback((view: MainView) => {
    startTransition(() => {
      setMainView(view);
    });
  }, []);

  handleSelectConversationRef.current = handleSelectConversation;

  const handleOpenInChat = (conversationId: string | null, messageId?: string | null) => {
    if (!conversationId) {
      toast.error('This file is not linked to a conversation.');
      return;
    }

    handleSelectConversation(conversationId, messageId ?? null);
  };

  const handleOpenDirectChat = useCallback(
    async (userId: string, options?: { displayName?: string; username?: string }) => {
      const displayName = options?.displayName?.trim() || options?.username?.trim() || 'Direct message';
      const existing = findConversationForPeerUserId(
        conversationsRef.current,
        userId,
        directChatMetadataRef.current,
      );

      if (existing) {
        rememberDirectChatMetadata(existing.id, userId, displayName);
        setConversations((current) =>
          upsertConversation(
            current,
            patchDirectConversationMetadata(existing, userId, displayName),
          ),
        );
        prefetchDirectPeerProfile(userId, existing.id, displayName);
        handleSelectConversationRef.current(existing.id);
        return existing.id;
      }

      const result = await createDirectChat(userId);

      if (!result.ok) {
        if (handleUnauthorized(result.status)) {
          return null;
        }

        toast.error(result.error);
        return null;
      }

      const conversationId = result.data.conversationId;
      const baseConversation =
        result.data.conversation ?? buildPlaceholderDirectConversation(conversationId, userId, displayName);
      const entry = patchDirectConversationMetadata(baseConversation, userId, displayName);

      rememberDirectChatMetadata(conversationId, userId, displayName);
      setConversations((current) => upsertConversation(current, entry));
      prefetchDirectPeerProfile(userId, conversationId, displayName);
      handleSelectConversationRef.current(conversationId);

      void loadConversations().then((listResult) => {
        if (!listResult.ok) {
          if (handleUnauthorized(listResult.status)) {
            return;
          }

          return;
        }

        seedDirectChatMetadata(listResult.data.conversations);

        setConversations((current) =>
          commitConversationList(
            mergeConversationLists(current, listResult.data.conversations).map((conversation) => {
              const stored = directChatMetadataRef.current[conversation.id];

              if (!stored) {
                return conversation;
              }

              return patchDirectConversationMetadata(
                conversation,
                stored.peerUserId,
                stored.displayName,
              );
            }),
            { currentUserId: userIdRef.current },
          ),
        );
      });

      return conversationId;
    },
    [commitConversationList, handleUnauthorized, prefetchDirectPeerProfile, rememberDirectChatMetadata, seedDirectChatMetadata, toast, upsertConversation],
  );

  const handleSelectPerson = async (person: SearchPerson) => {
    await handleOpenDirectChat(person.id, {
      displayName: person.name,
      username: person.username,
    });
  };

  const handleMessageSelf = async () => {
    const selfConversation = conversations.find((conversation) => conversation.isSelf);

    if (selfConversation) {
      handleSelectConversation(selfConversation.id);
      return;
    }

    const result = await openSelfConversation();

    if (result.ok) {
      await refreshConversations();
      handleSelectConversation(result.data.conversationId);
    }
  };

  const handleTeammateSelect = async (memberId: string) => {
    const teammate = teammates.find((member) => member.id === memberId);

    if (!teammate) {
      toast.error('Unable to find that teammate.');
      return;
    }

    setOpeningTeammateId(memberId);

    try {
      await handleOpenDirectChat(teammate.id, {
        displayName: teammate.name,
        username: teammate.username,
      });
    } finally {
      setOpeningTeammateId(null);
    }
  };

  const handleNotificationClick = (notification: NotificationItem) => {
    markNotificationSeen(notification);
    const action = resolveNotificationAction(notification, conversations);

    void markNotificationRead(notification.id).then((result) => {
      if (!result.ok) {
        handleUnauthorized(result.status);
        return;
      }

      setPanelNotifications((current) => current.filter((item) => item.id !== notification.id));
      setActivityNotifications((current) => current.filter((item) => item.id !== notification.id));
      void refreshUnreadCount();
    });

    setNotificationsOpen(false);

    if (action.kind === 'calendar') {
      openCalendarFromNotification(action.eventId);
      return;
    }

    if (action.kind === 'chat') {
      handleSelectConversation(action.conversationId, action.messageId);
    }
  };

  handleNotificationClickRef.current = handleNotificationClick;

  const handleSendMessage = async (replyToId?: string) => {
    if (!selectedId || !draft.trim()) {
      return;
    }

    const conversationId = selectedId;
    const content = draft.trim();
    const localId = createLocalMessageId();
    const userId = getUserId(user);
    const optimistic: MessageItem = {
      id: localId,
      content,
      senderId: userId,
      senderName: getUserDisplayName(user),
      senderInitials: getUserInitials(user),
      createdAt: new Date().toISOString(),
      editedAt: null,
      pinnedAt: null,
      isOwn: true,
      status: 'sending',
      reactions: [],
      replyToMessageId: replyToId,
      messageType: 'TEXT',
      media: [],
      deletedForEveryone: false,
      poll: null,
    };

    setDraft('');
    lastSavedDraftRef.current = '';
    setDraftError('');
    setDraftPreviewForConversation(conversationId, null);
    setConversations((current) => applyDraftPreviews(current));
    stopTyping(conversationId);
    void clearChatDraft(conversationId);
    setMessages((current) => appendMessage(current, optimistic, userId));
    touchConversationWithMessage(conversationId, optimistic, false);

    const result = await sendChatMessage(conversationId, content, replyToId);

    if (handleUnauthorized(result.status)) {
      setMessages((current) => current.filter((message) => message.id !== localId));
      setDraft(content);
      return;
    }

    if (!result.ok) {
      setDraftError(result.error);
      setMessages((current) => current.filter((message) => message.id !== localId));
      setDraft(content);
      return;
    }

    setMessages((current) => replaceLocalMessage(current, localId, result.data, userId));
    touchConversationWithMessage(conversationId, withDeliveredStatus(result.data), false);
  };

  const findConversationForFlex = (conversationId: string | null, conversationName: string | null) => {
    if (conversationId) {
      const exact = conversations.find((conversation) => conversation.id === conversationId);
      if (exact) {
        return exact;
      }
    }

    const needle = conversationName?.trim().toLowerCase();
    if (needle) {
      return (
        conversations.find((conversation) => conversation.title.toLowerCase() === needle) ??
        conversations.find((conversation) => conversation.title.toLowerCase().includes(needle)) ??
        null
      );
    }

    return conversations.find((conversation) => conversation.id === selectedId) ?? null;
  };

  const handleFlexCommand = async (result: AiTextResult, input: string): Promise<string> => {
    const command = inferFlexIntent(input, result);
    const action = (command.action ?? '').toLowerCase().replace(/[\s-]+/g, '_');
    const conversation = findConversationForFlex(command.conversationId, command.conversationName);
    const isOpen = action === 'open' || action === 'navigate' || action.includes('open');
    const isSchedule = action === 'schedule' || action.includes('schedule') || Boolean(command.scheduledAt);
    const isSend = action === 'send' || action === 'message' || (action.includes('send') && !isSchedule);
    const isSnoozeMe =
      action === 'snooze_me' ||
      action.includes('snooze_me') ||
      action.includes('snooze_notification') ||
      action.includes('dnd');
    const isSnoozeChat = !isSnoozeMe && (action === 'snooze' || action.includes('snooze'));

    if (isOpen) {
      if (!conversation) {
        return command.text || `I couldn't find ${command.conversationName ?? 'that chat'}.`;
      }

      handleSelectConversation(conversation.id);
      return command.text || `Opened ${conversation.title}.`;
    }

    if (isSend) {
      const content = command.message?.trim();
      if (!conversation) {
        return command.text || 'Name a chat to send to, or open one first.';
      }
      if (!content) {
        return command.text || 'What should I send?';
      }

      const sent = await sendChatMessage(conversation.id, content);
      if (handleUnauthorized(sent.status)) {
        return 'Please sign in again.';
      }
      if (!sent.ok) {
        return sent.error;
      }

      handleSelectConversation(conversation.id);
      void loadThread(conversation.id);
      return command.text || `Sent to ${conversation.title}.`;
    }

    if (isSchedule) {
      const content = command.message?.trim();
      const scheduledAt = command.scheduledAt;
      if (!conversation) {
        return command.text || 'Name a chat to schedule in, or open one first.';
      }
      if (!content || !scheduledAt) {
        return command.text || 'I need a message and a time to schedule that.';
      }

      const scheduled = await scheduleConversationMessage(
        conversation.id,
        buildScheduleMessageBody({ content, scheduledAt }),
      );
      if (handleUnauthorized(scheduled.status)) {
        return 'Please sign in again.';
      }
      if (!scheduled.ok) {
        return scheduled.error;
      }

      handleSelectConversation(conversation.id);
      return command.text || `Scheduled in ${conversation.title}.`;
    }

    if (isSnoozeMe) {
      const hours = command.snoozeHours && command.snoozeHours > 0 ? command.snoozeHours : 1;
      const saved = await saveNotificationSettings({ snoozeValue: hoursToSnoozePreset(hours) });
      if (handleUnauthorized(saved.status)) {
        return 'Please sign in again.';
      }
      if (!saved.ok) {
        return saved.error;
      }

      notificationSettingsRef.current = saved.data;
      setNotificationSettings(saved.data);
      return command.text || `I'll keep you on snooze for ${hours} hour${hours === 1 ? '' : 's'}.`;
    }

    if (isSnoozeChat) {
      if (!conversation) {
        return command.text || `I couldn't find ${command.conversationName ?? 'that chat'} to snooze.`;
      }

      applyConversationSnoozed(conversation.id, true);
      const snoozed = await updateConversationNotificationSettings(
        conversation.id,
        buildConversationSnoozePayload(
          command.snoozeHours ? hoursToSnoozePreset(command.snoozeHours) : '2h',
        ),
      );
      if (handleUnauthorized(snoozed.status)) {
        applyConversationSnoozed(conversation.id, false);
        return 'Please sign in again.';
      }
      if (!snoozed.ok) {
        applyConversationSnoozed(conversation.id, false);
        return snoozed.error;
      }

      return command.text || `Snoozed ${conversation.title}.`;
    }

    if (command.text.trim()) {
      return command.text;
    }

    return "I ran that, but I didn't get a reply I can show.";
  };

  const handleSendMedia = async (
    item: GifPickerItem,
    kind: 'gif' | 'sticker',
    replyToId?: string,
    threadRootId?: string,
  ) => {
    if (!selectedId) {
      return;
    }

    const conversationId = selectedId;
    const localId = createLocalMessageId();
    const userId = getUserId(user);
    const optimistic: MessageItem = {
      id: localId,
      content: kind === 'sticker' ? 'sticker' : '',
      senderId: userId,
      senderName: getUserDisplayName(user),
      senderInitials: getUserInitials(user),
      createdAt: new Date().toISOString(),
      editedAt: null,
      pinnedAt: null,
      isOwn: true,
      status: 'sending',
      reactions: [],
      replyToMessageId: replyToId,
      threadRootId,
      messageType: kind === 'sticker' ? 'STICKER' : 'GIF',
      media: [
        {
          kind,
          url: item.url,
          previewUrl: item.previewUrl ?? item.url,
          name: item.title ?? (kind === 'sticker' ? 'Sticker' : 'GIF'),
        },
      ],
      deletedForEveryone: false,
      poll: null,
    };

    setDraftError('');
    stopTyping(conversationId);
    if (threadRootId) {
      setMessages((current) => bumpThreadReplyCount(current, threadRootId));
    } else {
      setMessages((current) => appendMessage(current, optimistic, userId));
      touchConversationWithMessage(conversationId, optimistic, false);
    }

    const result = await sendChatMediaMessage(conversationId, item, kind, replyToId, threadRootId);

    if (handleUnauthorized(result.status)) {
      if (!threadRootId) {
        setMessages((current) => current.filter((message) => message.id !== localId));
      }
      return;
    }

    if (!result.ok) {
      setDraftError(result.error);
      if (!threadRootId) {
        setMessages((current) => current.filter((message) => message.id !== localId));
      }
      return;
    }

    if (threadRootId) {
      registerThreadReplyMessage(result.data.id, result.data.threadRootId ?? threadRootId);
      appendThreadReply(
        conversationId,
        result.data.threadRootId ?? threadRootId,
        result.data,
      );
      setMessages((current) =>
        bumpThreadReplyCount(
          filterMainChatMessages(current),
          result.data.threadRootId ?? threadRootId,
        ),
      );
      return;
    }

    setMessages((current) => replaceLocalMessage(current, localId, result.data, userId));
    touchConversationWithMessage(conversationId, withDeliveredStatus(result.data), false);
  };

  const handleSendFile = async (
    file: File,
    caption?: string,
    replyToId?: string,
    threadRootId?: string,
  ) => {
    if (!selectedId) {
      return;
    }

    const conversationId = selectedId;
    const localId = createLocalMessageId();
    const userId = getUserId(user);
    const mimeType = file.type || 'application/octet-stream';
    const previewUrl = URL.createObjectURL(file);
    const isImage = mimeType.startsWith('image/');
    const messageCaption = caption?.trim() ?? '';
    const optimistic: MessageItem = {
      id: localId,
      content: messageCaption,
      senderId: userId,
      senderName: getUserDisplayName(user),
      senderInitials: getUserInitials(user),
      createdAt: new Date().toISOString(),
      editedAt: null,
      pinnedAt: null,
      isOwn: true,
      status: 'sending',
      reactions: [],
      replyToMessageId: replyToId,
      threadRootId,
      messageType: isImage ? 'IMAGE' : 'FILE',
      media: [
        {
          kind: isImage ? 'image' : 'file',
          url: previewUrl,
          previewUrl,
          name: file.name,
        },
      ],
      deletedForEveryone: false,
      poll: null,
    };

    setDraftError('');
    if (!threadRootId) {
      setDraft('');
      lastSavedDraftRef.current = '';
      setDraftPreviewForConversation(conversationId, null);
      setConversations((current) => applyDraftPreviews(current));
      void clearChatDraft(conversationId);
    }
    stopTyping(conversationId);
    if (threadRootId) {
      setMessages((current) => bumpThreadReplyCount(current, threadRootId));
    } else {
      setMessages((current) => appendMessage(current, optimistic, userId));
      touchConversationWithMessage(conversationId, optimistic, false);
    }

    const uploadResult = await uploadChatFile(file);

    if (handleUnauthorized(uploadResult.status) || !uploadResult.ok) {
      URL.revokeObjectURL(previewUrl);
      if (!threadRootId) {
        setMessages((current) => current.filter((message) => message.id !== localId));
      }
      if (!uploadResult.ok && !handleUnauthorized(uploadResult.status)) {
        setDraftError(uploadResult.error);
      }
      return;
    }

    const uploadedUrl = uploadResult.data.url;
    if (!threadRootId) {
      setMessages((current) =>
        current.map((message) =>
          message.id === localId
            ? {
                ...message,
                media: [
                  {
                    kind: isImage ? 'image' : 'file',
                    url: uploadedUrl,
                    previewUrl: uploadedUrl,
                    name: file.name,
                  },
                ],
              }
            : message,
        ),
      );
    }
    URL.revokeObjectURL(previewUrl);

    const result = await sendChatFileMessage(
      conversationId,
      uploadedUrl,
      file.name,
      mimeType,
      replyToId,
      threadRootId,
      messageCaption || undefined,
    );

    if (handleUnauthorized(result.status) || !result.ok) {
      if (!threadRootId) {
        setMessages((current) => current.filter((message) => message.id !== localId));
      }
      if (!result.ok && !handleUnauthorized(result.status)) {
        setDraftError(result.error);
      }
      return;
    }

    if (threadRootId) {
      registerThreadReplyMessage(result.data.id, result.data.threadRootId ?? threadRootId);
      appendThreadReply(
        conversationId,
        result.data.threadRootId ?? threadRootId,
        result.data,
      );
      setMessages((current) =>
        bumpThreadReplyCount(
          filterMainChatMessages(current),
          result.data.threadRootId ?? threadRootId,
        ),
      );
      return;
    }

    setMessages((current) => replaceLocalMessage(current, localId, result.data, userId));
    touchConversationWithMessage(conversationId, withDeliveredStatus(result.data), false);
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
          ? preserveMessageOwnership(mergeMessageUpdates(message, result.data), message, getUserId(user))
          : message,
      ),
    );

    patchThreadCacheMessages(threadCacheRef.current, selectedId, (current) =>
      current.map((message) =>
        message.id === messageId
          ? preserveMessageOwnership(mergeMessageUpdates(message, result.data), message, getUserId(user))
          : message,
      ),
    );
  };

  const handleVotePoll = async (messageId: string, optionId: string) => {
    if (!selectedId) {
      return;
    }

    const result = await votePoll(selectedId, messageId, optionId);

    if (!result.ok) {
      if (handleUnauthorized(result.status)) {
        return;
      }

      toast.error(result.error);
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
    toast.success(message);
  };

  const handleToggleConversationPin = async (conversationId: string, isPinned: boolean) => {
    if (pinningConversationId) {
      return;
    }

    setPinningConversationId(conversationId);
    setConversations((current) =>
      commitConversationList(
        current.map((item) =>
          item.id === conversationId ? { ...item, isPinned: !isPinned } : item,
        ),
      ),
    );

    const result = await setConversationFavorite(conversationId, !isPinned);
    setPinningConversationId(null);

    if (!result.ok) {
      if (handleUnauthorized(result.status)) {
        return;
      }

      toast.error(result.error);
      void refreshConversations();
      return;
    }

    const nextPinned = result.data.favorite;
    setConversations((current) =>
      commitConversationList(
        current.map((item) =>
          item.id === conversationId ? { ...item, isPinned: nextPinned } : item,
        ),
      ),
    );

    showActionMessage(nextPinned ? 'Chat pinned.' : 'Chat unpinned.');
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

    const confirmed = await confirm({
      title: scope === 'everyone' ? 'Delete for everyone' : 'Delete message',
      message:
        scope === 'everyone'
          ? 'This message will be removed for all members. This cannot be undone.'
          : 'Delete this message from your view?',
      confirmLabel: 'Delete',
      tone: 'danger',
    });

    if (!confirmed) {
      return;
    }

    const result = await deleteChatMessage(selectedId, messageId, scope);

    if (!result.ok) {
      if (handleUnauthorized(result.status)) {
        return;
      }

      if (scope === 'everyone' && isAlreadyDeletedForEveryoneError(result.error)) {
        setMessages((current) =>
          current.map((message) =>
            message.id === messageId ? markMessageDeletedForEveryone(message) : message,
          ),
        );
        showActionMessage('Message deleted for everyone.');
        return;
      }

      setThreadError(result.error);
      toast.error(result.error);
      return;
    }

    if (result.data.scope === 'everyone') {
      setMessages((current) =>
        current.map((message) =>
          message.id === messageId ? markMessageDeletedForEveryone(message) : message,
        ),
      );
    } else {
      setMessages((current) => current.filter((message) => message.id !== messageId));
    }

    showActionMessage(scope === 'everyone' ? 'Message deleted for everyone.' : 'Message deleted.');
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
      setConversations((current) =>
        commitConversationList(mergeConversationLists(current, conversationsResult.data.conversations)),
      );
    }

    setMainView('chat');

    if (selectedId === targetConversationId) {
      const forwarded = commitMessages(result.data.messages, getUserId(user));

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
        message.id === messageId ? preserveMessageOwnership(result.data, message, getUserId(user)) : message,
      ),
    );

    setPinnedMessageIds((current) =>
      isPinned ? current.filter((id) => id !== messageId) : [...new Set([...current, messageId])],
    );

    patchThreadCacheMessages(threadCacheRef.current, selectedId, (current) =>
      current.map((message) =>
        message.id === messageId ? preserveMessageOwnership(result.data, message, getUserId(user)) : message,
      ),
    );

    const cached = getThreadCacheEntry(threadCacheRef.current, selectedId);

    if (cached) {
      writeThreadCacheEntry(threadCacheRef.current, selectedId, {
        ...cached,
        pinnedMessageIds: isPinned
          ? cached.pinnedMessageIds.filter((id) => id !== messageId)
          : [...new Set([...cached.pinnedMessageIds, messageId])],
      });
    }

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
          conversations={conversations}
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
            handleOpenInChat(item.conversationId, item.messageId);
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
          onOpenInChat={(item) => {
            handleOpenInChat(item.conversationId, item.messageId ?? item.id);
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
          user={user}
          onRetry={() => {
            void loadCalendarData();
          }}
          onRefresh={() => {
            void loadCalendarData();
            void syncNotifications();
          }}
          onNotificationsRefresh={() => {
            void syncNotifications();
          }}
          onUnauthorized={handleUnauthorized}
          highlightEventId={highlightCalendarEventId}
          onHighlightHandled={() => setHighlightCalendarEventId(null)}
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
          joiningChannelId={joiningChannelId}
          onRetry={() => {
            void loadHubsData();
          }}
          onAcceptInvite={async (inviteId) => {
            const result = await acceptHubInviteById(inviteId);
            if (result.ok) {
              void loadHubsData();
              void refreshConversations();
              toast.success('Hub invite accepted.');
            } else if (handleUnauthorized(result.status)) {
              return;
            } else {
              setHubsError(result.error);
              toast.error(result.error);
            }
          }}
          onDeclineInvite={async (inviteId) => {
            const result = await declineHubInvite(inviteId);
            if (result.ok) {
              void loadHubsData();
              toast.success('Hub invite declined.');
            } else if (handleUnauthorized(result.status)) {
              return;
            } else {
              setHubsError(result.error);
              toast.error(result.error);
            }
          }}
          onJoinChannel={async (channelId) => {
            setJoiningChannelId(channelId);
            setHubsError('');

            const result = await acceptHubInvite(channelId);

            setJoiningChannelId(null);

            if (result.ok) {
              void loadHubsData();
              void refreshConversations();
              toast.success('Joined hub successfully.');
              handleSelectConversation(channelId);
              setMainView('chat');
              return;
            }

            if (handleUnauthorized(result.status)) {
              return;
            }

            setHubsError(result.error);
            toast.error(result.error);
          }}
          onOpenChannel={(channelId) => {
            handleSelectConversation(channelId);
            setMainView('chat');
          }}
        />
      );
    }

    if (mainView === 'profile') {
      return (
        <ProfileSettingsView
          user={user}
          onLogout={() => void handleSignOut()}
          onUnauthorized={handleUnauthorized}
          onUserUpdated={() => {
            void getCurrentUser().then((result) => {
              if (result.ok) {
                setUser(result.data.user ?? result.data);
              }
            });
          }}
        />
      );
    }

    if (mainView === 'organization') {
      return (
        <OrganizationView
          user={user}
          onUnauthorized={handleUnauthorized}
          onLeftOrganization={() => {
            setMainView('chat');
            void getCurrentUser().then((result) => {
              if (result.ok) {
                setUser(result.data.user ?? result.data);
              }
            });
            void loadData();
          }}
        />
      );
    }

    if (selectedConversation) {
      return (
        <ConversationThread
          conversation={selectedConversation}
          hubDetails={selectedConversation.kind === 'hub' ? activeHubDetails : null}
          conversationDetails={activeHubDetails}
          pinnedMessageIds={pinnedMessageIds}
          conversations={conversations}
          messages={messages}
          draft={draft}
          loading={threadLoading}
          error={threadError}
          draftError={draftError}
          typingLabel={typingLabel}
          isSending={isSending}
          onDraftChange={handleDraftChange}
          onSend={(replyToMessageId) => {
            void handleSendMessage(replyToMessageId);
          }}
          onSendMedia={(item, kind, replyToId, threadRootId) => {
            void handleSendMedia(item, kind, replyToId, threadRootId);
          }}
          onSendFile={(file, caption, replyToId, threadRootId) => {
            void handleSendFile(file, caption, replyToId, threadRootId);
          }}
          onUnauthorized={handleUnauthorized}
          currentUserId={getUserId(user)}
          onAddReaction={(messageId, emoji) => {
            void handleAddReaction(messageId, emoji);
          }}
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
          savedMessageIds={savedMessageIds}
          onVotePoll={(messageId, optionId) => {
            void handleVotePoll(messageId, optionId);
          }}
          onConversationUpdated={() => {
            void refreshConversations();
            if (selectedId) {
              void loadThread(selectedId);
            }
          }}
          onNotificationsSnoozedChange={(snoozed) => {
            if (selectedId) {
              applyConversationSnoozed(selectedId, snoozed);
            }
          }}
          onTogglePin={(conversationId, isPinned) => {
            void handleToggleConversationPin(conversationId, isPinned);
          }}
          onOpenCalendar={() => {
            setMainView('calendar');
            void loadCalendarData();
          }}
          onHubDeleted={() => {
            setSelectedId(null);
            void refreshConversations();
          }}
          focusMessageId={focusMessageId}
          unreadAnchorMessageId={threadUnreadAnchorId}
          scrollRestoreKey={messageScrollRestoreKey}
          onFocusMessageHandled={() => setFocusMessageId(null)}
          onOpenFlexAi={() => setFlexAiOpen((current) => !current)}
          onThreadReplySent={(threadRootId) => {
            setMessages((current) => bumpThreadReplyCount(current, threadRootId));
          }}
          onThreadMessagesRegistered={() => {
            setMessages((current) => filterMainChatMessages(current));
          }}
          callBusy={callManager.busy || callManager.session.phase !== 'idle'}
          onStartVoiceCall={() => {
            if (!selectedConversation) {
              return;
            }

            if (selectedConversation.kind === 'hub') {
              void callManager.startGroupMeeting(selectedConversation, false);
              return;
            }

            const peerUserId =
              selectedConversation.peerUserId ??
              directChatMetadata[selectedConversation.id]?.peerUserId ??
              null;

            void callManager.startDirectCall(
              peerUserId
                ? { ...selectedConversation, peerUserId, kind: 'direct' as const }
                : selectedConversation,
              false,
            );
          }}
          onStartVideoCall={() => {
            if (!selectedConversation) {
              return;
            }

            if (selectedConversation.kind === 'hub') {
              void callManager.startGroupMeeting(selectedConversation, true);
              return;
            }

            const peerUserId =
              selectedConversation.peerUserId ??
              directChatMetadata[selectedConversation.id]?.peerUserId ??
              null;

            void callManager.startDirectCall(
              peerUserId
                ? { ...selectedConversation, peerUserId, kind: 'direct' as const }
                : selectedConversation,
              true,
            );
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

  const callPipMode =
    callManager.session.phase === 'active' && callPanelLayout === 'minimized';
  const showMeetingBanner =
    callManager.session.phase === 'idle' && Boolean(callManager.session.meetingBanner);

  return (
    <div
      className={`flex h-full bg-app-chat-bg ${callPipMode ? 'overflow-hidden bg-[#101114]' : ''}`}
    >
      <MediaPreviewHost />
      <CallOverlay
        session={callManager.session}
        busy={callManager.busy}
        callNotice={callManager.callNotice}
        room={callManager.room}
        remoteParticipants={callManager.remoteParticipants}
        mediasoupPeers={callManager.mediasoupPeers}
        mediasoupLocalVideo={callManager.mediasoupLocalVideo}
        micEnabled={callManager.micEnabled}
        cameraEnabled={callManager.cameraEnabled}
        screenShareEnabled={callManager.screenShareEnabled}
        pendingJoinRequests={callManager.pendingJoinRequests}
        awaitingJoinApproval={callManager.awaitingJoinApproval}
        onPanelLayoutChange={setCallPanelLayout}
        onAccept={() => void callManager.acceptIncomingCall()}
        onReject={() => void callManager.rejectIncomingCall()}
        onCancel={() => void callManager.cancelOutgoingCall()}
        onEnd={() => void callManager.endActiveCall()}
        onToggleMic={() => void callManager.toggleMic()}
        onToggleCamera={() => void callManager.toggleCamera()}
        onToggleScreenShare={() => void callManager.toggleScreenShare()}
        onJoinMeeting={() => {
          const meeting = callManager.session.meetingBanner;

          if (!meeting) {
            return;
          }

          const targetConversation =
            conversations.find((conversation) => conversation.id === meeting.conversationId) ??
            (selectedConversation?.id === meeting.conversationId ? selectedConversation : null);

          if (!targetConversation) {
            toast.error('Open the hub for this meeting, then tap Join again.');
            void handleSelectConversation(meeting.conversationId);
            return;
          }

          void callManager.joinGroupMeeting(targetConversation, meeting);
        }}
        onDismissMeetingBanner={callManager.dismissMeetingBanner}
        onApproveJoinRequest={(requestId) =>
          void callManager.respondToJoinRequest(requestId, true)
        }
        onDenyJoinRequest={(requestId) => void callManager.respondToJoinRequest(requestId, false)}
        onMuteParticipant={(participantIdentity, muted) =>
          void callManager.muteRemoteParticipant(participantIdentity, muted)
        }
        onRemoveParticipant={(participantIdentity) =>
          void callManager.removeRemoteParticipant(participantIdentity)
        }
      />
      <div
        className={`flex min-h-0 min-w-0 flex-1 ${callPipMode ? 'pointer-events-none invisible' : ''}`}
        aria-hidden={callPipMode}
      >
      <FlexAiPanel
        open={flexAiOpen}
        draft={draft}
        conversationId={selectedId}
        onToggle={() => setFlexAiOpen((current) => !current)}
        onClose={() => setFlexAiOpen(false)}
        onInsert={handleDraftChange}
        onCommand={handleFlexCommand}
        onUnauthorized={handleUnauthorized}
      />
      <OrganizationInviteModal
        onUnauthorized={handleUnauthorized}
        onInviteResolved={() => {
          void loadData();
          void getCurrentUser().then((result) => {
            if (result.ok) {
              setUser(result.data.user ?? result.data);
            }
          });
        }}
      />
      <NavRail
        unreadCount={unreadCount}
        user={user}
        activeView={mainView}
        onNavigate={handleNavigate}
        onOpenFlexAi={() => setFlexAiOpen((current) => !current)}
        onLogout={() => void handleSignOut()}
      />

      <ChatSidebar
        workspaceName={workspaceShortName}
        selfLabel={selfLabel}
        openingTeammateId={openingTeammateId}
        directChatMetadata={directChatMetadata}
        conversations={conversations}
        typingPreviews={typingPreviews}
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
        onPrefetch={prefetchThread}
        onTogglePin={(conversationId, isPinned) => {
          void handleToggleConversationPin(conversationId, isPinned);
        }}
        pinningConversationId={pinningConversationId}
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
        onNavigate={handleNavigate}
        onCreateHub={async (name, memberIds) => {
          const result = await createHubChannel({ name, memberIds });

          if (!result.ok) {
            if (handleUnauthorized(result.status)) {
              return { ok: false, error: result.error };
            }

            return { ok: false, error: result.error };
          }

          const conversationId = result.data.conversationId;

          void loadHubsData();
          void refreshConversations();
          handleSelectConversation(conversationId);
          setMainView('chat');
          showActionMessage('Hub created successfully.');
          return { ok: true };
        }}
        onCreateGroup={async (name, memberIds) => {
          const result = await createGroupConversation(name, memberIds);

          if (!result.ok) {
            if (handleUnauthorized(result.status)) {
              return { ok: false, error: result.error };
            }

            return { ok: false, error: result.error };
          }

          await refreshConversations();
          handleSelectConversation(result.data.conversationId);
          setMainView('chat');
          showActionMessage('Group created successfully.');
          return { ok: true };
        }}
      />

      <main
        className={`relative flex min-w-0 flex-1 flex-col ${showMeetingBanner ? 'pt-[4.25rem] sm:pt-20' : ''}`}
      >
        {mainView === 'chat' && notificationSettings ? (
          <NotificationStatusBanner
            settings={notificationSettings}
            onOpenSettings={() => handleNavigate('profile')}
          />
        ) : null}
        {mainView === 'chat' &&
        isOrgAdmin &&
        planComplianceRules.length > 0 &&
        !planComplianceDismissed ? (
          <PlanComplianceBanner
            rules={planComplianceRules}
            onDismiss={() => {
              setPlanComplianceDismissed(true);
              writePlanComplianceDismissed(true);
            }}
            onManagePlan={() => handleNavigate('organization')}
          />
        ) : null}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {renderMainPanel()}
        </div>
      </main>
      </div>
    </div>
  );
}
