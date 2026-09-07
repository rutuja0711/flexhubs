import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FiThumbsUp } from 'react-icons/fi';
import type { MessageItem } from '../../shared/messages';
import { groupMessageReactions, isMediaOnlyMessage, isPollMessage, resolveReplyTarget } from '../../shared/messages';
import { formatConversationTimestamp, formatMessageDayDivider, messageDayKey } from './format';
import { Avatar } from './ChatIcons';
import { MessageMenu } from './MessageMenu';
import { InlineThread } from './InlineThread';
import { MessageContent, MessageReplyPreview } from './MessageContent';

function DateDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-1" role="separator" aria-label={label}>
      <div className="h-px flex-1 bg-app-border" />
      <span className="shrink-0 rounded-full border border-app-border bg-app-surface px-3 py-1 text-xs font-medium text-app-muted">
        {label}
      </span>
      <div className="h-px flex-1 bg-app-border" />
    </div>
  );
}

function UnreadDivider() {
  return (
    <div className="flex items-center gap-3 py-1" role="separator" aria-label="New messages">
      <div className="h-px flex-1 bg-accent/50" />
      <span className="shrink-0 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-accent-soft">
        New messages
      </span>
      <div className="h-px flex-1 bg-accent/50" />
    </div>
  );
}

type MessageListEntry =
  | { kind: 'date'; key: string; label: string }
  | { kind: 'unread'; key: 'unread-divider' }
  | { kind: 'message'; key: string; message: MessageItem };

function buildMessageListEntries(
  messages: MessageItem[],
  unreadAnchorMessageId: string | null,
): MessageListEntry[] {
  const entries: MessageListEntry[] = [];
  let lastDayKey = '';
  let unreadDividerShown = false;

  for (const message of messages) {
    const dayKey = messageDayKey(message.createdAt);

    if (dayKey && dayKey !== lastDayKey) {
      entries.push({
        kind: 'date',
        key: `date-${dayKey}`,
        label: formatMessageDayDivider(message.createdAt),
      });
      lastDayKey = dayKey;
    }

    if (!unreadDividerShown && unreadAnchorMessageId && message.id === unreadAnchorMessageId) {
      entries.push({ kind: 'unread', key: 'unread-divider' });
      unreadDividerShown = true;
    }

    entries.push({ kind: 'message', key: message.id, message });
  }

  return entries;
}

function MessageListSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden px-6 py-4" aria-hidden="true">
      {[false, true, false, true, false, true].map((isOwn, index) => (
        <div
          key={index}
          className={`flex gap-3 ${isOwn ? 'flex-row-reverse' : 'flex-row'} animate-pulse`}
        >
          {!isOwn ? <div className="h-8 w-8 shrink-0 rounded-full bg-app-chat-hover" /> : null}
          <div className={`flex max-w-[70%] flex-col gap-2 ${isOwn ? 'items-end' : 'items-start'}`}>
            {!isOwn ? <div className="h-3 w-20 rounded bg-app-chat-hover" /> : null}
            <div
              className={`rounded-2xl bg-app-chat-hover ${
                isOwn ? 'h-10 w-40' : index % 2 === 0 ? 'h-14 w-56' : 'h-10 w-44'
              }`}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

type MessageRowProps = {
  message: MessageItem;
  messages: MessageItem[];
  isHighlighted: boolean;
  currentUserId: string | null;
  highlightTerm: string;
  conversationId?: string;
  expandedThreadMessageId?: string | null;
  editingId: string | null;
  editDraft: string;
  onEditDraftChange: (value: string) => void;
  onStartEdit: (message: MessageItem) => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onAddReaction: (messageId: string, emoji: string) => void;
  onReplyMessage: (messageId: string) => void;
  onReplyInThread: (messageId: string) => void;
  onEditMessage: (messageId: string, content: string) => void;
  onDeleteMessage: (messageId: string, scope: 'me' | 'everyone') => void;
  onForwardMessage: (messageId: string) => void;
  onPinMessage: (messageId: string, isPinned: boolean) => void;
  onSaveMessage: (messageId: string) => void;
  onUnsaveMessage: (messageId: string) => void;
  onSendThreadMessage?: (content: string, threadRootId: string) => Promise<string | null>;
  onVotePoll?: (messageId: string, optionId: string) => void;
};

function MessageTimeInline({
  message,
  className = '',
}: {
  message: MessageItem;
  className?: string;
}) {
  if (!message.createdAt && !message.editedAt) {
    return null;
  }

  return (
    <span
      className={`inline-block whitespace-nowrap text-[0.6875rem] leading-none ${
        message.isOwn
          ? 'text-app-message-out-text/75'
          : 'text-app-muted'
      } ${className}`}
    >
      {message.editedAt ? <span className="mr-1 lowercase">edited</span> : null}
      {message.createdAt ? formatConversationTimestamp(message.createdAt) : null}
    </span>
  );
}

const MessageRow = memo(function MessageRow({
  message,
  messages,
  isHighlighted,
  currentUserId,
  highlightTerm,
  conversationId,
  expandedThreadMessageId,
  editingId,
  editDraft,
  onEditDraftChange,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onAddReaction,
  onReplyMessage,
  onReplyInThread,
  onDeleteMessage,
  onForwardMessage,
  onPinMessage,
  onSaveMessage,
  onUnsaveMessage,
  onSendThreadMessage,
  onVotePoll,
}: MessageRowProps) {
  const reactionGroups = groupMessageReactions(message.reactions, currentUserId);
  const isPinned = Boolean(message.pinnedAt);
  const isEditing = editingId === message.id;
  const isPoll = isPollMessage(message);
  const isMediaOnly = !isPoll && isMediaOnlyMessage(message);
  const hasMedia = (message.media?.length ?? 0) > 0;
  const isTextOnly = !isPoll && !isMediaOnly && !hasMedia;

  const bubbleClassName = `inline-block w-fit max-w-full rounded-2xl px-2.5 py-1.5 text-sm leading-snug ${
    message.isOwn
      ? 'self-end bg-app-message-out text-app-message-out-text'
      : 'self-start bg-app-message-in text-app-text'
  }`;

  return (
    <div
      data-message-id={message.id}
      className={`message-row group flex gap-3 ${message.isOwn ? 'flex-row-reverse' : 'flex-row'} ${
        isHighlighted ? 'rounded-xl bg-accent/10 p-2' : ''
      }`}
    >
      {!message.isOwn ? (
        <Avatar imageUrl={null} initials={message.senderInitials} size="sm" />
      ) : null}
      <div className={`flex max-w-[70%] flex-col ${message.isOwn ? 'items-end' : 'items-start'}`}>
        {!message.isOwn ? (
          <p className="mb-1 text-xs font-medium text-app-muted">{message.senderName}</p>
        ) : null}
        {message.replyToMessage || message.replyToMessageId ? (
          <div
            className={`mb-1 flex max-w-full cursor-pointer flex-col rounded-[8px] border-l-2 bg-app-surface px-3 py-1.5 text-xs text-app-muted hover:bg-app-chat-hover ${
              message.isOwn ? 'mr-1 border-l-accent' : 'ml-1 border-l-app-border'
            }`}
          >
            {(() => {
              const replyTarget = resolveReplyTarget(message, messages);

              if (!replyTarget) {
                return null;
              }

              return (
                <>
                  <span className="mb-0.5 font-medium text-app-text">
                    {replyTarget.senderName || replyTarget.senderId}
                  </span>
                  <MessageReplyPreview message={replyTarget} />
                </>
              );
            })()}
          </div>
        ) : null}
        {isEditing ? (
          <div className="space-y-2">
            <textarea
              value={editDraft}
              onChange={(event) => onEditDraftChange(event.target.value)}
              rows={3}
              className="w-full rounded-xl border border-app-border bg-app-surface px-3 py-2 text-sm text-app-text outline-none focus:border-accent"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg px-3 py-1.5 text-xs text-app-muted hover:bg-app-chat-hover"
                onClick={onCancelEdit}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white"
                onClick={onSaveEdit}
              >
                Save
              </button>
            </div>
          </div>
        ) : (
          <div
            className={`flex items-end gap-1 ${message.isOwn ? 'flex-row-reverse' : 'flex-row'}`}
          >
            <div className={`min-w-0 max-w-full ${message.isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
              {isMediaOnly ? (
                <div
                  className={`inline-block w-fit max-w-full ${message.isOwn ? 'self-end' : 'self-start'}`}
                >
                  <MessageContent
                    message={message}
                    highlightTerm={highlightTerm}
                    onVotePoll={
                      onVotePoll ? (optionId) => onVotePoll(message.id, optionId) : undefined
                    }
                  />
                  <div className="mt-0.5 flex justify-end">
                    <MessageTimeInline message={message} className="!text-app-muted" />
                  </div>
                </div>
              ) : (
                <div className={bubbleClassName}>
                  {isTextOnly ? (
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-x-1.5">
                      <span className="min-w-0 whitespace-pre-wrap break-words text-left">
                        <MessageContent
                          message={message}
                          highlightTerm={highlightTerm}
                          compact
                          onVotePoll={
                            onVotePoll ? (optionId) => onVotePoll(message.id, optionId) : undefined
                          }
                        />
                      </span>
                      <MessageTimeInline message={message} className="pb-[1px]" />
                    </div>
                  ) : (
                    <>
                      <MessageContent
                        message={message}
                        highlightTerm={highlightTerm}
                        onVotePoll={
                          onVotePoll ? (optionId) => onVotePoll(message.id, optionId) : undefined
                        }
                      />
                      <div className="mt-1.5 flex justify-end">
                        <MessageTimeInline message={message} />
                      </div>
                    </>
                  )}
                </div>
              )}

              {reactionGroups.length > 0 ? (
                <div
                  className={`mt-1 flex flex-wrap gap-1 ${message.isOwn ? 'justify-end' : 'justify-start'}`}
                >
                  {reactionGroups.map((group) => (
                    <button
                      key={`${message.id}-${group.emoji}`}
                      type="button"
                      aria-label={`React with ${group.emoji}`}
                      className={`rounded-full border px-2 py-0.5 text-xs transition-colors ${
                        group.reactedByMe
                          ? 'border-accent bg-accent/15 text-app-text'
                          : 'border-app-border bg-app-surface text-app-muted hover:border-app-border-strong'
                      }`}
                      onClick={() => onAddReaction(message.id, group.emoji)}
                    >
                      {group.emoji} {group.count}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div
              className={`mb-1 flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 ${
                message.isOwn ? 'flex-row-reverse' : 'flex-row'
              }`}
            >
              <button
                type="button"
                aria-label="Add thumbs up reaction"
                className="flex h-6 w-6 items-center justify-center rounded text-app-muted transition-colors hover:bg-app-chat-hover hover:text-app-text"
                onClick={() => onAddReaction(message.id, '👍')}
              >
                <FiThumbsUp className="text-sm" />
              </button>
              <MessageMenu
                isOwn={message.isOwn}
                isPinned={isPinned}
                align={message.isOwn ? 'right' : 'left'}
                onReply={() => onReplyMessage(message.id)}
                onReplyInThread={() => onReplyInThread(message.id)}
                onEdit={() => onStartEdit(message)}
                onDeleteForMe={() => onDeleteMessage(message.id, 'me')}
                onDeleteForEveryone={() => onDeleteMessage(message.id, 'everyone')}
                onForward={() => onForwardMessage(message.id)}
                onPinToggle={() => onPinMessage(message.id, isPinned)}
                onSave={() => onSaveMessage(message.id)}
                onUnsave={() => onUnsaveMessage(message.id)}
              />
            </div>
          </div>
        )}

        {expandedThreadMessageId === message.id && conversationId && onSendThreadMessage ? (
          <InlineThread
            conversationId={conversationId}
            rootMessageId={message.id}
            onSendThreadMessage={onSendThreadMessage}
          />
        ) : null}
      </div>
    </div>
  );
});

type MessageListProps = {
  messages: MessageItem[];
  loading: boolean;
  error: string;
  highlightTerm?: string;
  highlightedMessageIds?: string[];
  scrollToMessageId?: string | null;
  unreadAnchorMessageId?: string | null;
  onScrollToMessageComplete?: () => void;
  currentUserId: string | null;
  onAddReaction: (messageId: string, emoji: string) => void;
  onReplyMessage: (messageId: string) => void;
  onReplyInThread: (messageId: string) => void;
  onEditMessage: (messageId: string, content: string) => void;
  onDeleteMessage: (messageId: string, scope: 'me' | 'everyone') => void;
  onForwardMessage: (messageId: string) => void;
  onPinMessage: (messageId: string, isPinned: boolean) => void;
  onSaveMessage: (messageId: string) => void;
  onUnsaveMessage: (messageId: string) => void;
  expandedThreadMessageId?: string | null;
  onSendThreadMessage?: (content: string, threadRootId: string) => Promise<string | null>;
  conversationId?: string;
  onVotePoll?: (messageId: string, optionId: string) => void;
};

export function MessageList({
  messages,
  loading,
  error,
  highlightTerm = '',
  highlightedMessageIds = [],
  scrollToMessageId = null,
  unreadAnchorMessageId = null,
  onScrollToMessageComplete,
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
  expandedThreadMessageId,
  onSendThreadMessage,
  conversationId,
  onVotePoll,
}: MessageListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const bottomAnchorRef = useRef<HTMLDivElement>(null);
  const showInitialLoading = loading && messages.length === 0;
  const showRefreshing = loading && messages.length > 0;
  const listEntries = useMemo(
    () => buildMessageListEntries(messages, unreadAnchorMessageId),
    [messages, unreadAnchorMessageId],
  );

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'auto') => {
    const container = scrollContainerRef.current;

    if (container) {
      const top = container.scrollHeight;

      if (behavior === 'smooth') {
        container.scrollTo({ top, behavior: 'smooth' });
      } else {
        container.scrollTop = top;
      }

      return;
    }

    bottomAnchorRef.current?.scrollIntoView({ block: 'end', behavior });
  }, []);

  useEffect(() => {
    if (!scrollToMessageId || showInitialLoading) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      const element = document.querySelector(`[data-message-id="${scrollToMessageId}"]`);

      if (element instanceof HTMLElement) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        onScrollToMessageComplete?.();
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, [onScrollToMessageComplete, scrollToMessageId, showInitialLoading, messages]);

  useEffect(() => {
    if (showInitialLoading || scrollToMessageId || messages.length === 0) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      scrollToBottom('auto');
      window.requestAnimationFrame(() => {
        scrollToBottom('auto');
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [conversationId, messages, scrollToBottom, scrollToMessageId, showInitialLoading]);

  const startEdit = useCallback((message: MessageItem) => {
    setEditingId(message.id);
    setEditDraft(message.content);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditDraft('');
  }, []);

  const saveEdit = useCallback(() => {
    if (!editingId || !editDraft.trim()) {
      return;
    }

    onEditMessage(editingId, editDraft.trim());
    setEditingId(null);
    setEditDraft('');
  }, [editDraft, editingId, onEditMessage]);

  if (showInitialLoading) {
    return <MessageListSkeleton />;
  }

  if (error && messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-accent-soft" role="alert">
        {error}
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-app-muted" role="status">
        No messages yet. Say hello.
      </div>
    );
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {showRefreshing ? (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-10 h-0.5 overflow-hidden bg-app-border"
          aria-hidden="true"
        >
          <div className="h-full w-1/3 animate-[shimmer_1s_ease-in-out_infinite] bg-accent/70" />
        </div>
      ) : null}

      <div
        ref={scrollContainerRef}
        className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-6 py-4"
      >
        {listEntries.map((entry) => {
          if (entry.kind === 'date') {
            return <DateDivider key={entry.key} label={entry.label} />;
          }

          if (entry.kind === 'unread') {
            return <UnreadDivider key={entry.key} />;
          }

          const message = entry.message;

          return (
            <MessageRow
              key={entry.key}
              message={message}
              messages={messages}
              isHighlighted={highlightedMessageIds.includes(message.id)}
              currentUserId={currentUserId}
              highlightTerm={highlightTerm}
              conversationId={conversationId}
              expandedThreadMessageId={expandedThreadMessageId}
              editingId={editingId}
              editDraft={editDraft}
              onEditDraftChange={setEditDraft}
              onStartEdit={startEdit}
              onCancelEdit={cancelEdit}
              onSaveEdit={saveEdit}
              onAddReaction={onAddReaction}
              onReplyMessage={onReplyMessage}
              onReplyInThread={onReplyInThread}
              onEditMessage={onEditMessage}
              onDeleteMessage={onDeleteMessage}
              onForwardMessage={onForwardMessage}
              onPinMessage={onPinMessage}
              onSaveMessage={onSaveMessage}
              onUnsaveMessage={onUnsaveMessage}
              onSendThreadMessage={onSendThreadMessage}
              onVotePoll={onVotePoll}
            />
          );
        })}
        <div ref={bottomAnchorRef} aria-hidden="true" className="h-px shrink-0" />
      </div>
    </div>
  );
}
