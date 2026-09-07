import { useEffect, useMemo, useState, useRef } from 'react';
import { FiBell, FiCalendar, FiMapPin, FiMoreVertical, FiUsers } from 'react-icons/fi';
import type { ConversationItem, PresenceStatus } from '../../shared/chat';
import type { GifPickerItem } from '../../shared/gifs';
import type { MessageItem } from '../../shared/messages';
import { formatMessagePreview } from '../../shared/messages';
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
import { GroupSidebar } from './GroupSidebar';
import { GroupMembersPanel } from './GroupMembersPanel';

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
  onSendMedia?: (item: GifPickerItem, kind: 'gif' | 'sticker', replyToId?: string) => void;
  onSendFile?: (file: File, replyToId?: string) => void;
  onUnauthorized: (status?: number) => boolean;
  currentUserId: string | null;
  onAddReaction: (messageId: string, emoji: string) => void;
  onEditMessage: (messageId: string, content: string) => void;
  onDeleteMessage: (messageId: string, scope: 'me' | 'everyone') => void;
  onForwardMessage: (messageId: string, targetConversationId: string) => Promise<string | null>;
  onPinMessage: (messageId: string, isPinned: boolean) => void;
  onSaveMessage: (messageId: string) => void;
  onUnsaveMessage: (messageId: string) => void;
  onVotePoll?: (messageId: string, optionId: string) => void;
  onConversationUpdated?: () => void;
  onTogglePin?: (conversationId: string, isPinned: boolean) => void;
  onHubDeleted?: () => void;
  pinnedMessageIds?: string[];
  onOpenCalendar?: () => void;
  focusMessageId?: string | null;
  unreadAnchorMessageId?: string | null;
  onFocusMessageHandled?: () => void;
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
  onVotePoll,
  onConversationUpdated,
  onTogglePin,
  onHubDeleted,
  pinnedMessageIds = [],
  onOpenCalendar,
  focusMessageId = null,
  unreadAnchorMessageId = null,
  onFocusMessageHandled,
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
  const [menuBusy, setMenuBusy] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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

    const presence = presenceLabel(conversation.status);

    if (conversation.kind === 'direct') {
      return presence ?? 'Available';
    }

    return presence ?? (conversation.subtitle || 'Available');
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
    setPinnedPanelOpen(false);
    setPinnedBannerDismissed(false);
    setPinnedBannerIndex(0);
    setBannerScrollTargetId(null);
    setLoadedPinnedMessages([]);
  }, [conversation.id]);

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

  const featuredPinnedMessage =
    pinnedMessages[pinnedBannerIndex % Math.max(pinnedMessages.length, 1)] ?? null;

  useEffect(() => {
    setPinnedBannerDismissed(false);
    setPinnedBannerIndex(0);
  }, [pinnedMessages.map((message) => message.id).join('|')]);

  const notificationSettings =
    conversationDetails && typeof conversationDetails === 'object' && conversationDetails.notificationSettings
      ? (conversationDetails.notificationSettings as Record<string, unknown>)
      : null;
  const notificationsSnoozed = notificationSettings?.snoozed === true;

  const handlePinnedBannerJump = () => {
    if (pinnedMessages.length === 0) {
      return;
    }

    const target = pinnedMessages[pinnedBannerIndex % pinnedMessages.length];

    if (!target) {
      return;
    }

    setBannerScrollTargetId(target.id);
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

  const handleToggleNotifications = async () => {
    setMenuBusy(true);
    const result = await updateConversationNotificationSettings(conversation.id, {
      snoozed: !notificationsSnoozed,
    });
    setMenuBusy(false);
    setMenuOpen(false);

    if (!result.ok) {
      if (onUnauthorized(result.status)) return;
      toast.error(result.error);
      return;
    }

    toast.success(
      notificationsSnoozed ? 'Notifications enabled for this chat.' : 'Notifications snoozed for this chat.',
    );
    onConversationUpdated?.();
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

  return (
    <div className="flex h-full w-full flex-row overflow-hidden">
      <div className="flex h-full flex-1 min-h-0 min-w-0 flex-col bg-app-chat-bg relative">
        <header className="flex items-center justify-between border-b border-app-border px-6 py-4">
        <div 
          className="min-w-0 cursor-pointer hover:opacity-80 transition-opacity"
          onClick={() => {
            if (conversation.kind === 'hub' || hubDetails) {
              setSettingsOpen(true);
            }
          }}
        >
          <h2 className="truncate text-lg font-semibold text-app-text">{title}</h2>
          <p className="truncate text-sm text-app-muted">{subtitle}</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            aria-label="Search in conversation"
            aria-pressed={searchOpen}
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors ${
              searchOpen
                ? 'bg-accent/15 text-accent-soft'
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
            <SearchIcon className="h-[18px] w-[18px]" />
          </button>
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              aria-label="Conversation options"
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors ${
                menuOpen
                  ? 'bg-app-chat-hover text-app-text'
                  : 'text-app-muted hover:bg-app-chat-hover hover:text-app-text'
              }`}
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <FiMoreVertical className="text-lg" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-xl border border-app-border bg-app-elevated py-2 shadow-lg">
                <button
                  type="button"
                  disabled={menuBusy}
                  onClick={() => {
                    void handleToggleFavorite();
                  }}
                  className="flex w-full items-center justify-between px-4 py-2 text-left text-sm text-app-text hover:bg-app-chat-hover disabled:opacity-50"
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
                  className="flex w-full items-center justify-between px-4 py-2 text-left text-sm text-app-text hover:bg-app-chat-hover disabled:opacity-50"
                >
                  <span className="flex items-center gap-2">
                    <FiMapPin />
                    Pinned messages
                  </span>
                  <span className="text-app-muted">{pinnedMessages.length > 0 ? pinnedMessages.length : '›'}</span>
                </button>
                <button
                  type="button"
                  disabled={menuBusy}
                  onClick={() => {
                    void handleToggleNotifications();
                  }}
                  className="flex w-full items-center justify-between px-4 py-2 text-left text-sm text-app-text hover:bg-app-chat-hover disabled:opacity-50"
                >
                  <span className="flex items-center gap-2">
                    <FiBell />
                    {notificationsSnoozed ? 'Enable notifications' : 'Snooze notifications'}
                  </span>
                </button>
                <button
                  type="button"
                  disabled={menuBusy}
                  onClick={() => {
                    void handleMarkUnread();
                  }}
                  className="flex w-full items-center justify-between px-4 py-2 text-left text-sm text-app-text hover:bg-app-chat-hover disabled:opacity-50"
                >
                  Mark as unread
                </button>
                <button
                  type="button"
                  disabled={menuBusy}
                  onClick={() => {
                    void handleClearHistory();
                  }}
                  className="flex w-full items-center justify-between px-4 py-2 text-left text-sm text-app-text hover:bg-app-chat-hover disabled:opacity-50"
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
                    className="flex w-full items-center justify-between px-4 py-2 text-left text-sm text-accent-soft hover:bg-app-chat-hover disabled:opacity-50"
                  >
                    Delete conversation
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={menuBusy}
                  onClick={handleScheduleEvent}
                  className="flex w-full items-center justify-between px-4 py-2 text-left text-sm text-app-text hover:bg-app-chat-hover disabled:opacity-50"
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
                    if (conversation.kind === 'hub' || hubDetails) {
                      setSettingsOpen(true);
                    }
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
          onJump={handlePinnedBannerJump}
          onUnpin={() => onPinMessage(featuredPinnedMessage.id, true)}
        />
      ) : null}

      <MessageList
        messages={messages}
        loading={loading}
        error={error}
        highlightTerm={searchOpen && searchQuery.trim() ? searchQuery : ''}
        highlightedMessageIds={
          focusMessageId
            ? [...new Set([...highlightedMessageIds, focusMessageId])]
            : highlightedMessageIds
        }
        scrollToMessageId={focusMessageId ?? bannerScrollTargetId}
        unreadAnchorMessageId={focusMessageId ? null : unreadAnchorMessageId}
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
        onReplyInThread={(messageId) => {
          setThreadRootMessage(threadRootMessage?.id === messageId ? null : messages.find((m) => m.id === messageId) || null);
        }}
        onEditMessage={onEditMessage}
        onDeleteMessage={onDeleteMessage}
        onForwardMessage={setForwardMessageId}
        onPinMessage={onPinMessage}
        onSaveMessage={onSaveMessage}
        onUnsaveMessage={onUnsaveMessage}
        expandedThreadMessageId={threadRootMessage?.id}
        onSendThreadMessage={async (content, threadRootId) => {
          const { sendChatMessage } = await import('../chatApi');
          const result = await sendChatMessage(conversation.id, content, undefined, threadRootId);
          if (!result.ok) {
            return result.error;
          }
          return null;
        }}
        conversationId={conversation.id}
        onVotePoll={onVotePoll}
      />

      {typingLabel ? (
        <p className="border-t border-app-border px-6 py-2 text-xs italic text-app-muted" role="status">
          {typingLabel}
        </p>
      ) : null}

      <MessageInput
        value={draft}
        disabled={loading && messages.length === 0}
        isSending={isSending}
        error={draftError}
        conversationId={conversation.id}
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
            ? (file) => {
                onSendFile(file, replyingToMessage?.id);
                setReplyingToMessage(null);
              }
            : undefined
        }
        onUnauthorized={onUnauthorized}
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
                        setBannerScrollTargetId(message.id);
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
      {settingsOpen && (conversation.kind === 'hub' || hubDetails) ? (
        <GroupSidebar
          conversation={conversation}
          hubDetails={hubDetails}
          currentUserId={currentUserId}
          onClose={() => setSettingsOpen(false)}
          onConversationUpdated={() => {
            onConversationUpdated?.();
          }}
          onHubDeleted={() => {
            onHubDeleted?.();
          }}
        />
      ) : null}
      {settingsOpen && conversation.kind !== 'hub' && !hubDetails ? (
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
    </div>
  );
}
