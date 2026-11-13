import { useCallback, useEffect, useMemo, useRef, useState, startTransition } from 'react';
import { createPortal } from 'react-dom';
import type {
  CalendarEventItem,
  FileItem,
  SavedMessageItem,
} from '../shared/features';
import type { MainView } from '../shared/nav';
import type { SearchPerson } from '../shared/search';
import {
  filterMessagesForBlockPolicy,
  isBlockedByViewer,
  redactDirectConversationForPeerBlock,
} from '../shared/blocking';
import {
  mergeCalendarEventTagFields,
  readAllCalendarEventTagSnapshotsAsync,
} from '../shared/calendarEventTags';
import {
  buildCalendarHubOptions,
  enrichCalendarEventsWithTeammateAvatars,
  resolveMyEventResponse,
} from '../shared/extras';
import {
  getBlockedByPeerIds,
  getBlockedUserIds,
  markUserBlocked,
  markUserUnblocked,
  refreshBlockedUsersFromApi,
  setBlockedUserIdsFromList,
  subscribeBlockedUsers,
  syncPeerBlockFromRelationship,
} from './blockedUsersSync';
import { getCurrentUser, getStoredUser } from './authApi';
import {
  acceptHubInvite,
  acceptHubInviteById,
  blockUser,
  loadBlockedUsers,
  loadFriendRelationship,
  unblockUser,
  addMessageReaction,
  removeMessageReaction,
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
  loadConversationMessages,
  loadConversationNotificationSettings,
  loadResolvedUserStatus,
  loadConversations,
  loadFiles,
  loadFriends,
  loadHubInvites,
  loadMessageDraft,
  loadMessageById,
  loadMessageConversation,
  loadNotificationSettings,
  loadOrganizationMembers,
  loadPendingFriends,
  loadSavedMessages,
  loadUnreadCount,
  loadUserPresence,
  loadRealtimeServerStatus,
  loadUserProfile,
  markConversationRead,
  markConversationUnread,
  markNotificationRead,
  loadNotifications,
  markAllNotificationsRead,
  openSelfConversation,
  pinChatMessage,
  saveChatDraft,
  saveChatMessage,
  saveNotificationSettings,
  scheduleConversationMessage,
  sendChatMessage,
  sendChatVoiceMessage,
  sendChatMediaMessage,
  sendChatFileMessage,
  sendTypingUpdate,
  setConversationFavorite,
  clearChatDraft,
  unpinChatMessage,
  updateConversationNotificationSettings,
  respondFriendRequest,
  sendFriendRequest,
  unsaveChatMessage,
  votePoll,
  summarizeUnreadMessages,
  translateUnreadMessages,
} from './chatApi';
import { ActivityView } from './chat/ActivityView';
import { CallHistoryView } from './chat/CallHistoryView';
import { CalendarView } from './chat/CalendarView';
import { uploadChatFile } from './extrasApi';
import { ChatSidebar } from './chat/ChatSidebar';
import { ChatWelcome } from './chat/ChatWelcome';
import { ConversationThread } from './chat/ConversationThread';
import { SummaryPanel } from './chat/SummaryPanel';
import { FilesView } from './chat/FilesView';
import { HubsView } from './chat/HubsView';
import { NavRail } from './chat/NavRail';
import { SavedView } from './chat/SavedView';
import { ProfileSettingsView } from './chat/ProfileSettingsView';
import { MeetingStartedBanner } from './call/MeetingStartedBanner';
import { OrganizationView } from './chat/OrganizationView';
import { SuperAdminView } from './chat/SuperAdminView';
import { OrganizationInviteModal } from './chat/OrganizationInviteModal';
import { dispatchOrganizationInvitesRefresh } from './organizationInvitesRefresh';
import { PlanComplianceBanner } from './chat/PlanComplianceBanner';
import { loadOrgSubscription, loadPlanCompliance } from './organizationApi';
import {
  readPersistedConversationSnooze,
  writePersistedConversationSnooze,
} from './conversationSnoozeStorage';
import {
  getConversationScrollSnapshot,
  setConversationScrollSnapshot,
  type ConversationScrollSnapshot,
} from './conversationScrollCache';
import {
  readPersistedDirectChatMetadata,
  readPlanComplianceDismissed,
  writePersistedDirectChatMetadata,
  writePlanComplianceDismissed,
} from './directChatMetadataStorage';
import { clearProfileCache, readPeerProfile, writePeerProfile } from './profileCache';
import { useConfirm } from './ui/ConfirmDialog';
import { useToast } from './ui/Toast';
import type { ConversationItem, DirectChatMetadata, PresenceStatus } from '../shared/chat';
import {
  mergePresenceItemsForRequestedUsers,
  mergeResolvedPresenceMaps,
  bootstrapPresenceFromConversations,
  mapLivePresenceUpdateStatus,
} from '../shared/presence';
import { mapApiPresenceToStatus, mergeConversationDraftPreviews, seedDraftPreviewCache, buildPlaceholderDirectConversation, dedupeDirectConversations, mergeConversationLists, repairConversationPeerIds, patchDirectConversationMetadata, applyStoredDirectChatMetadata, findConversationByAnyId, findConversationForPeerUserId, reconcileDirectConversations, dropBrokenDirectConversations, isBrokenDirectTitle, readDirectPeerDisplayName, readConversationSnoozeState, sanitizeDirectDisplayName, withConversationSnoozed, buildConversationSnoozePayload, formatConversationSnoozeUntil, resolveConversationForMessage, resolveTypingConversationId, buildConversationListPreview, areConversationSidebarListsEqual, mergeConversationMemberPreview, collectDirectPeerUserIds, collectSidebarPresenceUserIds, enrichSidebarConversationAvatars, sortSidebarTeammates, lookupPresenceStatus, normalizePresenceUserId, applyPendingHubInvitesToConversations, hubConversationMatchesTarget, isHubChannelConversation, isJoinedHubConversation, markHubConversationsJoined } from '../shared/chat';
import { enrichCallHistoryItems, type CallHistoryItem } from '../shared/calls';
import type {
  MessageItem,
  NotificationItem,
  PendingFriendItem,
  TeammateItem,
} from '../shared/messages';
import type { GifPickerItem } from '../shared/gifs';
import type { ConversationBootstrap } from '../shared/messages';
import { applyMessageDeletionToList, applyMessageReadReceipts, applyReactionPatch, buildScheduleMessageBody, clearThreadReplyRegistry, compareMessagesChronologically, enrichMessageReplies, extractPeerLastReadMessageIds, filterMainChatMessages, findFirstUnreadMessageId, findHubInviteForNotification, formatMessagePreview, isAlreadyDeletedForEveryoneError, isDeletedMessage, isPendingHubInviteNotification, markMessageDeletedForEveryone, mergeMessageListsChronologically, mergeMessageUpdates, mergeServerMessagesWithLocal, messageReactionMatchesUser, notificationMatchesHubInviteTarget, readLastReadMessageId, registerThreadReplyMessage, resolveMessageReadBy, resolveNotificationAction, resolveNotificationConversationId, resolveThreadRootId, userHasMessageReaction } from '../shared/messages';
import type { AiTextResult } from '../shared/extras';
import { hoursToSnoozePreset, inferFlexIntent } from '../shared/extras';
import type { ProfileSettings } from '../shared/profile';
import {
  mergeRemoteUserStatus,
  normalizeUserProfile,
  readUserPresenceStatus,
  userCanManageOrganization,
} from '../shared/profile';
import { shouldSharePresenceWithOthers } from '../shared/presencePrivacy';
import { scheduleCalendarReminders } from './calendarReminders';
import {
  alertNewDesktopNotifications,
  alertNewPendingFriendRequests,
  alertNewPendingHubInvites,
  bindMessageNotificationSound,
  peekNewNotifications,
  markNotificationSeen,
  seedNotificationSnapshot,
  seedPendingFriendsSnapshot,
  seedPendingHubInvitesSnapshot,
  registerNotificationNavigationFallback,
  shouldSkipDuplicateMessageNotification,
  hasShownMessageAlert,
  showCalendarEventReminder,
  showIncomingMessageDesktopNotification,
} from './desktopNotifications';
import {
  ensureDesktopNotificationsReady,
  shouldDeliverDesktopNotifications,
} from './pushNotifications';
import {
  extractConversationIdFromRealtime,
  extractConversationMemberIds,
  extractDeletedMessageId,
  extractMessageDeleteScope,
  extractMessageFromRealtimePayload,
  extractPresenceUpdate,
  extractReactionEvent,
  extractTypingUpdate,
  formatTypingIndicatorLabel,
  isCacheInvalidateEvent,
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
import {
  getUserAvatarUrl,
  getUserDisplayName,
  getUserId,
  getUserInitials,
  getUserUsername,
  getWorkspaceName,
  getWorkspaceShortName,
  userInOrganization,
} from '../shared/user';
import { userIsSuperAdmin } from '../shared/superadmin';
import { parseMeetingNotificationBody, type MeetingStartedPayload } from '../shared/calls';
import { loadCallHistory } from './callsApi';
import { useCallManager } from './callManager';
import { isUserCallChannelSubscribed } from './callSignaling';
import { CallOverlay } from './chat/CallOverlay';
import { MediaPreviewHost } from './chat/MediaPreviewHost';
import type { CallPanelLayout } from './call/CallFloatingPanel';
import { subscribeCallWindowPresentation } from './callWindowApi';
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
import {
  applyRemotePresenceBootstrap,
  getEffectivePresenceStatus,
  isPresenceManagerStarted,
  isPresenceSharingEnabled,
  setManualPresenceStatus,
  setPresenceSharingEnabled,
  startPresenceManager,
  stopPresenceManager,
  syncPresenceToServer,
} from './presenceManager';
import { readProfileCache, writeProfileCache } from './profileCache';
import { clearConversationScrollSnapshot } from './conversationScrollCache';
import {
  getThreadCacheEntry,
  invalidateThreadCacheEntry,
  patchThreadCacheMessages,
  writeThreadCacheEntry,
  type ThreadCacheStore,
} from './threadCache';
import { syncDesktopAppBadge } from './desktopAppBadge';
import { clearDraftContentCache, setDraftContentCache } from './draftCache';
import { appendThreadReply, clearThreadRepliesStore } from './threadRepliesStore';
import {
  perfMeasure,
  perfMeasureAsync,
  perfIncrement,
  perfPresenceRefreshEnter,
  perfPresenceRefreshExit,
} from './dev/perfInstrumentation';
import {
  useConversationThreadCallbacks,
  type ConversationThreadActions,
} from './chat/useConversationThreadCallbacks';
import {
  appendMessage,
  applyMainChatFilterIfChanged,
  buildPresenceRefreshInflightKey,
  bumpThreadReplyCount,
  commitMessages,
  createLocalMessageId,
  isActivelyViewingConversation,
  isLocalMessageId,
  markMessageStatus,
  markOwnMessages,
  mergeIncomingMessage,
  mergeLocalPendingMessages,
  MESSAGE_HISTORY_PAGE_SIZE,
  notificationBelongsToConversation,
  preserveMessageOwnership,
  replaceLocalMessage,
  resolveConversationUnreadCountOverride,
  resolveHasMoreMessagesFromBootstrap,
  resolveTyperDisplayName,
  shouldDropHubMessageFromBlockedSender,
  sortConversations,
  stripConversationMessageNotifications,
  withDeliveredStatus,
  type ConversationTypingState,
} from './features/chat/lib/chatPageHelpers';

const PENDING_FRIENDS_CACHE_MS = 120_000;
const TYPING_STOP_MS = 3_000;
const TYPING_LABEL_MS = 5_000;

type FileFilter = 'all' | 'images' | 'docs' | 'other';

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
  const allowSuperAdminAutoLandingRef = useRef(userIsSuperAdmin(getStoredUser()));

  const [mainView, setMainView] = useState<MainView>(() =>
    userIsSuperAdmin(getStoredUser()) ? 'superadmin' : 'chat',
  );
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [presenceByUserId, setPresenceByUserId] = useState<Map<string, PresenceStatus>>(
    () => new Map(),
  );
  const bootstrapPresenceRef = useRef<Map<string, PresenceStatus>>(new Map());
  const presenceRefreshInflightRef = useRef(new Map<string, Promise<void>>());
  const redisPresencePollingRef = useRef(false);
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
  const realtimeStatusRef = useRef<RealtimeConnectionStatus>('idle');
  const [threadLoading, setThreadLoading] = useState(false);
  const [threadJumpSyncing, setThreadJumpSyncing] = useState(false);
  const [threadError, setThreadError] = useState('');
  const [threadUnreadAnchorId, setThreadUnreadAnchorId] = useState<string | null>(null);
  const [activeHubDetails, setActiveHubDetails] = useState<Record<string, unknown> | null>(null);
  const [pinnedMessageIds, setPinnedMessageIds] = useState<string[]>([]);
  const [pinningConversationId, setPinningConversationId] = useState<string | null>(null);
  const [conversationMenuBusyId, setConversationMenuBusyId] = useState<string | null>(null);
  const [blockedUserIds, setBlockedUserIds] = useState<ReadonlySet<string>>(() => getBlockedUserIds());
  const [blockedByPeerIds, setBlockedByPeerIds] = useState<ReadonlySet<string>>(() => getBlockedByPeerIds());
  const blockedUserIdsRef = useRef(blockedUserIds);
  const [isSending, setIsSending] = useState(false);
  const [flexAiOpen, setFlexAiOpen] = useState(false);
  const [callPanelLayout, setCallPanelLayout] = useState<CallPanelLayout>('floating');
  const [hasMoreOlderMessages, setHasMoreOlderMessages] = useState(false);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const loadingOlderInFlightRef = useRef(false);
  const hasMoreOlderMessagesRef = useRef(false);
  const [summaryPanelOpen, setSummaryPanelOpen] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryContent, setSummaryContent] = useState<string | null>(null);
  const callPhaseRef = useRef<'idle' | 'outgoing' | 'incoming' | 'connecting' | 'active' | 'ending'>('idle');
  const cancelledLocalMessageIdsRef = useRef<Set<string>>(new Set());
  const abortOutboundSendRef = useRef(
    new Map<
      string,
      {
        conversationId: string;
        fileName: string | null;
        caption: string;
      }
    >(),
  );
  const hiddenOutboundSendRef = useRef(
    new Map<
      string,
      {
        conversationId: string;
        fileName: string | null;
        caption: string;
      }
    >(),
  );
  const suppressedMessageIdsRef = useRef<Set<string>>(new Set());
  const locallyHiddenMessageIdsRef = useRef<Set<string>>(new Set());
  const [locallyHiddenRevision, setLocallyHiddenRevision] = useState(0);
  const [outboundSendProgress, setOutboundSendProgress] = useState<Record<string, number>>({});
  const pendingFileRetriesRef = useRef(
    new Map<
      string,
      {
        file: File;
        caption: string;
        replyToId?: string;
        threadRootId?: string;
        uploadedUrl?: string;
      }
    >(),
  );

  const outboundSendProgressCeilingRef = useRef<Record<string, number>>({});

  const patchOutboundSendProgress = (messageId: string, progress: number | null) => {
    setOutboundSendProgress((current) => {
      if (progress == null) {
        delete outboundSendProgressCeilingRef.current[messageId];
        if (!(messageId in current)) {
          return current;
        }

        const next = { ...current };
        delete next[messageId];
        return next;
      }

      const previous = outboundSendProgressCeilingRef.current[messageId] ?? 0;
      const nextValue = Math.max(previous, progress);
      outboundSendProgressCeilingRef.current[messageId] = nextValue;

      return { ...current, [messageId]: nextValue };
    });
  };

  const finishOutboundSendProgress = async (messageId: string) => {
    patchOutboundSendProgress(messageId, 100);
    await new Promise((resolve) => window.setTimeout(resolve, 320));
    patchOutboundSendProgress(messageId, null);
  };

  const isLocalSendCancelled = (localId: string) =>
    cancelledLocalMessageIdsRef.current.has(localId);

  const isHiddenOutboundSend = (localId: string) =>
    hiddenOutboundSendRef.current.has(localId);

  const cleanupCancelledOutboundSend = (localId: string, previewUrl?: string) => {
    pendingFileRetriesRef.current.delete(localId);
    patchOutboundSendProgress(localId, null);

    if (previewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
  };


  const [activityNotifications, setActivityNotifications] = useState<NotificationItem[]>([]);
  const [activityPendingFriends, setActivityPendingFriends] = useState<PendingFriendItem[]>([]);
  const [activityHubInvites, setActivityHubInvites] = useState<import('../shared/features').HubInviteItem[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState('');

  const [callHistoryItems, setCallHistoryItems] = useState<CallHistoryItem[]>([]);
  const [callHistoryLoading, setCallHistoryLoading] = useState(false);
  const [callHistoryError, setCallHistoryError] = useState('');
  const [callHistoryFilter, setCallHistoryFilter] = useState<'all' | 'missed'>('all');

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
  const calendarHubOptions = useMemo(() => buildCalendarHubOptions(conversations), [conversations]);
  const [highlightCalendarEventId, setHighlightCalendarEventId] = useState<string | null>(null);
  const [openingTeammateId, setOpeningTeammateId] = useState<string | null>(null);
  const [directChatMetadata, setDirectChatMetadata] = useState<Record<string, DirectChatMetadata>>(
    () => readPersistedDirectChatMetadata(),
  );
  const directChatMetadataRef = useRef<Record<string, DirectChatMetadata>>({});
  const [notificationSettings, setNotificationSettings] = useState<ProfileSettings | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateViewed, setUpdateViewed] = useState(false);
  const [profileInitialTab, setProfileInitialTab] = useState<
    'profile' | 'appearance' | 'notifications' | 'privacy' | 'updates'
  >('profile');
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

  const pendingConversationReadSyncRef = useRef<Set<string>>(new Set());
  const conversationReadSyncInFlightRef = useRef<Set<string>>(new Set());
  const refreshConversationsTimerRef = useRef<number | null>(null);
  const draftSaveChainRef = useRef<Promise<void>>(Promise.resolve());
  const draftPersistTokenRef = useRef(0);
  const draftDirtyRef = useRef(false);
  const composerReplyToIdRef = useRef<string | null>(null);
  const typingStopTimerRef = useRef<number | null>(null);
  const typingTimersRef = useRef<Map<string, number>>(new Map());
  const lastSavedDraftRef = useRef('');
  const lastSavedReplyToIdRef = useRef<string | null>(null);
  const draftRef = useRef('');
  const draftPreviewsRef = useRef<Record<string, string | null>>({});
  const threadCacheRef = useRef<ThreadCacheStore>({});
  const activeHubDetailsRef = useRef<Record<string, unknown> | null>(null);
  const prefetchInFlightRef = useRef<Set<string>>(new Set());
  const hubAvatarHydrateInFlightRef = useRef<Set<string>>(new Set());
  const prefetchTimerRef = useRef<Record<string, number>>({});
  const bootstrapStartedRef = useRef(false);
  const pendingFriendsCacheRef = useRef<{ fetchedAt: number; count: number } | null>(null);
  const pendingHubInvitesCacheRef = useRef<{ fetchedAt: number; count: number } | null>(null);
  const isTypingActiveRef = useRef(false);
  const selectedIdRef = useRef<string | null>(null);
  const messagesRef = useRef<MessageItem[]>([]);
  const reactionInFlightRef = useRef<Set<string>>(new Set());
  const mainViewRef = useRef<MainView>('chat');
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
  const loadCallHistoryDataRef = useRef<(() => void) | null>(null);
  const conversationsRef = useRef(conversations);
  const teammatesRef = useRef(teammates);
  const userRef = useRef(user);
  const handleSelectConversationRef = useRef<
    (conversationId: string, messageId?: string | null, options?: { forceReload?: boolean }) => void
  >(() => {});
  const syncNotificationsRef = useRef<
    (options?: { seedSnapshot?: boolean; withLoading?: boolean; markAllRead?: boolean }) => Promise<void>
  >(async () => {});
  const refreshConversationsRef = useRef<() => Promise<void>>(async () => {});
  const refreshActiveThreadSilentlyRef = useRef<(conversationId: string) => Promise<void>>(async () => {});
  const refreshUnreadCountRef = useRef<(notificationItems?: NotificationItem[]) => Promise<void>>(async () => {});
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

  useEffect(() => {
    if (!window.electronAPI) return;

    // One deferred update check shortly after startup (no recurring poll).
    const updateCheckTimer = window.setTimeout(() => {
      void window.electronAPI?.checkForUpdates().catch(() => undefined);
    }, 5000);

    let lastUpdateToastVersion = '';

    const unsubAvailable = window.electronAPI.onUpdaterEvent('update-available', (info: any) => {
      setUpdateAvailable(true);
      setUpdateViewed(false);

      const versionLabel = String(info?.version || '').trim() || 'new';
      if (lastUpdateToastVersion === versionLabel) {
        return;
      }
      lastUpdateToastVersion = versionLabel;

      toast.info(`Version ${versionLabel} is ready to download.`, {
        action: {
          label: 'View Update',
          onClick: () => {
            setProfileInitialTab('updates');
            handleNavigate('profile');
          },
        },
      });
    });

    return () => {
      clearTimeout(updateCheckTimer);
      unsubAvailable();
    };
  }, []);

  const isOrgAdmin = useMemo(() => userCanManageOrganization(user), [user]);

  selectedIdRef.current = selectedId;
  messagesRef.current = messages;
  mainViewRef.current = mainView;
  realtimeStatusRef.current = realtimeStatus;
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

  const viewerUserId = getUserId(user);
  const viewerUsername = getUserUsername(user);
  const viewerDisplayName = getUserDisplayName(user);

  const calendarInviteStatusByEventId = useMemo(() => {
    const next: Record<string, string | null> = {};

    for (const event of calendarEvents) {
      next[event.id] = resolveMyEventResponse(
        event,
        viewerUserId,
        viewerUsername,
        viewerDisplayName,
      );
    }

    return next;
  }, [calendarEvents, viewerDisplayName, viewerUserId, viewerUsername]);

  const visibleMessages = useMemo(() => {
    const conversationKind = selectedConversation?.kind ?? 'direct';
    const filtered = filterMessagesForBlockPolicy(
      messages,
      conversationKind,
      blockedUserIds,
      viewerUserId,
    );

    return filtered.filter((message) => !locallyHiddenMessageIdsRef.current.has(message.id));
  }, [
    messages,
    locallyHiddenRevision,
    blockedUserIds,
    selectedConversation?.kind,
    viewerUserId,
  ]);

  const conversationsForSidebar = useMemo(() => {
    const withHubMembership = applyPendingHubInvitesToConversations(
      conversations,
      activityHubInvites,
    );

    return withHubMembership.map((conversation) =>
      redactDirectConversationForPeerBlock(conversation, blockedByPeerIds),
    );
  }, [activityHubInvites, blockedByPeerIds, conversations]);

  useEffect(() => {
    if (!selectedId || mainView !== 'chat') {
      return;
    }

    const selected =
      conversations.find((conversation) => conversation.id === selectedId) ?? null;

    if (!selected) {
      return;
    }

    const [resolved] = applyPendingHubInvitesToConversations([selected], activityHubInvites);

    if (resolved && isHubChannelConversation(resolved) && !isJoinedHubConversation(resolved)) {
      setSelectedId(null);
      setMainView('activity');
    }
  }, [activityHubInvites, conversations, mainView, selectedId]);

  const selectedConversationForDisplay = useMemo(() => {
    if (!selectedConversation) {
      return null;
    }

    return redactDirectConversationForPeerBlock(selectedConversation, blockedByPeerIds);
  }, [blockedByPeerIds, selectedConversation]);

  const typingPreviews = useMemo(() => {
    const previews: Record<string, string> = {};

    for (const [conversationId, state] of Object.entries(typingByConversation)) {
      const conversation =
        conversations.find((item) => item.id === conversationId) ??
        (selectedConversation?.id === conversationId ? selectedConversation : null);
      const visibleTypers = state.userIds.filter((id) => {
        if (isBlockedByViewer(id, blockedUserIds)) {
          return false;
        }

        if (
          conversation?.kind === 'direct' &&
          conversation.peerUserId &&
          blockedByPeerIds.has(conversation.peerUserId)
        ) {
          return false;
        }

        return true;
      });

      const label = formatTypingIndicatorLabel(
        visibleTypers.map((id) => state.namesByUserId[id] ?? 'Someone'),
      );

      if (label) {
        previews[conversationId] = label;
      }
    }

    return previews;
  }, [blockedByPeerIds, blockedUserIds, conversations, selectedConversation, typingByConversation]);

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

  const applyConversationSidebarPatch = useCallback(
    (current: ConversationItem[], map: (items: ConversationItem[]) => ConversationItem[]) => {
      const next = applyDraftPreviews(sortConversations(map(current)));
      return areConversationSidebarListsEqual(current, next) ? current : next;
    },
    [applyDraftPreviews],
  );

  const commitConversationList = useCallback(
    (
      items: ConversationItem[],
      options?: { seedFromApi?: boolean; currentUserId?: string | null },
    ) =>
      perfMeasure('chat:commitConversationList', () => {
      const viewerId = options?.currentUserId ?? userIdRef.current;
      const selfName = getUserDisplayName(userRef.current);
      const teammateMap = new Map(
        teammatesRef.current.map((teammate) => [
          teammate.id,
          { name: teammate.name, username: teammate.username },
        ]),
      );
      const teammateAvatars = new Map(
        teammatesRef.current.map((teammate) => [teammate.id, teammate.avatarUrl] as const),
      );
      const peerAvatars = new Map<string, string | null>();
      for (const conversation of items) {
        if (conversation.kind !== 'direct' || !conversation.peerUserId) {
          continue;
        }

        const cachedPeer = readPeerProfile(conversation.peerUserId);
        if (cachedPeer?.avatarUrl) {
          peerAvatars.set(conversation.peerUserId, cachedPeer.avatarUrl);
        }
      }

      const sorted = sortConversations(
        enrichSidebarConversationAvatars(
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
          {
            viewerDisplayName: selfName,
            viewerAvatarUrl: getUserAvatarUrl(userRef.current),
            teammateAvatars,
            peerAvatars,
          },
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
      }),
    [applyDraftPreviews],
  );

  const patchHubMemberPreview = useCallback(
    (conversationId: string, conversationRecord: Record<string, unknown>) => {
      setConversations((current) =>
        applyConversationSidebarPatch(current, (items) =>
          items.map((conversation) =>
            conversation.id === conversationId
              ? mergeConversationMemberPreview(conversation, conversationRecord)
              : conversation,
          ),
        ),
      );
    },
    [applyConversationSidebarPatch],
  );

  const hydrateHubMemberAvatars = useCallback(
    (items: ConversationItem[]) => {
      for (const conversation of items) {
        if (conversation.kind !== 'hub') {
          continue;
        }

        const avatarCount = conversation.memberAvatars?.length ?? 0;
        const needsMoreAvatars = avatarCount < 3;
        const needsMemberCount =
          (conversation.totalMemberCount ?? 0) <= Math.max(avatarCount, 1);

        if (!needsMoreAvatars && !needsMemberCount) {
          continue;
        }

        const cachedThread = getThreadCacheEntry(threadCacheRef.current, conversation.id);

        if (cachedThread?.activeHubDetails) {
          patchHubMemberPreview(conversation.id, cachedThread.activeHubDetails);
          continue;
        }

        if (
          hubAvatarHydrateInFlightRef.current.has(conversation.id) ||
          prefetchInFlightRef.current.has(conversation.id)
        ) {
          continue;
        }

        hubAvatarHydrateInFlightRef.current.add(conversation.id);

        void loadConversationBootstrap(conversation.id)
          .then((result) => {
            if (!result.ok) {
              return;
            }

            patchHubMemberPreview(conversation.id, result.data.conversation);
          })
          .finally(() => {
            hubAvatarHydrateInFlightRef.current.delete(conversation.id);
          });
      }
    },
    [patchHubMemberPreview],
  );

  const upsertConversation = useCallback(
    (items: ConversationItem[], conversation: ConversationItem) => {
      const without = items.filter((item) => item.id !== conversation.id);
      const bumped = {
        ...conversation,
        timestamp: new Date().toISOString(),
      };
      return commitConversationList([bumped, ...without], { seedFromApi: false });
    },
    [commitConversationList],
  );

  const prefetchDirectPeerProfile = useCallback(
    (peerUserId: string, conversationId: string, fallbackName?: string) => {
      const selfName = getUserDisplayName(userRef.current);

      const applyProfile = (displayName: string, avatarUrl?: string | null) => {
        const trimmedName = sanitizeDirectDisplayName(displayName, selfName, fallbackName);

        if (isBrokenDirectTitle(trimmedName, selfName)) {
          return;
        }

        rememberDirectChatMetadata(conversationId, peerUserId, trimmedName);
        setConversations((current) =>
          applyConversationSidebarPatch(current, (items) =>
            items.map((conversation) =>
              conversation.id === conversationId
                ? patchDirectConversationMetadata(
                    conversation,
                    peerUserId,
                    trimmedName,
                    selfName,
                    avatarUrl ?? conversation.avatarUrl,
                  )
                : conversation,
            ),
          ),
        );
      };

      const cached = readPeerProfile(peerUserId);

      if (cached) {
        const cachedName = cached.name.trim() || cached.username.trim();

        if (cachedName) {
          applyProfile(cachedName, cached.avatarUrl);
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

        applyProfile(displayName, profile.avatarUrl);
      });
    },
    [applyConversationSidebarPatch, rememberDirectChatMetadata],
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

    draftPreviewsRef.current[conversationId] = null;
  }, []);

  const syncThreadCache = useCallback(
    (
      conversationId: string,
      entry: {
        messages: MessageItem[];
        pinnedMessageIds: string[];
        activeHubDetails: Record<string, unknown> | null;
        draft: string;
        hasMoreOlderMessages?: boolean;
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
    setHasMoreOlderMessages(
      cached.hasMoreOlderMessages ?? cached.messages.length >= MESSAGE_HISTORY_PAGE_SIZE,
    );
    setActiveHubDetails(cached.activeHubDetails);
    setPinnedMessageIds(cached.pinnedMessageIds);
    setDraft(cached.draft);
    lastSavedDraftRef.current = cached.draft.trim();
    lastSavedReplyToIdRef.current = null;
    draftDirtyRef.current = false;
    setDraftContentCache(conversationId, cached.draft);
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

  const bumpDraftPersistToken = useCallback(() => {
    draftPersistTokenRef.current += 1;
    return draftPersistTokenRef.current;
  }, []);

  const flushDraftSave = useCallback(
    (conversationId: string) => {
      if (!conversationId || !draftDirtyRef.current) {
        return;
      }

      const contentSnapshot = draftRef.current;
      const replySnapshot = composerReplyToIdRef.current ?? null;
      draftDirtyRef.current = false;

      const runSave = async () => {
        const persistToken = draftPersistTokenRef.current;
        const content = contentSnapshot;
        const trimmed = content.trim();
        const normalizedReply = replySnapshot;

        const applyPreview = (preview: string | null) => {
          setDraftPreviewForConversation(conversationId, preview);
          setDraftContentCache(conversationId, preview);
          setConversations((current) => applyDraftPreviews(current));
        };

        if (!trimmed) {
          if (!lastSavedDraftRef.current.trim() && lastSavedReplyToIdRef.current === null) {
            return;
          }

          if (persistToken !== draftPersistTokenRef.current) {
            return;
          }

          const result = await clearChatDraft(conversationId);

          if (persistToken !== draftPersistTokenRef.current) {
            return;
          }

          if (result.ok) {
            lastSavedDraftRef.current = '';
            lastSavedReplyToIdRef.current = null;
            applyPreview(null);
          } else {
            draftDirtyRef.current = true;
          }

          return;
        }

        if (
          trimmed === lastSavedDraftRef.current.trim() &&
          normalizedReply === lastSavedReplyToIdRef.current
        ) {
          return;
        }

        if (persistToken !== draftPersistTokenRef.current) {
          return;
        }

        const result = await saveChatDraft(conversationId, content, normalizedReply);

        if (persistToken !== draftPersistTokenRef.current) {
          return;
        }

        if (result.ok) {
          const preview = result.data?.content?.trim() ?? trimmed;
          lastSavedDraftRef.current = preview;
          lastSavedReplyToIdRef.current = normalizedReply;
          applyPreview(preview || null);
        } else {
          draftDirtyRef.current = true;
        }
      };

      draftSaveChainRef.current = draftSaveChainRef.current.then(runSave).catch(() => {
        draftDirtyRef.current = true;
      });
    },
    [applyDraftPreviews, setDraftPreviewForConversation],
  );

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

      if (isOwn) {
        draftPreviewsRef.current[conversationId] = null;
      }

      setConversations((current) =>
        applyConversationSidebarPatch(current, (items) =>
          items.map((conversation) => {
            if (conversation.id !== conversationId) {
              return conversation;
            }

            const listPreview = buildConversationListPreview(
              conversation.kind,
              preview,
              message.senderName,
            );

            return {
              ...conversation,
              messagePreview: listPreview,
              subtitle: listPreview,
              draftPreview: null,
              isDraftPreview: false,
              timestamp,
              unreadCount:
                incrementUnread && !isOwn
                  ? Math.max(conversation.unreadCount, 0) + 1
                  : conversation.unreadCount,
            };
          }),
        ),
      );
    },
    [applyConversationSidebarPatch],
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

  const purgeCancelledServerMessage = async (
    conversationId: string,
    serverMessageId: string,
    scope: 'me' | 'everyone',
  ) => {
    suppressedMessageIdsRef.current.add(serverMessageId);
    const result = await deleteChatMessage(conversationId, serverMessageId, scope);
    if (!result.ok && !handleUnauthorized(result.status)) {
      suppressedMessageIdsRef.current.delete(serverMessageId);
    }
  };

  const finalizeCancelledOutboundSend = async (
    localId: string,
    conversationId: string,
    serverMessage?: MessageItem,
  ) => {
    cleanupCancelledOutboundSend(localId);
    cancelledLocalMessageIdsRef.current.delete(localId);
    abortOutboundSendRef.current.delete(localId);

    if (serverMessage?.id) {
      await purgeCancelledServerMessage(conversationId, serverMessage.id, 'everyone');
    }
  };

  const rememberLocallyHiddenMessage = (messageId: string) => {
    if (!messageId) {
      return;
    }

    locallyHiddenMessageIdsRef.current.add(messageId);
    setLocallyHiddenRevision((value) => value + 1);
  };

  const scheduledDeleteForMeIdsRef = useRef<Set<string>>(new Set());

  const scheduleDeleteForMeAfterSend = (conversationId: string, messageId: string) => {
    if (scheduledDeleteForMeIdsRef.current.has(messageId)) {
      return;
    }

    scheduledDeleteForMeIdsRef.current.add(messageId);
    window.setTimeout(() => {
      void deleteChatMessage(conversationId, messageId, 'me');
    }, 3000);
  };

  const finalizeHiddenOutboundSend = (
    localId: string,
    conversationId: string,
    serverMessage?: MessageItem,
  ) => {
    hiddenOutboundSendRef.current.delete(localId);
    patchOutboundSendProgress(localId, null);

    if (serverMessage?.id) {
      rememberLocallyHiddenMessage(serverMessage.id);
      scheduleDeleteForMeAfterSend(conversationId, serverMessage.id);
    }
  };

  const matchesOutboundSendRecord = (
    incoming: MessageItem,
    record: { fileName: string | null; caption: string },
  ) => {
    const incomingFileName = incoming.media[0]?.name ?? null;
    const captionMatches =
      record.caption === incoming.content.trim() ||
      (!record.caption && !incoming.content.trim());

    if (record.fileName && incomingFileName === record.fileName && captionMatches) {
      return true;
    }

    if (!record.fileName && captionMatches && incoming.content.trim() === record.caption) {
      return true;
    }

    return false;
  };

  const shouldIgnoreCancelledInboundMessage = (
    incoming: MessageItem,
    conversationId: string,
    userId: string | null,
  ) => {
    if (suppressedMessageIdsRef.current.has(incoming.id)) {
      return true;
    }

    if (!userId || (!incoming.isOwn && incoming.senderId !== userId)) {
      return false;
    }

    for (const [localId, record] of abortOutboundSendRef.current.entries()) {
      if (record.conversationId !== conversationId) {
        continue;
      }

      if (matchesOutboundSendRecord(incoming, record)) {
        void finalizeCancelledOutboundSend(localId, conversationId, incoming);
        return true;
      }
    }

    for (const [localId, record] of hiddenOutboundSendRef.current.entries()) {
      if (record.conversationId !== conversationId) {
        continue;
      }

      if (matchesOutboundSendRecord(incoming, record)) {
        if (incoming.id) {
          rememberLocallyHiddenMessage(incoming.id);
          scheduleDeleteForMeAfterSend(conversationId, incoming.id);
        }
        return true;
      }
    }

    if (locallyHiddenMessageIdsRef.current.has(incoming.id)) {
      return true;
    }

    return false;
  };

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
    void window.electronAPI?.setAppBadge?.({ count: 0, mentionUnread: 0 });
    onSessionExpired();
  }, [confirm, onSessionExpired]);

  const activityNotificationsRef = useRef<NotificationItem[]>([]);
  const activityHubInvitesRef = useRef<import('../shared/features').HubInviteItem[]>([]);
  const hubsInvitesRef = useRef<import('../shared/features').HubInviteItem[]>([]);

  useEffect(() => {
    activityNotificationsRef.current = activityNotifications;
  }, [activityNotifications]);

  useEffect(() => {
    activityHubInvitesRef.current = activityHubInvites;
  }, [activityHubInvites]);

  useEffect(() => {
    hubsInvitesRef.current = hubsInvites;
  }, [hubsInvites]);

  useEffect(() => {
    syncDesktopAppBadge({
      activityUnread: unreadCount,
      notifications: activityNotifications,
    });
  }, [activityNotifications, unreadCount]);

  const refreshUnreadCount = useCallback(
    async (notificationItems?: NotificationItem[]) => {
      let pendingCount = 0;
      let hubInviteCount = 0;
      const pendingCache = pendingFriendsCacheRef.current;
      const pendingCacheFresh =
        pendingCache && Date.now() - pendingCache.fetchedAt < PENDING_FRIENDS_CACHE_MS;

      if (pendingCacheFresh) {
        pendingCount = pendingCache.count;
      } else {
        const pendingResult = await loadPendingFriends();

        if (handleUnauthorized(pendingResult.status)) {
          return;
        }

        pendingCount = pendingResult.ok ? pendingResult.data.length : 0;
        pendingFriendsCacheRef.current = { fetchedAt: Date.now(), count: pendingCount };
      }

      const hubInviteCache = pendingHubInvitesCacheRef.current;
      const hubInviteCacheFresh =
        hubInviteCache && Date.now() - hubInviteCache.fetchedAt < PENDING_FRIENDS_CACHE_MS;

      if (hubInviteCacheFresh) {
        hubInviteCount = hubInviteCache.count;
      } else {
        const hubInvitesResult = await loadHubInvites();

        if (handleUnauthorized(hubInvitesResult.status)) {
          return;
        }

        hubInviteCount = hubInvitesResult.ok ? hubInvitesResult.data.length : 0;
        pendingHubInvitesCacheRef.current = { fetchedAt: Date.now(), count: hubInviteCount };

        if (hubInvitesResult.ok) {
          setActivityHubInvites(hubInvitesResult.data);
        }
      }

      const listSource =
        notificationItems ??
        (activityNotificationsRef.current.length > 0 ? activityNotificationsRef.current : null);

      if (listSource) {
        const unreadFromNotifications = listSource.filter((item) => !item.isRead).length;
        setUnreadCount(unreadFromNotifications + pendingCount + hubInviteCount);
        return;
      }

      const countResult = await loadUnreadCount();

      if (handleUnauthorized(countResult.status)) {
        return;
      }

      const apiCount = countResult.ok ? countResult.data.count : 0;
      setUnreadCount(apiCount + pendingCount + hubInviteCount);
    },
    [handleUnauthorized],
  );

  const clearHubInviteActivityState = useCallback(
    (target: {
      inviteId?: string | null;
      conversationId?: string | null;
      channelId?: string | null;
    }) => {
      const inviteId = target.inviteId?.trim() || null;

      if (inviteId) {
        setActivityHubInvites((current) => current.filter((entry) => entry.id !== inviteId));
        setHubsInvites((current) => current.filter((entry) => entry.id !== inviteId));
      }

      pendingHubInvitesCacheRef.current = null;

      const hubInviteCatalog = [...activityHubInvitesRef.current, ...hubsInvitesRef.current];
      const removedNotifications = activityNotificationsRef.current.filter((notification) =>
        notificationMatchesHubInviteTarget(notification, target, hubInviteCatalog),
      );
      const nextActivityNotifications = activityNotificationsRef.current.filter(
        (notification) => !notificationMatchesHubInviteTarget(notification, target, hubInviteCatalog),
      );

      setActivityNotifications(nextActivityNotifications);
      void refreshUnreadCount(nextActivityNotifications);

      for (const notification of removedNotifications) {
        if (!notification.isRead) {
          void markNotificationRead(notification.id).then((readResult) => {
            if (!readResult.ok) {
              handleUnauthorized(readResult.status);
            }
          });
        }
      }
    },
    [handleUnauthorized, refreshUnreadCount],
  );

  const syncConversationReadState = useCallback(
    (conversationId: string) => {
      if (!conversationId) {
        return;
      }

      pendingConversationReadSyncRef.current.add(conversationId);
      clearConversationUnread(conversationId);

      if (selectedIdRef.current === conversationId) {
        setThreadUnreadAnchorId(null);
      }

      const conversations = conversationsRef.current;
      const removedNotifications = activityNotificationsRef.current.filter((notification) =>
        notificationBelongsToConversation(notification, conversationId, conversations),
      );
      const nextActivityNotifications = stripConversationMessageNotifications(
        activityNotificationsRef.current,
        conversationId,
        conversations,
      );

      setActivityNotifications(nextActivityNotifications);
      void refreshUnreadCount(nextActivityNotifications);

      if (conversationReadSyncInFlightRef.current.has(conversationId)) {
        return;
      }

      conversationReadSyncInFlightRef.current.add(conversationId);

      void markConversationRead(conversationId)
        .then((result) => {
          if (!result.ok) {
            pendingConversationReadSyncRef.current.delete(conversationId);
            handleUnauthorized(result.status);
            void refreshConversationsRef.current();
            void syncNotificationsRef.current();
            return;
          }

          for (const notification of removedNotifications) {
            if (!notification.isRead) {
              void markNotificationRead(notification.id).then((readResult) => {
                if (!readResult.ok) {
                  handleUnauthorized(readResult.status);
                }
              });
            }
          }
        })
        .finally(() => {
          conversationReadSyncInFlightRef.current.delete(conversationId);
          pendingConversationReadSyncRef.current.delete(conversationId);
        });
    },
    [clearConversationUnread, handleUnauthorized, refreshUnreadCount],
  );

  const refreshBlockedUserIds = useCallback(async () => {
    const result = await loadBlockedUsers();

    if (handleUnauthorized(result.status)) {
      return;
    }

    if (result.ok) {
      setBlockedUserIdsFromList(result.data);
    } else {
      await refreshBlockedUsersFromApi();
    }
  }, [handleUnauthorized]);

  useEffect(() => {
    blockedUserIdsRef.current = blockedUserIds;
  }, [blockedUserIds]);

  useEffect(() => {
    return subscribeBlockedUsers(() => {
      setBlockedUserIds(new Set(getBlockedUserIds()));
      setBlockedByPeerIds(new Set(getBlockedByPeerIds()));
    });
  }, []);

  const syncDirectPeerBlockRelationships = useCallback(async () => {
    const peerIds = [
      ...new Set(
        conversationsRef.current
          .filter(
            (conversation) =>
              conversation.kind === 'direct' &&
              !conversation.isSelf &&
              Boolean(conversation.peerUserId),
          )
          .map((conversation) => conversation.peerUserId as string),
      ),
    ];

    if (peerIds.length === 0) {
      return;
    }

    await Promise.all(
      peerIds.map(async (peerUserId) => {
        const result = await loadFriendRelationship(peerUserId);

        if (result.ok) {
          syncPeerBlockFromRelationship(peerUserId, result.data);
        }
      }),
    );
  }, []);

  useEffect(() => {
    void syncDirectPeerBlockRelationships();
  }, [conversations, syncDirectPeerBlockRelationships]);

  useEffect(() => {
    if (!selectedConversation?.peerUserId || selectedConversation.kind !== 'direct') {
      return;
    }

    void loadFriendRelationship(selectedConversation.peerUserId).then((result) => {
      if (result.ok) {
        syncPeerBlockFromRelationship(selectedConversation.peerUserId as string, result.data);
      }
    });
  }, [selectedConversation?.id, selectedConversation?.kind, selectedConversation?.peerUserId]);

  const syncNotificationSettings = useCallback((next: ProfileSettings) => {
    notificationSettingsRef.current = next;
    setNotificationSettings(next);
  }, []);

  const handleSaveConversationScroll = useCallback(
    (conversationId: string, snapshot: ConversationScrollSnapshot) => {
      setConversationScrollSnapshot(conversationId, snapshot);
    },
    [],
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
    if (conversationSnoozeRef.current[conversationId] === true) {
      return true;
    }

    const conversation = findConversationByAnyId(conversationsRef.current, conversationId);

    return conversation?.notificationsSnoozed === true;
  }, []);

  const patchMessageReactions = useCallback(
    (
      conversationId: string,
      messageId: string,
      patch: {
        incoming?: MessageItem;
        replaceReactions?: boolean;
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

        patchMessageReactions(conversationId, messageId, {
          incoming: result.data,
          replaceReactions: true,
        });
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
        const isOpenConversation = resolvedNotificationConversationId
          ? isActivelyViewingConversation(
              resolvedNotificationConversationId,
              mainViewRef.current,
              selectedIdRef.current,
            )
          : false;

        if (
          (resolvedNotificationConversationId &&
            isConversationSnoozed(resolvedNotificationConversationId)) ||
          isOpenConversation
        ) {
          markNotificationSeen(notification);
        }
      }

      alertNewDesktopNotifications(
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
        (notification) => {
          const conversationId = resolveNotificationConversationId(
            notification,
            conversationsRef.current,
          );

          if (conversationId && isConversationSnoozed(conversationId)) {
            return true;
          }

          if (
            conversationId &&
            isActivelyViewingConversation(
              conversationId,
              mainViewRef.current,
              selectedIdRef.current,
            )
          ) {
            return true;
          }

          if (shouldSkipDuplicateMessageNotification(notification)) {
            return true;
          }

          return false;
        },
        conversationsRef.current,
      );
    },
    [isConversationSnoozed, refreshMessageFromNotification, shouldSuppressNotificationAlerts],
  );

  const syncNotifications = useCallback(
    async (options?: {
      seedSnapshot?: boolean;
      withLoading?: boolean;
      markAllRead?: boolean;
      refreshActivitySources?: boolean;
    }) => {
      if (options?.withLoading) {
        setActivityLoading(true);
        setActivityError('');
      }

      if (options?.markAllRead) {
        const markReadResult = await markAllNotificationsRead();

        if (handleUnauthorized(markReadResult.status)) {
          if (options?.withLoading) {
            setActivityLoading(false);
          }
          return;
        }

        if (!markReadResult.ok) {
          if (options?.withLoading) {
            setActivityLoading(false);
          }
          return;
        }
      }

      const notifications = await loadNotifications();

      if (handleUnauthorized(notifications.status)) {
        if (options?.withLoading) {
          setActivityLoading(false);
        }
        return;
      }

      if (!notifications.ok) {
        if (options?.withLoading) {
          setActivityError(notifications.error);
          setActivityLoading(false);
        }
        return;
      }

      let notificationList = notifications.data;

      if (options?.markAllRead) {
        notificationList = notificationList.map((item) => ({ ...item, isRead: true }));
      }

      notificationList = notificationList.filter((notification) => {
        if (!isPendingHubInviteNotification(notification)) {
          return true;
        }

        const matched = findHubInviteForNotification(
          notification,
          activityHubInvitesRef.current,
        );

        if (!matched) {
          return false;
        }

        const conversation = conversationsRef.current.find((item) =>
          hubConversationMatchesTarget(item, matched),
        );

        return !(conversation && isJoinedHubConversation(conversation));
      });

      const activeConversationId = selectedIdRef.current;
      if (activeConversationId && mainViewRef.current === 'chat') {
        notificationList = stripConversationMessageNotifications(
          notificationList,
          activeConversationId,
          conversationsRef.current,
        );
      }

      setActivityNotifications(notificationList);

      if (options?.seedSnapshot) {
        seedNotificationSnapshot(notificationList);
      } else {
        void processNotificationAlerts(notificationList);
      }

      void refreshUnreadCount(notificationList);

      if (!userInOrganization(userRef.current)) {
        dispatchOrganizationInvitesRefresh();
      }

      const pendingCache = pendingFriendsCacheRef.current;
      const pendingListStale =
        options?.refreshActivitySources ||
        !pendingCache ||
        Date.now() - pendingCache.fetchedAt >= PENDING_FRIENDS_CACHE_MS;

      if (options?.withLoading && options?.refreshActivitySources) {
        const [pendingResult, hubInvitesResult] = await Promise.all([
          loadPendingFriends(),
          loadHubInvites(),
        ]);

        if (handleUnauthorized(pendingResult.status) || handleUnauthorized(hubInvitesResult.status)) {
          if (options?.withLoading) {
            setActivityLoading(false);
          }
          return;
        }

        if (pendingResult.ok) {
          pendingFriendsCacheRef.current = {
            fetchedAt: Date.now(),
            count: pendingResult.data.length,
          };
          setActivityPendingFriends(pendingResult.data);
          if (options?.seedSnapshot) {
            seedPendingFriendsSnapshot(pendingResult.data);
          }
        }

        if (hubInvitesResult.ok) {
          pendingHubInvitesCacheRef.current = {
            fetchedAt: Date.now(),
            count: hubInvitesResult.data.length,
          };
          setActivityHubInvites(hubInvitesResult.data);
          if (options?.seedSnapshot) {
            seedPendingHubInvitesSnapshot(hubInvitesResult.data);
          } else {
            void alertNewPendingHubInvites(hubInvitesResult.data, () => {
              setMainView('activity');
            });
          }
        }
      } else {
        if (pendingListStale) {
        void loadPendingFriends().then((pending) => {
          if (handleUnauthorized(pending.status)) {
            return;
          }

          if (pending.ok) {
            pendingFriendsCacheRef.current = {
              fetchedAt: Date.now(),
              count: pending.data.length,
            };
            setActivityPendingFriends(pending.data);
            if (options?.seedSnapshot) {
              seedPendingFriendsSnapshot(pending.data);
            } else {
              void alertNewPendingFriendRequests(pending.data, () => {
                setMainView('activity');
              });
            }
          }
        });
        }

        const hubInviteCache = pendingHubInvitesCacheRef.current;
        const hubInviteListStale =
          !hubInviteCache ||
          Date.now() - hubInviteCache.fetchedAt >= PENDING_FRIENDS_CACHE_MS;

        if (hubInviteListStale) {
        void loadHubInvites().then((hubInvitesResult) => {
          if (handleUnauthorized(hubInvitesResult.status)) {
            return;
          }

          if (hubInvitesResult.ok) {
            pendingHubInvitesCacheRef.current = {
              fetchedAt: Date.now(),
              count: hubInvitesResult.data.length,
            };
            setActivityHubInvites(hubInvitesResult.data);
            if (options?.seedSnapshot) {
              seedPendingHubInvitesSnapshot(hubInvitesResult.data);
            } else {
              void alertNewPendingHubInvites(hubInvitesResult.data, () => {
                setMainView('activity');
              });
            }
          }
        });
        }
      }

      if (options?.withLoading) {
        setActivityLoading(false);
      }
    },
    [handleUnauthorized, processNotificationAlerts, refreshUnreadCount],
  );

  const loadActivityData = useCallback(async () => {
    pendingFriendsCacheRef.current = null;
    pendingHubInvitesCacheRef.current = null;
    await syncNotifications({ withLoading: true, refreshActivitySources: true });
  }, [syncNotifications]);

  const refreshPresence = useCallback(
    async (
      userIds: string[],
      options?: { snapshotMissingAsOffline?: boolean },
    ) => {
      const unique = [...new Set(userIds.filter((id): id is string => Boolean(id)))];

      if (unique.length === 0) {
        return;
      }

      const inflightKey = buildPresenceRefreshInflightKey(unique, options);
      const inflight = presenceRefreshInflightRef.current;
      const existing = inflight.get(inflightKey);

      if (existing) {
        perfIncrement('chat:refreshPresence:dedupedJoin');
        return existing;
      }

      const run = perfMeasureAsync('chat:refreshPresence', async () => {
        perfPresenceRefreshEnter();
        try {
          const result = await perfMeasureAsync('chat:refreshPresence:api', () =>
            loadUserPresence(unique),
          );

          if (!result.ok) {
            handleUnauthorized(result.status);
            return;
          }

          perfMeasure('chat:refreshPresence:process', () => {
            const livePollHadRows = result.data.length > 0;
            const redisMode = redisPresencePollingRef.current;
            const treatMissingAsOffline =
              options?.snapshotMissingAsOffline ??
              (redisMode && unique.length > 1);

            const { statusByUserId: liveByUserId, statusMessageByUserId } =
              mergePresenceItemsForRequestedUsers(result.data, unique, { treatMissingAsOffline });

            const merged = mergeResolvedPresenceMaps(
              bootstrapPresenceRef.current,
              liveByUserId,
              unique,
              {
                livePollHadRows: treatMissingAsOffline && (redisMode || livePollHadRows),
              },
            );

            setPresenceByUserId((current) => {
              let changed = false;

              for (const [userId, status] of merged) {
                if (current.get(userId) !== status) {
                  changed = true;
                  break;
                }
              }

              if (!changed) {
                perfIncrement('chat:refreshPresence:stateSkipped:presenceMap');
                return current;
              }

              perfIncrement('chat:refreshPresence:stateChanged:presenceMap');
              const next = new Map(current);

              for (const [userId, status] of merged) {
                next.set(userId, status);
              }

              return next;
            });

            setTeammates((current) => {
              let changed = false;

              const next = current.map((teammate) => {
                const statusMessage = statusMessageByUserId.get(
                  normalizePresenceUserId(teammate.id),
                );

                if (statusMessage === undefined) {
                  return teammate;
                }

                if (teammate.statusMessage !== statusMessage) {
                  changed = true;
                  return { ...teammate, statusMessage };
                }

                return teammate;
              });

              if (!changed) {
                perfIncrement('chat:refreshPresence:stateSkipped:teammates');
                return current;
              }

              perfIncrement('chat:refreshPresence:stateChanged:teammates');
              return next;
            });
          });
        } finally {
          perfPresenceRefreshExit();
        }
      });

      const promise = run.finally(() => {
        if (inflight.get(inflightKey) === promise) {
          inflight.delete(inflightKey);
        }
      });

      inflight.set(inflightKey, promise);
      return promise;
    },
    [handleUnauthorized],
  );

  const syncRedisPresenceMode = useCallback(async () => {
    const result = await loadRealtimeServerStatus();

    if (result.ok) {
      redisPresencePollingRef.current = result.data.redisPresence;
    }
  }, []);

  const refreshPresenceRef = useRef(refreshPresence);
  refreshPresenceRef.current = refreshPresence;

  useEffect(() => {
    bootstrapPresenceRef.current = bootstrapPresenceFromConversations(conversations);
  }, [conversations]);

  useEffect(() => {
    void syncRedisPresenceMode();
  }, [syncRedisPresenceMode]);

  const applyPresenceSharingPreference = useCallback(
    (userPayload: unknown, settings: ProfileSettings | null | undefined) => {
      const share = shouldSharePresenceWithOthers({
        profileShareOnlineStatus: normalizeUserProfile(userPayload).shareOnlineStatus,
        settingsShareOnlineStatus: settings?.shareOnlineStatus,
      });

      if (share === isPresenceSharingEnabled()) {
        return;
      }

      setPresenceSharingEnabled(share);
      void syncPresenceToServer();
    },
    [],
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
      if (!userInOrganization(userPayload)) {
        dispatchOrganizationInvitesRefresh();
      }
      const statusResult = await loadResolvedUserStatus(getUserId(userPayload) ?? '');
      const { status, statusMessage } = mergeRemoteUserStatus(
        userPayload,
        statusResult.ok ? statusResult.data : null,
      );
      applyPresenceSharingPreference(userPayload, notificationSettingsRef.current);
      startPresenceManager(status, statusMessage);

      if (allowSuperAdminAutoLandingRef.current && userIsSuperAdmin(userPayload)) {
        setMainView('superadmin');
      }
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

    const initialConversations = commitConversationList(conversationsResult.data.conversations, {
      currentUserId: getUserId(currentUser),
    });
    setConversations(initialConversations);
    seedDirectChatMetadata(conversationsResult.data.conversations);
    hydrateHubMemberAvatars(initialConversations);

    if (inOrg) {
      void loadHubInvites().then((hubInvitesResult) => {
        if (!hubInvitesResult.ok) {
          handleUnauthorized(hubInvitesResult.status);
          return;
        }

        pendingHubInvitesCacheRef.current = {
          fetchedAt: Date.now(),
          count: hubInvitesResult.data.length,
        };
        setActivityHubInvites(hubInvitesResult.data);
        seedPendingHubInvitesSnapshot(hubInvitesResult.data);
      });
    }

    if (unreadCountResult.ok) {
      setUnreadCount(unreadCountResult.data.count);
    } else if (handleUnauthorized(unreadCountResult.status)) {
      return;
    }

    if (membersResult?.ok) {
      const currentUserId = getUserId(currentUser);
      const nextTeammates = sortSidebarTeammates(
        membersResult.data.filter((member) => member.id && member.id !== currentUserId),
      );
      setTeammates(nextTeammates);
      teammatesRef.current = nextTeammates;
      setConversations((current) =>
        commitConversationList(current, {
          seedFromApi: false,
          currentUserId,
        }),
      );
    } else if (friendsResult?.ok) {
      const nextTeammates = sortSidebarTeammates(
        friendsResult.data.map((friend) => ({
          id: friend.id,
          name: friend.name,
          username: friend.username,
          avatarUrl: null,
          initials: getUserInitials({ name: friend.name }),
          statusMessage: friend.status,
        })),
      );
      setTeammates(nextTeammates);
      teammatesRef.current = nextTeammates;
    }

    if (friendsResult?.ok) {
      setHubsFriends(friendsResult.data);
    }

    if (orgBootstrapResult?.complianceRules.length) {
      setPlanComplianceRules(orgBootstrapResult.complianceRules);
    } else if (!inOrg) {
      setPlanComplianceRules([]);
    }

    const conversationsForPresence =
      membersResult?.ok
        ? commitConversationList(initialConversations, {
            seedFromApi: false,
            currentUserId: getUserId(currentUser),
          })
        : initialConversations;

    void refreshPresence(
      collectSidebarPresenceUserIds(conversationsForPresence, teammatesRef.current),
    );
    } finally {
      setLoading(false);
    }
  }, [
    applyPresenceSharingPreference,
    commitConversationList,
    handleUnauthorized,
    hydrateHubMemberAvatars,
    refreshPresence,
  ]);

  useEffect(() => {
    const syncSidebarPresence = () => {
      const peerIds = collectSidebarPresenceUserIds(conversationsRef.current, teammatesRef.current);

      if (peerIds.length === 0) {
        return;
      }

      void refreshPresence(peerIds);
    };

    syncSidebarPresence();
  }, [refreshPresence]);

  const loadThread = useCallback(
    async (conversationId: string) => {
      const cached = getThreadCacheEntry(threadCacheRef.current, conversationId);
      const hasCache = Boolean(cached);

      setThreadError('');
      setDraftError('');

      if (!hasCache) {
        setThreadLoading(true);
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

        const serverMessages = commitMessages(
          bootstrapResult.data.messages,
          getUserId(user),
          bootstrapResult.data.conversation,
        );
        const pendingLocalMessages =
          conversationId === selectedIdRef.current
            ? messagesRef.current.filter(
                (message) => isLocalMessageId(message.id) || message.status === 'sending',
              )
            : [];

        const nextMessages = mergeServerMessagesWithLocal(serverMessages, pendingLocalMessages);
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
        const resolvedHasMoreOlder = resolveHasMoreMessagesFromBootstrap(bootstrapResult.data);
        setHasMoreOlderMessages(resolvedHasMoreOlder);
        void hydrateThreadReplyRegistry(conversationId, bootstrapResult.data.messages).then(() => {
          if (conversationId !== selectedIdRef.current) {
            return;
          }

          setMessages((current) => applyMainChatFilterIfChanged(current));
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
          const summary = draftResult.data;

          if (summary?.content) {
            nextDraft = summary.content;
            setDraft(summary.content);
            draftRef.current = summary.content;
            lastSavedDraftRef.current = summary.content.trim();
            lastSavedReplyToIdRef.current = summary.replyToId ?? null;
            draftDirtyRef.current = false;
            setDraftContentCache(conversationId, summary.content);
            setDraftPreviewForConversation(conversationId, summary.content.trim() || null);
          } else {
            nextDraft = '';
            setDraft('');
            draftRef.current = '';
            lastSavedDraftRef.current = '';
            lastSavedReplyToIdRef.current = null;
            draftDirtyRef.current = false;
            clearDraftContentCache(conversationId);
            setDraftPreviewForConversation(conversationId, null);
          }
        } else if (!draftResult.ok && draftResult.status !== 404) {
          // Keep local/cached draft; draft sync failures should not block the composer.
        } else {
          nextDraft = '';
          setDraft('');
          draftRef.current = '';
          lastSavedDraftRef.current = '';
          lastSavedReplyToIdRef.current = null;
          draftDirtyRef.current = false;
          clearDraftContentCache(conversationId);
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
          hasMoreOlderMessages: resolvedHasMoreOlder,
        });

        patchHubMemberPreview(conversationId, bootstrapResult.data.conversation);

        if (memberIds.length > 0) {
          void refreshPresence(memberIds);
        }

        syncConversationReadState(conversationId);
      } finally {
        if (conversationId === selectedIdRef.current) {
          setThreadLoading(false);
          setThreadJumpSyncing(false);
        }
      }
    },
    [applyDraftPreviews, commitConversationList, handleUnauthorized, hydrateConversationSnooze, patchHubMemberPreview, prefetchDirectPeerProfile, rememberDirectChatMetadata, refreshPresence, setDraftPreviewForConversation, syncConversationReadState, syncThreadCache, user],
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

      if (mainViewRef.current === 'calls') {
        loadCallHistoryDataRef.current?.();
      }

    },
    onError: (message) => {
      toast.error(message);
    },
  });

  useEffect(() => {
    setCallPanelLayout('floating');
  }, [callManager.session.callId]);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.setUpdateInstallBlocked) {
      return;
    }

    const callPhase = callManager.session.phase;
    const callBlocked = callPhase !== 'idle' && callPhase !== 'ending';
    const uploadBlocked = messages.some((message) => message.status === 'sending');
    void api.setUpdateInstallBlocked(callBlocked || uploadBlocked);
  }, [callManager.session.phase, messages]);

  useEffect(() => {
    return subscribeCallWindowPresentation((mode) => {
      if (mode === 'fullscreen' || mode === 'floating' || mode === 'minimized') {
        setCallPanelLayout(mode);
      }
    });
  }, []);

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

      const serverMessages = commitMessages(
        result.data.messages,
        getUserId(user),
        result.data.conversation,
      );
      const nextMessages = mergeLocalPendingMessages(
        mergeServerMessagesWithLocal(serverMessages, messagesRef.current),
        messagesRef.current,
      );

      setMessages((current) => {
        const unchanged =
          current.length === nextMessages.length &&
          current.every((message, index) => {
            const next = nextMessages[index];
            return (
              next &&
              message.id === next.id &&
              message.status === next.status &&
              message.content === next.content &&
              message.editedAt === next.editedAt &&
              message.reactions.length === next.reactions.length
            );
          });

        return unchanged ? current : nextMessages;
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

        setMessages((current) => applyMainChatFilterIfChanged(current));
      });
    },
    [syncThreadCache, user],
  );

  const loadOlderMessages = useCallback(async () => {
    const conversationId = selectedIdRef.current;

    if (
      !conversationId ||
      loadingOlderInFlightRef.current ||
      !hasMoreOlderMessagesRef.current
    ) {
      return;
    }

    const sortedCurrent = [...messagesRef.current].sort(compareMessagesChronologically);
    const oldest =
      sortedCurrent.find((message) => !isLocalMessageId(message.id)) ?? sortedCurrent[0];

    if (!oldest || isLocalMessageId(oldest.id)) {
      return;
    }

    loadingOlderInFlightRef.current = true;
    setLoadingOlderMessages(true);

    try {
      const result = await loadConversationMessages(conversationId, {
        before: oldest.id,
        limit: MESSAGE_HISTORY_PAGE_SIZE,
      });

      if (!result.ok || conversationId !== selectedIdRef.current) {
        return;
      }

      const conversationRecord =
        activeHubDetailsRef.current ??
        getThreadCacheEntry(threadCacheRef.current, conversationId)?.activeHubDetails ??
        null;

      const olderMessages = commitMessages(
        result.data.messages,
        getUserId(user),
        conversationRecord,
      );

      if (olderMessages.length === 0) {
        setHasMoreOlderMessages(false);
        return;
      }

      setMessages((current) =>
        enrichMessageReplies(mergeMessageListsChronologically(olderMessages, current)),
      );
      setHasMoreOlderMessages(
        result.data.hasMore ||
          olderMessages.length >= MESSAGE_HISTORY_PAGE_SIZE,
      );
    } finally {
      loadingOlderInFlightRef.current = false;

      if (conversationId === selectedIdRef.current) {
        setLoadingOlderMessages(false);
      }
    }
  }, [user]);

  useEffect(() => {
    hasMoreOlderMessagesRef.current = hasMoreOlderMessages;
  }, [hasMoreOlderMessages]);

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

            const draftContent =
              draftResult.ok && draftResult.data?.content ? draftResult.data.content : '';

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
              hasMoreOlderMessages: resolveHasMoreMessagesFromBootstrap(bootstrapResult.data),
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

            patchHubMemberPreview(conversationId, bootstrapResult.data.conversation);
          })
          .finally(() => {
            prefetchInFlightRef.current.delete(conversationId);
          });
      }, 120);
    },
    [patchHubMemberPreview, prefetchDirectPeerProfile, user],
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

    const [result, tagCache] = await Promise.all([
      loadCalendarEvents(),
      readAllCalendarEventTagSnapshotsAsync(),
    ]);

    if (handleUnauthorized(result.status)) {
      setCalendarLoading(false);
      return;
    }

    if (!result.ok) {
      setCalendarError(result.error);
      setCalendarLoading(false);
      return;
    }

    setCalendarEvents(
      enrichCalendarEventsWithTeammateAvatars(
        result.data.map((event) => {
          const cached = tagCache[event.id];
          return cached ? mergeCalendarEventTagFields(event, cached) : event;
        }),
        teammatesRef.current,
      ),
    );
    setCalendarLoading(false);
  }, [handleUnauthorized]);

  const loadCallHistoryData = useCallback(async () => {
    setCallHistoryLoading(true);
    setCallHistoryError('');

    const result = await loadCallHistory(callHistoryFilter);

    if (handleUnauthorized(result.status)) {
      setCallHistoryLoading(false);
      return;
    }

    if (!result.ok) {
      setCallHistoryError(result.error);
      setCallHistoryLoading(false);
      return;
    }

    setCallHistoryItems(
      enrichCallHistoryItems(result.data, {
        currentUserId: getUserId(userRef.current),
        currentUserName: getUserDisplayName(userRef.current),
        conversations: conversationsRef.current,
        teammateNamesById: Object.fromEntries(
          teammatesRef.current.map((member) => [
            member.id,
            member.name?.trim() || member.username?.trim() || '',
          ]),
        ),
      }),
    );
    setCallHistoryLoading(false);
  }, [callHistoryFilter, handleUnauthorized]);

  loadCallHistoryDataRef.current = () => {
    void loadCallHistoryData();
  };

  const openCalendarFromNotification = useCallback(
    (eventId?: string | null) => {
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

  useEffect(() => {
    if (hubsChannels.length === 0) {
      return;
    }

    setConversations((current) =>
      commitConversationList(
        current.map((conversation) => {
          if (conversation.kind !== 'hub') {
            return conversation;
          }

          const channel =
            hubsChannels.find((item) => item.id === conversation.channelId) ??
            hubsChannels.find((item) => item.id === conversation.id);

          if (!channel || channel.memberCount <= 0) {
            return conversation;
          }

          const totalMemberCount = Math.max(
            conversation.totalMemberCount ?? 0,
            channel.memberCount,
          );

          if (totalMemberCount === conversation.totalMemberCount) {
            return conversation;
          }

          return { ...conversation, totalMemberCount };
        }),
        { seedFromApi: false, currentUserId: userIdRef.current },
      ),
    );
  }, [commitConversationList, hubsChannels]);

  const refreshConversations = useCallback(async () => {
    const result = await loadConversations();

    if (handleUnauthorized(result.status)) {
      return;
    }

    if (result.ok) {
      setConversations((current) => {
        const merged = commitConversationList(mergeConversationLists(current, result.data.conversations));
        const selectedConversationId = selectedIdRef.current;
        const mainView = mainViewRef.current;
        const pendingReadSync = pendingConversationReadSyncRef.current;
        const next = merged.map((conversation) => {
          const unreadCount = resolveConversationUnreadCountOverride(
            conversation,
            selectedConversationId,
            mainView,
            pendingReadSync,
          );

          return unreadCount === conversation.unreadCount
            ? conversation
            : { ...conversation, unreadCount };
        });

        if (!areConversationSidebarListsEqual(current, next)) {
          hydrateHubMemberAvatars(next);
          void refreshPresence(collectSidebarPresenceUserIds(next, teammatesRef.current));
        }

        return areConversationSidebarListsEqual(current, next) ? current : next;
      });
    }
  }, [commitConversationList, handleUnauthorized, hydrateHubMemberAvatars, refreshPresence]);

  const finalizeHubInviteAccept = useCallback(
    async (options: {
      inviteId?: string | null;
      invite?: import('../shared/features').HubInviteItem | null;
      acceptResult?: import('../shared/features').AcceptHubInviteResult | null;
      channelIdFallback?: string | null;
    }) => {
      const invite =
        options.invite ??
        (options.inviteId
          ? activityHubInvites.find((entry) => entry.id === options.inviteId) ??
            hubsInvites.find((entry) => entry.id === options.inviteId)
          : null);

      const target = {
        conversationId:
          options.acceptResult?.conversationId ??
          invite?.conversationId ??
          options.channelIdFallback ??
          invite?.channelId ??
          null,
        channelId:
          options.acceptResult?.channelId ??
          invite?.channelId ??
          options.channelIdFallback ??
          invite?.conversationId ??
          null,
      };

      clearHubInviteActivityState({
        inviteId: options.inviteId,
        conversationId: target.conversationId,
        channelId: target.channelId,
      });

      setConversations((current) =>
        commitConversationList(markHubConversationsJoined(current, target), {
          seedFromApi: false,
          currentUserId: userIdRef.current,
        }),
      );

      await refreshConversations();

      const hubInvitesResult = await loadHubInvites();

      if (hubInvitesResult.ok) {
        const filtered = hubInvitesResult.data.filter((entry) => {
          if (options.inviteId && entry.id === options.inviteId) {
            return false;
          }

          const conversation = conversationsRef.current.find((item) =>
            hubConversationMatchesTarget(item, {
              conversationId: entry.conversationId,
              channelId: entry.channelId,
            }),
          );

          return !(conversation && isJoinedHubConversation(conversation));
        });

        pendingHubInvitesCacheRef.current = {
          fetchedAt: Date.now(),
          count: filtered.length,
        };
        setActivityHubInvites(filtered);
      }

      void loadHubsData();
      void refreshUnreadCount();

      setMainView('chat');

      const resolved =
        (target.conversationId
          ? findConversationByAnyId(conversationsRef.current, target.conversationId)
          : null) ??
        (target.channelId ? findConversationByAnyId(conversationsRef.current, target.channelId) : null);

      const openId = resolved?.id ?? target.conversationId ?? target.channelId;

      if (openId) {
        handleSelectConversationRef.current(openId);
      }
    },
    [
      clearHubInviteActivityState,
      commitConversationList,
      loadHubsData,
      refreshConversations,
      refreshUnreadCount,
    ],
  );

  useEffect(() => {
    if (loading || conversations.length === 0) {
      return;
    }

    if (conversations.some((conversation) => conversation.isSelf)) {
      return;
    }

    void openSelfConversation().then((selfResult) => {
      if (selfResult.ok) {
        void refreshConversations();
      }
    });
  }, [conversations, loading, refreshConversations]);

  const openHubFromNotification = useCallback(
    async (channelId: string | null, inviteId: string | null) => {
      if (channelId) {
        const existing = findConversationByAnyId(conversationsRef.current, channelId);

        if (existing) {
          const inviteStillPending =
            Boolean(inviteId) &&
            (activityHubInvites.some((entry) => entry.id === inviteId) ||
              hubsInvites.some((entry) => entry.id === inviteId));

          const conversation = inviteStillPending
            ? applyPendingHubInvitesToConversations(
                [existing],
                activityHubInvites.length > 0 ? activityHubInvites : hubsInvites,
              )[0] ?? existing
            : existing;

          if (isJoinedHubConversation(conversation)) {
            clearHubInviteActivityState({
              inviteId,
              conversationId: conversation.id,
              channelId: conversation.channelId ?? channelId,
            });
            setMainView('chat');
            handleSelectConversationRef.current(conversation.id);
            return;
          }
        }
      }

      if (inviteId) {
        const inviteSnapshot =
          activityHubInvites.find((entry) => entry.id === inviteId) ??
          hubsInvites.find((entry) => entry.id === inviteId) ??
          null;
        const result = await acceptHubInviteById(inviteId);

        if (result.ok) {
          await finalizeHubInviteAccept({
            inviteId,
            invite: inviteSnapshot,
            acceptResult: result.data,
            channelIdFallback: channelId,
          });
          toast.success('Hub invite accepted.');
          return;
        }

        if (handleUnauthorized(result.status)) {
          return;
        }

        const fallbackConversation = channelId
          ? findConversationByAnyId(conversationsRef.current, channelId)
          : null;

        if (fallbackConversation && isJoinedHubConversation(fallbackConversation)) {
          clearHubInviteActivityState({
            inviteId,
            conversationId: fallbackConversation.id,
            channelId: fallbackConversation.channelId ?? channelId,
          });
          setMainView('chat');
          handleSelectConversationRef.current(fallbackConversation.id);
          return;
        }
      } else if (channelId) {
        const result = await acceptHubInvite(channelId);

        if (result.ok) {
          await finalizeHubInviteAccept({
            acceptResult: result.data,
            channelIdFallback: channelId,
          });
          toast.success('Joined hub successfully.');
          return;
        }

        if (handleUnauthorized(result.status)) {
          return;
        }

        const fallbackConversation = findConversationByAnyId(conversationsRef.current, channelId);

        if (fallbackConversation && isJoinedHubConversation(fallbackConversation)) {
          clearHubInviteActivityState({
            conversationId: fallbackConversation.id,
            channelId: fallbackConversation.channelId ?? channelId,
          });
          setMainView('chat');
          handleSelectConversationRef.current(fallbackConversation.id);
          return;
        }
      }

      setMainView('hubs');
      void loadHubsData();
    },
    [
      activityHubInvites,
      clearHubInviteActivityState,
      finalizeHubInviteAccept,
      handleUnauthorized,
      hubsInvites,
      loadHubsData,
    ],
  );

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

  const notifyIncomingMessage = useCallback(
    (
      message: MessageItem,
      resolvedConversationId: string,
      conversation: ConversationItem | null,
    ) => {
      // Only trigger the IPC desktop notification, since it will now spawn the custom BrowserWindow overlay
      // in all cases (whether the app is focused or not).


      let avatarUrl = conversation?.avatarUrl || null;
      if (message.senderId && teammatesRef.current) {
        const sender = teammatesRef.current.find((t) => t.id === message.senderId);
        if (sender?.avatarUrl) avatarUrl = sender.avatarUrl;
      }

      void showIncomingMessageDesktopNotification(
        message,
        conversation,
        () => handleSelectConversationRef.current(resolvedConversationId, message.id),
        resolvedConversationId,
        avatarUrl
      );
      void refreshUnreadCount();
    },
    [refreshUnreadCount],
  );

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

      if (incomingMessage && conversationId && isDeletedMessage(incomingMessage)) {
        const messageId = incomingMessage.id;
        const applyDelete = (current: MessageItem[]) =>
          applyMessageDeletionToList(current, messageId, 'everyone');

        if (conversationId === activeConversationId) {
          setMessages(applyDelete);
        } else {
          patchThreadCacheMessages(threadCacheRef.current, conversationId, applyDelete);
        }

        setSavedItems((current) => current.filter((item) => item.messageId !== messageId));
        scheduleConversationsRefresh();
        void syncNotifications();
        return;
      }

      if (incomingMessage && conversationId && isNewMessageEvent(type)) {
        const message = markOwnMessages([incomingMessage], userId)[0];
        const { conversationId: resolvedConversationId, conversation } = resolveConversationForMessage(
          conversationsRef.current,
          conversationId,
          message.senderId,
        );
        callManager.clearMeetingBannerFromCallLog(
          message.content,
          resolvedConversationId,
          message.createdAt,
        );
        const isActivelyViewing = isActivelyViewingConversation(
          resolvedConversationId,
          mainViewRef.current,
          activeConversationId,
        );
        const senderIsBlocked = Boolean(
          message.senderId && blockedUserIdsRef.current.has(message.senderId),
        );

        if (shouldDropHubMessageFromBlockedSender(message, conversation, blockedUserIdsRef.current)) {
          return;
        }

        const incrementUnread =
          !isActivelyViewing && !message.isOwn && message.senderId !== userId && !senderIsBlocked;
        const shouldNotifyIncoming =
          !isActivelyViewing &&
          !message.isOwn &&
          message.senderId !== userId &&
          !senderIsBlocked &&
          !isConversationSnoozed(resolvedConversationId) &&
          !shouldSuppressNotificationAlerts() &&
          shouldDeliverDesktopNotifications();

        if (message.senderId && !message.isOwn) {
          clearTypingUser(resolvedConversationId, message.senderId);
        }

        const incomingThreadRootId = resolveThreadRootId(message, userId);

        if (isActivelyViewing) {
          if (incomingThreadRootId) {
            appendThreadReply(resolvedConversationId, incomingThreadRootId, message);
          }

          setMessages((current) =>
            mergeIncomingMessage(current, message, userId, (incoming) =>
              shouldIgnoreCancelledInboundMessage(incoming, resolvedConversationId, userId),
            ),
          );

          if (!message.isOwn && message.senderId !== userId) {
            syncConversationReadState(resolvedConversationId);
          }
        } else if (resolvedConversationId === activeConversationId) {
          if (incomingThreadRootId) {
            appendThreadReply(resolvedConversationId, incomingThreadRootId, message);
          }

          setMessages((current) =>
            mergeIncomingMessage(current, message, userId, (incoming) =>
              shouldIgnoreCancelledInboundMessage(incoming, resolvedConversationId, userId),
            ),
          );

          if (incrementUnread) {
            setUnreadCount((count) => count + 1);
          }

          if (shouldNotifyIncoming) {
            if (!hasShownMessageAlert(message.id)) {
              notifyIncomingMessage(message, resolvedConversationId, conversation);
            }
          } else {
            void syncNotificationsRef.current();
          }
        } else {
          patchThreadCacheMessages(threadCacheRef.current, resolvedConversationId, (current) =>
            mergeIncomingMessage(current, message, userId, (incoming) =>
              shouldIgnoreCancelledInboundMessage(incoming, resolvedConversationId, userId),
            ),
          );

          if (incrementUnread) {
            setUnreadCount((count) => count + 1);
          }

          if (shouldNotifyIncoming) {
            if (!hasShownMessageAlert(message.id)) {
              notifyIncomingMessage(message, resolvedConversationId, conversation);
            }
          } else {
            void syncNotificationsRef.current();
          }
        }

        if (!resolveThreadRootId(message, userId)) {
          touchConversationWithMessage(resolvedConversationId, message, incrementUnread);
        }

        if (!conversation) {
          scheduleConversationsRefresh();
        }

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

          const hasAuthoritativeReactionPayload =
            Boolean(reactionPatch.message) ||
            Boolean(reactionPatch.reactions?.length) ||
            Boolean(reactionPatch.addedReaction) ||
            Boolean(reactionPatch.removedReaction);

          if (conversationId === activeConversationId && !hasAuthoritativeReactionPayload) {
            refreshMessageReactions(conversationId, reactionPatch.messageId);
          }

          void syncNotifications();
          return;
        }
      }

      if (incomingMessage && conversationId && isMessageUpdateEvent(type, event.payload)) {
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

      if (isMessageDeleteEvent(type, event.payload) && conversationId) {
        const messageId = extractDeletedMessageId(event.payload, incomingMessage);

        if (messageId) {
          const deleteScope = extractMessageDeleteScope(event.payload) ?? 'everyone';
          const applyDelete = (current: MessageItem[]) =>
            applyMessageDeletionToList(current, messageId, deleteScope);

          if (conversationId === activeConversationId) {
            setMessages(applyDelete);
          } else {
            patchThreadCacheMessages(threadCacheRef.current, conversationId, applyDelete);
          }

          setSavedItems((current) => current.filter((item) => item.messageId !== messageId));
        }

        scheduleConversationsRefresh();
        void syncNotifications();
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

      if (isCacheInvalidateEvent(type)) {
        scheduleConversationsRefresh();
        dispatchOrganizationInvitesRefresh();
        void syncNotifications();
        return;
      }

      if (isPresenceEvent(type)) {
        const presenceUpdate = extractPresenceUpdate(event.payload);

        if (presenceUpdate) {
          const selfId = userIdRef.current;
          const isSelfUpdate =
            selfId &&
            normalizePresenceUserId(presenceUpdate.userId) === normalizePresenceUserId(selfId);

          if (isSelfUpdate) {
            const apiStatus =
              readUserPresenceStatus({ status: presenceUpdate.status }) ??
              readUserPresenceStatus(presenceUpdate);
            const nextMessage =
              presenceUpdate.statusMessage !== undefined
                ? presenceUpdate.statusMessage
                : undefined;

            if (apiStatus || nextMessage !== undefined) {
              setManualPresenceStatus(
                apiStatus ?? getEffectivePresenceStatus(),
                nextMessage,
              );
            }

            const cachedProfile = readProfileCache();

            if (cachedProfile && nextMessage !== undefined) {
              writeProfileCache({
                profile: {
                  ...cachedProfile.profile,
                  ...(apiStatus ? { status: apiStatus } : {}),
                  statusMessage: nextMessage ?? cachedProfile.profile.statusMessage,
                },
                settings: cachedProfile.settings,
                avatarStyles: cachedProfile.avatarStyles,
              });
            }
          }

          if (presenceUpdate.statusMessage !== undefined) {
            setTeammates((current) =>
              current.map((teammate) =>
                teammate.id === presenceUpdate.userId
                  ? { ...teammate, statusMessage: presenceUpdate.statusMessage ?? '' }
                  : teammate,
              ),
            );
          }

          if (presenceUpdate.status) {
            const peerKey = normalizePresenceUserId(presenceUpdate.userId);
            const liveStatus = mapLivePresenceUpdateStatus(presenceUpdate.status);

            setPresenceByUserId((current) => {
              const next = new Map(current);
              next.set(peerKey, liveStatus);
              return next;
            });

            setConversations((current) =>
              applyDraftPreviews(
                current.map((conversation) =>
                  conversation.peerUserId &&
                  normalizePresenceUserId(conversation.peerUserId) === peerKey
                    ? {
                        ...conversation,
                        status: liveStatus,
                        ...(presenceUpdate.statusMessage !== undefined
                          ? { peerStatusMessage: presenceUpdate.statusMessage }
                          : {}),
                      }
                    : conversation,
                ),
              ),
            );
          } else if (presenceUpdate.statusMessage !== undefined) {
            setConversations((current) =>
              applyDraftPreviews(
                current.map((conversation) =>
                  conversation.peerUserId &&
                  normalizePresenceUserId(conversation.peerUserId) ===
                    normalizePresenceUserId(presenceUpdate.userId)
                    ? {
                        ...conversation,
                        peerStatusMessage: presenceUpdate.statusMessage,
                      }
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
        const { conversationId: resolvedConversationId, conversation } = resolveConversationForMessage(
          conversationsRef.current,
          conversationId,
          message.senderId,
        );
        callManager.clearMeetingBannerFromCallLog(
          message.content,
          resolvedConversationId,
          message.createdAt,
        );
        const isActivelyViewing = isActivelyViewingConversation(
          resolvedConversationId,
          mainViewRef.current,
          activeConversationId,
        );
        const senderIsBlocked = Boolean(
          message.senderId && blockedUserIdsRef.current.has(message.senderId),
        );

        if (shouldDropHubMessageFromBlockedSender(message, conversation, blockedUserIdsRef.current)) {
          return;
        }

        const incrementUnread =
          !isActivelyViewing && !message.isOwn && message.senderId !== userId && !senderIsBlocked;
        const shouldNotifyIncoming =
          !isActivelyViewing &&
          !message.isOwn &&
          message.senderId !== userId &&
          !senderIsBlocked &&
          !isConversationSnoozed(resolvedConversationId) &&
          !shouldSuppressNotificationAlerts() &&
          shouldDeliverDesktopNotifications();

        if (message.senderId && !message.isOwn) {
          clearTypingUser(resolvedConversationId, message.senderId);
        }

        if (conversationId === activeConversationId) {
          setMessages((current) =>
            mergeIncomingMessage(current, message, userId, (incoming) =>
              shouldIgnoreCancelledInboundMessage(incoming, resolvedConversationId, userId),
            ),
          );
        } else {
          patchThreadCacheMessages(threadCacheRef.current, conversationId, (current) =>
            mergeIncomingMessage(current, message, userId, (incoming) =>
              shouldIgnoreCancelledInboundMessage(incoming, resolvedConversationId, userId),
            ),
          );

          if (incrementUnread) {
            setUnreadCount((count) => count + 1);
          }
        }

        touchConversationWithMessage(resolvedConversationId, message, incrementUnread);

        if (!conversationsRef.current.some((item) => item.id === resolvedConversationId)) {
          scheduleConversationsRefresh();
        }

        if (shouldNotifyIncoming) {
          if (!hasShownMessageAlert(message.id)) {
            notifyIncomingMessage(message, resolvedConversationId, conversation);
          }
        } else {
          void syncNotifications();
        }
      }
    },
    [applyDraftPreviews, applyTypingUpdate, callManager.clearMeetingBannerFromCallLog, clearTypingUser, isConversationSnoozed, notifyIncomingMessage, patchMessageReactions, refreshActiveThreadSilently, refreshMessageReactions, scheduleConversationsRefresh, shouldSuppressNotificationAlerts, syncConversationReadState, syncNotifications, touchConversationWithMessage],
  );

  useEffect(() => {
    const banner = callManager.session.meetingBanner;

    if (!banner || selectedId !== banner.conversationId) {
      return;
    }

    const scanFrom = Math.max(0, messages.length - 40);

    for (let index = messages.length - 1; index >= scanFrom; index -= 1) {
      const message = messages[index];

      if (!message) {
        continue;
      }

      callManager.clearMeetingBannerFromCallLog(
        message.content,
        banner.conversationId,
        message.createdAt,
      );
    }
  }, [
    callManager.clearMeetingBannerFromCallLog,
    callManager.session.meetingBanner,
    messages,
    selectedId,
  ]);

  handleRealtimeEventRef.current = handleRealtimeEvent;
  syncNotificationsRef.current = syncNotifications;
  refreshConversationsRef.current = refreshConversations;
  refreshActiveThreadSilentlyRef.current = refreshActiveThreadSilently;
  refreshUnreadCountRef.current = refreshUnreadCount;

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
    const unsubscribeStatus = subscribeRealtimeStatus((status) => {
      const previous = realtimeStatusRef.current;
      realtimeStatusRef.current = status;
      setRealtimeStatus(status);

      if (status === 'connected' && previous !== 'connected') {
        void syncNotificationsRef.current();
        void refreshConversationsRef.current();
        void refreshUnreadCountRef.current();
        void syncPresenceToServer();
        void syncRedisPresenceMode();
        const activeId = selectedIdRef.current;

        if (activeId) {
          void refreshActiveThreadSilentlyRef.current(activeId);
        }

        const peerIds = collectSidebarPresenceUserIds(conversationsRef.current, teammatesRef.current);

        if (peerIds.length > 0) {
          void refreshPresenceRef.current(peerIds);
        }
      }
    });

    return () => {
      unsubscribeEvents();
      unsubscribeStatus();
      setRealtimeStatus('idle');
      void stopRealtime();
      stopPresenceManager();

      if (refreshConversationsTimerRef.current) {
        window.clearTimeout(refreshConversationsTimerRef.current);
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
    const catchUpAfterFocus = () => {
      if (document.hidden) {
        return;
      }

      void syncNotificationsRef.current();
      void refreshUnreadCountRef.current();
      void refreshConversationsRef.current();

      const activeId = selectedIdRef.current;

      if (activeId && mainViewRef.current === 'chat') {
        void refreshActiveThreadSilentlyRef.current(activeId);
      }
    };

    window.addEventListener('focus', catchUpAfterFocus);
    document.addEventListener('visibilitychange', catchUpAfterFocus);

    return () => {
      window.removeEventListener('focus', catchUpAfterFocus);
      document.removeEventListener('visibilitychange', catchUpAfterFocus);
    };
  }, []);

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
      draftRef.current = value;
      draftDirtyRef.current = true;
      setDraft(value);

      if (!selectedId) {
        return;
      }

      setDraftContentCache(selectedId, value);
      setDraftPreviewForConversation(selectedId, value.trim() || null);
      setConversations((current) => applyDraftPreviews(current));

      if (value.trim()) {
        pulseTyping(selectedId);
      } else {
        stopTyping(selectedId);
      }
    },
    [applyDraftPreviews, pulseTyping, selectedId, setDraftPreviewForConversation, stopTyping],
  );

  const handleComposerBlur = useCallback(() => {
    const conversationId = selectedIdRef.current;

    if (!conversationId) {
      return;
    }

    flushDraftSave(conversationId);
  }, [flushDraftSave]);

  useEffect(() => {
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
    void refreshBlockedUserIds();
    void refreshUnreadCount();
    void loadNotificationSettings().then((result) => {
      if (result.ok) {
        notificationSettingsRef.current = result.data;
        setNotificationSettings(result.data);
        applyPresenceSharingPreference(userRef.current, result.data);
      }
    });
    void ensureDesktopNotificationsReady();
    bindMessageNotificationSound(
      () => notificationSettingsRef.current?.messageSoundEnabled ?? false,
    );
    void syncNotifications({ seedSnapshot: true });
  }, [loadCalendarData, loadData, refreshBlockedUserIds, refreshUnreadCount, syncNotifications]);

  useEffect(() => {
    return registerNotificationNavigationFallback(({ conversationId, messageId }) => {
      if (!conversationId) {
        return;
      }

      setMainView('chat');
      handleSelectConversationRef.current(conversationId, messageId ?? undefined);
    });
  }, []);

  useEffect(() => {
    if (mainView !== 'chat') {
      return;
    }

    void loadNotificationSettings().then((result) => {
      if (result.ok) {
        notificationSettingsRef.current = result.data;
        setNotificationSettings(result.data);
        applyPresenceSharingPreference(userRef.current, result.data);
      }
    });
  }, [applyPresenceSharingPreference, mainView]);

  useEffect(() => {
    if (mainView !== 'activity') {
      return;
    }

    void loadActivityData();
  }, [loadActivityData, mainView]);

  useEffect(() => {
    if (!teammates.length) {
      return;
    }

    setCalendarEvents((current) =>
      current.length ? enrichCalendarEventsWithTeammateAvatars(current, teammates) : current,
    );
  }, [teammates]);

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

    if (mainView === 'calls') {
      void loadCallHistoryData();
    }
  }, [
    fileFilter,
    loadCalendarData,
    loadCallHistoryData,
    loadFilesData,
    loadSavedData,
    loadHubsData,
    mainView,
  ]);

  useEffect(() => {
    clearThreadReplyRegistry();
    clearThreadRepliesStore();
    setHasMoreOlderMessages(false);
    setLoadingOlderMessages(false);
    loadingOlderInFlightRef.current = false;

    if (!selectedId) {
      setMessages([]);
      setDraft('');
      setThreadError('');
      return;
    }

    void loadThread(selectedId);

    return () => {
      flushDraftSave(selectedId);
    };
  }, [flushDraftSave, loadThread, selectedId]);

  const focusMessageHydratingRef = useRef<string | null>(null);

  useEffect(() => {
    if (!focusMessageId || !selectedId) {
      return;
    }

    if (threadLoading && messages.length === 0) {
      return;
    }

    if (messages.some((message) => message.id === focusMessageId)) {
      focusMessageHydratingRef.current = null;
      setThreadJumpSyncing(false);
      return;
    }

    const hydrateKey = `${selectedId}:${focusMessageId}`;
    if (focusMessageHydratingRef.current === hydrateKey) {
      return;
    }

    focusMessageHydratingRef.current = hydrateKey;
    let cancelled = false;

    void loadMessageById(selectedId, focusMessageId).then((result) => {
      if (cancelled || selectedIdRef.current !== selectedId) {
        return;
      }

      if (!result.ok) {
        focusMessageHydratingRef.current = null;
        setThreadJumpSyncing(false);
        if (handleUnauthorized(result.status)) {
          return;
        }
        toast.error('Could not open that message in the chat.');
        setFocusMessageId(null);
        return;
      }

      const userId = getUserId(user);
      const [targetMessage] = commitMessages(
        [result.data],
        userId,
        activeHubDetailsRef.current ?? activeHubDetails,
      );

      if (!targetMessage) {
        focusMessageHydratingRef.current = null;
        return;
      }

      setMessages((current) => {
        if (current.some((message) => message.id === focusMessageId)) {
          return current;
        }

        return enrichMessageReplies(
          mergeMessageListsChronologically(current, [targetMessage]),
        );
      });
      focusMessageHydratingRef.current = null;
      setThreadJumpSyncing(false);
    });

    return () => {
      cancelled = true;
    };
  }, [
    activeHubDetails,
    focusMessageId,
    handleUnauthorized,
    messages,
    selectedId,
    threadLoading,
    user,
  ]);

  useEffect(() => {
    if (!selectedId || threadLoading) {
      return;
    }

    syncThreadCache(selectedId, {
      messages,
      pinnedMessageIds,
      activeHubDetails,
      draft,
      hasMoreOlderMessages,
    });
  }, [
    activeHubDetails,
    draft,
    hasMoreOlderMessages,
    messages,
    pinnedMessageIds,
    selectedId,
    syncThreadCache,
    threadLoading,
  ]);

  useEffect(() => {
    activeHubDetailsRef.current = activeHubDetails;
  }, [activeHubDetails]);

  const handleSummarizeUnread = async () => {
    if (!selectedId) return;
    setSummaryPanelOpen(true);
    setSummaryLoading(true);
    try {
      const res = await summarizeUnreadMessages(selectedId);
      if (res.ok) {
        setSummaryContent(res.data.summary);
      } else {
        setSummaryContent(null);
        toast.error('Failed to summarize unread messages.');
      }
    } catch (err) {
      setSummaryContent(null);
      toast.error('An error occurred while summarizing messages.');
    } finally {
      setSummaryLoading(false);
    }
  };

  const handleSelectConversation = (
    conversationId: string,
    messageId?: string | null,
    options?: { forceReload?: boolean },
  ) => {
    const outgoingId = selectedIdRef.current;

    if (outgoingId && outgoingId !== conversationId) {
      setDraftPreviewForConversation(outgoingId, draftRef.current.trim() || null);
      flushDraftSave(outgoingId);
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
      setThreadUnreadAnchorId(null);
      setThreadJumpSyncing(false);
      setFocusMessageId(messageId);
    } else {
      setThreadJumpSyncing(false);
      setFocusMessageId(null);
    }

    syncConversationReadState(conversationId);

    const conversation = conversationsRef.current.find((item) => item.id === conversationId);

    if (
      conversation &&
      isHubChannelConversation(conversation) &&
      isJoinedHubConversation(conversation)
    ) {
      const staleInvite = [...activityHubInvitesRef.current, ...hubsInvitesRef.current].find(
        (invite) => hubConversationMatchesTarget(conversation, invite),
      );

      if (staleInvite) {
        clearHubInviteActivityState({
          inviteId: staleInvite.id,
          conversationId: conversation.id,
          channelId: conversation.channelId,
        });
      }
    }
  };

  const handleNavigate = useCallback((view: MainView) => {
    if (view !== 'superadmin') {
      allowSuperAdminAutoLandingRef.current = false;
    }

    startTransition(() => {
      setMainView(view);
    });
  }, []);

  const handleGoToChatHome = useCallback(() => {
    allowSuperAdminAutoLandingRef.current = false;
    setFlexAiOpen(false);
    setNewConversationOpen(false);
    setFocusMessageId(null);
    setSelectedId(null);
    startTransition(() => {
      setMainView('chat');
    });
  }, []);

  const handleOrganizationUserUpdated = useCallback((nextUser: unknown) => {
    setUser(nextUser);
  }, []);

  handleSelectConversationRef.current = handleSelectConversation;

  const handleOpenInChat = useCallback(
    (rawConversationId: string | null, messageId?: string | null) => {
      const trimmedMessageId = messageId?.trim() || null;
      const trimmedConversationId = rawConversationId?.trim() || null;

      if (!trimmedMessageId) {
        toast.error('Could not find the original message.');
        if (trimmedConversationId) {
          handleSelectConversation(trimmedConversationId);
        }
        return;
      }

      const openConversation = (conversationId: string) => {
        const matched = findConversationByAnyId(conversationsRef.current, conversationId);
        const targetConversationId = matched?.id ?? conversationId;
        setMainView('chat');
        handleSelectConversation(targetConversationId, trimmedMessageId, { forceReload: false });
      };

      if (trimmedConversationId) {
        openConversation(trimmedConversationId);
      }

      void loadMessageConversation(trimmedMessageId).then((conversationLookup) => {
        if (!conversationLookup.ok) {
          if (trimmedConversationId) {
            return;
          }

          if (handleUnauthorized(conversationLookup.status)) {
            return;
          }

          toast.error(
            conversationLookup.error || 'Could not find the conversation for this message.',
          );
          return;
        }

        const resolvedMatch = findConversationByAnyId(
          conversationsRef.current,
          conversationLookup.data.conversationId,
        );
        const resolvedConversationId =
          resolvedMatch?.id ?? conversationLookup.data.conversationId;

        if (trimmedConversationId) {
          const localMatch = findConversationByAnyId(
            conversationsRef.current,
            trimmedConversationId,
          );
          const localConversationId = localMatch?.id ?? trimmedConversationId;

          if (localConversationId === resolvedConversationId) {
            return;
          }
        }

        openConversation(resolvedConversationId);
      });
    },
    [handleSelectConversation, handleUnauthorized],
  );

  const handleOpenDirectChat = useCallback(
    async (userId: string, options?: { displayName?: string; username?: string; avatarUrl?: string | null }) => {
      const displayName = options?.displayName?.trim() || options?.username?.trim() || 'Direct message';
      const rosterAvatar =
        options?.avatarUrl ??
        teammatesRef.current.find((member) => member.id === userId)?.avatarUrl ??
        readPeerProfile(userId)?.avatarUrl ??
        null;
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
            patchDirectConversationMetadata(existing, userId, displayName, undefined, rosterAvatar),
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
      const entry = patchDirectConversationMetadata(
        baseConversation,
        userId,
        displayName,
        undefined,
        rosterAvatar,
      );

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

  const handleHubMemberDirectCall = useCallback(
    async (userId: string, displayName: string, video: boolean) => {
      const conversationId = await handleOpenDirectChat(userId, { displayName });

      if (!conversationId) {
        return;
      }

      const fromList =
        findConversationByAnyId(conversationsRef.current, conversationId) ??
        findConversationForPeerUserId(conversationsRef.current, userId, directChatMetadataRef.current);

      const target = patchDirectConversationMetadata(
        fromList ?? buildPlaceholderDirectConversation(conversationId, userId, displayName),
        userId,
        displayName,
      );

      void callManager.startDirectCall(
        { ...target, peerUserId: userId, kind: 'direct' as const },
        video,
      );
    },
    [callManager, handleOpenDirectChat],
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

  const handleTeammateSelect = (memberId: string) => {
    const teammate = teammates.find((member) => member.id === memberId);

    if (!teammate) {
      toast.error('Unable to find that teammate.');
      return;
    }

    const existing = findConversationForPeerUserId(
      conversationsRef.current,
      memberId,
      directChatMetadataRef.current,
    );

    if (existing) {
      void handleOpenDirectChat(teammate.id, {
        displayName: teammate.name,
        username: teammate.username,
        avatarUrl: teammate.avatarUrl,
      });
      return;
    }

    let openingTimer: number | undefined = window.setTimeout(() => {
      setOpeningTeammateId(memberId);
    }, 500);

    void handleOpenDirectChat(teammate.id, {
      displayName: teammate.name,
      username: teammate.username,
      avatarUrl: teammate.avatarUrl,
    }).finally(() => {
      if (openingTimer !== undefined) {
        window.clearTimeout(openingTimer);
      }
      setOpeningTeammateId(null);
    });
  };

  const handleTeammateAddFriend = async (memberId: string) => {
    const result = await sendFriendRequest(memberId);

    if (!result.ok) {
      toast.error(result.error);
      throw new Error(result.error);
    }

    toast.success('Friend request sent.');
  };

  const handleNotificationClick = (notification: NotificationItem) => {
    markNotificationSeen(notification);
    const action = resolveNotificationAction(notification, conversationsRef.current);

    void markNotificationRead(notification.id).then((result) => {
      if (!result.ok) {
        handleUnauthorized(result.status);
        return;
      }

      setActivityNotifications((current) => current.filter((item) => item.id !== notification.id));
      void refreshUnreadCount();
    });

    if (action.kind === 'calendar') {
      openCalendarFromNotification(action.eventId);
      return;
    }

    if (action.kind === 'hubs') {
      void openHubFromNotification(action.channelId, action.inviteId);
      return;
    }

    if (action.kind === 'chat') {
      setMainView('chat');
      handleSelectConversation(action.conversationId, action.messageId ?? undefined);
      return;
    }

    const fallbackConversationId = resolveNotificationConversationId(
      notification,
      conversationsRef.current,
    );

    if (fallbackConversationId) {
      setMainView('chat');
      handleSelectConversation(fallbackConversationId, notification.messageId ?? undefined);
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
      readBy: [],
      reactions: [],
      replyToMessageId: replyToId,
      messageType: 'TEXT',
      media: [],
      deletedForEveryone: false,
      poll: null,
    };

    bumpDraftPersistToken();
    draftDirtyRef.current = false;
    draftRef.current = '';
    setDraft('');
    lastSavedDraftRef.current = '';
    lastSavedReplyToIdRef.current = null;
    setDraftError('');
    clearDraftContentCache(conversationId);
    setDraftPreviewForConversation(conversationId, null);
    setConversations((current) => applyDraftPreviews(current));
    stopTyping(conversationId);
    setMessages((current) => appendMessage(current, optimistic, userId));
    touchConversationWithMessage(conversationId, optimistic, false);

    const [result] = await Promise.all([
      sendChatMessage(conversationId, content, replyToId),
      clearChatDraft(conversationId),
    ]);

    if (handleUnauthorized(result.status)) {
      setMessages((current) => current.filter((message) => message.id !== localId));
      draftRef.current = content;
      draftDirtyRef.current = true;
      setDraft(content);
      setDraftPreviewForConversation(conversationId, content.trim() || null);
      setConversations((current) => applyDraftPreviews(current));
      return;
    }

    if (!result.ok) {
      setDraftError(result.error);
      draftRef.current = content;
      draftDirtyRef.current = true;
      setDraft(content);
      setDraftPreviewForConversation(conversationId, content.trim() || null);
      setConversations((current) => applyDraftPreviews(current));
      setMessages((current) => markMessageStatus(current, localId, 'failed'));
      return;
    }

    if (isHiddenOutboundSend(localId)) {
      finalizeHiddenOutboundSend(localId, conversationId, result.data);
      return;
    }

    setMessages((current) => replaceLocalMessage(current, localId, result.data, userId));
    touchConversationWithMessage(conversationId, withDeliveredStatus(result.data), false);

    if (cancelledLocalMessageIdsRef.current.has(localId)) {
      cancelledLocalMessageIdsRef.current.delete(localId);
      void deleteChatMessage(conversationId, result.data.id, 'everyone');
    }
  };

  const handleRetryMessage = async (messageId: string) => {
    if (!selectedId) {
      return;
    }

    const message = messagesRef.current.find((item) => item.id === messageId);
    if (!message || !isLocalMessageId(messageId) || message.status !== 'failed') {
      return;
    }

    const conversationId = selectedId;
    const userId = getUserId(user);
    const localId = messageId;

    setDraftError('');
    setMessages((current) => markMessageStatus(current, localId, 'sending'));

    const media = message.media[0];
    const isGifOrSticker = media?.kind === 'gif' || media?.kind === 'sticker';
    const isUploadedFile =
      media &&
      (media.kind === 'image' || media.kind === 'file' || media.kind === 'video') &&
      !isGifOrSticker;

    let result: Awaited<ReturnType<typeof sendChatMessage>>;

    if (isGifOrSticker && media) {
      const kind = media.kind as 'gif' | 'sticker';
      const item: GifPickerItem = {
        id: media.url,
        url: media.url,
        previewUrl: media.previewUrl ?? media.url,
        title: media.name,
        width: null,
        height: null,
        mimeType: kind === 'gif' ? 'image/gif' : 'image/png',
      };
      result = await sendChatMediaMessage(
        conversationId,
        item,
        kind,
        message.replyToMessageId,
        message.threadRootId,
      );
    } else if (isUploadedFile && media) {
      const pending = pendingFileRetriesRef.current.get(localId);
      let uploadedUrl =
        pending?.uploadedUrl ?? (media.url.startsWith('http') ? media.url : undefined);

      if (!uploadedUrl && pending?.file) {
        const uploadResult = await uploadChatFile(pending.file);

        if (handleUnauthorized(uploadResult.status)) {
          setMessages((current) => markMessageStatus(current, localId, 'failed'));
          return;
        }

        if (!uploadResult.ok) {
          setDraftError(uploadResult.error);
          setMessages((current) => markMessageStatus(current, localId, 'failed'));
          return;
        }

        uploadedUrl = uploadResult.data.url;
        pendingFileRetriesRef.current.set(localId, { ...pending, uploadedUrl });
      }

      if (!uploadedUrl || !pending?.file) {
        setDraftError('Unable to resend this file. Please attach it again.');
        setMessages((current) => markMessageStatus(current, localId, 'failed'));
        return;
      }

      result = await sendChatFileMessage(
        conversationId,
        uploadedUrl,
        pending.file.name,
        pending.file.type || 'application/octet-stream',
        message.replyToMessageId,
        message.threadRootId,
        message.content.trim() || undefined,
      );
    } else {
      result = await sendChatMessage(
        conversationId,
        message.content,
        message.replyToMessageId,
        message.threadRootId,
      );
    }

    if (handleUnauthorized(result.status)) {
      setMessages((current) => current.filter((item) => item.id !== localId));
      pendingFileRetriesRef.current.delete(localId);
      return;
    }

    if (!result.ok) {
      setDraftError(result.error);
      setMessages((current) => markMessageStatus(current, localId, 'failed'));
      return;
    }

    pendingFileRetriesRef.current.delete(localId);

    if (message.threadRootId) {
      registerThreadReplyMessage(result.data.id, result.data.threadRootId ?? message.threadRootId!);
      appendThreadReply(
        conversationId,
        result.data.threadRootId ?? message.threadRootId!,
        result.data,
      );
      setMessages((current) =>
        bumpThreadReplyCount(
          filterMainChatMessages(current),
          result.data.threadRootId ?? message.threadRootId!,
        ),
      );
      return;
    }

    setMessages((current) => replaceLocalMessage(current, localId, result.data, userId));
    touchConversationWithMessage(conversationId, withDeliveredStatus(result.data), false);

    if (cancelledLocalMessageIdsRef.current.has(localId)) {
      cancelledLocalMessageIdsRef.current.delete(localId);
      void deleteChatMessage(conversationId, result.data.id, 'everyone');
    }
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
    const isSummarizeUnread = action === 'summarize_unread' || action.includes('summarize');
    const isTranslateUnread = action === 'translate_unread' || action.includes('translate');

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

    if (isSummarizeUnread) {
      if (!conversation) {
        return command.text || `I couldn't find ${command.conversationName ?? 'that chat'} to summarize.`;
      }
      const summaryRes = await summarizeUnreadMessages(conversation.id);
      if (handleUnauthorized(summaryRes.status)) {
        return 'Please sign in again.';
      }
      if (!summaryRes.ok) {
        return summaryRes.error;
      }
      return command.text ? `${command.text}\n\n${summaryRes.data.summary}` : summaryRes.data.summary;
    }

    if (isTranslateUnread) {
      if (!conversation) {
        return command.text || `I couldn't find ${command.conversationName ?? 'that chat'} to translate.`;
      }
      const translateRes = await translateUnreadMessages(conversation.id);
      if (handleUnauthorized(translateRes.status)) {
        return 'Please sign in again.';
      }
      if (!translateRes.ok) {
        return translateRes.error;
      }
      return command.text ? `${command.text}\n\n${translateRes.data.translation}` : translateRes.data.translation;
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
      readBy: [],
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

    if (isLocalSendCancelled(localId)) {
      if (result.ok) {
        void deleteChatMessage(conversationId, result.data.id, 'everyone');
      }
      return;
    }

    if (handleUnauthorized(result.status)) {
      if (!threadRootId) {
        setMessages((current) => current.filter((message) => message.id !== localId));
      }
      return;
    }

    if (!result.ok) {
      setDraftError(result.error);
      if (!threadRootId) {
        setMessages((current) => markMessageStatus(current, localId, 'failed'));
      }
      return;
    }

    if (isHiddenOutboundSend(localId)) {
      finalizeHiddenOutboundSend(localId, conversationId, result.data);
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

    if (cancelledLocalMessageIdsRef.current.has(localId)) {
      cancelledLocalMessageIdsRef.current.delete(localId);
      void deleteChatMessage(conversationId, result.data.id, 'everyone');
    }
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
    const isVideo = mimeType.startsWith('video/');
    const mediaKind = isVideo ? 'video' : isImage ? 'image' : 'file';
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
      readBy: [],
      reactions: [],
      replyToMessageId: replyToId,
      threadRootId,
      messageType: isImage ? 'IMAGE' : 'FILE',
      media: [
        {
          kind: mediaKind,
          url: previewUrl,
          previewUrl,
          name: file.name,
        },
      ],
      deletedForEveryone: false,
      poll: null,
    };

    setDraftError('');
    pendingFileRetriesRef.current.set(localId, {
      file,
      caption: messageCaption,
      replyToId,
      threadRootId,
    });
    if (!threadRootId) {
      bumpDraftPersistToken();
      draftDirtyRef.current = false;
      draftRef.current = '';
      setDraft('');
      lastSavedDraftRef.current = '';
      lastSavedReplyToIdRef.current = null;
      clearDraftContentCache(conversationId);
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

    patchOutboundSendProgress(localId, 1);

    const uploadResult = await uploadChatFile(file, (progress) => {
      if (!isLocalSendCancelled(localId)) {
        patchOutboundSendProgress(localId, progress);
      }
    });

    if (isLocalSendCancelled(localId)) {
      cleanupCancelledOutboundSend(localId, previewUrl);
      return;
    }

    if (handleUnauthorized(uploadResult.status) || !uploadResult.ok) {
      patchOutboundSendProgress(localId, null);
      if (!threadRootId) {
        setMessages((current) => markMessageStatus(current, localId, 'failed'));
      } else {
        URL.revokeObjectURL(previewUrl);
        pendingFileRetriesRef.current.delete(localId);
      }
      if (!uploadResult.ok && !handleUnauthorized(uploadResult.status)) {
        setDraftError(uploadResult.error);
      }
      return;
    }

    const uploadedUrl = uploadResult.data.url;
    if (isLocalSendCancelled(localId)) {
      cleanupCancelledOutboundSend(localId, previewUrl);
      return;
    }

    pendingFileRetriesRef.current.set(localId, {
      file,
      caption: messageCaption,
      replyToId,
      threadRootId,
      uploadedUrl,
    });
    if (!threadRootId) {
      setMessages((current) => {
        if (!current.some((message) => message.id === localId)) {
          return current;
        }

        return current.map((message) =>
          message.id === localId
            ? {
                ...message,
                media: [
                  {
                    kind: mediaKind,
                    url: uploadedUrl,
                    previewUrl: uploadedUrl,
                    name: file.name,
                  },
                ],
              }
            : message,
        );
      });
    }
    URL.revokeObjectURL(previewUrl);

  if (isLocalSendCancelled(localId)) {
      cleanupCancelledOutboundSend(localId);
      return;
    }

    patchOutboundSendProgress(localId, 95);

    const result = await sendChatFileMessage(
      conversationId,
      uploadedUrl,
      file.name,
      mimeType,
      replyToId,
      threadRootId,
      messageCaption || undefined,
    );

    if (isLocalSendCancelled(localId)) {
      await finalizeCancelledOutboundSend(
        localId,
        conversationId,
        result.ok ? result.data : undefined,
      );
      return;
    }

    if (handleUnauthorized(result.status) || !result.ok) {
      patchOutboundSendProgress(localId, null);
      if (!threadRootId) {
        setMessages((current) => markMessageStatus(current, localId, 'failed'));
      } else {
        pendingFileRetriesRef.current.delete(localId);
      }
      if (!result.ok && !handleUnauthorized(result.status)) {
        setDraftError(result.error);
      }
      return;
    }

    pendingFileRetriesRef.current.delete(localId);

    if (isLocalSendCancelled(localId)) {
      await finalizeCancelledOutboundSend(localId, conversationId, result.data);
      return;
    }

    if (threadRootId) {
      await finishOutboundSendProgress(localId);
      if (isLocalSendCancelled(localId)) {
        await finalizeCancelledOutboundSend(localId, conversationId, result.data);
        return;
      }
      if (isHiddenOutboundSend(localId)) {
        finalizeHiddenOutboundSend(localId, conversationId, result.data);
        return;
      }
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

    await finishOutboundSendProgress(localId);

    if (isLocalSendCancelled(localId)) {
      await finalizeCancelledOutboundSend(localId, conversationId, result.data);
      return;
    }

    if (isHiddenOutboundSend(localId)) {
      finalizeHiddenOutboundSend(localId, conversationId, result.data);
      return;
    }

    setMessages((current) => replaceLocalMessage(current, localId, result.data, userId));
    touchConversationWithMessage(conversationId, withDeliveredStatus(result.data), false);
  };

  const handleSendVoice = async (
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
    const mimeType = file.type || 'audio/webm';
    const previewUrl = URL.createObjectURL(file);
    const trimmedCaption = caption?.trim() ?? '';
    const optimistic: MessageItem = {
      id: localId,
      content: trimmedCaption,
      senderId: userId,
      senderName: getUserDisplayName(user),
      senderInitials: getUserInitials(user),
      createdAt: new Date().toISOString(),
      editedAt: null,
      pinnedAt: null,
      isOwn: true,
      status: 'sending',
      readBy: [],
      reactions: [],
      replyToMessageId: replyToId,
      threadRootId,
      messageType: 'VOICE',
      media: [
        {
          kind: 'file',
          url: previewUrl,
          previewUrl,
          name: file.name || 'voice-note.webm',
        },
      ],
      deletedForEveryone: false,
      poll: null,
    };

    setDraftError('');
    if (!threadRootId) {
      stopTyping(conversationId);
      setMessages((current) => appendMessage(current, optimistic, userId));
      touchConversationWithMessage(conversationId, optimistic, false);
    } else {
      setMessages((current) => bumpThreadReplyCount(current, threadRootId));
    }

    const uploadResult = await uploadChatFile(file);

    if (isLocalSendCancelled(localId)) {
      cleanupCancelledOutboundSend(localId, previewUrl);
      return;
    }

    if (handleUnauthorized(uploadResult.status) || !uploadResult.ok) {
      if (!threadRootId) {
        setMessages((current) => markMessageStatus(current, localId, 'failed'));
      }
      URL.revokeObjectURL(previewUrl);
      if (!uploadResult.ok && !handleUnauthorized(uploadResult.status)) {
        setDraftError(uploadResult.error);
      }
      return;
    }

    const uploadedUrl = uploadResult.data.url;
    URL.revokeObjectURL(previewUrl);

    if (!threadRootId) {
      setMessages((current) =>
        current.map((message) =>
          message.id === localId
            ? {
                ...message,
                media: [
                  {
                    kind: 'file',
                    url: uploadedUrl,
                    previewUrl: uploadedUrl,
                    name: file.name || 'voice-note.webm',
                  },
                ],
              }
            : message,
        ),
      );
    }

    const result = await sendChatVoiceMessage(
      conversationId,
      uploadedUrl,
      file.name || 'voice-note.webm',
      mimeType,
      file.size,
      replyToId,
      threadRootId,
      trimmedCaption || undefined,
    );

    if (handleUnauthorized(result.status) || !result.ok) {
      if (!threadRootId) {
        setMessages((current) => markMessageStatus(current, localId, 'failed'));
      }
      if (!result.ok && !handleUnauthorized(result.status)) {
        setDraftError(result.error);
      }
      return;
    }

    if (threadRootId) {
      await finishOutboundSendProgress(localId);
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

    await finishOutboundSendProgress(localId);
    setMessages((current) => replaceLocalMessage(current, localId, result.data, userId));
    touchConversationWithMessage(conversationId, withDeliveredStatus(result.data), false);
  };

  const handleAddReaction = async (
    messageId: string,
    emoji: string,
    options?: { remove?: boolean },
  ) => {
    if (!selectedId) {
      return;
    }

    const currentUserId = getUserId(user);
    if (!currentUserId) {
      return;
    }

    if (reactionInFlightRef.current.has(messageId)) {
      return;
    }

    reactionInFlightRef.current.add(messageId);

    const applyOptimisticReactions = (messages: MessageItem[]) =>
      messages.map((message) => {
        if (message.id !== messageId) {
          return message;
        }

        const hasExact = userHasMessageReaction(message.reactions, currentUserId, emoji);

        if (hasExact) {
          return {
            ...message,
            reactions: message.reactions.filter(
              (reaction) =>
                !(
                  messageReactionMatchesUser(reaction, currentUserId) && reaction.emoji === emoji
                ),
            ),
          };
        }

        const withoutMine = message.reactions.filter(
          (reaction) => !messageReactionMatchesUser(reaction, currentUserId),
        );
        return {
          ...message,
          reactions: [
            ...withoutMine,
            { emoji, userId: currentUserId, username: user?.name || '' },
          ],
        };
      });

    let targetMessage = messagesRef.current.find((item) => item.id === messageId);
    if (!targetMessage) {
      const threadCache = threadCacheRef.current[selectedId];
      targetMessage = threadCache?.messages.find((item) => item.id === messageId);
    }

    const togglingOff = Boolean(
      options?.remove ||
        userHasMessageReaction(targetMessage?.reactions ?? [], currentUserId, emoji),
    );
    const priorReactions = targetMessage?.reactions ?? [];

    const revertOptimisticReactions = () => {
      setMessages((current) =>
        current.map((message) =>
          message.id === messageId ? { ...message, reactions: priorReactions } : message,
        ),
      );
      patchThreadCacheMessages(threadCacheRef.current, selectedId, (current) =>
        current.map((message) =>
          message.id === messageId ? { ...message, reactions: priorReactions } : message,
        ),
      );
    };

    setMessages((current) => applyOptimisticReactions(current));
    patchThreadCacheMessages(threadCacheRef.current, selectedId, (current) =>
      applyOptimisticReactions(current),
    );

    try {
      if (togglingOff) {
        const removeResult = await removeMessageReaction(selectedId, messageId, emoji);
        if (!removeResult.ok) {
          if (handleUnauthorized(removeResult.status)) {
            return;
          }
          toast.error(removeResult.error);
          revertOptimisticReactions();
          void refreshMessageReactions(selectedId, messageId);
          return;
        }

        const resultData = removeResult.data;
        setMessages((current) =>
          current.map((message) =>
            message.id === messageId
              ? preserveMessageOwnership(
                  mergeMessageUpdates(message, resultData, { replaceReactions: true }),
                  message,
                  currentUserId,
                )
              : message,
          ),
        );
        patchThreadCacheMessages(threadCacheRef.current, selectedId, (current) =>
          current.map((message) =>
            message.id === messageId
              ? preserveMessageOwnership(
                  mergeMessageUpdates(message, resultData, { replaceReactions: true }),
                  message,
                  currentUserId,
                )
              : message,
          ),
        );
        return;
      }

      const otherMine =
        targetMessage?.reactions.filter(
          (reaction) => messageReactionMatchesUser(reaction, currentUserId) && reaction.emoji !== emoji,
        ) ?? [];

      for (const reaction of otherMine) {
        const removeResult = await removeMessageReaction(selectedId, messageId, reaction.emoji);
        if (!removeResult.ok && handleUnauthorized(removeResult.status)) {
          return;
        }
      }

      const addResult = await addMessageReaction(selectedId, messageId, emoji);
      if (!addResult.ok) {
        if (handleUnauthorized(addResult.status)) {
          return;
        }
        toast.error(addResult.error);
        revertOptimisticReactions();
        void refreshMessageReactions(selectedId, messageId);
        return;
      }

      const resultData = addResult.data;
      setMessages((current) =>
        current.map((message) =>
          message.id === messageId
            ? preserveMessageOwnership(
                mergeMessageUpdates(message, resultData, { replaceReactions: true }),
                message,
                currentUserId,
              )
            : message,
        ),
      );
      patchThreadCacheMessages(threadCacheRef.current, selectedId, (current) =>
        current.map((message) =>
          message.id === messageId
            ? preserveMessageOwnership(
                mergeMessageUpdates(message, resultData, { replaceReactions: true }),
                message,
                currentUserId,
              )
            : message,
        ),
      );
    } finally {
      reactionInFlightRef.current.delete(messageId);
    }
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

  const handleSidebarMarkUnread = useCallback(
    async (conversation: ConversationItem) => {
      setConversationMenuBusyId(conversation.id);
      const result = await markConversationUnread(conversation.id);
      setConversationMenuBusyId(null);

      if (!result.ok) {
        if (handleUnauthorized(result.status)) {
          return;
        }

        toast.error(result.error);
        return;
      }

      setConversations((current) =>
        applyDraftPreviews(
          current.map((item) =>
            item.id === conversation.id
              ? { ...item, unreadCount: Math.max(1, item.unreadCount) }
              : item,
          ),
        ),
      );
      void refreshUnreadCount();
      toast.success('Marked as unread.');
    },
    [applyDraftPreviews, handleUnauthorized, refreshUnreadCount],
  );

  const handleSidebarToggleMute = useCallback(
    async (conversation: ConversationItem) => {
      const nextMuted = conversation.notificationsSnoozed !== true;
      applyConversationSnoozed(conversation.id, nextMuted);
      setConversationMenuBusyId(conversation.id);

      const result = await updateConversationNotificationSettings(
        conversation.id,
        buildConversationSnoozePayload(nextMuted ? 'forever' : 'off'),
      );

      setConversationMenuBusyId(null);

      if (!result.ok) {
        applyConversationSnoozed(conversation.id, !nextMuted);
        if (handleUnauthorized(result.status)) {
          return;
        }

        toast.error(result.error);
        return;
      }

      toast.success(
        nextMuted
          ? formatConversationSnoozeUntil(null, true)
          : 'Notifications enabled for this chat.',
      );
    },
    [applyConversationSnoozed, handleUnauthorized],
  );

  const applyAfterConversationHistoryCleared = useCallback(
    (conversationId: string) => {
      invalidateThreadCacheEntry(threadCacheRef.current, conversationId);
      clearConversationScrollSnapshot(conversationId);
      clearThreadRepliesStore();
      clearThreadReplyRegistry();

      if (selectedIdRef.current === conversationId) {
        setMessages([]);
        setPinnedMessageIds([]);
        setHasMoreOlderMessages(false);
        setThreadUnreadAnchorId(null);
      }

      void loadThread(conversationId);
      void refreshConversations();
    },
    [loadThread, refreshConversations],
  );

  const handleSidebarClearHistory = useCallback(
    async (conversation: ConversationItem) => {
      const confirmed = await confirm({
        title: 'Clear chat history',
        message: `Clear all messages in "${conversation.title}"?`,
        confirmLabel: 'Clear history',
        tone: 'danger',
      });

      if (!confirmed) {
        return;
      }

      setConversationMenuBusyId(conversation.id);
      const result = await clearConversationHistory(conversation.id);
      setConversationMenuBusyId(null);

      if (!result.ok) {
        if (handleUnauthorized(result.status)) {
          return;
        }

        toast.error(result.error);
        return;
      }

      applyAfterConversationHistoryCleared(conversation.id);
      toast.success('Chat history cleared.');
    },
    [applyAfterConversationHistoryCleared, confirm, handleUnauthorized],
  );

  const handleSidebarBlockUser = useCallback(
    async (conversation: ConversationItem) => {
      const peerUserId = conversation.peerUserId;

      if (!peerUserId) {
        return;
      }

      const confirmed = await confirm({
        title: 'Block user',
        message: `Block ${conversation.title}? They will no longer be able to message you.`,
        confirmLabel: 'Block user',
        tone: 'danger',
      });

      if (!confirmed) {
        return;
      }

      setConversationMenuBusyId(conversation.id);
      const result = await blockUser(peerUserId);
      setConversationMenuBusyId(null);

      if (!result.ok) {
        if (handleUnauthorized(result.status)) {
          return;
        }

        toast.error(result.error);
        return;
      }

      markUserBlocked(peerUserId);
      toast.success(`${conversation.title} blocked.`);
      void refreshBlockedUserIds();
      void refreshConversations();
    },
    [confirm, handleUnauthorized, refreshBlockedUserIds, refreshConversations],
  );

  const handleSidebarUnblockUser = useCallback(
    async (conversation: ConversationItem) => {
      const peerUserId = conversation.peerUserId;

      if (!peerUserId) {
        return;
      }

      const confirmed = await confirm({
        title: 'Unblock user',
        message: `Unblock ${conversation.title}? They will be able to message you again.`,
        confirmLabel: 'Unblock user',
      });

      if (!confirmed) {
        return;
      }

      setConversationMenuBusyId(conversation.id);
      const result = await unblockUser(peerUserId);
      setConversationMenuBusyId(null);

      if (!result.ok) {
        if (handleUnauthorized(result.status)) {
          return;
        }

        toast.error(result.error);
        return;
      }

      markUserUnblocked(peerUserId);
      toast.success(`${conversation.title} unblocked.`);
      void refreshBlockedUserIds();
      void refreshConversations();
    },
    [confirm, handleUnauthorized, refreshBlockedUserIds, refreshConversations],
  );

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

  const sidebarConversationMenuActions = useMemo(
    () => ({
      onMarkUnread: (conversation: ConversationItem) => {
        void handleSidebarMarkUnread(conversation);
      },
      onTogglePin: (conversation: ConversationItem) => {
        void handleToggleConversationPin(conversation.id, conversation.isPinned);
      },
      onToggleMute: (conversation: ConversationItem) => {
        void handleSidebarToggleMute(conversation);
      },
      onClearHistory: (conversation: ConversationItem) => {
        void handleSidebarClearHistory(conversation);
      },
      onBlockUser: (conversation: ConversationItem) => {
        void handleSidebarBlockUser(conversation);
      },
      onUnblockUser: (conversation: ConversationItem) => {
        void handleSidebarUnblockUser(conversation);
      },
    }),
    [
      handleSidebarBlockUser,
      handleSidebarClearHistory,
      handleSidebarMarkUnread,
      handleSidebarToggleMute,
      handleSidebarUnblockUser,
    ],
  );

  const handleEditMessage = async (messageId: string, content: string): Promise<boolean> => {
    if (!selectedId) {
      return false;
    }

    const result = await editChatMessage(selectedId, messageId, content);

    if (!result.ok) {
      if (handleUnauthorized(result.status)) {
        return false;
      }

      toast.error(result.error || 'Could not update message.');
      return false;
    }

    setMessages((current) =>
      current.map((message) =>
        message.id === messageId
          ? preserveMessageOwnership(result.data, message, getUserId(user))
          : message,
      ),
    );
    showActionMessage('Message updated.');
    return true;
  };

  const handleDeleteMessage = async (messageId: string, scope: 'me' | 'everyone') => {
    if (!selectedId) {
      return;
    }

    const messageToDelete = messagesRef.current.find((m) => m.id === messageId);
    if (!messageToDelete) return;

    if (messageToDelete.status === 'sending') {
      const confirmed = await confirm({
        title: scope === 'everyone' ? 'Cancel sending' : 'Delete message',
        message:
          scope === 'everyone'
            ? 'This attachment is still sending. Stop the upload and remove it for everyone?'
            : 'Remove this from your view while it finishes sending? It will still be delivered to the chat.',
        confirmLabel: scope === 'everyone' ? 'Remove for everyone' : 'Delete for me',
        tone: 'danger',
      });
      if (!confirmed) {
        return;
      }

      const sendRecord = {
        conversationId: selectedId,
        fileName: messageToDelete.media[0]?.name ?? null,
        caption: messageToDelete.content.trim(),
      };

      if (scope === 'everyone') {
        cancelledLocalMessageIdsRef.current.add(messageId);
        abortOutboundSendRef.current.set(messageId, sendRecord);
        cleanupCancelledOutboundSend(messageId, messageToDelete.media[0]?.url);
      } else {
        hiddenOutboundSendRef.current.set(messageId, sendRecord);
        patchOutboundSendProgress(messageId, null);
      }

      setMessages((current) => current.filter((message) => message.id !== messageId));
      setSavedItems((current) => current.filter((item) => item.messageId !== messageId));
      showActionMessage(
        scope === 'everyone' ? 'Send cancelled.' : 'Hidden while sending. The message will still be delivered.',
      );
      return;
    }

    if (scope === 'me') {
      const confirmed = await confirm({
        title: 'Delete message',
        message: 'Delete this message from your view?',
        confirmLabel: 'Delete',
        tone: 'danger',
      });
      if (!confirmed) return;
    }

    const originalMessages = [...messages];
    const originalSaved = [...savedItems];

    if (scope === 'everyone') {
      setMessages((current) =>
        current.map((message) =>
          message.id === messageId ? markMessageDeletedForEveryone(message) : message,
        ),
      );
    } else {
      setMessages((current) => current.filter((message) => message.id !== messageId));
    }
    setSavedItems((current) => current.filter((item) => item.messageId !== messageId));

    if (scope === 'everyone') {
      let isUndone = false;
      toast.success('Message deleted for everyone', {
        action: {
          label: 'Undo',
          onClick: () => {
            isUndone = true;
            setMessages(originalMessages);
            setSavedItems(originalSaved);
          },
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 5000));

      if (isUndone) {
        return;
      }
    }

    const result = await deleteChatMessage(selectedId, messageId, scope);

    if (!result.ok) {
      if (handleUnauthorized(result.status)) {
        return;
      }

      if (scope === 'everyone' && isAlreadyDeletedForEveryoneError(result.error)) {
        return;
      }

      setMessages(originalMessages);
      setSavedItems(originalSaved);
      toast.error(result.error);
      return;
    }

    if (savedMessageIds.has(messageId)) {
      void unsaveChatMessage(selectedId, messageId);
    }
  };

  const handleForwardMessage = async (
    messageId: string,
    targetConversationIds: string[],
  ): Promise<string | null> => {
    if (!selectedId) {
      return 'No conversation selected.';
    }

    const result = await forwardChatMessage(selectedId, messageId, targetConversationIds);

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

    const firstTargetId = targetConversationIds[0];
    if (firstTargetId) {
      if (selectedId === firstTargetId) {
        const forwarded = commitMessages(result.data.messages, getUserId(user));

        if (forwarded.length > 0) {
          setMessages((current) => {
            const existingIds = new Set(current.map((message) => message.id));
            const next = forwarded.filter((message) => !existingIds.has(message.id));
            return next.length > 0 ? [...current, ...next] : current;
          });
        }

        void loadThread(firstTargetId);
      } else {
        setSelectedId(firstTargetId);
      }
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

      toast.error(result.error);
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

      toast.error(result.error);
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

      toast.error(result.error);
      return;
    }

    setSavedItems(result.data);
    setSavedError('');
    showActionMessage('Message unsaved.');
  };

  const handleRespondFriendRequest = async (
    requestId: string,
    status: 'ACCEPTED' | 'DECLINED',
    context: { userId: string; notificationId: string | null },
  ) => {
    const result = await respondFriendRequest(requestId, status);

    if (!result.ok) {
      if (handleUnauthorized(result.status)) {
        return;
      }
      showActionMessage(result.error || 'Could not update friend request.');
      pendingFriendsCacheRef.current = null;
      void loadActivityData();
      return;
    }

    if (context.notificationId) {
      void markNotificationRead(context.notificationId);
    }

    pendingFriendsCacheRef.current = null;
    setActivityPendingFriends((current) => current.filter((item) => item.requestId !== requestId));
    showActionMessage(status === 'ACCEPTED' ? 'Friend request accepted.' : 'Friend request declined.');
    void loadActivityData();
    void refreshConversations();

    if (status === 'ACCEPTED' && result.data.conversationId) {
      handleSelectConversation(result.data.conversationId);
    }
  };

  const handleRespondHubInvite = async (
    inviteId: string,
    accept: boolean,
    linkedNotificationId?: string | null,
  ) => {
    const inviteSnapshot =
      activityHubInvites.find((entry) => entry.id === inviteId) ??
      hubsInvites.find((entry) => entry.id === inviteId) ??
      null;

    const result = accept ? await acceptHubInviteById(inviteId) : await declineHubInvite(inviteId);

    if (!result.ok) {
      if (handleUnauthorized(result.status)) {
        return;
      }
      showActionMessage(result.error || 'Could not update hub invitation.');
      void loadActivityData();
      return;
    }

    const inviteTarget = {
      inviteId,
      conversationId:
        inviteSnapshot?.conversationId ??
        (accept && result.data ? result.data.conversationId : null) ??
        null,
      channelId:
        inviteSnapshot?.channelId ??
        (accept && result.data ? result.data.channelId : null) ??
        null,
    };

    if (accept) {
      showActionMessage('Hub invitation accepted.');
      await finalizeHubInviteAccept({
        inviteId,
        invite: inviteSnapshot,
        acceptResult: result.data,
      });
      void loadActivityData();
      return;
    }

    showActionMessage('Hub invitation declined.');
    clearHubInviteActivityState(inviteTarget);
    void refreshConversations();
    void loadActivityData();
    void loadHubsData();
  };

  const conversationThreadActionsRef = useRef<ConversationThreadActions>({
    handleSendMessage: () => undefined,
    handleRetryMessage: () => undefined,
    handleSendMedia: () => undefined,
    handleSendFile: () => undefined,
    handleSendVoice: () => undefined,
    handleAddReaction: () => undefined,
    handleEditMessage: () => Promise.resolve(false),
    handleDeleteMessage: () => undefined,
    handleForwardMessage: () => Promise.resolve(null),
    handlePinMessage: () => undefined,
    handleSaveMessage: () => undefined,
    handleUnsaveMessage: () => undefined,
    handleVotePoll: () => undefined,
    handleDraftChange: () => undefined,
    handleComposerBlur: () => undefined,
    handleDraftReplyToIdChange: () => undefined,
    handleUnauthorized: () => false,
    refreshConversations: () => undefined,
    loadThread: () => undefined,
    applyConversationSnoozed: () => undefined,
    handleToggleConversationPin: () => undefined,
    loadCalendarData: () => undefined,
    setSelectedId: () => undefined,
    setMainView: () => undefined,
    setFlexAiOpen: () => undefined,
    loadOlderMessages: () => undefined,
    setFocusMessageId: () => undefined,
    saveConversationScroll: () => undefined,
    bumpThreadReplyCount: (items) => items,
    filterMainChatMessages: (items) => items,
    handleSummarizeUnread: () => undefined,
    refreshBlockedUserIds: () => undefined,
    refreshPresenceForPeer: () => undefined,
    handleOpenDirectChat: () => undefined,
    handleHubMemberDirectCall: () => undefined,
    startDirectCall: () => undefined,
    startGroupMeeting: () => undefined,
    getSelectedConversation: () => null,
    getSelectedConversationId: () => null,
    getDirectChatPeerUserId: () => null,
    applyThreadReplySent: () => undefined,
    applyThreadMessagesRegistered: () => undefined,
    applyAfterConversationHistoryCleared: () => undefined,
  });

  conversationThreadActionsRef.current = {
    handleSendMessage: (replyToMessageId) => {
      void handleSendMessage(replyToMessageId);
    },
    handleRetryMessage: (messageId) => {
      void handleRetryMessage(messageId);
    },
    handleSendMedia: (item, kind, replyToId, threadRootId) => {
      void handleSendMedia(item, kind, replyToId, threadRootId);
    },
    handleSendFile: (file, caption, replyToId, threadRootId) => {
      void handleSendFile(file, caption, replyToId, threadRootId);
    },
    handleSendVoice: (file, caption, replyToId, threadRootId) => {
      void handleSendVoice(file, caption, replyToId, threadRootId);
    },
    handleAddReaction: (messageId, emoji) => {
      void handleAddReaction(messageId, emoji);
    },
    handleEditMessage: handleEditMessage,
    handleDeleteMessage: (messageId, scope) => {
      void handleDeleteMessage(messageId, scope);
    },
    handleForwardMessage: handleForwardMessage,
    handlePinMessage: (messageId, isPinned) => {
      void handlePinMessage(messageId, isPinned);
    },
    handleSaveMessage: (messageId) => {
      void handleSaveMessage(messageId);
    },
    handleUnsaveMessage: (messageId) => {
      void handleUnsaveMessage(messageId);
    },
    handleVotePoll: (messageId, optionId) => {
      void handleVotePoll(messageId, optionId);
    },
    handleDraftChange,
    handleComposerBlur,
    handleDraftReplyToIdChange: (replyToId) => {
      if (composerReplyToIdRef.current !== replyToId) {
        composerReplyToIdRef.current = replyToId;
        draftDirtyRef.current = true;
      }
    },
    handleUnauthorized,
    refreshConversations: () => {
      void refreshConversations();
    },
    loadThread: (conversationId) => {
      void loadThread(conversationId);
    },
    applyConversationSnoozed,
    handleToggleConversationPin: (conversationId, isPinned) => {
      void handleToggleConversationPin(conversationId, isPinned);
    },
    loadCalendarData: () => {
      void loadCalendarData();
    },
    setSelectedId,
    setMainView,
    setFlexAiOpen,
    loadOlderMessages: () => {
      void loadOlderMessages();
    },
    setFocusMessageId,
    bumpThreadReplyCount,
    filterMainChatMessages,
    handleSummarizeUnread: () => {
      void handleSummarizeUnread();
    },
    refreshBlockedUserIds: () => {
      void refreshBlockedUserIds();
    },
    refreshPresenceForPeer: (peerUserId) => {
      void refreshPresence([peerUserId], { snapshotMissingAsOffline: false });
    },
    handleOpenDirectChat: (userId, options) => {
      void handleOpenDirectChat(userId, options);
    },
    handleHubMemberDirectCall: (userId, displayName, video) => {
      void handleHubMemberDirectCall(userId, displayName, video);
    },
    startDirectCall: (conversation, video) => {
      void callManager.startDirectCall(conversation, video);
    },
    startGroupMeeting: (conversation, video) => {
      void callManager.startGroupMeeting(conversation, video);
    },
    getSelectedConversation: () => selectedConversationForDisplay ?? selectedConversation,
    getSelectedConversationId: () => selectedId,
    getDirectChatPeerUserId: (conversationId) =>
      directChatMetadata[conversationId]?.peerUserId ??
      conversations.find((entry) => entry.id === conversationId)?.peerUserId ??
      null,
    applyThreadReplySent: (threadRootId) => {
      setMessages((current) => bumpThreadReplyCount(current, threadRootId));
    },
    applyThreadMessagesRegistered: () => {
      setMessages((current) => filterMainChatMessages(current));
    },
    saveConversationScroll: (conversationId, snapshot) => {
      handleSaveConversationScroll(conversationId, snapshot);
    },
    applyAfterConversationHistoryCleared,
  };

  const conversationThreadCallbacks = useConversationThreadCallbacks(conversationThreadActionsRef);

  const renderMainPanel = () => {
    if (mainView === 'activity') {
      return (
        <ActivityView
          notifications={activityNotifications}
          pendingFriends={activityPendingFriends}
          hubInvites={activityHubInvites}
          conversations={conversations}
          loading={activityLoading}
          error={activityError}
          onRetry={() => {
            void loadActivityData();
          }}
          onNotificationClick={handleNotificationClick}
          onRespondFriend={(requestId, status, context) => {
            void handleRespondFriendRequest(requestId, status, context);
          }}
          onRespondHubInvite={(inviteId, accept, linkedNotificationId) => {
            void handleRespondHubInvite(inviteId, accept, linkedNotificationId);
          }}
          onMarkAllRead={() => {
            void syncNotifications({ withLoading: true, markAllRead: true });
          }}
          onMarkNotificationRead={(notificationId) => {
            void markNotificationRead(notificationId).then((result) => {
              if (!result.ok) {
                handleUnauthorized(result.status);
                return;
              }

              setActivityNotifications((current) => current.filter((item) => item.id !== notificationId));
              void refreshUnreadCount();
            });
          }}
          onOpenNotificationSettings={() => {
            setProfileInitialTab('notifications');
            handleNavigate('profile');
          }}
          calendarInviteStatusByEventId={calendarInviteStatusByEventId}
          onCalendarInviteResponded={() => {
            void loadCalendarData();
            void loadActivityData();
          }}
          onUnauthorized={handleUnauthorized}
        />
      );
    }

    if (mainView === 'calls') {
      return (
        <CallHistoryView
          items={callHistoryItems}
          loading={callHistoryLoading}
          error={callHistoryError}
          filter={callHistoryFilter}
          currentUserId={getUserId(user)}
          onFilterChange={(filter) => {
            setCallHistoryFilter(filter);
          }}
          onRetry={() => {
            void loadCallHistoryData();
          }}
          onDeleteCall={async (item) => {
            const confirmed = await confirm({
              title: 'Delete call history',
              message: 'Are you sure you want to remove this call from your history?'
            });
            if (confirmed) {
              const res = await deleteChatMessage(item.conversationId, item.id, 'me');
              if (res.ok) {
                setCallHistoryItems(prev => prev.filter(c => c.id !== item.id));
              } else {
                toast.error('Failed to delete call history');
              }
            }
          }}
          onOpenConversation={(item) => {
            handleOpenInChat(item.conversationId, null);
          }}
          onCall={(item, video) => {
            const conversation = conversationsRef.current.find(c => c.id === item.conversationId);
            if (!conversation) return;
            
            if (conversation.kind === 'hub') {
              void callManager.startGroupMeeting(conversation, video);
            } else {
              void callManager.startDirectCall(conversation, video);
            }
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
            const messageId =
              item.messageId?.trim() ||
              (item.id && !item.id.startsWith('saved-') ? item.id : null);
            handleOpenInChat(item.conversationId, messageId);
          }}
          onUnsave={async (item) => {
            if (!item.conversationId || !item.messageId) return;
            setSavedItems((current) => current.filter((i) => i.id !== item.id));
            await unsaveChatMessage(item.conversationId, item.messageId);
            void loadSavedData();
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
          hubOptions={calendarHubOptions}
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
          onEventSaved={(saved) => {
            setCalendarEvents((current) =>
              current.map((event) => {
                if (event.id !== saved.id) {
                  return event;
                }

                const tagged = mergeCalendarEventTagFields(event, saved);
                return {
                  ...event,
                  ...saved,
                  mentionUserIds: tagged.mentionUserIds,
                  invitees: tagged.invitees,
                };
              }),
            );
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
            const inviteSnapshot = hubsInvites.find((entry) => entry.id === inviteId) ?? null;
            const result = await acceptHubInviteById(inviteId);
            if (result.ok) {
              await finalizeHubInviteAccept({
                inviteId,
                invite: inviteSnapshot,
                acceptResult: result.data,
              });
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
              await finalizeHubInviteAccept({
                acceptResult: result.data,
                channelIdFallback: channelId,
              });
              toast.success('Joined hub successfully.');
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
          sessionNotificationSettings={notificationSettings}
          onLogout={() => void handleSignOut()}
          onUnauthorized={handleUnauthorized}
          onUserUpdated={() => {
            void getCurrentUser().then(async (result) => {
              if (result.ok) {
                const userPayload = result.data.user ?? result.data;
                setUser(userPayload);
                const statusResult = await loadResolvedUserStatus(getUserId(userPayload) ?? '');
                const { status, statusMessage } = mergeRemoteUserStatus(
                  userPayload,
                  statusResult.ok ? statusResult.data : null,
                );
                applyPresenceSharingPreference(userPayload, notificationSettingsRef.current);
                if (isPresenceManagerStarted()) {
                  applyRemotePresenceBootstrap(status, statusMessage);
                } else {
                  startPresenceManager(status, statusMessage);
                }
              }
            });
          }}
          hasUpdateBadge={updateAvailable && !updateViewed}
          onUpdateViewed={() => setUpdateViewed(true)}
          onNotificationSettingsChange={syncNotificationSettings}
          initialTab={profileInitialTab}
        />
      );
    }

    if (mainView === 'organization') {
      return (
        <OrganizationView
          user={user}
          onUnauthorized={handleUnauthorized}
          onUserUpdated={handleOrganizationUserUpdated}
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

    if (mainView === 'superadmin') {
      if (!userIsSuperAdmin(user)) {
        return (
          <div className="flex flex-1 items-center justify-center bg-app-chat-bg px-6 text-sm text-app-muted">
            You do not have super admin access.
          </div>
        );
      }

      return (
        <SuperAdminView
          user={user}
          onUnauthorized={handleUnauthorized}
          onLogout={() => void handleSignOut()}
          onExitSuperAdmin={() => handleNavigate('chat')}
        />
      );
    }

    if (selectedConversation) {
      return (
        <ConversationThread
          conversation={selectedConversationForDisplay ?? selectedConversation}
          blockedByPeerIds={blockedByPeerIds}
          presenceByUserId={presenceByUserId}
          viewerSharePresence={true}
          hubDetails={selectedConversation.kind === 'hub' ? activeHubDetails : null}
          conversationDetails={activeHubDetails}
          pinnedMessageIds={pinnedMessageIds}
          conversations={conversations}
          sendProgressByMessageId={outboundSendProgress}
          blockedUserIds={blockedUserIds}
          messages={visibleMessages}
          draft={draft}
          loading={threadLoading}
          error={threadError}
          draftError={draftError}
          typingLabel={typingLabel}
          isSending={isSending}
          onUnauthorized={handleUnauthorized}
          currentUserId={getUserId(user)}
          savedMessageIds={savedMessageIds}
          focusMessageId={focusMessageId}
          unreadAnchorMessageId={threadUnreadAnchorId}
          initialScrollSnapshot={
            focusMessageId || !selectedId
              ? null
              : getConversationScrollSnapshot(selectedId) ?? null
          }
          hasMoreOlder={hasMoreOlderMessages}
          loadingOlder={loadingOlderMessages}
          callBusy={callManager.busy || callManager.session.phase !== 'idle'}
          {...conversationThreadCallbacks}
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

  const callImmersiveMode =
    callManager.session.phase === 'active' && callPanelLayout === 'fullscreen';
  const showMeetingBanner =
    callManager.session.phase === 'idle' && Boolean(callManager.session.meetingBanner);

  const meetingCallHubDetails = (() => {
    const conversationId = callManager.session.conversationId;

    if (!conversationId || !callManager.session.isGroup) {
      return null;
    }

    if (selectedConversation?.id === conversationId && activeHubDetails) {
      return activeHubDetails;
    }

    return getThreadCacheEntry(threadCacheRef.current, conversationId)?.activeHubDetails ?? null;
  })();

  return (
    <div
      className={`flex h-full bg-app-chat-bg ${callImmersiveMode ? 'overflow-hidden bg-[#101114]' : ''}`}
    >
      <MediaPreviewHost />
      {showMeetingBanner && callManager.session.meetingBanner
        ? createPortal(
            <MeetingStartedBanner
              meeting={callManager.session.meetingBanner}
              onJoin={() => {
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
              onDismiss={callManager.dismissMeetingBanner}
            />,
            document.body,
          )
        : null}
      <CallOverlay
        session={callManager.session}
        busy={callManager.busy}
        room={callManager.room}
        remoteParticipants={callManager.remoteParticipants}
        mediasoupPeers={callManager.mediasoupPeers}
        mediasoupLocalVideo={callManager.mediasoupLocalVideo}
        micEnabled={callManager.micEnabled}
        cameraEnabled={callManager.cameraEnabled}
        screenShareEnabled={callManager.screenShareEnabled}
        screenSharePickerOpen={callManager.screenSharePickerOpen}
        onCloseScreenSharePicker={callManager.closeScreenSharePicker}
        onShareScreenSource={(source) => void callManager.shareScreenFromSource(source)}
        pendingJoinRequests={callManager.pendingJoinRequests}
        awaitingJoinApproval={callManager.awaitingJoinApproval}
        panelLayout={callPanelLayout}
        onPanelLayoutChange={setCallPanelLayout}
        onAccept={() => void callManager.acceptIncomingCall()}
        onReject={() => void callManager.rejectIncomingCall()}
        onCancel={() => void callManager.cancelOutgoingCall()}
        onEnd={() => void callManager.endActiveCall()}
        onToggleMic={() => void callManager.toggleMic()}
        onToggleCamera={() => void callManager.toggleCamera()}
        onToggleScreenShare={() => void callManager.toggleScreenShare()}
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
        meetingHubMembers={callManager.meetingHubMembers}
        meetingHubMembersLoaded={callManager.meetingHubMembersLoaded}
        fallbackHubDetails={meetingCallHubDetails}
        meetingDeclinedInviteUserIds={callManager.meetingDeclinedInviteUserIds}
        meetingInvitedUserIds={callManager.meetingInvitedUserIds}
        meetingInviteBusyUserId={callManager.meetingInviteBusyUserId}
        onInviteUserToMeeting={(userId) => void callManager.inviteUserToMeeting(userId)}
      />
      <div
        className={`flex min-h-0 min-w-0 flex-1 ${callImmersiveMode ? 'pointer-events-none invisible' : ''}`}
        aria-hidden={callImmersiveMode}
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
        user={user}
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
      {mainView !== 'superadmin' ? (
      <NavRail
        unreadCount={unreadCount}
        user={user}
        activeView={mainView}
        onNavigate={handleNavigate}
        onGoHome={handleGoToChatHome}
        onOpenFlexAi={() => setFlexAiOpen((current) => !current)}
        onLogout={() => void handleSignOut()}
        hasUpdateBadge={updateAvailable && !updateViewed}
      />
      ) : null}

      {mainView !== 'superadmin' ? (
      <ChatSidebar
        workspaceName={workspaceShortName}
        organizationNavEnabled={userInOrganization(user)}
        selfLabel={selfLabel}
        openingTeammateId={openingTeammateId}
        directChatMetadata={directChatMetadata}
        presenceByUserId={presenceByUserId}
        viewerUserId={getUserId(user)}
        viewerSharePresence={true}
        conversations={conversationsForSidebar}
        typingPreviews={typingPreviews}
        teammates={teammates}
        blockedByPeerIds={blockedByPeerIds}
        loading={loading}
        error={error}
        selectedId={selectedId}
        onSelect={handleSelectConversation}
        onPrefetch={prefetchThread}
        conversationMenuActions={sidebarConversationMenuActions}
        conversationMenuBusy={conversationMenuBusyId !== null}
        blockedUserIds={blockedUserIds}
        onPrepareConversationContextMenu={() => {
          void refreshBlockedUserIds();
        }}
        onRetry={() => {
          void loadData();
        }}
        onTeammateSelect={handleTeammateSelect}
        onTeammateAddFriend={handleTeammateAddFriend}
        onSelectPerson={(person) => {
          void handleSelectPerson(person);
        }}
        onMessageSelf={handleMessageSelf}
        newConversationOpen={newConversationOpen}
        onNewConversationOpenChange={setNewConversationOpen}
        onMessageUser={(userId) => {
          void handleOpenDirectChat(userId);
        }}
        onNavigate={handleNavigate}
        notificationSettings={notificationSettings}
        onOpenNotificationSettings={() => {
          setProfileInitialTab('notifications');
          handleNavigate('profile');
        }}
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
          if (memberIds.length > 0) {
            showActionMessage(
              `Hub created and ${memberIds.length} invitation${memberIds.length === 1 ? '' : 's'} sent.`,
            );
          } else {
            showActionMessage('Hub created successfully.');
          }
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
      ) : null}

      <main className="relative flex min-w-0 flex-1 flex-col">
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
      {summaryPanelOpen && (
        <SummaryPanel
          summary={summaryContent}
          loading={summaryLoading}
          onClose={() => setSummaryPanelOpen(false)}
        />
      )}
      </div>
    </div>
  );
}
