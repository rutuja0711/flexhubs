import { useCallback, useEffect, useMemo, useRef, useState, startTransition } from 'react';
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
import { buildCalendarHubOptions, enrichCalendarEventsWithTeammateAvatars } from '../shared/extras';
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
import { estimateSendDurationMs, runSimulatedProgress } from './uploadProgress';
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
import { mapApiPresenceToStatus, mergeConversationDraftPreviews, seedDraftPreviewCache, buildPlaceholderDirectConversation, dedupeDirectConversations, mergeConversationLists, repairConversationPeerIds, patchDirectConversationMetadata, applyStoredDirectChatMetadata, findConversationByAnyId, findConversationForPeerUserId, reconcileDirectConversations, dropBrokenDirectConversations, isBrokenDirectTitle, readDirectPeerDisplayName, readConversationSnoozeState, sanitizeDirectDisplayName, withConversationSnoozed, buildConversationSnoozePayload, formatConversationSnoozeUntil, resolveConversationForMessage, resolveTypingConversationId, buildConversationListPreview } from '../shared/chat';
import { enrichCallHistoryItems, type CallHistoryItem } from '../shared/calls';
import type {
  MessageItem,
  NotificationItem,
  PendingFriendItem,
  TeammateItem,
} from '../shared/messages';
import type { GifPickerItem } from '../shared/gifs';
import { applyMessageReadReceipts, applyReactionPatch, buildScheduleMessageBody, clearThreadReplyRegistry, enrichMessageReplies, extractPeerLastReadMessageIds, filterMainChatMessages, findFirstUnreadMessageId, formatMessagePreview, isAlreadyDeletedForEveryoneError, markMessageDeletedForEveryone, mergeMessageUpdates, mergeServerMessagesWithLocal, readLastReadMessageId, registerThreadReplyMessage, resolveMessageReadBy, resolveNotificationAction, resolveNotificationConversationId, resolveThreadRootId } from '../shared/messages';
import type { AiTextResult } from '../shared/extras';
import { hoursToSnoozePreset, inferFlexIntent } from '../shared/extras';
import type { ProfileSettings } from '../shared/profile';
import { normalizeUserProfile, userCanManageOrganization } from '../shared/profile';
import { scheduleCalendarReminders } from './calendarReminders';
import {
  alertNewDesktopNotifications,
  bindMessageNotificationSound,
  peekNewNotifications,
  markNotificationSeen,
  seedNotificationSnapshot,
  showCalendarEventReminder,
  showIncomingMessageDesktopNotification,
} from './desktopNotifications';
import { FlexHubsDesktopNotification, mapMessageToNotificationData } from './ui/notifications/FlexHubsDesktopNotification';
import {
  ensureDesktopNotificationsReady,
  shouldDeliverDesktopNotifications,
} from './pushNotifications';
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
import { startPresenceManager, stopPresenceManager, syncPresenceToServer } from './presenceManager';
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
const NOTIFICATION_POLL_CONNECTED_MS = 12_000;
const NOTIFICATION_POLL_DISCONNECTED_MS = 3_000;
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

function isActivelyViewingConversation(
  conversationId: string,
  mainView: MainView,
  selectedConversationId: string | null,
): boolean {
  if (mainView !== 'chat' || selectedConversationId !== conversationId) {
    return false;
  }

  if (typeof document === 'undefined') {
    return false;
  }

  return document.hasFocus() && !document.hidden;
}

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

function shouldDropHubMessageFromBlockedSender(
  message: MessageItem,
  conversation: ConversationItem | null | undefined,
  blockedUserIds: ReadonlySet<string>,
): boolean {
  return (
    conversation?.kind === 'hub' &&
    !message.isOwn &&
    Boolean(message.senderId) &&
    blockedUserIds.has(message.senderId as string)
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
  const withReaders = withReceipts.map((message) => {
    if (!message.isOwn || message.status !== 'seen') {
      return message;
    }

    const readBy = resolveMessageReadBy(message, conversation ?? null, withReceipts, userId);

    return readBy.length > 0 ? { ...message, readBy } : message;
  });

  return enrichMessageReplies(filterMainChatMessages(withReaders));
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

function markMessageStatus(
  current: MessageItem[],
  messageId: string,
  status: MessageItem['status'],
): MessageItem[] {
  return current.map((message) =>
    message.id === messageId ? { ...message, status } : message,
  );
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
  shouldIgnore?: (message: MessageItem) => boolean,
): MessageItem[] {
  if (shouldIgnore?.(incoming)) {
    return current;
  }

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
  const allowSuperAdminAutoLandingRef = useRef(userIsSuperAdmin(getStoredUser()));

  const [mainView, setMainView] = useState<MainView>(() =>
    userIsSuperAdmin(getStoredUser()) ? 'superadmin' : 'chat',
  );
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
  const realtimeStatusRef = useRef<RealtimeConnectionStatus>('idle');
  const [threadLoading, setThreadLoading] = useState(false);
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
  const [messageScrollRestoreKey, setMessageScrollRestoreKey] = useState(0);
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
  const messagesRef = useRef<MessageItem[]>([]);
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

    // Check for updates shortly after startup
    const timer = setTimeout(() => {
      void window.electronAPI?.checkForUpdates().catch(() => undefined);
    }, 5000);

    const unsubAvailable = window.electronAPI.onUpdaterEvent('update-available', (info: any) => {
      setUpdateAvailable(true);
      setUpdateViewed(false);
      
      toast.info(`Version ${info?.version || "new"} is ready to download.`, {
        action: { label: "View Update", onClick: () => handleNavigate("profile") }
      });

    });

    // Remind user / check for updates every hour (3600000 ms)
    const interval = setInterval(() => {
      void window.electronAPI?.checkForUpdates().catch(() => undefined);
    }, 60 * 60 * 1000);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
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

  const conversationsForSidebar = useMemo(
    () =>
      conversations.map((conversation) =>
        redactDirectConversationForPeerBlock(conversation, blockedByPeerIds),
      ),
    [blockedByPeerIds, conversations],
  );

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
      setActivityNotifications((current) => current.filter((n) => resolveNotificationConversationId(n, conversationsRef.current) !== conversationId));
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
    onSessionExpired();
  }, [confirm, onSessionExpired]);

  const activityNotificationsRef = useRef<NotificationItem[]>([]);

  useEffect(() => {
    activityNotificationsRef.current = activityNotifications;
  }, [activityNotifications]);

  const refreshUnreadCount = useCallback(
    async (notificationItems?: NotificationItem[]) => {
      const pendingResult = await loadPendingFriends();

      if (handleUnauthorized(pendingResult.status)) {
        return;
      }

      const pendingCount = pendingResult.ok ? pendingResult.data.length : 0;
      const listSource =
        notificationItems ??
        (activityNotificationsRef.current.length > 0 ? activityNotificationsRef.current : null);

      if (listSource) {
        const unreadFromNotifications = listSource.filter((item) => !item.isRead).length;
        setUnreadCount(unreadFromNotifications + pendingCount);
        return;
      }

      const countResult = await loadUnreadCount();

      if (handleUnauthorized(countResult.status)) {
        return;
      }

      const apiCount = countResult.ok ? countResult.data.count : 0;
      setUnreadCount(apiCount + pendingCount);
    },
    [handleUnauthorized],
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

          return false;
        },
      );
    },
    [isConversationSnoozed, refreshMessageFromNotification, shouldSuppressNotificationAlerts],
  );

  const syncNotifications = useCallback(
    async (options?: { seedSnapshot?: boolean; withLoading?: boolean; markAllRead?: boolean }) => {
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
      const hasUnreadNotifications = notificationList.some((item) => !item.isRead);
      const shouldAcknowledgeOnActivityView =
        mainViewRef.current === 'activity' && hasUnreadNotifications && !options?.markAllRead;

      if (shouldAcknowledgeOnActivityView) {
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

      if (options?.markAllRead || shouldAcknowledgeOnActivityView) {
        notificationList = notificationList.map((item) => ({ ...item, isRead: true }));
      }

      setActivityNotifications(notificationList);

      if (options?.seedSnapshot) {
        seedNotificationSnapshot(notificationList);
      } else {
        void processNotificationAlerts(notificationList);
      }

      void refreshUnreadCount(notificationList);

      void loadPendingFriends().then((pending) => {
        if (handleUnauthorized(pending.status)) {
          return;
        }

        if (pending.ok) {
          setActivityPendingFriends(pending.data);
        }
      });

      if (options?.withLoading) {
        setActivityLoading(false);
      }
    },
    [handleUnauthorized, processNotificationAlerts, refreshUnreadCount],
  );

  const loadActivityData = useCallback(async () => {
    await syncNotifications({ withLoading: true });
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
      const statusMessageByUserId = new Map(
        result.data.map((item) => [item.userId, item.statusMessage] as const),
      );

      setTeammates((current) =>
        current.map((teammate) => {
          const statusMessage = statusMessageByUserId.get(teammate.id);

          if (statusMessage === undefined) {
            return teammate;
          }

          return { ...teammate, statusMessage };
        }),
      );

      setConversations((current) =>
        applyDraftPreviews(
          current.map((conversation) => {
            if (!conversation.peerUserId) {
              return conversation;
            }

            const status = statusByUserId.get(conversation.peerUserId);
            const peerStatusMessage = statusMessageByUserId.get(conversation.peerUserId);

            if (!status && peerStatusMessage === undefined) {
              return conversation;
            }

            return {
              ...conversation,
              ...(status ? { status } : {}),
              ...(peerStatusMessage !== undefined ? { peerStatusMessage } : {}),
            };
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

        const nextMessages = mergeServerMessagesWithLocal(
          commitMessages(
            bootstrapResult.data.messages,
            getUserId(user),
            bootstrapResult.data.conversation,
          ),
          cached?.messages ?? [],
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

      if (mainViewRef.current === 'calls') {
        loadCallHistoryDataRef.current?.();
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

  useEffect(() => {
    setCallPanelLayout('floating');
  }, [callManager.session.callId]);

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

    setCalendarEvents(
      enrichCalendarEventsWithTeammateAvatars(result.data, teammatesRef.current),
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

  const openHubFromNotification = useCallback(
    async (channelId: string | null, inviteId: string | null) => {
      if (channelId) {
        const existing = findConversationByAnyId(conversationsRef.current, channelId);

        if (existing) {
          handleSelectConversationRef.current(existing.id);
          return;
        }
      }

      if (inviteId) {
        const result = await acceptHubInviteById(inviteId);

        if (result.ok) {
          await refreshConversations();
          void loadHubsData();

          if (channelId) {
            handleSelectConversationRef.current(channelId);
          } else {
            setMainView('hubs');
          }

          toast.success('Hub invite accepted.');
          return;
        }

        if (handleUnauthorized(result.status)) {
          return;
        }
      } else if (channelId) {
        const result = await acceptHubInvite(channelId);

        if (result.ok) {
          await refreshConversations();
          void loadHubsData();
          handleSelectConversationRef.current(channelId);
          toast.success('Joined hub successfully.');
          return;
        }

        if (handleUnauthorized(result.status)) {
          return;
        }
      }

      setMainView('hubs');
      void loadHubsData();
    },
    [handleUnauthorized, loadHubsData, refreshConversations],
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

      if (incomingMessage && conversationId && isNewMessageEvent(type)) {
        const message = markOwnMessages([incomingMessage], userId)[0];
        const { conversationId: resolvedConversationId, conversation } = resolveConversationForMessage(
          conversationsRef.current,
          conversationId,
          message.senderId,
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
            void markConversationRead(resolvedConversationId).then((result) => {
              if (result.ok) {
                clearConversationUnread(resolvedConversationId);
              }
            });
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
            notifyIncomingMessage(message, resolvedConversationId, conversation);
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
            notifyIncomingMessage(message, resolvedConversationId, conversation);
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
          
          setSavedItems((current) => current.filter((item) => item.messageId !== messageId));
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

          if (presenceUpdate.statusMessage !== undefined) {
            setTeammates((current) =>
              current.map((teammate) =>
                teammate.id === presenceUpdate.userId
                  ? { ...teammate, statusMessage: presenceUpdate.statusMessage ?? '' }
                  : teammate,
              ),
            );
          }

          if (status || presenceUpdate.statusMessage !== undefined) {
            setConversations((current) =>
              applyDraftPreviews(
                current.map((conversation) =>
                  conversation.peerUserId === presenceUpdate.userId
                    ? {
                        ...conversation,
                        ...(status ? { status } : {}),
                        ...(presenceUpdate.statusMessage !== undefined
                          ? { peerStatusMessage: presenceUpdate.statusMessage }
                          : {}),
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
          notifyIncomingMessage(message, resolvedConversationId, conversation);
        } else {
          void syncNotifications();
        }
      }
    },
    [applyDraftPreviews, applyTypingUpdate, clearConversationUnread, clearTypingUser, isConversationSnoozed, notifyIncomingMessage, patchMessageReactions, refreshActiveThreadSilently, refreshMessageReactions, scheduleConversationsRefresh, shouldSuppressNotificationAlerts, syncNotifications, touchConversationWithMessage],
  );

  handleRealtimeEventRef.current = handleRealtimeEvent;
  syncNotificationsRef.current = syncNotifications;

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
        void syncPresenceToServer();
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
    void refreshBlockedUserIds();
    void refreshUnreadCount();
    void loadNotificationSettings().then((result) => {
      if (result.ok) {
        notificationSettingsRef.current = result.data;
        setNotificationSettings(result.data);
      }
    });
    void ensureDesktopNotificationsReady();
    bindMessageNotificationSound(
      () => notificationSettingsRef.current?.messageSoundEnabled ?? false,
    );
    void syncNotifications({ seedSnapshot: true });
  }, [loadCalendarData, loadData, refreshBlockedUserIds, refreshUnreadCount, syncNotifications]);

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
    const pollMs =
      realtimeStatus === 'connected'
        ? NOTIFICATION_POLL_CONNECTED_MS
        : NOTIFICATION_POLL_DISCONNECTED_MS;

    void syncNotifications();

    const intervalId = window.setInterval(() => {
      void syncNotifications();
    }, pollMs);

    return () => window.clearInterval(intervalId);
  }, [realtimeStatus, syncNotifications]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void loadCalendarData();
    }, CALENDAR_POLL_MS);

    return () => window.clearInterval(intervalId);
  }, [loadCalendarData]);

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
    const intervalId = window.setInterval(() => {
      void refreshUnreadCount();
    }, UNREAD_POLL_MS);

    return () => window.clearInterval(intervalId);
  }, [refreshUnreadCount]);

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
    if (view !== 'superadmin') {
      allowSuperAdminAutoLandingRef.current = false;
    }

    startTransition(() => {
      setMainView(view);
    });
  }, []);

  const handleOrganizationUserUpdated = useCallback((nextUser: unknown) => {
    setUser(nextUser);
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
    const action = resolveNotificationAction(notification, conversations);

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
      readBy: [],
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

    patchOutboundSendProgress(localId, 90);

    if (isLocalSendCancelled(localId)) {
      cleanupCancelledOutboundSend(localId);
      return;
    }

    const stopSendProgress = runSimulatedProgress(91, 97, estimateSendDurationMs(), (value) => {
      if (!isLocalSendCancelled(localId)) {
        patchOutboundSendProgress(localId, value);
      }
    });

    const result = await sendChatFileMessage(
      conversationId,
      uploadedUrl,
      file.name,
      mimeType,
      replyToId,
      threadRootId,
      messageCaption || undefined,
    );
    stopSendProgress();

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

  const handleAddReaction = async (messageId: string, emoji: string) => {
    if (!selectedId) {
      return;
    }

    const currentUserId = getUserId(user);
    if (!currentUserId) return;

    // Find the message in either main chat or thread cache
    let targetMessage = messages.find(m => m.id === messageId);
    if (!targetMessage && threadCacheRef.current[selectedId]) {
      targetMessage = threadCacheRef.current[selectedId].messages.find(m => m.id === messageId);
    }

    let finalResult;

    const existingReactions = targetMessage ? targetMessage.reactions.filter(r => r.userId === currentUserId) : [];
    const exactMatch = existingReactions.find(r => r.emoji === emoji);

    // OPTIMISTIC UPDATE: Prevents rapid double-clicks from causing race conditions
    setMessages((current) =>
      current.map((message) => {
        if (message.id === messageId) {
          const isToggleOff = existingReactions.length === 1 && exactMatch;
          const newReactions = message.reactions.filter((r) => r.userId !== currentUserId);
          if (!isToggleOff) {
            newReactions.push({ emoji, userId: currentUserId, username: user?.name || '' });
          }
          return { ...message, reactions: newReactions };
        }
        return message;
      }),
    );

    if (targetMessage) {

      if (exactMatch) {
        // Toggle off exact match. Also clear any other rogue reactions.
        for (const reaction of existingReactions) {
          const removeResult = await removeMessageReaction(selectedId, messageId, reaction.emoji);
          if (reaction.emoji === emoji && !removeResult.ok) {
            if (handleUnauthorized(removeResult.status)) return;
            setThreadError(removeResult.error);
            return;
          }
          if (reaction.emoji === emoji) {
            finalResult = removeResult;
          }
        }
      } else if (existingReactions.length > 0) {
        // Changed emoji: remove all old ones, then fall through to add new one
        for (const reaction of existingReactions) {
          const removeResult = await removeMessageReaction(selectedId, messageId, reaction.emoji);
          if (!removeResult.ok && handleUnauthorized(removeResult.status)) return;
        }
      }
    }

    if (!finalResult) {
      finalResult = await addMessageReaction(selectedId, messageId, emoji);
      if (!finalResult.ok) {
        if (handleUnauthorized(finalResult.status)) {
          return;
        }
        setThreadError(finalResult.error);
        return;
      }
    }

    const resultData = finalResult.data;

    setMessages((current) =>
      current.map((message) =>
        message.id === messageId
          ? preserveMessageOwnership(mergeMessageUpdates(message, resultData), message, currentUserId)
          : message,
      ),
    );

    patchThreadCacheMessages(threadCacheRef.current, selectedId, (current) =>
      current.map((message) =>
        message.id === messageId
          ? preserveMessageOwnership(mergeMessageUpdates(message, resultData), message, currentUserId)
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

      if (selectedIdRef.current === conversation.id) {
        setMessages([]);
        void loadThread(conversation.id);
      }

      toast.success('Chat history cleared.');
      void refreshConversations();
    },
    [confirm, handleUnauthorized, loadThread, refreshConversations],
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
      setThreadError(result.error);
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
          onMarkAllRead={() => {
            void syncNotifications({ withLoading: true, markAllRead: true });
          }}
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
            handleOpenInChat(item.conversationId, item.messageId);
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
                const userPayload = result.data.user ?? result.data;
                setUser(userPayload);
                const profile = normalizeUserProfile(userPayload);
                startPresenceManager(profile.status, profile.statusMessage);
              }
            });
          }}
          hasUpdateBadge={updateAvailable && !updateViewed}
          onUpdateViewed={() => setUpdateViewed(true)}
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
          hubDetails={selectedConversation.kind === 'hub' ? activeHubDetails : null}
          conversationDetails={activeHubDetails}
          pinnedMessageIds={pinnedMessageIds}
          conversations={conversations}
          onSummarizeUnread={handleSummarizeUnread}
          sendProgressByMessageId={outboundSendProgress}
          blockedUserIds={blockedUserIds}
          onBlockedUsersChanged={() => {
            void refreshBlockedUserIds();
          }}
          messages={visibleMessages}
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
          onRetryMessage={(messageId) => {
            void handleRetryMessage(messageId);
          }}
          onSendMedia={(item, kind, replyToId, threadRootId) => {
            void handleSendMedia(item, kind, replyToId, threadRootId);
          }}
          onSendFile={(file, caption, replyToId, threadRootId) => {
            void handleSendFile(file, caption, replyToId, threadRootId);
          }}
          onSendVoice={(file, caption, replyToId, threadRootId) => {
            void handleSendVoice(file, caption, replyToId, threadRootId);
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
          onForwardMessage={(messageId, targetConversationIds) =>
            handleForwardMessage(messageId, targetConversationIds)
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

  const callImmersiveMode =
    callManager.session.phase === 'active' && callPanelLayout === 'fullscreen';
  const showMeetingBanner =
    callManager.session.phase === 'idle' && Boolean(callManager.session.meetingBanner);

  return (
    <div
      className={`flex h-full bg-app-chat-bg ${callImmersiveMode ? 'overflow-hidden bg-[#101114]' : ''}`}
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
      ) : null}

      <main className="relative flex min-w-0 flex-1 flex-col">
        {showMeetingBanner && callManager.session.meetingBanner ? (
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
          />
        ) : null}
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
