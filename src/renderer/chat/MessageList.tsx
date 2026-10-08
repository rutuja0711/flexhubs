import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { FiCheck, FiMessageSquare, FiChevronUp, FiRefreshCw } from 'react-icons/fi';
import type { MessageItem, MessageReadReceipt } from '../../shared/messages';
import {
  buildConversationMemberNameIndex,
  enrichMessageReadReceipts,
  formatMessageSeenByDetail,
  formatMessageSeenByLabel,
  groupMessageReactions,
  isCallLogMessage,
  isMediaOnlyMessage,
  isVoiceOnlyMessage,
  isPollMessage,
  resolveMessageReadBy,
  resolveReplyTarget,
  shouldShowUploadProgress,
} from '../../shared/messages';
import { loadMessageById } from '../chatApi';
import { fetchMediaBlob } from '../mediaBlob';
import { formatConversationTimestamp, formatMessageDayDivider, messageDayKey } from './format';
import { Avatar, SparkleIcon } from './ChatIcons';
import { MessageMenu } from './MessageMenu';
import { ReactionChip } from './ReactionChip';
import { ReactionPicker } from './ReactionPicker';
import { MessageContent, MessageReplyPreview } from './MessageContent';

function MessageListSurface({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex min-h-0 flex-1 flex-col relative ${className}`.trim()}>
      {children}
    </div>
  );
}

function DateDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-2.5 my-1" role="separator" aria-label={label}>
      <div className="h-px flex-1 bg-app-border/40" />
      <span className="shrink-0 rounded-full border border-app-border/60 bg-app-surface/90 backdrop-blur-sm px-3.5 py-0.5 text-[11px] font-medium text-app-muted shadow-sm">
        {label}
      </span>
      <div className="h-px flex-1 bg-app-border/40" />
    </div>
  );
}

function UnreadDivider() {
  return (
    <div className="flex items-center gap-3 py-2 my-1" role="separator" aria-label="New messages">
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-accent/40 to-transparent" />
      <span className="shrink-0 rounded-full border border-accent/30 bg-accent/15 px-3 py-0.5 text-[0.625rem] font-bold uppercase tracking-wider text-accent-soft shadow-sm shadow-accent/20">
        New messages
      </span>
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-accent/40 to-transparent" />
    </div>
  );
}

function BlockedByYouDivider() {
  return (
    <div className="flex items-center gap-3 py-2 my-1" role="status" aria-label="You blocked this user">
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-accent/40 to-transparent" />
      <span className="shrink-0 rounded-full border border-accent/30 bg-accent/15 px-3 py-0.5 text-[0.625rem] font-bold uppercase tracking-wider text-accent-soft shadow-sm shadow-accent/20">
        You blocked this user
      </span>
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-accent/40 to-transparent" />
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
    <MessageListSurface className="overflow-hidden">
    <div className="flex min-h-0 flex-1 flex-col gap-4 px-6 py-4" aria-hidden="true">
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
    </MessageListSurface>
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
  onJumpToMessage?: (messageId: string) => void;
  onEditMessage: (messageId: string, content: string) => void;
  onDeleteMessage: (messageId: string, scope: 'me' | 'everyone') => void;
  onForwardMessage: (messageId: string) => void;
  onPinMessage: (messageId: string, isPinned: boolean) => void;
  onSaveMessage: (messageId: string) => void;
  onUnsaveMessage: (messageId: string) => void;
  savedMessageIds: ReadonlySet<string>;
  onRetryMessage?: (messageId: string) => void;
  onSendThreadMessage?: (
    content: string,
    threadRootId: string,
  ) => Promise<{ ok: true; message: import('../../shared/messages').MessageItem } | { ok: false; error: string }>;
  onVotePoll?: (messageId: string, optionId: string) => void;
  threadsEnabled?: boolean;
  showReactionAuthors?: boolean;
  allowMessageAppear?: boolean;
  conversationDetails?: Record<string, unknown> | null;
  conversationKind?: string;
  hideIncomingSenderMeta?: boolean;
  sendProgressByMessageId?: Record<string, number>;
};

function DoubleCheckIcon() {
  return (
    <span className="relative inline-block h-3 w-3.5 shrink-0" aria-hidden="true">
      <FiCheck className="absolute top-0 left-0 text-[11px]" strokeWidth={2.5} />
      <FiCheck className="absolute top-0 left-[5px] text-[11px]" strokeWidth={2.5} />
    </span>
  );
}

function isAppearingMessage(message: MessageItem): boolean {
  if (message.id.startsWith('local-')) {
    return true;
  }

  const created = Date.parse(message.createdAt);
  return Number.isFinite(created) && Date.now() - created < 2500;
}

function MessageSeenBy({
  message,
  messages,
  conversationId,
  conversationDetails,
  currentUserId,
  conversationKind,
}: {
  message: MessageItem;
  messages: MessageItem[];
  conversationId?: string;
  conversationDetails?: Record<string, unknown> | null;
  currentUserId: string | null;
  conversationKind?: string;
}) {
  const isDirect = conversationKind === 'direct' || conversationDetails?.kind === 'direct';
  const [fetchedReadBy, setFetchedReadBy] = useState<MessageReadReceipt[] | null>(null);
  const memberNameIndex = useMemo(
    () => buildConversationMemberNameIndex(conversationDetails ?? null),
    [conversationDetails],
  );

  const readers = useMemo(() => {
    if (isDirect) {
      return [];
    }
    const baseReaders =
      fetchedReadBy && fetchedReadBy.length > 0
        ? fetchedReadBy
        : resolveMessageReadBy(message, conversationDetails ?? null, messages, currentUserId);

    return enrichMessageReadReceipts(baseReaders, memberNameIndex);
  }, [conversationDetails, currentUserId, fetchedReadBy, isDirect, memberNameIndex, message, messages]);

  useEffect(() => {
    setFetchedReadBy(null);
  }, [message.id, conversationId]);

  useEffect(() => {
    if (isDirect || !message.isOwn || message.status !== 'seen' || !conversationId || isLocalMessageId(message.id)) {
      return;
    }

    let cancelled = false;

    void loadMessageById(conversationId, message.id).then((result) => {
      if (cancelled || !result.ok || result.data.readBy.length === 0) {
        return;
      }

      setFetchedReadBy(
        enrichMessageReadReceipts(result.data.readBy, memberNameIndex),
      );
    });

    return () => {
      cancelled = true;
    };
  }, [conversationId, isDirect, memberNameIndex, message.id, message.isOwn, message.status]);

  if (isDirect || !message.isOwn || message.status !== 'seen' || readers.length === 0) {
    return null;
  }

  // The user requested not to show "Seen by" and the person's name, just the double ticks
  return null;
}

function isLocalMessageId(id: string): boolean {
  return id.startsWith('local-');
}

function MessageTimeInline({
  message,
  messages,
  conversationId,
  conversationDetails,
  currentUserId,
  conversationKind,
  onRetryMessage,
  className = '',
}: {
  message: MessageItem;
  messages: MessageItem[];
  conversationId?: string;
  conversationDetails?: Record<string, unknown> | null;
  currentUserId: string | null;
  conversationKind?: string;
  onRetryMessage?: (messageId: string) => void;
  className?: string;
}) {
  if (!message.createdAt && !message.editedAt && !message.isOwn) {
    return null;
  }

  const isDirect = conversationKind === 'direct' || conversationDetails?.kind === 'direct';

  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap text-[0.6875rem] leading-none ${
        message.isOwn
          ? 'text-app-message-out-text/75'
          : 'text-app-muted'
      } ${className}`}
    >
      {message.editedAt ? <span className="lowercase">edited</span> : null}
      {message.createdAt ? formatConversationTimestamp(message.createdAt) : null}
      {message.isOwn && message.status === 'sending' ? (
        <span className="text-[10px] italic opacity-75">Sending…</span>
      ) : null}
      {message.isOwn && message.status === 'seen' ? <DoubleCheckIcon /> : null}
      {message.isOwn && message.status === 'delivered' ? (
        <FiCheck className="text-[11px]" strokeWidth={2.5} aria-hidden="true" />
      ) : null}
      {message.isOwn && message.status === 'failed' && onRetryMessage ? (
        <button
          type="button"
          className="inline-flex items-center rounded p-0.5 text-red-200 transition-colors hover:text-white"
          aria-label="Retry sending message"
          title="Failed to send. Tap to retry."
          onClick={(event) => {
            event.stopPropagation();
            onRetryMessage(message.id);
          }}
        >
          <FiRefreshCw className="text-[11px]" aria-hidden="true" />
        </button>
      ) : null}
      {!isDirect ? (
        <MessageSeenBy
          message={message}
          messages={messages}
          conversationId={conversationId}
          conversationDetails={conversationDetails}
          currentUserId={currentUserId}
          conversationKind={conversationKind}
        />
      ) : null}
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
  onJumpToMessage,
  onDeleteMessage,
  onForwardMessage,
  onPinMessage,
  onSaveMessage,
  onUnsaveMessage,
  savedMessageIds,
  onRetryMessage,
  onSendThreadMessage,
  onVotePoll,
  threadsEnabled = false,
  showReactionAuthors = false,
  allowMessageAppear = false,
  conversationDetails = null,
  conversationKind,
  hideIncomingSenderMeta = false,
  sendProgressByMessageId = {},
}: MessageRowProps) {
  const reactionGroups = groupMessageReactions(message.reactions, currentUserId);
  const outboundMediaSending = shouldShowUploadProgress(message);
  const sendProgress = sendProgressByMessageId[message.id];
  const mediaSendProps = {
    isOwn: message.isOwn,
    ...(outboundMediaSending
      ? {
          isSending: true as const,
          sendProgress: sendProgress ?? null,
        }
      : {}),
  };
  const timeInlineProps = {
    message,
    messages,
    conversationId,
    conversationDetails,
    currentUserId,
    conversationKind,
    onRetryMessage,
  };
  const isPinned = Boolean(message.pinnedAt);
  const isSending = message.status === 'sending';
  const hasDownloadableMedia =
    isSending &&
    (message.media?.some((item) => Boolean(item.url || item.previewUrl)) ?? false);
  const isEditing = editingId === message.id;
  const isPoll = isPollMessage(message);
  const isCallLog = isCallLogMessage(message);
  const isMediaOnly =
    !isPoll && !isCallLog && (isMediaOnlyMessage(message) || isVoiceOnlyMessage(message));
  const hasMedia = (message.media?.length ?? 0) > 0;
  const isTextOnly = !isPoll && !isCallLog && !isMediaOnly && !hasMedia;
  const bubbleHasMediaCaption = hasMedia && !isMediaOnly;
  const detailsKind = String(
    conversationDetails?.kind ?? conversationDetails?.type ?? conversationDetails?.conversationType ?? '',
  ).toLowerCase();
  const isDirectChat =
    hideIncomingSenderMeta ||
    conversationKind === 'direct' ||
    detailsKind === 'direct' ||
    detailsKind === 'dm' ||
    detailsKind === 'private' ||
    conversationDetails?.isDirect === true ||
    conversationDetails?.isDm === true;
  const showIncomingSenderMeta = !message.isOwn && !isDirectChat;

  const handleDownloadSendingMedia = async () => {
    const item = message.media?.[0];
    if (!item) {
      return;
    }

    const url = item.previewUrl ?? item.url;
    const fileName = item.name ?? 'download';

    try {
      let blob: Blob;
      if (url.startsWith('blob:') || url.startsWith('data:')) {
        const response = await fetch(url);
        blob = await response.blob();
      } else {
        blob = await fetchMediaBlob(url);
      }

      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = fileName;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
    } catch {
      // Download unavailable until upload completes.
    }
  };

  const bubbleClassName = `${
    bubbleHasMediaCaption ? 'inline-flex w-fit max-w-full flex-col overflow-hidden p-0' : 'inline-block w-fit max-w-full px-3.5 py-2'
  } rounded-[18px] text-sm leading-relaxed border border-black/20 dark:border-white/20 text-app-text ${
    message.isOwn ? 'self-end' : 'self-start'
  }`;
  const bubbleCaptionPad = bubbleHasMediaCaption ? 'px-3.5' : '';

  return (
    <div
      data-message-id={message.id}
      className={`message-row group flex ${showIncomingSenderMeta ? 'gap-3' : 'gap-0'} ${message.isOwn ? 'flex-row-reverse' : 'flex-row'} ${
        allowMessageAppear && isAppearingMessage(message)
          ? message.isOwn
            ? 'message-appear message-appear-own'
            : 'message-appear'
          : ''
      } ${message.isOwn && message.status === 'failed' ? 'opacity-80' : ''} ${
        isHighlighted ? 'message-target-highlight rounded-2xl p-2' : ''
      }`}
    >
      {showIncomingSenderMeta ? (
        <Avatar imageUrl={message.senderAvatarUrl ?? null} initials={message.senderInitials} size="sm" />
      ) : null}
      <div className={`flex max-w-[70%] flex-col ${message.isOwn ? 'items-end' : 'items-start'}`}>
        {showIncomingSenderMeta ? (
          <p className="mb-1 text-xs font-semibold text-app-muted">{message.senderName}</p>
        ) : null}
        {message.replyToMessage || message.replyToMessageId ? (
          (() => {
            const replyTarget = resolveReplyTarget(message, messages);

            if (!replyTarget) {
              return null;
            }

            return (
              <button
                type="button"
                className={`mb-1.5 flex max-w-full cursor-pointer flex-col rounded-xl border-l-2 bg-app-surface/90 backdrop-blur-sm px-3 py-1.5 text-left text-xs transition-colors hover:bg-app-chat-hover ${
                  message.isOwn ? 'mr-1 border-l-white/60 text-white/90' : 'ml-1 border-l-accent text-app-muted'
                }`}
                onClick={() => onJumpToMessage?.(replyTarget.id)}
              >
                <span className="mb-0.5 font-medium text-app-text">
                  {replyTarget.senderName || replyTarget.senderId}
                </span>
                <MessageReplyPreview message={replyTarget} currentUserId={currentUserId} />
              </button>
            );
          })()
        ) : null}
        {isEditing ? (
          <div className="flex flex-col gap-1 items-end">
            <div className={bubbleClassName + " p-0 overflow-hidden grid"}>
              {/* Invisible div to perfectly size the parent bubble */}
              <div className="invisible col-start-1 row-start-1 min-w-[200px] whitespace-pre-wrap break-words px-3.5 py-2 text-sm leading-relaxed">
                {editDraft + ' '}
              </div>
              <textarea
                value={editDraft}
                onChange={(event) => onEditDraftChange(event.target.value)}
                className="col-start-1 row-start-1 h-full w-full resize-none bg-transparent px-3.5 py-2 text-sm leading-relaxed text-inherit outline-none overflow-hidden"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg px-3 py-1.5 text-xs text-app-muted hover:bg-app-chat-hover transition-colors"
                onClick={onCancelEdit}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg bg-accent/80 hover:bg-accent px-3 py-1.5 text-xs font-medium text-white transition-colors"
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
                  className={`inline-block w-fit max-w-full ${message.isOwn ? 'self-end' : 'self-start'} max-w-sm`}
                >
                  <MessageContent
                    message={message}
                    highlightTerm={highlightTerm}
                    currentUserId={currentUserId}
                    {...mediaSendProps}
                    onVotePoll={
                      onVotePoll ? (optionId) => onVotePoll(message.id, optionId) : undefined
                    }
                  />
                  <div className="mt-0.5 flex justify-end">
                    <MessageTimeInline {...timeInlineProps} className="!text-app-muted" />
                  </div>
                </div>
              ) : (
                <div className={bubbleClassName}>
                  {isTextOnly ? (
                    message.isOwn ? (
                      <>
                        <MessageContent
                          message={message}
                          highlightTerm={highlightTerm}
                          currentUserId={currentUserId}
                          {...mediaSendProps}
                          onVotePoll={
                            onVotePoll ? (optionId) => onVotePoll(message.id, optionId) : undefined
                          }
                        />
                        <div className="mt-1.5 flex justify-end">
                          <MessageTimeInline {...timeInlineProps} />
                        </div>
                      </>
                    ) : (
                      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-x-1.5">
                        <span className="min-w-0 whitespace-pre-wrap break-words break-all text-left">
                          <MessageContent
                            message={message}
                            highlightTerm={highlightTerm}
                            compact
                            currentUserId={currentUserId}
                            {...mediaSendProps}
                            onVotePoll={
                              onVotePoll ? (optionId) => onVotePoll(message.id, optionId) : undefined
                            }
                          />
                        </span>
                        <MessageTimeInline {...timeInlineProps} className="pb-[1px]" />
                      </div>
                    )
                  ) : (
                    <>
                      <MessageContent
                        message={message}
                        highlightTerm={highlightTerm}
                        currentUserId={currentUserId}
                        {...mediaSendProps}
                        onVotePoll={
                          onVotePoll ? (optionId) => onVotePoll(message.id, optionId) : undefined
                        }
                      />
                      <div className={`mt-1.5 flex justify-end ${bubbleHasMediaCaption ? `${bubbleCaptionPad} pb-2` : ''}`}>
                        <MessageTimeInline {...timeInlineProps} />
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
                    <ReactionChip
                      key={`${message.id}-${group.emoji}`}
                      emoji={group.emoji}
                      count={group.count}
                      reactedByMe={group.reactedByMe}
                      reactions={message.reactions}
                      currentUserId={currentUserId}
                      showAuthors={showReactionAuthors}
                      onClick={() => onAddReaction(message.id, group.emoji)}
                    />
                  ))}
                </div>
              ) : null}
            </div>

            <div
              className={`mb-1 flex shrink-0 items-center gap-0.5 rounded-xl border border-app-border/80 bg-app-surface/98 dark:bg-app-elevated/95 backdrop-blur-md px-1 py-0.5 shadow-md opacity-0 transition-all duration-200 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 ${
                message.isOwn ? 'flex-row-reverse' : 'flex-row'
              }`}
            >
              {!isSending ? (
                <ReactionPicker
                  align={message.isOwn ? 'right' : 'left'}
                  onSelect={(emoji) => onAddReaction(message.id, emoji)}
                />
              ) : null}
              <MessageMenu
                isOwn={message.isOwn}
                isPinned={isPinned}
                isSaved={savedMessageIds.has(message.id)}
                isDeleted={message.content.trim() === 'This message was deleted.'}
                isSending={isSending}
                hasDownloadableMedia={hasDownloadableMedia}
                align={message.isOwn ? 'right' : 'left'}
                showReplyInThread={threadsEnabled}
                onReply={() => onReplyMessage(message.id)}
                onReplyInThread={() => onReplyInThread(message.id)}
                onEdit={() => onStartEdit(message)}
                onDeleteForMe={() => onDeleteMessage(message.id, 'me')}
                onDeleteForEveryone={() => onDeleteMessage(message.id, 'everyone')}
                onForward={() => onForwardMessage(message.id)}
                onPinToggle={() => onPinMessage(message.id, isPinned)}
                onSave={() => onSaveMessage(message.id)}
                onUnsave={() => onUnsaveMessage(message.id)}
                onDownload={() => {
                  void handleDownloadSendingMedia();
                }}
              />
            </div>
          </div>
        )}

        {threadsEnabled && message.threadReplyCount && message.threadReplyCount > 0 ? (
          <div className={`mt-1 flex flex-col ${message.isOwn ? 'items-end' : 'items-start'}`}>
            <button
              type="button"
              className="group/reply flex items-center gap-1.5 text-xs text-accent-soft hover:text-accent transition-colors"
              onClick={() => onReplyInThread(message.id)}
            >
              <FiChevronUp className="text-[10px]" />
              <span className="font-medium">{message.threadReplyCount} {message.threadReplyCount === 1 ? 'reply' : 'replies'} - {formatConversationTimestamp(message.createdAt)}</span>
              <FiMessageSquare className="text-[10px]" />
            </button>
            <span className="text-[10px] text-app-muted mt-0.5 pr-0.5 cursor-pointer hover:underline" onClick={() => onReplyInThread(message.id)}>
              Open thread panel
            </span>
          </div>
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
  /** While set, suppress auto scroll-to-bottom (e.g. opening a saved message). */
  pendingScrollToMessageId?: string | null;
  scrollRequestKey?: number;
  scrollRestoreKey?: number;
  hasMoreOlder?: boolean;
  loadingOlder?: boolean;
  onLoadOlder?: () => void;
  unreadAnchorMessageId?: string | null;
  onScrollToMessageComplete?: (messageId: string) => void;
  currentUserId: string | null;
  onAddReaction: (messageId: string, emoji: string) => void;
  onReplyMessage: (messageId: string) => void;
  onReplyInThread: (messageId: string) => void;
  onJumpToMessage?: (messageId: string) => void;
  onEditMessage: (messageId: string, content: string) => void;
  onDeleteMessage: (messageId: string, scope: 'me' | 'everyone') => void;
  onForwardMessage: (messageId: string) => void;
  onPinMessage: (messageId: string, isPinned: boolean) => void;
  onSaveMessage: (messageId: string) => void;
  onUnsaveMessage: (messageId: string) => void;
  savedMessageIds: ReadonlySet<string>;
  onRetryMessage?: (messageId: string) => void;
  expandedThreadMessageId?: string | null;
  onSendThreadMessage?: (
    content: string,
    threadRootId: string,
  ) => Promise<{ ok: true; message: import('../../shared/messages').MessageItem } | { ok: false; error: string }>;
  conversationId?: string;
  onVotePoll?: (messageId: string, optionId: string) => void;
  threadsEnabled?: boolean;
  showReactionAuthors?: boolean;
  conversationDetails?: Record<string, unknown> | null;
  conversationKind?: string;
  /** Hide avatar + name on incoming messages (direct / 1:1 chats). */
  hideIncomingSenderMeta?: boolean;
  onSummarizeUnread?: () => void;
  sendProgressByMessageId?: Record<string, number>;
  /** True when the signed-in user blocked the direct-chat peer (not shown to the blocked party). */
  peerBlockedByCurrentUser?: boolean;
};

export function MessageList({
  messages,
  loading,
  error,
  highlightTerm = '',
  highlightedMessageIds = [],
  scrollToMessageId = null,
  pendingScrollToMessageId = null,
  scrollRequestKey = 0,
  scrollRestoreKey = 0,
  hasMoreOlder = false,
  loadingOlder = false,
  onLoadOlder,
  unreadAnchorMessageId = null,
  onScrollToMessageComplete,
  currentUserId,
  onAddReaction,
  onReplyMessage,
  onReplyInThread,
  onJumpToMessage,
  onEditMessage,
  onDeleteMessage,
  onForwardMessage,
  onPinMessage,
  onSaveMessage,
  onUnsaveMessage,
  savedMessageIds,
  onRetryMessage,
  expandedThreadMessageId,
  onSendThreadMessage,
  conversationId,
  onVotePoll,
  threadsEnabled = false,
  showReactionAuthors = false,
  conversationDetails = null,
  conversationKind,
  hideIncomingSenderMeta = false,
  onSummarizeUnread,
  sendProgressByMessageId = {},
  peerBlockedByCurrentUser = false,
}: MessageListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [allowMessageAppear, setAllowMessageAppear] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const bottomAnchorRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const suppressAutoScrollRef = useRef(false);
  const lastMessageIdRef = useRef<string | null>(null);
  const loadOlderScrollSnapshotRef = useRef<{ scrollHeight: number; scrollTop: number } | null>(
    null,
  );
  const showInitialLoading = loading && messages.length === 0;
  const showRefreshing = loading && messages.length > 0;

  useEffect(() => {
    if (showInitialLoading) {
      setAllowMessageAppear(false);
      return;
    }

    setAllowMessageAppear(true);
  }, [conversationId, showInitialLoading]);
  const listEntries = useMemo(
    () => buildMessageListEntries(messages, unreadAnchorMessageId),
    [messages, unreadAnchorMessageId],
  );

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'auto') => {
    if (suppressAutoScrollRef.current || pendingScrollToMessageId || scrollToMessageId) {
      return;
    }

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
  }, [pendingScrollToMessageId, scrollToMessageId]);

  useEffect(() => {
    if (!scrollToMessageId || showInitialLoading) {
      return;
    }

    let attempts = 0;
    let frame = 0;
    const maxAttempts = 48;

    const tryScroll = () => {
      const container = scrollContainerRef.current;
      const element = container?.querySelector(`[data-message-id="${scrollToMessageId}"]`);

      if (container && element instanceof HTMLElement) {
        stickToBottomRef.current = false;
        suppressAutoScrollRef.current = true;

        const elementTop =
          element.getBoundingClientRect().top -
          container.getBoundingClientRect().top +
          container.scrollTop;
        const targetTop =
          elementTop - container.clientHeight / 2 + element.getBoundingClientRect().height / 2;

        container.scrollTop = Math.max(0, Math.min(targetTop, container.scrollHeight - container.clientHeight));
        onScrollToMessageComplete?.(scrollToMessageId);
        return;
      }

      attempts += 1;
      if (attempts < maxAttempts) {
        frame = window.requestAnimationFrame(tryScroll);
      }
    };

    frame = window.requestAnimationFrame(tryScroll);

    return () => window.cancelAnimationFrame(frame);
  }, [messages, onScrollToMessageComplete, scrollRequestKey, scrollToMessageId, showInitialLoading]);

  useEffect(() => {
    if (pendingScrollToMessageId) {
      stickToBottomRef.current = false;
      suppressAutoScrollRef.current = true;
    } else {
      stickToBottomRef.current = true;
      suppressAutoScrollRef.current = false;
    }
    lastMessageIdRef.current = null;
    loadOlderScrollSnapshotRef.current = null;
  }, [conversationId, pendingScrollToMessageId]);

  useEffect(() => {
    if (pendingScrollToMessageId || scrollToMessageId) {
      suppressAutoScrollRef.current = true;
      stickToBottomRef.current = false;
      return;
    }

    const timeoutId = window.setTimeout(() => {
      suppressAutoScrollRef.current = false;
    }, 5000);

    return () => window.clearTimeout(timeoutId);
  }, [pendingScrollToMessageId, scrollToMessageId]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) {
      return;
    }

    const onScroll = () => {
      if (suppressAutoScrollRef.current || pendingScrollToMessageId) {
        return;
      }

      if (container.scrollHeight <= container.clientHeight + 1) {
        stickToBottomRef.current = true;
        return;
      }

      const distanceFromBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight;
      stickToBottomRef.current = distanceFromBottom < 150;

      if (
        onLoadOlder &&
        hasMoreOlder &&
        !loadingOlder &&
        container.scrollTop < 120 &&
        !loadOlderScrollSnapshotRef.current
      ) {
        loadOlderScrollSnapshotRef.current = {
          scrollHeight: container.scrollHeight,
          scrollTop: container.scrollTop,
        };
        onLoadOlder();
      }
    };

    container.addEventListener('scroll', onScroll, { passive: true });
    return () => container.removeEventListener('scroll', onScroll);
  }, [hasMoreOlder, loadingOlder, onLoadOlder, pendingScrollToMessageId]);

  useEffect(() => {
    const container = scrollContainerRef.current;

    if (
      !container ||
      !onLoadOlder ||
      !hasMoreOlder ||
      loadingOlder ||
      showInitialLoading ||
      loadOlderScrollSnapshotRef.current ||
      pendingScrollToMessageId ||
      suppressAutoScrollRef.current
    ) {
      return;
    }

    if (container.scrollHeight <= container.clientHeight + 8) {
      loadOlderScrollSnapshotRef.current = {
        scrollHeight: container.scrollHeight,
        scrollTop: container.scrollTop,
      };
      onLoadOlder();
    }
  }, [
    hasMoreOlder,
    loadingOlder,
    messages.length,
    onLoadOlder,
    pendingScrollToMessageId,
    showInitialLoading,
  ]);

  useEffect(() => {
    if (loadingOlder || !loadOlderScrollSnapshotRef.current) {
      return;
    }

    const snapshot = loadOlderScrollSnapshotRef.current;
    loadOlderScrollSnapshotRef.current = null;
    const container = scrollContainerRef.current;

    if (!container) {
      return;
    }

    let innerFrame = 0;
    const outerFrame = window.requestAnimationFrame(() => {
      innerFrame = window.requestAnimationFrame(() => {
        const delta = container.scrollHeight - snapshot.scrollHeight;
        container.scrollTop = snapshot.scrollTop + delta;
      });
    });

    return () => {
      window.cancelAnimationFrame(outerFrame);
      window.cancelAnimationFrame(innerFrame);
    };
  }, [loadingOlder, messages]);

  useEffect(() => {
    if (showInitialLoading || messages.length === 0) {
      return;
    }

    const lastMessage = messages[messages.length - 1];
    const lastId = lastMessage?.id ?? null;
    const previousLastId = lastMessageIdRef.current;
    const isInitialLoad = previousLastId === null;
    const appendedNewMessage = Boolean(lastId && previousLastId && lastId !== previousLastId);

    const isOwnNewMessage =
      lastMessage?.isOwn === true ||
      lastMessage?.id.startsWith('local-') ||
      (lastMessage ? isAppearingMessage(lastMessage) && lastMessage.isOwn : false);

    if ((pendingScrollToMessageId || suppressAutoScrollRef.current) && !isOwnNewMessage) {
      return;
    }

    lastMessageIdRef.current = lastId;

    if (
      scrollToMessageId &&
      !isInitialLoad &&
      !isOwnNewMessage &&
      !stickToBottomRef.current
    ) {
      return;
    }

    const shouldScroll =
      (isInitialLoad && !pendingScrollToMessageId && !scrollToMessageId) ||
      isOwnNewMessage ||
      (appendedNewMessage && stickToBottomRef.current);

    if (!shouldScroll) {
      return;
    }

    if (isOwnNewMessage) {
      stickToBottomRef.current = true;
    }

    const behavior = isOwnNewMessage ? 'smooth' : 'auto';
    let innerFrame = 0;

    const outerFrame = window.requestAnimationFrame(() => {
      innerFrame = window.requestAnimationFrame(() => {
        scrollToBottom(behavior);
      });
    });

    return () => {
      window.cancelAnimationFrame(outerFrame);
      window.cancelAnimationFrame(innerFrame);
    };
  }, [
    conversationId,
    messages,
    pendingScrollToMessageId,
    scrollToBottom,
    scrollToMessageId,
    showInitialLoading,
  ]);

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
      <MessageListSurface>
        <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-accent-soft" role="alert">
          {error}
        </div>
      </MessageListSurface>
    );
  }

  if (messages.length === 0) {
    return (
      <MessageListSurface>
        <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-app-muted" role="status">
          No messages yet. Say hello.
        </div>
      </MessageListSurface>
    );
  }

  return (
    <MessageListSurface>
      {onSummarizeUnread && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[20] flex justify-center w-full pointer-events-none">
          <button
            onClick={onSummarizeUnread}
            className="pointer-events-auto flex items-center gap-2 rounded-full bg-[#8c2a44] hover:bg-[#7a243a] px-4 py-2 text-[13px] font-semibold text-white shadow-md transition-colors"
          >
            <SparkleIcon className="h-4 w-4" /> Summarize recent messages
          </button>
        </div>
      )}
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
        className="message-list-scroll flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-6 py-4"
      >
        <div ref={contentRef} className="flex flex-col gap-4">
        {loadingOlder ? (
          <div className="flex justify-center py-2 text-xs text-app-muted" role="status">
            Loading earlier messages…
          </div>
        ) : null}
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
              onJumpToMessage={onJumpToMessage}
              onEditMessage={onEditMessage}
              onDeleteMessage={onDeleteMessage}
              onForwardMessage={onForwardMessage}
              onPinMessage={onPinMessage}
              onSaveMessage={onSaveMessage}
              onUnsaveMessage={onUnsaveMessage}
              savedMessageIds={savedMessageIds}
              onRetryMessage={onRetryMessage}
              onSendThreadMessage={onSendThreadMessage}
              onVotePoll={onVotePoll}
              threadsEnabled={threadsEnabled}
              showReactionAuthors={showReactionAuthors}
              allowMessageAppear={allowMessageAppear}
              conversationDetails={conversationDetails}
              conversationKind={conversationKind}
              hideIncomingSenderMeta={hideIncomingSenderMeta}
              sendProgressByMessageId={sendProgressByMessageId}
            />
          );
        })}
        {peerBlockedByCurrentUser ? <BlockedByYouDivider key="blocked-by-you" /> : null}
        <div ref={bottomAnchorRef} aria-hidden="true" className="h-px shrink-0" />
        </div>
      </div>
    </MessageListSurface>
  );
}
