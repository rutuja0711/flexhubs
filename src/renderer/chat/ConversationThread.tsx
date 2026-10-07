import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import {
  FiBell,
  FiBellOff,
  FiBookmark,
  FiCalendar,
  FiClock,
  FiMail,
  FiMapPin,
  FiMoreVertical,
  FiPhone,
  FiTrash2,
  FiUsers,
  FiVideo,
} from 'react-icons/fi';
import {
  filterMessagesForBlockPolicy,
  isViewerBlockedByPeer,
} from '../../shared/blocking';
import type { ConversationItem, PresenceStatus } from '../../shared/chat';
import {
  buildConversationSnoozePayload,
  CONVERSATION_SNOOZE_OPTIONS,
  formatConversationSnoozeUntil,
  formatHubMemberSubtitle,
  readConversationSnoozed,
  readHubMemberStats,
} from '../../shared/chat';
import type { GifPickerItem } from '../../shared/gifs';
import type { MessageItem } from '../../shared/messages';
import {
  filterMainChatMessages,
  formatMessagePreview,
  registerThreadReplyMessage,
  trackPendingThreadSend,
} from '../../shared/messages';
import { validateSearchInput } from '../../shared/search';
import {
  loadMessageSearch,
  loadPinnedMessages,
  setConversationFavorite,
  updateConversationNotificationSettings,
  markConversationUnread,
  clearConversationHistory,
  deleteConversation,
} from '../chatApi';
import { useConfirm } from '../ui/ConfirmDialog';
import { useToast } from '../ui/Toast';
import { PinIcon, SearchIcon } from './ChatIcons';
import { ForwardMessageModal } from './ForwardMessageModal';
import { InConversationSearchBar } from './InConversationSearchBar';
import { MessageInput } from './MessageInput';
import { MessageList } from './MessageList';
import { PinnedMessageBanner } from './PinnedMessageBanner';
import { ContactInfoPanel } from './ContactInfoPanel';
import { GroupSidebar } from './GroupSidebar';
import { GroupMembersPanel } from './GroupMembersPanel';
import { ThreadSidebar } from './ThreadSidebar';

type ConversationThreadProps = {
  conversation: ConversationItem;
  hubDetails?: Record<string, unknown> | null;
  conversationDetails?: Record<string, unknown> | null;
  conversations: ConversationItem[];
  messages: MessageItem[];
  draft: string;
  loading: boolean;
  error: string;
  draftError: string;
  typingLabel: string;
  isSending: boolean;
  onDraftChange: (value: string) => void;
  onSend: (replyToId?: string) => void;
  onRetryMessage?: (messageId: string) => void;
  onSendMedia?: (item: GifPickerItem, kind: 'gif' | 'sticker', replyToId?: string, threadRootId?: string) => void;
  onSendFile?: (file: File, caption?: string, replyToId?: string, threadRootId?: string) => void;
  onSendVoice?: (file: File, caption?: string, replyToId?: string, threadRootId?: string) => void;
  onUnauthorized: (status?: number) => boolean;
  currentUserId: string | null;
  onAddReaction: (messageId: string, emoji: string) => void;
  onEditMessage: (messageId: string, content: string) => void;
  onDeleteMessage: (messageId: string, scope: 'me' | 'everyone') => void;
  onForwardMessage: (messageId: string, targetConversationIds: string[]) => Promise<string | null>;
  onPinMessage: (messageId: string, isPinned: boolean) => void;
  onSaveMessage: (messageId: string) => void;
  onUnsaveMessage: (messageId: string) => void;
  savedMessageIds?: ReadonlySet<string>;
  onVotePoll?: (messageId: string, optionId: string) => void;
  onConversationUpdated?: () => void;
  onNotificationsSnoozedChange?: (snoozed: boolean) => void;
  onTogglePin?: (conversationId: string, isPinned: boolean) => void;
  onHubDeleted?: () => void;
  pinnedMessageIds?: string[];
  onOpenCalendar?: () => void;
  focusMessageId?: string | null;
  unreadAnchorMessageId?: string | null;
  scrollRestoreKey?: number;
  hasMoreOlder?: boolean;
  loadingOlder?: boolean;
  onLoadOlder?: () => void;
  onFocusMessageHandled?: () => void;
  onStartVoiceCall?: () => void;
  onStartVideoCall?: () => void;
  callBusy?: boolean;
  onOpenFlexAi?: () => void;
  onThreadReplySent?: (threadRootId: string) => void;
  onThreadMessagesRegistered?: () => void;
  onSummarizeUnread?: () => void;
  sendProgressByMessageId?: Record<string, number>;
  onBlockedUsersChanged?: () => void;
  blockedUserIds?: ReadonlySet<string>;
  blockedByPeerIds?: ReadonlySet<string>;
};

export function ConversationThread({
  conversation,
  hubDetails = null,
  conversationDetails = null,
  conversations,
  messages,
  draft,
  loading,
  error,
  draftError,
  typingLabel,
  isSending,
  onDraftChange,
  onSend,
  onRetryMessage,
  onSendMedia,
  onSendFile,
  onSendVoice,
  onUnauthorized,
  currentUserId,
  onAddReaction,
  onEditMessage,
  onDeleteMessage,
  onForwardMessage,
  onPinMessage,
  onSaveMessage,
  onUnsaveMessage,
  onSummarizeUnread,
  sendProgressByMessageId = {},
  savedMessageIds = new Set<string>(),
  onVotePoll,
  onConversationUpdated,
  onNotificationsSnoozedChange,
  onTogglePin,
  onHubDeleted,
  pinnedMessageIds = [],
  onOpenCalendar,
  focusMessageId = null,
  unreadAnchorMessageId = null,
  scrollRestoreKey = 0,
  hasMoreOlder = false,
  loadingOlder = false,
  onLoadOlder,
  onFocusMessageHandled,
  onStartVoiceCall,
  onStartVideoCall,
  callBusy = false,
  onOpenFlexAi,
  onThreadReplySent,
  onThreadMessagesRegistered,
  onBlockedUsersChanged,
  blockedUserIds,
  blockedByPeerIds,
}: ConversationThreadProps) {
  const toast = useToast();
  const confirm = useConfirm();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchError, setSearchError] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResultCount, setSearchResultCount] = useState(0);
  const [highlightedMessageIds, setHighlightedMessageIds] = useState<string[]>([]);
  const [searchActiveMatchIndex, setSearchActiveMatchIndex] = useState(0);
  const searchMatchIdsRef = useRef<string[]>([]);
  const [forwardMessageId, setForwardMessageId] = useState<string | null>(null);
  const [forwardLoading, setForwardLoading] = useState(false);
  const [forwardError, setForwardError] = useState('');
  const [replyingToMessage, setReplyingToMessage] = useState<MessageItem | null>(null);
  const [threadRootMessage, setThreadRootMessage] = useState<MessageItem | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pinnedPanelOpen, setPinnedPanelOpen] = useState(false);
  const [loadedPinnedMessages, setLoadedPinnedMessages] = useState<MessageItem[]>([]);
  const [pinnedBannerDismissed, setPinnedBannerDismissed] = useState(false);
  const [pinnedBannerIndex, setPinnedBannerIndex] = useState(0);
  const [bannerScrollTargetId, setBannerScrollTargetId] = useState<string | null>(null);
  const [scrollRequestKey, setScrollRequestKey] = useState(0);
  const [menuBusy, setMenuBusy] = useState(false);
  const [snoozeMenuOpen, setSnoozeMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const highlightTimeoutsRef = useRef<number[]>([]);

  // Close menu on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [menuOpen]);

  const title = conversation.isSelf ? `${conversation.title} (Yourself)` : conversation.title;

  function presenceLabel(status: PresenceStatus | null): string | null {
    if (!status) {
      return null;
    }

    if (status === 'online') return 'Online';
    if (status === 'away') return 'Away';
    if (status === 'dnd') return 'Do not disturb';
    if (status === 'offline') return 'Offline';
    return null;
  }

  const isDirectContact =
    conversation.kind === 'direct' && !conversation.isSelf && Boolean(conversation.peerUserId);
  const peerBlockedByCurrentUser =
    isDirectContact &&
    conversation.peerUserId != null &&
    blockedUserIds?.has(conversation.peerUserId) === true;
  const peerBlockedViewer =
    isDirectContact &&
    conversation.peerUserId != null &&
    isViewerBlockedByPeer(conversation.peerUserId, blockedByPeerIds ?? new Set());

  const subtitle = (() => {
    if (conversation.isSelf) {
      return 'Message yourself';
    }

    if (conversation.kind === 'hub') {
      const stats = readHubMemberStats(hubDetails ?? conversationDetails ?? null);
      if (stats.memberCount > 0) {
        return formatHubMemberSubtitle(stats.memberCount, stats.adminCount);
      }

      return 'Hub';
    }

    if (peerBlockedViewer) {
      return '';
    }

    const customStatus = conversation.peerStatusMessage?.trim();

    if (customStatus) {
      return customStatus;
    }

    return presenceLabel(conversation.status) ?? 'Available';
  })();

  useEffect(() => {
    setSearchOpen(false);
    setSearchQuery('');
    setSearchError('');
    setSearchResultCount(0);
    setHighlightedMessageIds([]);
    setForwardMessageId(null);
    setForwardLoading(false);
    setForwardError('');
    setReplyingToMessage(null);
    setThreadRootMessage(null);
    setSettingsOpen(false);
    setMenuOpen(false);
    setSnoozeMenuOpen(false);
    setPinnedPanelOpen(false);
    setPinnedBannerDismissed(false);
    setPinnedBannerIndex(0);
    setBannerScrollTargetId(null);
    setScrollRequestKey(0);
    setLoadedPinnedMessages([]);
    highlightTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    highlightTimeoutsRef.current = [];
  }, [conversation.id]);

  useEffect(() => {
    return () => {
      highlightTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
      highlightTimeoutsRef.current = [];
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    void loadPinnedMessages(conversation.id).then((result) => {
      if (cancelled) {
        return;
      }

      setLoadedPinnedMessages(result.ok ? result.data : []);
    });

    return () => {
      cancelled = true;
    };
  }, [conversation.id]);

  const pinnedMessages = useMemo(() => {
    const byId = new Map<string, MessageItem>();

    for (const message of loadedPinnedMessages) {
      byId.set(message.id, message);
    }

    for (const message of messages) {
      if (message.pinnedAt || pinnedMessageIds.includes(message.id)) {
        byId.set(message.id, message);
      }
    }

    for (const [id] of [...byId.entries()]) {
      const live = messages.find((item) => item.id === id);

      if (live && !live.pinnedAt && !pinnedMessageIds.includes(id)) {
        byId.delete(id);
      }
    }

    return [...byId.values()].sort((left, right) => {
      const leftTime = Date.parse(left.pinnedAt ?? left.createdAt);
      const rightTime = Date.parse(right.pinnedAt ?? right.createdAt);

      if (!Number.isNaN(leftTime) && !Number.isNaN(rightTime) && leftTime !== rightTime) {
        return rightTime - leftTime;
      }

      return right.createdAt.localeCompare(left.createdAt);
    });
  }, [loadedPinnedMessages, messages, pinnedMessageIds]);

  const mainChatMessages = useMemo(() => {
    const main = filterMainChatMessages(messages);
    return filterMessagesForBlockPolicy(
      main,
      conversation.kind,
      blockedUserIds ?? new Set(),
      currentUserId,
    );
  }, [blockedUserIds, conversation.kind, currentUserId, messages]);
  const threadsEnabled = conversation.kind === 'hub';

  const featuredPinnedMessage =
    pinnedMessages[pinnedBannerIndex % Math.max(pinnedMessages.length, 1)] ?? null;

  useEffect(() => {
    setPinnedBannerDismissed(false);
    setPinnedBannerIndex(0);
  }, [pinnedMessages.map((message) => message.id).join('|')]);

  const notificationsSnoozedFromProps =
    conversation.notificationsSnoozed === true || readConversationSnoozed(conversationDetails);
  const [notificationsSnoozed, setNotificationsSnoozed] = useState(notificationsSnoozedFromProps);

  useEffect(() => {
    setNotificationsSnoozed(notificationsSnoozedFromProps);
  }, [conversation.id, notificationsSnoozedFromProps]);

  const scrollToMessageInThread = useCallback((messageId: string) => {
    setBannerScrollTargetId(messageId);
    setScrollRequestKey((current) => current + 1);
  }, []);

  const jumpToMessage = useCallback((messageId: string) => {
    scrollToMessageInThread(messageId);
    setHighlightedMessageIds((current) => [...new Set([...current, messageId])]);
  }, [scrollToMessageInThread]);

  const navigateSearchMatch = useCallback(
    (delta: number) => {
      const ids = searchMatchIdsRef.current;

      if (ids.length === 0) {
        return;
      }

      setSearchActiveMatchIndex((current) => {
        const next = (current + delta + ids.length) % ids.length;
        const messageId = ids[next];

        if (messageId) {
          scrollToMessageInThread(messageId);
        }

        return next;
      });
    },
    [scrollToMessageInThread],
  );

  useEffect(() => {
    if (focusMessageId) {
      jumpToMessage(focusMessageId);
      onFocusMessageHandled?.();
    }
  }, [focusMessageId, jumpToMessage, onFocusMessageHandled]);

  const handlePinnedBannerJump = () => {
    if (!featuredPinnedMessage) {
      return;
    }

    jumpToMessage(featuredPinnedMessage.id);
  };

  const handlePinnedBannerPrev = () => {
    if (pinnedMessages.length < 2) {
      return;
    }

    setPinnedBannerIndex((current) => (current - 1 + pinnedMessages.length) % pinnedMessages.length);
  };

  const handlePinnedBannerNext = () => {
    if (pinnedMessages.length < 2) {
      return;
    }

    setPinnedBannerIndex((current) => (current + 1) % pinnedMessages.length);
  };

  const handleToggleFavorite = async () => {
    if (onTogglePin) {
      setMenuOpen(false);
      onTogglePin(conversation.id, conversation.isPinned);
      return;
    }

    setMenuBusy(true);
    const nextFavorite = !conversation.isPinned;
    const result = await setConversationFavorite(conversation.id, nextFavorite);
    setMenuBusy(false);
    setMenuOpen(false);

    if (!result.ok) {
      if (onUnauthorized(result.status)) return;
      toast.error(result.error);
      return;
    }

    toast.success(result.data.favorite ? 'Chat pinned.' : 'Chat unpinned.');
    onConversationUpdated?.();
  };

  const handleSnooze = async (duration: string) => {
    const next = duration !== 'off';
    setNotificationsSnoozed(next);
    onNotificationsSnoozedChange?.(next);
    setMenuBusy(true);
    const result = await updateConversationNotificationSettings(
      conversation.id,
      buildConversationSnoozePayload(duration),
    );
    setMenuBusy(false);
    setMenuOpen(false);
    setSnoozeMenuOpen(false);

    if (!result.ok) {
      setNotificationsSnoozed(!next);
      onNotificationsSnoozedChange?.(!next);
      if (onUnauthorized(result.status)) return;
      toast.error(result.error);
      return;
    }

    toast.success(
      next
        ? formatConversationSnoozeUntil(
            duration === 'forever' ? null : (buildConversationSnoozePayload(duration).snoozedUntil as string | null),
            duration === 'forever',
          )
        : 'Notifications enabled for this chat.',
    );
  };

  const handleMarkUnread = async () => {
    setMenuBusy(true);
    const result = await markConversationUnread(conversation.id);
    setMenuBusy(false);
    setMenuOpen(false);

    if (!result.ok) {
      if (onUnauthorized(result.status)) return;
      toast.error(result.error);
      return;
    }

    toast.success('Marked as unread.');
    onConversationUpdated?.();
  };

  const handleClearHistory = async () => {
    setMenuOpen(false);
    const confirmed = await confirm({
      title: 'Clear chat history',
      message: `Clear all messages in "${conversation.title}"?`,
      confirmLabel: 'Clear history',
      tone: 'danger',
    });

    if (!confirmed) return;

    setMenuBusy(true);
    const result = await clearConversationHistory(conversation.id);
    setMenuBusy(false);

    if (!result.ok) {
      if (onUnauthorized(result.status)) return;
      toast.error(result.error);
      return;
    }

    toast.success('Chat history cleared.');
    onConversationUpdated?.();
  };

  const handleDeleteConversation = async () => {
    setMenuOpen(false);
    const confirmed = await confirm({
      title: 'Delete conversation',
      message: `Delete "${conversation.title}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    });

    if (!confirmed) return;

    setMenuBusy(true);
    const result = await deleteConversation(conversation.id);
    setMenuBusy(false);

    if (!result.ok) {
      if (onUnauthorized(result.status)) return;
      toast.error(result.error);
      return;
    }

    toast.success('Conversation deleted.');
    onHubDeleted?.();
    onConversationUpdated?.();
  };

  const handleScheduleEvent = () => {
    setMenuOpen(false);
    if (onOpenCalendar) {
      onOpenCalendar();
      return;
    }
    toast.info('Open Calendar from the left sidebar to schedule events.');
  };

  useEffect(() => {
    if (!searchOpen) {
      return;
    }

    const validation = validateSearchInput(searchQuery);

    if (!validation.ok) {
      setSearchError(validation.error);
      setHighlightedMessageIds([]);
      searchMatchIdsRef.current = [];
      setSearchActiveMatchIndex(0);
      setSearchResultCount(0);
      return;
    }

    if (!validation.value) {
      setSearchError('');
      setHighlightedMessageIds([]);
      searchMatchIdsRef.current = [];
      setSearchActiveMatchIndex(0);
      setSearchResultCount(0);
      return;
    }

    setSearchError('');
    setSearchLoading(true);

    const timer = window.setTimeout(() => {
      void loadMessageSearch(conversation.id, validation.value).then((response) => {
        setSearchLoading(false);

        if (!response.ok) {
          if (onUnauthorized(response.status)) {
            return;
          }

          setSearchError(response.error);
          setHighlightedMessageIds([]);
          searchMatchIdsRef.current = [];
          setSearchActiveMatchIndex(0);
          setSearchResultCount(0);
          return;
        }

        const matchIds = response.data.hits.map((hit) => hit.messageId);
        searchMatchIdsRef.current = matchIds;
        setSearchResultCount(response.data.count);
        setHighlightedMessageIds(matchIds);
        setSearchActiveMatchIndex(0);

        if (matchIds[0]) {
          scrollToMessageInThread(matchIds[0]);
        }
      });
    }, 300);

    return () => window.clearTimeout(timer);
  }, [conversation.id, onUnauthorized, scrollToMessageInThread, searchOpen, searchQuery]);

  const closeSearch = () => {
    setSearchOpen(false);
    setSearchQuery('');
    setSearchError('');
    setHighlightedMessageIds([]);
    searchMatchIdsRef.current = [];
    setSearchActiveMatchIndex(0);
    setSearchResultCount(0);
  };

  const canCallDirect = isDirectContact;
  const canCallHub = conversation.kind === 'hub';
  const isHubPanel = conversation.kind === 'hub' || Boolean(hubDetails);
  const isGroupPanel = !isHubPanel && !isDirectContact;

  const openInfoPanel = () => {
    if (conversation.isSelf) {
      return;
    }

    if (isDirectContact || isHubPanel || isGroupPanel) {
      setSettingsOpen(true);
    }
  };

  return (
    <div className="flex h-full w-full flex-row overflow-hidden">
      <div className="flex h-full flex-1 min-h-0 min-w-0 flex-col bg-app-chat-bg relative">
        <header className="flex items-center justify-between border-b border-app-border bg-app-chat-bg/90 backdrop-blur-md px-6 py-3.5 z-20">
        <div
          className="group min-w-0 cursor-pointer text-left transition-opacity hover:opacity-90"
          onClick={openInfoPanel}
        >
          <div className="flex items-center gap-2">
            <h2 className="truncate text-base font-bold tracking-tight text-app-text group-hover:text-accent-soft transition-colors">{title}</h2>
          </div>
          <p className="truncate text-xs font-medium text-app-muted mt-0.5">{subtitle}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            aria-label="Search in conversation"
            aria-pressed={searchOpen}
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-all duration-200 active:scale-95 ${
              searchOpen
                ? 'bg-accent/20 text-accent-soft ring-1 ring-accent/30'
                : 'text-app-muted hover:bg-app-chat-hover hover:text-app-text'
            }`}
            onClick={() => {
              if (searchOpen) {
                closeSearch();
                return;
              }

              setSearchOpen(true);
            }}
          >
            <SearchIcon className="h-4 w-4" />
          </button>
          {canCallDirect || canCallHub ? (
            <>
              <button
                type="button"
                aria-label={canCallHub ? 'Start voice meeting' : 'Start voice call'}
                disabled={callBusy || peerBlockedByCurrentUser || peerBlockedViewer}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-app-muted transition-all duration-200 hover:bg-app-chat-hover hover:text-app-text active:scale-95 disabled:opacity-40"
                onClick={() => onStartVoiceCall?.()}
              >
                <FiPhone className="text-base" />
              </button>
              <button
                type="button"
                aria-label={canCallHub ? 'Start video meeting' : 'Start video call'}
                disabled={callBusy || peerBlockedByCurrentUser || peerBlockedViewer}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-app-muted transition-all duration-200 hover:bg-app-chat-hover hover:text-app-text active:scale-95 disabled:opacity-40"
                onClick={() => onStartVideoCall?.()}
              >
                <FiVideo className="text-base" />
              </button>
            </>
          ) : null}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              aria-label="Conversation options"
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-all duration-200 active:scale-95 ${
                menuOpen
                  ? 'bg-accent/15 text-accent dark:text-accent-soft'
                  : 'text-app-muted hover:bg-black/[0.05] dark:hover:bg-white/[0.08] hover:text-app-text'
              }`}
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <FiMoreVertical className="text-base" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full z-[120] mt-2 w-60 overflow-hidden rounded-2xl border border-app-border/80 bg-app-surface shadow-[0_20px_50px_-12px_rgba(0,0,0,0.45)] ring-1 ring-black/[0.06] animate-pop-in origin-top-right dark:border-white/10 dark:bg-[#18181c] dark:ring-white/10 dark:shadow-black/70">
                <div
                  className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/25 via-white/5 to-transparent dark:from-white/[0.08] dark:via-white/[0.02]"
                  aria-hidden="true"
                />
                <div className="pointer-events-none absolute inset-0 backdrop-blur-2xl backdrop-saturate-150" aria-hidden="true" />
                <div className="relative p-1.5">
                <button
                  type="button"
                  disabled={menuBusy}
                  onClick={() => {
                    void handleToggleFavorite();
                  }}
                  className="flex w-full items-center justify-between rounded-xl px-3.5 py-2 text-left text-xs font-medium text-app-text hover:bg-black/[0.05] dark:hover:bg-white/[0.08] hover:text-accent dark:hover:text-accent-soft transition-colors disabled:opacity-50"
                >
                  <span className="flex items-center gap-2">
                    <FiMapPin className="shrink-0 text-sm text-app-muted" strokeWidth={1.75} aria-hidden="true" />
                    {conversation.isPinned ? 'Unpin chat' : 'Pin chat'}
                  </span>
                </button>
                <button
                  type="button"
                  disabled={menuBusy}
                  onClick={() => {
                    setMenuOpen(false);
                    setPinnedPanelOpen(true);
                  }}
                  className="flex w-full items-center justify-between rounded-xl px-3.5 py-2 text-left text-xs font-medium text-app-text hover:bg-black/[0.05] dark:hover:bg-white/[0.08] hover:text-accent dark:hover:text-accent-soft transition-colors disabled:opacity-50"
                >
                  <span className="flex items-center gap-2">
                    <FiBookmark className="shrink-0 text-sm text-app-muted" strokeWidth={1.75} aria-hidden="true" />
                    Pinned messages
                  </span>
                  <span className="text-app-muted">{pinnedMessages.length > 0 ? pinnedMessages.length : '›'}</span>
                </button>
                {notificationsSnoozed ? (
                  <button
                    type="button"
                    disabled={menuBusy}
                    onClick={() => {
                      void handleSnooze('off');
                    }}
                    className="flex w-full items-center justify-between rounded-xl px-3.5 py-2 text-left text-xs font-medium text-app-text hover:bg-black/[0.05] dark:hover:bg-white/[0.08] hover:text-accent dark:hover:text-accent-soft transition-colors disabled:opacity-50"
                  >
                    <span className="flex items-center gap-2">
                      <FiBell className="shrink-0 text-sm text-app-muted" strokeWidth={1.75} aria-hidden="true" />
                      Enable notifications
                    </span>
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      disabled={menuBusy}
                      onClick={() => setSnoozeMenuOpen((open) => !open)}
                      className="flex w-full items-center justify-between rounded-xl px-3.5 py-2 text-left text-xs font-medium text-app-text hover:bg-black/[0.05] dark:hover:bg-white/[0.08] hover:text-accent dark:hover:text-accent-soft transition-colors disabled:opacity-50"
                    >
                      <span className="flex items-center gap-2">
                        <FiBellOff className="shrink-0 text-sm text-app-muted" strokeWidth={1.75} aria-hidden="true" />
                        Snooze notifications
                      </span>
                      <span className="text-app-muted">{snoozeMenuOpen ? '⌃' : '›'}</span>
                    </button>
                    {snoozeMenuOpen
                      ? CONVERSATION_SNOOZE_OPTIONS.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            disabled={menuBusy}
                            onClick={() => {
                              void handleSnooze(option.value);
                            }}
                            className="flex w-full items-center gap-2 rounded-lg px-7 py-1.5 text-left text-xs text-app-muted hover:bg-black/[0.05] dark:hover:bg-white/[0.08] hover:text-app-text transition-colors disabled:opacity-50"
                          >
                            <FiClock className="shrink-0 text-[13px] opacity-70" strokeWidth={1.75} aria-hidden="true" />
                            {option.label}
                          </button>
                        ))
                      : null}
                  </>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    openInfoPanel();
                  }}
                  className="flex w-full items-center justify-between rounded-xl px-3.5 py-2 text-left text-xs font-medium text-app-text hover:bg-black/[0.05] dark:hover:bg-white/[0.08] hover:text-accent dark:hover:text-accent-soft transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <FiUsers className="shrink-0 text-sm text-app-muted" strokeWidth={1.75} aria-hidden="true" />
                    Members
                  </span>
                  <span className="text-app-muted">›</span>
                </button>
                <div className="my-1 h-px bg-app-border/70" role="separator" />
                <button
                  type="button"
                  disabled={menuBusy}
                  onClick={() => {
                    void handleMarkUnread();
                  }}
                  className="flex w-full items-center justify-between rounded-xl px-3.5 py-2 text-left text-xs font-medium text-app-text hover:bg-black/[0.05] dark:hover:bg-white/[0.08] hover:text-accent dark:hover:text-accent-soft transition-colors disabled:opacity-50"
                >
                  <span className="flex items-center gap-2">
                    <FiMail className="shrink-0 text-sm text-app-muted" strokeWidth={1.75} aria-hidden="true" />
                    Mark as unread
                  </span>
                </button>
                <button
                  type="button"
                  disabled={menuBusy}
                  onClick={() => {
                    void handleClearHistory();
                  }}
                  className="flex w-full items-center justify-between rounded-xl px-3.5 py-2 text-left text-xs font-medium text-app-text hover:bg-black/[0.05] dark:hover:bg-white/[0.08] hover:text-accent dark:hover:text-accent-soft transition-colors disabled:opacity-50"
                >
                  <span className="flex items-center gap-2">
                    <FiTrash2 className="shrink-0 text-sm text-app-muted" strokeWidth={1.75} aria-hidden="true" />
                    Clear history
                  </span>
                </button>
                <button
                  type="button"
                  disabled={menuBusy}
                  onClick={handleScheduleEvent}
                  className="flex w-full items-center justify-between rounded-xl px-3.5 py-2 text-left text-xs font-medium text-app-text hover:bg-black/[0.05] dark:hover:bg-white/[0.08] hover:text-accent dark:hover:text-accent-soft transition-colors disabled:opacity-50"
                >
                  <span className="flex items-center gap-2">
                    <FiCalendar className="shrink-0 text-sm text-app-muted" strokeWidth={1.75} aria-hidden="true" />
                    Schedule event
                  </span>
                </button>
                {conversation.kind !== 'hub' ? (
                  <button
                    type="button"
                    disabled={menuBusy}
                    onClick={() => {
                      void handleDeleteConversation();
                    }}
                    className="flex w-full items-center justify-between rounded-xl px-3.5 py-2 text-left text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors disabled:opacity-50"
                  >
                    <span className="flex items-center gap-2">
                      <FiTrash2 className="shrink-0 text-sm" strokeWidth={1.75} aria-hidden="true" />
                      Delete conversation
                    </span>
                  </button>
                ) : null}
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {searchOpen ? (
        <InConversationSearchBar
          value={searchQuery}
          error={searchError}
          resultCount={searchLoading ? 0 : searchResultCount}
          activeMatchIndex={searchActiveMatchIndex}
          onChange={setSearchQuery}
          onClose={closeSearch}
          onPreviousMatch={() => navigateSearchMatch(-1)}
          onNextMatch={() => navigateSearchMatch(1)}
        />
      ) : null}

      {!pinnedBannerDismissed && featuredPinnedMessage ? (
        <PinnedMessageBanner
          message={featuredPinnedMessage}
          pinnedCount={pinnedMessages.length}
          pinnedIndex={pinnedBannerIndex % pinnedMessages.length}
          onJump={handlePinnedBannerJump}
          onPrev={handlePinnedBannerPrev}
          onNext={handlePinnedBannerNext}
          onOpenAll={() => setPinnedPanelOpen(true)}
          onUnpin={() => onPinMessage(featuredPinnedMessage.id, true)}
        />
      ) : null}

      <MessageList
        messages={mainChatMessages}
        loading={loading}
        error={error}
        highlightTerm={searchOpen && searchQuery.trim() ? searchQuery : ''}
        highlightedMessageIds={highlightedMessageIds}
        scrollToMessageId={bannerScrollTargetId}
        scrollRequestKey={scrollRequestKey}
        scrollRestoreKey={scrollRestoreKey}
        hasMoreOlder={hasMoreOlder}
        loadingOlder={loadingOlder}
        onLoadOlder={onLoadOlder}
        unreadAnchorMessageId={unreadAnchorMessageId}
        onJumpToMessage={jumpToMessage}
        onScrollToMessageComplete={(messageId) => {
          setBannerScrollTargetId(null);
          if (messageId) {
            const timeoutId = window.setTimeout(() => {
              setHighlightedMessageIds((current) => current.filter((id) => id !== messageId));
              highlightTimeoutsRef.current = highlightTimeoutsRef.current.filter((id) => id !== timeoutId);
            }, 2200);
            highlightTimeoutsRef.current.push(timeoutId);
          }
        }}
        currentUserId={currentUserId}
        onAddReaction={onAddReaction}
        onRetryMessage={onRetryMessage}
        onReplyMessage={(messageId) => {
          const message = messages.find((m) => m.id === messageId);
          if (message) {
            setReplyingToMessage(message);
          }
        }}
        threadsEnabled={threadsEnabled}
        onReplyInThread={(messageId) => {
          if (!threadsEnabled) {
            return;
          }

          setThreadRootMessage(threadRootMessage?.id === messageId ? null : messages.find((m) => m.id === messageId) || null);
        }}
        onEditMessage={onEditMessage}
        onDeleteMessage={onDeleteMessage}
        onSummarizeUnread={onSummarizeUnread}
        sendProgressByMessageId={sendProgressByMessageId}
        onForwardMessage={setForwardMessageId}
        onPinMessage={onPinMessage}
        onSaveMessage={onSaveMessage}
        onUnsaveMessage={onUnsaveMessage}
        savedMessageIds={savedMessageIds}
        expandedThreadMessageId={threadRootMessage?.id}
        onSendThreadMessage={async (content, threadRootId) => {
          const { sendChatMessage } = await import('../chatApi');
          trackPendingThreadSend(content, threadRootId);
          const result = await sendChatMessage(conversation.id, content, undefined, threadRootId);
          if (!result.ok) {
            return { ok: false as const, error: result.error };
          }
          registerThreadReplyMessage(result.data.id, result.data.threadRootId ?? threadRootId);
          onThreadMessagesRegistered?.();
          return { ok: true as const, message: result.data };
        }}
        conversationId={conversation.id}
        conversationDetails={conversationDetails ?? hubDetails ?? null}
        conversationKind={conversation.kind}
        onVotePoll={onVotePoll}
        showReactionAuthors={conversation.kind === 'hub'}
        peerBlockedByCurrentUser={peerBlockedByCurrentUser}
      />

      {typingLabel ? (
        <div
          className="flex items-center gap-2 border-t border-app-border px-6 py-2 text-sm text-app-text"
          role="status"
        >
          <span className="flex items-end gap-0.5" aria-hidden="true">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent [animation-delay:-0.2s]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent [animation-delay:-0.1s]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent" />
          </span>
          <span>{typingLabel}</span>
        </div>
      ) : null}

      <MessageInput
        value={draft}
        disabled={
          (loading && messages.length === 0) || peerBlockedByCurrentUser || peerBlockedViewer
        }
        isSending={isSending}
        error={draftError}
        conversationId={conversation.id}
        currentUserId={currentUserId}
        replyingToMessage={replyingToMessage}
        onCancelReply={() => setReplyingToMessage(null)}
        onChange={onDraftChange}
        onSend={() => {
          onSend(replyingToMessage?.id);
          setReplyingToMessage(null);
        }}
        onPollCreated={() => {
          onConversationUpdated?.();
        }}
        onSendMedia={
          onSendMedia
            ? (item, kind) => {
                onSendMedia(item, kind, replyingToMessage?.id);
                setReplyingToMessage(null);
              }
            : undefined
        }
        onSendFile={
          onSendFile
            ? (file, caption) => {
                onSendFile(file, caption, replyingToMessage?.id);
                setReplyingToMessage(null);
              }
            : undefined
        }
        onSendVoice={
          onSendVoice
            ? (file, caption) => {
                onSendVoice(file, caption, replyingToMessage?.id);
                setReplyingToMessage(null);
              }
            : undefined
        }
        onScheduled={() => {
          onConversationUpdated?.();
        }}
        onUnauthorized={onUnauthorized}
        onOpenFlexAi={onOpenFlexAi}
      />

        <ForwardMessageModal
          open={Boolean(forwardMessageId)}
          conversations={conversations}
          currentConversationId={conversation.id}
          loading={forwardLoading}
          error={forwardError}
          onClose={() => {
            if (forwardLoading) {
              return;
            }

            setForwardMessageId(null);
            setForwardError('');
          }}
          onForward={(targetConversationIds) => {
            if (!forwardMessageId || forwardLoading) {
              return;
            }

            setForwardLoading(true);
            setForwardError('');

            void onForwardMessage(forwardMessageId, targetConversationIds).then((error) => {
              setForwardLoading(false);

              if (!error) {
                setForwardMessageId(null);
                setForwardError('');
                return;
              }

              setForwardError(error);
            });
          }}
        />
      </div>
      {pinnedPanelOpen ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-6">
          <div className="w-full max-w-md rounded-2xl border border-app-border bg-app-surface p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-app-text">Pinned messages</h3>
              <button
                type="button"
                className="text-sm text-app-muted hover:text-app-text"
                onClick={() => setPinnedPanelOpen(false)}
              >
                Close
              </button>
            </div>
            {pinnedMessages.length === 0 ? (
              <p className="text-sm text-app-muted">No pinned messages in this chat yet.</p>
            ) : (
              <div className="max-h-80 space-y-2 overflow-y-auto">
                {pinnedMessages.map((message) => (
                  <div
                    key={message.id}
                    className="flex w-full items-start gap-3 rounded-xl bg-app-chat-panel px-3 py-2.5 shadow-sm"
                  >
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-start gap-3 text-left transition-colors hover:opacity-80"
                      onClick={() => {
                        setPinnedPanelOpen(false);
                        setPinnedBannerDismissed(false);
                        jumpToMessage(message.id);
                      }}
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10">
                        <PinIcon size={14} className="text-accent" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-accent">
                          {message.senderName || 'Pinned message'}
                        </p>
                        <p className="mt-0.5 truncate text-sm text-app-text">
                          {formatMessagePreview(message) || 'Attachment'}
                        </p>
                      </div>
                    </button>
                    <button
                      type="button"
                      aria-label="Unpin message"
                      className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-app-muted transition-colors hover:bg-app-chat-hover hover:text-app-text"
                      onClick={() => {
                        onPinMessage(message.id, true);
                        if (pinnedMessages.length <= 1) {
                          setPinnedPanelOpen(false);
                        }
                      }}
                    >
                      Unpin
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
      {settingsOpen && isDirectContact && conversation.peerUserId ? (
        <ContactInfoPanel
          conversation={conversation}
          peerUserId={conversation.peerUserId}
          pinnedCount={pinnedMessages.length}
          pinnedMessages={pinnedMessages}
          onJumpToMessage={jumpToMessage}
          notificationsSnoozed={notificationsSnoozed}
          canCall={canCallDirect}
          callBusy={callBusy}
          onClose={() => setSettingsOpen(false)}
          onStartVoiceCall={onStartVoiceCall}
          onStartVideoCall={onStartVideoCall}
          onOpenSearch={() => setSearchOpen(true)}
          onOpenPinned={() => setPinnedPanelOpen(true)}
          onTogglePinChat={() => {
            void handleToggleFavorite();
          }}
          onMarkUnread={() => {
            void handleMarkUnread();
          }}
          onClearHistory={() => {
            void handleClearHistory();
          }}
          onScheduleEvent={handleScheduleEvent}
          onSnooze={(duration) => {
            void handleSnooze(duration);
          }}
          snoozeOptions={CONVERSATION_SNOOZE_OPTIONS}
          onBlockedUsersChanged={onBlockedUsersChanged}
          peerIsBlocked={
            conversation.peerUserId ? blockedUserIds?.has(conversation.peerUserId) === true : false
          }
          peerBlockedViewer={peerBlockedViewer}
        />
      ) : null}
      {settingsOpen && isHubPanel ? (
        <GroupSidebar
          conversation={conversation}
          hubDetails={hubDetails}
          currentUserId={currentUserId}
          blockedUserIds={blockedUserIds}
          blockedByPeerIds={blockedByPeerIds}
          onClose={() => setSettingsOpen(false)}
          onConversationUpdated={() => {
            onConversationUpdated?.();
          }}
          onNotificationsSnoozedChange={onNotificationsSnoozedChange}
          onHubDeleted={() => {
            onHubDeleted?.();
          }}
        />
      ) : null}
      {settingsOpen && isGroupPanel ? (
        <GroupMembersPanel
          conversation={conversation}
          conversationDetails={conversationDetails}
          currentUserId={currentUserId}
          onClose={() => setSettingsOpen(false)}
          onConversationUpdated={() => {
            onConversationUpdated?.();
          }}
        />
      ) : null}
      {threadsEnabled && threadRootMessage ? (
        <ThreadSidebar
          conversationId={conversation.id}
          rootMessage={threadRootMessage}
          currentUserId={currentUserId}
          onClose={() => setThreadRootMessage(null)}
          onSendThreadMessage={async (content, threadRootId, replyToId) => {
            const { sendChatMessage } = await import('../chatApi');
            trackPendingThreadSend(content, threadRootId);
            const result = await sendChatMessage(conversation.id, content, replyToId, threadRootId);
            if (!result.ok) {
              return { ok: false as const, error: result.error };
            }
            registerThreadReplyMessage(result.data.id, result.data.threadRootId ?? threadRootId);
            onThreadMessagesRegistered?.();
            return { ok: true as const, message: result.data };
          }}
          onSendMedia={onSendMedia}
          onSendFile={onSendFile}
          onSendVoice={onSendVoice}
          onUnauthorized={onUnauthorized}
          onOpenFlexAi={onOpenFlexAi}
          onThreadReplySent={onThreadReplySent}
          onThreadMessagesRegistered={onThreadMessagesRegistered}
        />
      ) : null}
    </div>
  );
}
