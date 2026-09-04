import { useEffect, useState } from 'react';
import type { ConversationItem } from '../../shared/chat';
import type { MessageItem } from '../../shared/messages';
import { validateSearchInput } from '../../shared/search';
import { loadMessageSearch } from '../chatApi';
import { SearchIcon } from './ChatIcons';
import { ForwardMessageModal } from './ForwardMessageModal';
import { InConversationSearchBar } from './InConversationSearchBar';
import { MessageInput } from './MessageInput';
import { MessageList } from './MessageList';
import { GroupSettingsModal } from './GroupSettingsModal';
import { ThreadSidebar } from './ThreadSidebar';

type ConversationThreadProps = {
  conversation: ConversationItem;
  conversations: ConversationItem[];
  messages: MessageItem[];
  draft: string;
  loading: boolean;
  error: string;
  draftError: string;
  typingLabel: string;
  actionMessage: string;
  isSending: boolean;
  onDraftChange: (value: string) => void;
  onSend: (replyToId?: string) => void;
  onUnauthorized: (status?: number) => boolean;
  currentUserId: string | null;
  onAddReaction: (messageId: string, emoji: string) => void;
  onReplyMessage: (messageId: string) => void;
  onReplyInThread: (messageId: string) => void;
  onEditMessage: (messageId: string, content: string) => void;
  onDeleteMessage: (messageId: string, scope: 'me' | 'everyone') => void;
  onForwardMessage: (messageId: string, targetConversationId: string) => Promise<string | null>;
  onPinMessage: (messageId: string, isPinned: boolean) => void;
  onSaveMessage: (messageId: string) => void;
  onUnsaveMessage: (messageId: string) => void;
};

export function ConversationThread({
  conversation,
  conversations,
  messages,
  draft,
  loading,
  error,
  draftError,
  typingLabel,
  actionMessage,
  isSending,
  onDraftChange,
  onSend,
  onUnauthorized,
  currentUserId,
  onAddReaction,
  onReplyMessage,
  onReplyInThread,
  onEditMessage,
  onDeleteMessage,
  onForwardMessage,
  onPinMessage,
  onSaveMessage,
  onUnsaveMessage,
}: ConversationThreadProps) {
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

  const title = conversation.isSelf ? `${conversation.title} (Yourself)` : conversation.title;
  const subtitle = conversation.isSelf ? 'Message yourself' : conversation.subtitle || 'Available';

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
  }, [conversation.id]);

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
    <div className="flex h-full flex-col bg-app-chat-bg">
      <header className="flex items-center justify-between border-b border-app-border px-6 py-4">
        <div className="min-w-0">
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
          {conversation.kind === 'hub' && (
            <button
              type="button"
              aria-label="Group settings"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-app-muted transition-colors hover:bg-app-chat-hover hover:text-app-text"
              onClick={() => setSettingsOpen(true)}
            >
              ℹ️
            </button>
          )}
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

      <MessageList
        messages={messages}
        loading={loading}
        error={error}
        highlightTerm={searchOpen && searchQuery.trim() ? searchQuery : ''}
        highlightedMessageIds={highlightedMessageIds}
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
      />

      {actionMessage ? (
        <p className="border-t border-app-border px-6 py-2 text-center text-xs text-app-muted" role="status">
          {actionMessage}
        </p>
      ) : null}

      {typingLabel ? (
        <p className="border-t border-app-border px-6 py-2 text-xs italic text-app-muted" role="status">
          {typingLabel}
        </p>
      ) : null}

      <MessageInput
        value={draft}
        disabled={loading}
        isSending={isSending}
        error={draftError}
        replyingToMessage={replyingToMessage}
        onCancelReply={() => setReplyingToMessage(null)}
        onChange={onDraftChange}
        onSend={() => {
          onSend(replyingToMessage?.id);
          setReplyingToMessage(null);
        }}
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
      <GroupSettingsModal
        open={settingsOpen}
        conversation={conversation}
        currentUserId={currentUserId}
        onClose={() => setSettingsOpen(false)}
        onConversationUpdated={() => {
          setSettingsOpen(false);
          // Just reloading the window for now to force a full conversation list refresh.
          // The proper way is to emit an event back to ChatPage to fetchConversations.
          window.location.reload();
        }}
      />
    </div>
  );
}
