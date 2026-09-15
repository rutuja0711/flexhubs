import { useEffect, useMemo, useState, useRef } from 'react';
import { FiBell, FiCalendar, FiMapPin, FiMoreVertical, FiPhone, FiUsers, FiVideo } from 'react-icons/fi';
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
  onSendMedia?: (item: GifPickerItem, kind: 'gif' | 'sticker', replyToId?: string, threadRootId?: string) => void;
  onSendFile?: (file: File, caption?: string, replyToId?: string, threadRootId?: string) => void;
  onUnauthorized: (status?: number) => boolean;
  currentUserId: string | null;
  onAddReaction: (messageId: string, emoji: string) => void;
  onEditMessage: (messageId: string, content: string) => void;
  onDeleteMessage: (messageId: string, scope: 'me' | 'everyone') => void;
  onForwardMessage: (messageId: string, targetConversationId: string) => Promise<string | null>;
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
  onFocusMessageHandled?: () => void;
  onStartVoiceCall?: () => void;
  onStartVideoCall?: () => void;
  callBusy?: boolean;
  onOpenFlexAi?: () => void;
  onThreadReplySent?: (threadRootId: string) => void;
  onThreadMessagesRegistered?: () => void;
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
  onSendMedia,
  onSendFile,
  onUnauthorized,
  currentUserId,
  onAddReaction,
  onEditMessage,
  onDeleteMessage,
  onForwardMessage,
  onPinMessage,
  onSaveMessage,
  onUnsaveMessage,
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
  onFocusMessageHandled,
  onStartVoiceCall,
  onStartVideoCall,
  callBusy = false,
  onOpenFlexAi,
  onThreadReplySent,
  onThreadMessagesRegistered,
}: ConversationThreadProps) {
  const toast = useToast();
  const confirm = useConfirm();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchError, setSearchError] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResultCount, setSearchResultCount] = useState(0);
  const [highlightedMessageIds, setHighlightedMessageIds] = useState<string[]>([]);
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

  const mainChatMessages = useMemo(() => filterMainChatMessages(messages), [messages]);
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

  const jumpToMessage = (messageId: string) => {
    setBannerScrollTargetId(messageId);
    setScrollRequestKey((current) => current + 1);
    setHighlightedMessageIds((current) => [...new Set([...current, messageId])]);

    const timeoutId = window.setTimeout(() => {
      setHighlightedMessageIds((current) => current.filter((id) => id !== messageId));
      highlightTimeoutsRef.current = highlightTimeoutsRef.current.filter((id) => id !== timeoutId);
    }, 2200);

    highlightTimeoutsRef.current.push(timeoutId);
  };

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
      setSearchResultCount(0);
      return;
    }

    if (!validation.value) {
      setSearchError('');
      setHighlightedMessageIds([]);
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
          setSearchResultCount(0);
          return;
        }

        setSearchResultCount(response.data.count);
        setHighlightedMessageIds(response.data.hits.map((hit) => hit.messageId));
      });
    }, 300);

    return () => window.clearTimeout(timer);
  }, [conversation.id, onUnauthorized, searchOpen, searchQuery]);

  const closeSearch = () => {
    setSearchOpen(false);
    setSearchQuery('');
    setSearchError('');
    setHighlightedMessageIds([]);
    setSearchResultCount(0);
  };

  const canCallDirect =
    conversation.kind === 'direct' && !conversation.isSelf && Boolean(conversation.peerUserId);
  const canCallHub = conversation.kind === 'hub';
  const isDirectContact =
    conversation.kind === 'direct' && !conversation.isSelf && Boolean(conversation.peerUserId);
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
        <header className="flex items-center justify-between border-b border-app-border/40 bg-app-chat-bg/90 backdrop-blur-md px-6 py-3 z-20">
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
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border transition-all duration-200 active:scale-95 ${
              searchOpen
                ? 'border-accent/40 bg-accent/20 text-accent-soft ring-1 ring-accent/30'
                : 'border-transparent text-app-muted hover:bg-app-chat-hover hover:text-app-text'
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
                disabled={callBusy}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-transparent text-app-muted transition-all duration-200 hover:bg-app-chat-hover hover:text-app-text active:scale-95 disabled:opacity-40"
                onClick={() => onStartVoiceCall?.()}
              >
                <FiPhone className="text-base" />
              </button>
              <button
                type="button"
                aria-label={canCallHub ? 'Start video meeting' : 'Start video call'}
                disabled={callBusy}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-transparent text-app-muted transition-all duration-200 hover:bg-app-chat-hover hover:text-app-text active:scale-95 disabled:opacity-40"
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
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border transition-all duration-200 active:scale-95 ${
                menuOpen
                  ? 'border-accent/40 bg-accent/15 text-accent dark:text-accent-soft'
                  : 'border-transparent text-app-muted hover:bg-black/[0.05] dark:hover:bg-white/[0.08] hover:text-app-text'
              }`}
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <FiMoreVertical className="text-base" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full z-50 mt-2 w-60 rounded-2xl border border-app-border/80 bg-app-surface/98 dark:bg-app-elevated/95 backdrop-blur-xl p-1.5 shadow-2xl animate-pop-in origin-top-right">
                <button
                  type="button"
                  disabled={menuBusy}
                  onClick={() => {
                    void handleToggleFavorite();
                  }}
                  className="flex w-full items-center justify-between rounded-xl px-3.5 py-2 text-left text-xs font-medium text-app-text hover:bg-black/[0.05] dark:hover:bg-white/[0.08] hover:text-accent dark:hover:text-accent-soft transition-colors disabled:opacity-50"
                >
                  <span className="flex items-center gap-2">
                    <FiMapPin />
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
                    <FiMapPin />
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
                      <FiBell />
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
                        <FiBell />
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
                            className="flex w-full rounded-lg px-7 py-1.5 text-left text-xs text-app-muted hover:bg-black/[0.05] dark:hover:bg-white/[0.08] hover:text-app-text transition-colors disabled:opacity-50"
                          >
                            {option.label}
                          </button>
                        ))
                      : null}
                  </>
                )}
                <button
                  type="button"
                  disabled={menuBusy}
                  onClick={() => {
                    void handleMarkUnread();
                  }}
                  className="flex w-full items-center justify-between rounded-xl px-3.5 py-2 text-left text-xs font-medium text-app-text hover:bg-black/[0.05] dark:hover:bg-white/[0.08] hover:text-accent dark:hover:text-accent-soft transition-colors disabled:opacity-50"
                >
                  Mark as unread
                </button>
                <button
                  type="button"
                  disabled={menuBusy}
                  onClick={() => {
                    void handleClearHistory();
                  }}
                  className="flex w-full items-center justify-between rounded-xl px-3.5 py-2 text-left text-xs font-medium text-app-text hover:bg-black/[0.05] dark:hover:bg-white/[0.08] hover:text-accent dark:hover:text-accent-soft transition-colors disabled:opacity-50"
                >
                  Clear history
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
                    Delete conversation
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={menuBusy}
                  onClick={handleScheduleEvent}
                  className="flex w-full items-center justify-between rounded-xl px-3.5 py-2 text-left text-xs font-medium text-app-text hover:bg-black/[0.05] dark:hover:bg-white/[0.08] hover:text-accent dark:hover:text-accent-soft transition-colors disabled:opacity-50"
                >
                  <span className="flex items-center gap-2">
                    <FiCalendar />
                    Schedule event
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    openInfoPanel();
                  }}
                  className="flex w-full items-center justify-between px-4 py-2 text-left text-sm text-app-text hover:bg-app-chat-hover"
                >
                  <span className="flex items-center gap-2">
                    <FiUsers />
                    Members
                  </span>
                  <span className="text-app-muted">›</span>
                </button>
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
          onChange={setSearchQuery}
          onClose={closeSearch}
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
        highlightedMessageIds={
          focusMessageId
            ? [...new Set([...highlightedMessageIds, focusMessageId])]
            : highlightedMessageIds
        }
        scrollToMessageId={focusMessageId ?? bannerScrollTargetId}
        scrollRequestKey={scrollRequestKey}
        scrollRestoreKey={scrollRestoreKey}
        unreadAnchorMessageId={focusMessageId ? null : unreadAnchorMessageId}
        onJumpToMessage={jumpToMessage}
        onScrollToMessageComplete={() => {
          setBannerScrollTargetId(null);
          onFocusMessageHandled?.();
        }}
        currentUserId={currentUserId}
        onAddReaction={onAddReaction}
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
      />

      {typingLabel ? (
        <div
          className="flex items-center gap-2 border-t border-app-border/60 px-6 py-2 text-sm text-app-text"
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
        disabled={loading && messages.length === 0}
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
          onForward={(targetConversationId) => {
            if (!forwardMessageId || forwardLoading) {
              return;
            }

            setForwardLoading(true);
            setForwardError('');

            void onForwardMessage(forwardMessageId, targetConversationId).then((error) => {
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
          <div className="w-full max-w-md rounded-2xl border border-app-border bg-app-surface p-5 shadow-xl">
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
                    className="flex w-full items-start gap-3 rounded-xl border border-app-border bg-app-chat-panel px-3 py-2.5"
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
        />
      ) : null}
      {settingsOpen && isHubPanel ? (
        <GroupSidebar
          conversation={conversation}
          hubDetails={hubDetails}
          currentUserId={currentUserId}
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
          onSendMedia={onSendMedia}
          onSendFile={onSendFile}
          onUnauthorized={onUnauthorized}
          onOpenFlexAi={onOpenFlexAi}
          onThreadReplySent={onThreadReplySent}
          onThreadMessagesRegistered={onThreadMessagesRegistered}
        />
      ) : null}
    </div>
  );
}
