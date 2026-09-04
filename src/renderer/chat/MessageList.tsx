import { useState, type ReactNode } from 'react';
import type { MessageItem } from '../../shared/messages';
import { groupMessageReactions } from '../../shared/messages';
import { formatConversationTimestamp } from './format';
import { Avatar } from './ChatIcons';
import { MessageMenu } from './MessageMenu';
import { InlineThread } from './InlineThread';

type MessageListProps = {
  messages: MessageItem[];
  loading: boolean;
  error: string;
  highlightTerm?: string;
  highlightedMessageIds?: string[];
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
};

function highlightContent(content: string, term: string): ReactNode {
  if (!term.trim()) {
    return content;
  }

  const index = content.toLowerCase().indexOf(term.toLowerCase());

  if (index < 0) {
    return content;
  }

  const before = content.slice(0, index);
  const match = content.slice(index, index + term.length);
  const after = content.slice(index + term.length);

  return (
    <>
      {before}
      <mark className="rounded bg-accent/25 px-0.5 text-app-text">{match}</mark>
      {after}
    </>
  );
}

export function MessageList({
  messages,
  loading,
  error,
  highlightTerm = '',
  highlightedMessageIds = [],
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
}: MessageListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-app-muted" role="status">
        Loading messages...
      </div>
    );
  }

  if (error) {
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

  const startEdit = (message: MessageItem) => {
    setEditingId(message.id);
    setEditDraft(message.content);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft('');
  };

  const saveEdit = () => {
    if (!editingId || !editDraft.trim()) {
      return;
    }

    onEditMessage(editingId, editDraft.trim());
    setEditingId(null);
    setEditDraft('');
  };

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-4">
      {messages.map((message) => {
        const isHighlighted = highlightedMessageIds.includes(message.id);
        const reactionGroups = groupMessageReactions(message.reactions, currentUserId);
        const isPinned = Boolean(message.pinnedAt);
        const isEditing = editingId === message.id;

        return (
          <div
            key={message.id}
            className={`group flex gap-3 ${message.isOwn ? 'flex-row-reverse' : 'flex-row'} ${
              isHighlighted ? 'rounded-xl bg-accent/10 p-2' : ''
            }`}
          >
            {!message.isOwn ? (
              <Avatar imageUrl={null} initials={message.senderInitials} size="sm" />
            ) : null}
            <div
              className={`flex max-w-[70%] flex-col ${message.isOwn ? 'items-end' : 'items-start'}`}
            >
              {!message.isOwn ? (
                <p className="mb-1 text-xs font-medium text-app-muted">{message.senderName}</p>
              ) : null}
              {isPinned ? (
                <p className="mb-1 text-xs text-app-muted">📌 Pinned</p>
              ) : null}
              {message.replyToMessage ? (
                <div 
                  className={`mb-1 flex max-w-full flex-col rounded-[8px] border-l-2 bg-app-surface px-3 py-1.5 text-xs text-app-muted cursor-pointer hover:bg-app-chat-hover ${
                    message.isOwn ? 'border-l-accent mr-1' : 'border-l-app-border ml-1'
                  }`}
                >
                  <span className="font-medium text-app-text mb-0.5">{message.replyToMessage.senderName || message.replyToMessage.senderId}</span>
                  <span className="truncate">{message.replyToMessage.content}</span>
                </div>
              ) : null}
              {isEditing ? (
                <div className="space-y-2">
                  <textarea
                    value={editDraft}
                    onChange={(event) => setEditDraft(event.target.value)}
                    rows={3}
                    className="w-full rounded-xl border border-app-border bg-app-surface px-3 py-2 text-sm text-app-text outline-none focus:border-accent"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      className="rounded-lg px-3 py-1.5 text-xs text-app-muted hover:bg-app-chat-hover"
                      onClick={cancelEdit}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white"
                      onClick={saveEdit}
                    >
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    message.isOwn
                      ? 'bg-app-message-out text-app-message-out-text'
                      : 'bg-app-message-in text-app-text'
                  }`}
                >
                  {highlightContent(message.content, highlightTerm)}
                </div>
              )}

              <div
                className={`mt-1 flex w-full flex-wrap items-center gap-x-2 gap-y-1 ${
                  message.isOwn ? 'justify-end' : 'justify-start'
                }`}
              >
                {reactionGroups.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-1">
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

                <div
                  className={`inline-flex items-center gap-2 text-xs text-app-muted ${
                    message.isOwn ? 'flex-row-reverse' : 'flex-row'
                  }`}
                >
                  <div className="inline-flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      type="button"
                      aria-label="Add thumbs up reaction"
                      className="flex h-6 w-6 items-center justify-center rounded transition-colors hover:bg-app-chat-hover hover:text-app-text"
                      onClick={() => onAddReaction(message.id, '👍')}
                    >
                      👍
                    </button>
                    <MessageMenu
                      isOwn={message.isOwn}
                      isPinned={isPinned}
                      align={message.isOwn ? 'right' : 'left'}
                      onReply={() => onReplyMessage(message.id)}
                      onReplyInThread={() => onReplyInThread(message.id)}
                      onEdit={() => startEdit(message)}
                      onDeleteForMe={() => onDeleteMessage(message.id, 'me')}
                      onDeleteForEveryone={() => onDeleteMessage(message.id, 'everyone')}
                      onForward={() => onForwardMessage(message.id)}
                      onPinToggle={() => onPinMessage(message.id, isPinned)}
                      onSave={() => onSaveMessage(message.id)}
                      onUnsave={() => onUnsaveMessage(message.id)}
                    />
                  </div>
                  <div
                    className={`inline-flex items-center gap-2 ${
                      message.isOwn ? 'flex-row-reverse' : 'flex-row'
                    }`}
                  >
                    {message.createdAt ? (
                      <span className="whitespace-nowrap">{formatConversationTimestamp(message.createdAt)}</span>
                    ) : null}
                    {message.editedAt ? <span className="whitespace-nowrap">Edited</span> : null}
                    {message.isOwn && message.status === 'seen' ? (
                      <span className="whitespace-nowrap">Seen</span>
                    ) : null}
                    {message.isOwn && message.status === 'sent' ? (
                      <span className="whitespace-nowrap">Sent</span>
                    ) : null}
                  </div>
                </div>
              </div>
              
              {expandedThreadMessageId === message.id && conversationId && onSendThreadMessage && (
                <InlineThread 
                  conversationId={conversationId} 
                  rootMessageId={message.id} 
                  onSendThreadMessage={onSendThreadMessage} 
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
