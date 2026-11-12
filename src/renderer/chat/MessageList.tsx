import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  Virtuoso,
  type Components,
  type FollowOutputScalarType,
  type ItemProps,
  type ListProps,
  type ListRange,
  type ScrollerProps,
  type VirtuosoHandle,
} from 'react-virtuoso';
import { FiCheck, FiCornerUpLeft, FiMessageSquare, FiChevronUp, FiRefreshCw } from 'react-icons/fi';
import type { MessageItem, MessageReadReceipt } from '../../shared/messages';
import {
  buildConversationMemberNameIndex,
  enrichMessageReadReceipts,
  formatMessagePreview,
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
import { prefetchAuthenticatedMediaUrls } from '../authenticatedMedia';
import { isPerfEnabled, perfRecordRender, perfSetGauge } from '../dev/perfInstrumentation';
import { isMessageListVirtualizationEnabled } from '../dev/messageListVirtualization';
import { registerMessageListVirtuosoLayoutSync } from './messageListVirtuosoSync';
import { fetchMediaBlob } from '../mediaBlob';
import { formatConversationTimestamp, formatMessageDayDivider, messageDayKey } from './format';
import { Avatar, EnhanceSparkleIcon } from './ChatIcons';
import { MessageMenu } from './MessageMenu';
import { ReactionChip } from './ReactionChip';
import { ReactionPicker } from './ReactionPicker';
import { MessageContent, MessageReplyPreview } from './MessageContent';
import type { ConversationScrollSnapshot } from '../conversationScrollCache';

function MessageListSurface({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`relative flex min-h-0 min-w-0 w-full flex-1 flex-col ${className}`.trim()}>
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

export type MessageListEntry =
  | { kind: 'date'; key: string; label: string }
  | { kind: 'unread'; key: 'unread-divider' }
  | { kind: 'message'; key: string; message: MessageItem };

const VIRTUOSO_BASE_FIRST_ITEM_INDEX = 10_000;
const STICK_TO_BOTTOM_THRESHOLD_PX = 150;
const LOAD_OLDER_TOP_THRESHOLD_PX = 120;
const VIRTUOSO_AUTOSCROLL_MIN_INTERVAL_MS = 80;

function countMessageRowsInScroller(container: HTMLElement | null): number {
  if (!container) {
    return 0;
  }

  return container.querySelectorAll('[data-message-id]').length;
}

function findMessageEntryIndex(entries: MessageListEntry[], messageId: string): number {
  return entries.findIndex(
    (entry) => entry.kind === 'message' && entry.message.id === messageId,
  );
}

const messageListVirtuosoScroller = forwardRef<HTMLDivElement, ScrollerProps>(
  function MessageListVirtuosoScroller({ style, children, ...rest }, ref) {
    return (
      <div
        {...rest}
        ref={ref}
        style={style}
        className={`message-list-scroll flex h-full min-h-0 w-full min-w-0 max-w-full flex-col overflow-y-auto overscroll-contain py-4 ${rest.className ?? ''}`.trim()}
      >
        {children}
      </div>
    );
  },
);

const messageListVirtuosoList = forwardRef<HTMLDivElement, ListProps>(function MessageListVirtuosoList(
  { children, style, ...rest },
  ref,
) {
  return (
    <div
      {...rest}
      ref={ref}
      style={{
        ...style,
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box',
      }}
      className="min-w-0 max-w-full"
    >
      {children}
    </div>
  );
});

function MessageListVirtuosoItem({
  children,
  style,
  ...rest
}: ItemProps<MessageListEntry>) {
  return (
    <div
      {...rest}
      style={{
        ...style,
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box',
      }}
      className="min-w-0 max-w-full"
    >
      {children}
    </div>
  );
}

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
  replyTarget?: MessageItem | null;
  isHighlighted: boolean;
  currentUserId: string | null;
  highlightTerm: string;
  conversationId?: string;
  expandedThreadMessageId?: string | null;
  editingId: string | null;
  editDraft: string;
  editSaving?: boolean;
  onEditDraftChange: (value: string) => void;
  onStartEdit: (message: MessageItem) => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void | Promise<void>;
  onAddReaction: (messageId: string, emoji: string) => void;
  onReplyMessage: (messageId: string) => void;
  onAiReplyMessage?: (messageId: string) => void;
  aiReplyLoadingMessageId?: string | null;
  onReplyInThread: (messageId: string) => void;
  onJumpToMessage?: (messageId: string) => void;
  onEditMessage: (messageId: string, content: string) => void | Promise<boolean>;
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

function MessageHoverAction({
  label,
  title,
  onClick,
  disabled = false,
  busy = false,
  children,
}: {
  label: string;
  title: string;
  onClick: () => void;
  disabled?: boolean;
  busy?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={title}
      disabled={disabled || busy}
      className="flex h-7 w-7 items-center justify-center rounded-lg text-app-muted transition-all duration-150 hover:bg-black/[0.06] hover:text-app-text active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-white/[0.1]"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
    >
      {busy ? <FiRefreshCw className="animate-spin text-sm" aria-hidden /> : children}
    </button>
  );
}

function canGenerateAiReply(message: MessageItem): boolean {
  if (message.isOwn) {
    return false;
  }

  if (message.content.trim() === 'This message was deleted.') {
    return false;
  }

  if (isCallLogMessage(message)) {
    return false;
  }

  const preview = formatMessagePreview(message).trim();
  return preview.length > 0 || message.content.trim().length > 0;
}

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
  conversationId,
  conversationDetails,
  currentUserId,
  conversationKind,
  onRetryMessage,
  className = '',
}: {
  message: MessageItem;
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
      className={`inline-flex items-center gap-1 whitespace-nowrap text-[0.625rem] leading-none tracking-wide ${
        message.isOwn
          ? 'text-app-message-out-text/75'
          : 'text-app-muted'
      } ${className}`}
    >
      {message.editedAt ? <span className="lowercase">edited</span> : null}
      {message.createdAt ? formatConversationTimestamp(message.createdAt) : null}
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
          messages={[]}
          conversationId={conversationId}
          conversationDetails={conversationDetails}
          currentUserId={currentUserId}
          conversationKind={conversationKind}
        />
      ) : null}
    </span>
  );
}

function MessageTimeFooter({
  message,
  conversationId,
  conversationDetails,
  currentUserId,
  conversationKind,
  onRetryMessage,
}: {
  message: MessageItem;
  conversationId?: string;
  conversationDetails?: Record<string, unknown> | null;
  currentUserId: string | null;
  conversationKind?: string;
  onRetryMessage?: (messageId: string) => void;
}) {
  return (
    <div className="mt-0.5 flex w-full justify-end pr-0.5 opacity-90">
      <MessageTimeInline
        message={message}
        conversationId={conversationId}
        conversationDetails={conversationDetails}
        currentUserId={currentUserId}
        conversationKind={conversationKind}
        onRetryMessage={onRetryMessage}
        className={message.isOwn ? '' : '!text-app-muted'}
      />
    </div>
  );
}

function areMessageRowPropsEqual(prev: MessageRowProps, next: MessageRowProps): boolean {
  if (prev.message !== next.message) {
    return false;
  }

  return (
    prev.replyTarget === next.replyTarget &&
    prev.isHighlighted === next.isHighlighted &&
    prev.currentUserId === next.currentUserId &&
    prev.highlightTerm === next.highlightTerm &&
    prev.conversationId === next.conversationId &&
    prev.expandedThreadMessageId === next.expandedThreadMessageId &&
    prev.editingId === next.editingId &&
    prev.editDraft === next.editDraft &&
    prev.editSaving === next.editSaving &&
    prev.aiReplyLoadingMessageId === next.aiReplyLoadingMessageId &&
    prev.threadsEnabled === next.threadsEnabled &&
    prev.showReactionAuthors === next.showReactionAuthors &&
    prev.allowMessageAppear === next.allowMessageAppear &&
    prev.conversationDetails === next.conversationDetails &&
    prev.conversationKind === next.conversationKind &&
    prev.hideIncomingSenderMeta === next.hideIncomingSenderMeta &&
    prev.savedMessageIds === next.savedMessageIds &&
    prev.sendProgressByMessageId === next.sendProgressByMessageId &&
    prev.sendProgressByMessageId?.[prev.message.id] === next.sendProgressByMessageId?.[next.message.id]
  );
}

const MessageRow = memo(function MessageRow({
  message,
  replyTarget = null,
  isHighlighted,
  currentUserId,
  highlightTerm,
  conversationId,
  expandedThreadMessageId,
  editingId,
  editDraft,
  editSaving = false,
  onEditDraftChange,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onAddReaction,
  onReplyMessage,
  onAiReplyMessage,
  aiReplyLoadingMessageId = null,
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
    bubbleHasMediaCaption ? 'inline-flex w-fit max-w-full flex-col overflow-hidden p-0' : 'inline-block w-fit max-w-full px-3.5 py-2.5'
  } rounded-[18px] text-sm leading-relaxed transition-shadow duration-150 ${
    message.isOwn
      ? 'self-end border border-white/12 bg-app-message-out text-app-message-out-text shadow-sm shadow-black/15'
      : 'self-start border border-app-border-subtle bg-app-message-in text-app-text shadow-sm shadow-black/[0.03] dark:shadow-black/20'
  }`;
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
          <div className={`flex flex-col gap-1 ${message.isOwn ? 'items-end' : 'items-start'}`}>
            <div className={bubbleClassName + " p-0 overflow-hidden grid"}>
              {/* Invisible div to perfectly size the parent bubble */}
              <div className="invisible col-start-1 row-start-1 min-w-[200px] whitespace-pre-wrap break-words px-3.5 py-2 text-sm leading-relaxed">
                {editDraft + ' '}
              </div>
              <textarea
                value={editDraft}
                onChange={(event) => onEditDraftChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    event.preventDefault();
                    onCancelEdit();
                    return;
                  }

                  if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                    event.preventDefault();
                    void onSaveEdit();
                  }
                }}
                className="col-start-1 row-start-1 h-full w-full resize-none bg-transparent px-3.5 py-2 text-sm leading-relaxed text-inherit outline-none overflow-hidden"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg px-3 py-1.5 text-xs text-app-muted hover:bg-app-chat-hover transition-colors"
                onClick={onCancelEdit}
                disabled={editSaving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg bg-accent/80 hover:bg-accent px-3 py-1.5 text-xs font-medium text-white transition-colors disabled:opacity-60"
                onClick={() => {
                  void onSaveEdit();
                }}
                disabled={editSaving || !editDraft.trim()}
              >
                {editSaving ? 'Saving…' : 'Save'}
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
                </div>
              ) : (
                <div className={bubbleClassName}>
                  <MessageContent
                    message={message}
                    highlightTerm={highlightTerm}
                    compact={isTextOnly && !message.isOwn}
                    currentUserId={currentUserId}
                    {...mediaSendProps}
                    onVotePoll={
                      onVotePoll ? (optionId) => onVotePoll(message.id, optionId) : undefined
                    }
                  />
                </div>
              )}

              <MessageTimeFooter {...timeInlineProps} />

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
              className={`glass-panel mb-1 flex shrink-0 items-center gap-0.5 rounded-xl border border-app-border/60 px-1 py-0.5 shadow-lg opacity-0 transition-all duration-200 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 ${
                message.isOwn ? 'flex-row-reverse' : 'flex-row'
              }`}
            >
              {!isSending ? (
                <ReactionPicker
                  align={message.isOwn ? 'right' : 'left'}
                  onSelect={(emoji) => onAddReaction(message.id, emoji)}
                />
              ) : null}
              {!isSending && message.content.trim() !== 'This message was deleted.' ? (
                <MessageHoverAction
                  label="Reply"
                  title="Reply"
                  onClick={() => onReplyMessage(message.id)}
                >
                  <FiCornerUpLeft className="text-sm" aria-hidden />
                </MessageHoverAction>
              ) : null}
              {!isSending && onAiReplyMessage && canGenerateAiReply(message) ? (
                <MessageHoverAction
                  label="Reply with AI"
                  title="Reply with AI"
                  busy={aiReplyLoadingMessageId === message.id}
                  disabled={Boolean(aiReplyLoadingMessageId && aiReplyLoadingMessageId !== message.id)}
                  onClick={() => onAiReplyMessage(message.id)}
                >
                  <EnhanceSparkleIcon className="h-[15px] w-[15px]" />
                </MessageHoverAction>
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
}, areMessageRowPropsEqual);

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
  initialScrollSnapshot?: ConversationScrollSnapshot | null;
  onSaveScrollPosition?: (snapshot: ConversationScrollSnapshot) => void;
  hasMoreOlder?: boolean;
  loadingOlder?: boolean;
  onLoadOlder?: () => void;
  unreadAnchorMessageId?: string | null;
  onScrollToMessageComplete?: (messageId: string) => void;
  currentUserId: string | null;
  onAddReaction: (messageId: string, emoji: string) => void;
  onReplyMessage: (messageId: string) => void;
  onAiReplyMessage?: (messageId: string) => void;
  aiReplyLoadingMessageId?: string | null;
  onReplyInThread: (messageId: string) => void;
  onJumpToMessage?: (messageId: string) => void;
  onEditMessage: (messageId: string, content: string) => void | Promise<boolean>;
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
  initialScrollSnapshot = null,
  onSaveScrollPosition,
  hasMoreOlder = false,
  loadingOlder = false,
  onLoadOlder,
  unreadAnchorMessageId = null,
  onScrollToMessageComplete,
  currentUserId,
  onAddReaction,
  onReplyMessage,
  onAiReplyMessage,
  aiReplyLoadingMessageId = null,
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
  sendProgressByMessageId = {},
  peerBlockedByCurrentUser = false,
}: MessageListProps) {
  perfRecordRender('MessageList');
  const virtualListEnabled = isMessageListVirtualizationEnabled();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const editingOriginalRef = useRef('');
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
  const restoredScrollForConversationRef = useRef<string | null>(null);
  const completedScrollTargetRef = useRef<string | null>(null);
  const completedScrollRequestKeyRef = useRef(0);
  const virtuosoRef = useRef<VirtuosoHandle | null>(null);
  const loadOlderStartReachedRef = useRef(false);
  const virtuosoAutoscrollLastAtRef = useRef(0);
  const listEntriesFirstKeyRef = useRef<string | null>(null);
  const listEntriesLengthRef = useRef(0);
  const [virtuosoFirstItemIndex, setVirtuosoFirstItemIndex] = useState(
    VIRTUOSO_BASE_FIRST_ITEM_INDEX,
  );
  const showInitialLoading = loading && messages.length === 0;

  useEffect(() => {
    completedScrollTargetRef.current = null;
    completedScrollRequestKeyRef.current = 0;
    lastMessageIdRef.current = null;
    loadOlderScrollSnapshotRef.current = null;
    loadOlderStartReachedRef.current = false;
    listEntriesFirstKeyRef.current = null;
    listEntriesLengthRef.current = 0;
    restoredScrollForConversationRef.current = null;
    stickToBottomRef.current = true;
    suppressAutoScrollRef.current = false;
    setVirtuosoFirstItemIndex(VIRTUOSO_BASE_FIRST_ITEM_INDEX);
  }, [conversationId]);

  useEffect(() => {
    const urls: string[] = [];
    for (const message of messages) {
      for (const item of message.media ?? []) {
        if (item.url) {
          urls.push(item.url);
        }
        if (item.previewUrl && item.previewUrl !== item.url) {
          urls.push(item.previewUrl);
        }
      }
    }
    prefetchAuthenticatedMediaUrls(urls);
  }, [messages]);

  const persistScrollPosition = useCallback(() => {
    if (!conversationId || !onSaveScrollPosition) {
      return;
    }

    const container = scrollContainerRef.current;
    if (!container) {
      return;
    }

    onSaveScrollPosition({
      scrollTop: container.scrollTop,
      stickToBottom: stickToBottomRef.current,
    });
  }, [conversationId, onSaveScrollPosition]);
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

  const virtuosoMountScrollTop = useMemo(() => {
    if (!virtualListEnabled) {
      return undefined;
    }

    if (scrollToMessageId || pendingScrollToMessageId) {
      return undefined;
    }

    if (initialScrollSnapshot && !initialScrollSnapshot.stickToBottom) {
      return initialScrollSnapshot.scrollTop;
    }

    return undefined;
  }, [
    initialScrollSnapshot,
    pendingScrollToMessageId,
    scrollToMessageId,
    virtualListEnabled,
  ]);

  const virtuosoAlignToBottom = virtuosoMountScrollTop === undefined;

  const requestStickToBottomIfNeeded = useCallback(() => {
    if (suppressAutoScrollRef.current || pendingScrollToMessageId || scrollToMessageId) {
      return;
    }

    if (!stickToBottomRef.current) {
      return;
    }

    const now = performance.now();
    if (now - virtuosoAutoscrollLastAtRef.current < VIRTUOSO_AUTOSCROLL_MIN_INTERVAL_MS) {
      return;
    }

    virtuosoAutoscrollLastAtRef.current = now;
    virtuosoRef.current?.autoscrollToBottom();
  }, [pendingScrollToMessageId, scrollToMessageId]);

  useEffect(() => {
    if (!virtualListEnabled) {
      registerMessageListVirtuosoLayoutSync(null);
      return;
    }

    registerMessageListVirtuosoLayoutSync(requestStickToBottomIfNeeded);
    return () => registerMessageListVirtuosoLayoutSync(null);
  }, [requestStickToBottomIfNeeded, virtualListEnabled]);

  useEffect(() => {
    if (!virtualListEnabled || !editingId) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      requestStickToBottomIfNeeded();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [editingId, requestStickToBottomIfNeeded, virtualListEnabled]);

  useEffect(() => {
    if (!virtualListEnabled) {
      return;
    }

    const nextFirstKey = listEntries[0]?.key ?? null;
    const previousFirstKey = listEntriesFirstKeyRef.current;
    const previousLength = listEntriesLengthRef.current;
    const nextLength = listEntries.length;

    if (
      nextLength > previousLength &&
      previousFirstKey &&
      nextFirstKey &&
      previousFirstKey !== nextFirstKey
    ) {
      const prependedCount = nextLength - previousLength;
      setVirtuosoFirstItemIndex((current) => current - prependedCount);
    }

    listEntriesFirstKeyRef.current = nextFirstKey;
    listEntriesLengthRef.current = nextLength;
  }, [listEntries, virtualListEnabled]);

  useEffect(() => {
    if (!loadingOlder) {
      loadOlderStartReachedRef.current = false;
    }
  }, [loadingOlder]);

  const replyTargetByMessageId = useMemo(() => {
    const map = new Map<string, MessageItem | null>();

    for (const message of messages) {
      if (message.replyToMessage || message.replyToMessageId) {
        map.set(message.id, resolveReplyTarget(message, messages));
      }
    }

    return map;
  }, [messages]);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'auto') => {
    if (suppressAutoScrollRef.current || pendingScrollToMessageId || scrollToMessageId) {
      return;
    }

    if (virtualListEnabled && virtuosoRef.current) {
      virtuosoRef.current.scrollToIndex({
        index: 'LAST',
        align: 'end',
        behavior,
      });
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
  }, [pendingScrollToMessageId, scrollToMessageId, virtualListEnabled]);

  useEffect(() => {
    const scrollTargetId = scrollToMessageId ?? pendingScrollToMessageId;

    if (!scrollTargetId || showInitialLoading) {
      return;
    }

    if (
      completedScrollTargetRef.current === scrollTargetId &&
      completedScrollRequestKeyRef.current === scrollRequestKey
    ) {
      return;
    }

    let attempts = 0;
    let frame = 0;
    const maxAttempts = 96;

    const completeJumpScroll = () => {
      stickToBottomRef.current = false;
      suppressAutoScrollRef.current = true;
      completedScrollTargetRef.current = scrollTargetId;
      completedScrollRequestKeyRef.current = scrollRequestKey;
      lastMessageIdRef.current = messages[messages.length - 1]?.id ?? null;
      onScrollToMessageComplete?.(scrollTargetId);
    };

    const tryScroll = () => {
      if (virtualListEnabled) {
        const entryIndex = findMessageEntryIndex(listEntries, scrollTargetId);
        const handle = virtuosoRef.current;

        if (entryIndex >= 0 && handle) {
          handle.scrollToIndex({
            index: entryIndex,
            align: 'center',
            behavior: 'auto',
          });
          completeJumpScroll();
          return;
        }

        attempts += 1;
        if (attempts < maxAttempts) {
          frame = window.requestAnimationFrame(tryScroll);
        }

        return;
      }

      const container = scrollContainerRef.current;
      const element = container?.querySelector(`[data-message-id="${scrollTargetId}"]`);

      if (container && element instanceof HTMLElement) {
        const elementTop =
          element.getBoundingClientRect().top -
          container.getBoundingClientRect().top +
          container.scrollTop;
        const targetTop =
          elementTop - container.clientHeight / 2 + element.getBoundingClientRect().height / 2;

        container.scrollTop = Math.max(
          0,
          Math.min(targetTop, container.scrollHeight - container.clientHeight),
        );
        completeJumpScroll();
        return;
      }

      attempts += 1;
      if (attempts < maxAttempts) {
        frame = window.requestAnimationFrame(tryScroll);
      }
    };

    frame = window.requestAnimationFrame(tryScroll);

    return () => window.cancelAnimationFrame(frame);
  }, [
    listEntries,
    messages,
    onScrollToMessageComplete,
    pendingScrollToMessageId,
    scrollRequestKey,
    scrollToMessageId,
    showInitialLoading,
    virtualListEnabled,
  ]);

  useEffect(() => {
    if (pendingScrollToMessageId) {
      stickToBottomRef.current = false;
      suppressAutoScrollRef.current = true;
      return;
    }

    if (scrollToMessageId) {
      stickToBottomRef.current = false;
      suppressAutoScrollRef.current = true;
      return;
    }

    if (initialScrollSnapshot && !initialScrollSnapshot.stickToBottom) {
      stickToBottomRef.current = false;
      suppressAutoScrollRef.current = false;
      return;
    }

    if (initialScrollSnapshot?.stickToBottom) {
      stickToBottomRef.current = true;
      suppressAutoScrollRef.current = false;
      return;
    }

    if (completedScrollTargetRef.current) {
      stickToBottomRef.current = false;
      suppressAutoScrollRef.current = true;
      return;
    }

    stickToBottomRef.current = true;
    suppressAutoScrollRef.current = false;
  }, [initialScrollSnapshot, pendingScrollToMessageId, scrollToMessageId]);

  useEffect(() => {
    return () => {
      persistScrollPosition();
    };
  }, [conversationId, persistScrollPosition]);

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
      if (virtualListEnabled) {
        if (!pendingScrollToMessageId && !suppressAutoScrollRef.current) {
          persistScrollPosition();
        }
        return;
      }

      if (suppressAutoScrollRef.current || pendingScrollToMessageId) {
        return;
      }

      if (container.scrollHeight <= container.clientHeight + 1) {
        stickToBottomRef.current = true;
        return;
      }

      const distanceFromBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight;
      stickToBottomRef.current = distanceFromBottom < STICK_TO_BOTTOM_THRESHOLD_PX;
      persistScrollPosition();

      if (
        onLoadOlder &&
        hasMoreOlder &&
        !loadingOlder &&
        container.scrollTop < LOAD_OLDER_TOP_THRESHOLD_PX &&
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
  }, [
    hasMoreOlder,
    loadingOlder,
    onLoadOlder,
    pendingScrollToMessageId,
    persistScrollPosition,
    virtualListEnabled,
  ]);

  useEffect(() => {
    const container = scrollContainerRef.current;

    if (
      !container ||
      !onLoadOlder ||
      !hasMoreOlder ||
      loadingOlder ||
      showInitialLoading ||
      pendingScrollToMessageId ||
      suppressAutoScrollRef.current
    ) {
      return;
    }

    if (virtualListEnabled) {
      if (loadOlderStartReachedRef.current) {
        return;
      }

      if (container.scrollHeight <= container.clientHeight + 8) {
        loadOlderStartReachedRef.current = true;
        onLoadOlder();
      }

      return;
    }

    if (loadOlderScrollSnapshotRef.current) {
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
    virtualListEnabled,
  ]);

  useEffect(() => {
    if (virtualListEnabled) {
      return;
    }

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
  }, [loadingOlder, messages, virtualListEnabled]);

  useEffect(() => {
    if (showInitialLoading || messages.length === 0) {
      return;
    }

    const lastMessage = messages[messages.length - 1];
    const lastId = lastMessage?.id ?? null;
    const previousLastId = lastMessageIdRef.current;
    const isInitialLoad = previousLastId === null;
    const appendedNewMessage = Boolean(lastId && previousLastId && lastId !== previousLastId);

    const shouldRestoreScroll =
      isInitialLoad &&
      !pendingScrollToMessageId &&
      !scrollToMessageId &&
      !completedScrollTargetRef.current &&
      conversationId &&
      restoredScrollForConversationRef.current !== conversationId &&
      initialScrollSnapshot &&
      Number.isFinite(initialScrollSnapshot.scrollTop) &&
      !initialScrollSnapshot.stickToBottom;

    if (shouldRestoreScroll) {
      restoredScrollForConversationRef.current = conversationId;
      lastMessageIdRef.current = lastId;
      stickToBottomRef.current = false;
      suppressAutoScrollRef.current = true;

      if (virtualListEnabled && virtuosoMountScrollTop !== undefined) {
        window.setTimeout(() => {
          suppressAutoScrollRef.current = false;
        }, 250);
        return;
      }

      const targetTop = initialScrollSnapshot.scrollTop;
      let innerFrame = 0;
      const outerFrame = window.requestAnimationFrame(() => {
        innerFrame = window.requestAnimationFrame(() => {
          if (virtualListEnabled && virtuosoRef.current) {
            virtuosoRef.current.scrollTo({ top: targetTop });
          } else {
            const container = scrollContainerRef.current;
            if (container) {
              const maxTop = Math.max(0, container.scrollHeight - container.clientHeight);
              container.scrollTop = Math.min(targetTop, maxTop);
            }
          }
          window.setTimeout(() => {
            suppressAutoScrollRef.current = false;
          }, 250);
        });
      });

      return () => {
        window.cancelAnimationFrame(outerFrame);
        window.cancelAnimationFrame(innerFrame);
      };
    }

    if (virtualListEnabled) {
      lastMessageIdRef.current = lastId;
      return;
    }

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
      (isInitialLoad && !pendingScrollToMessageId && !scrollToMessageId && !completedScrollTargetRef.current) ||
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
    initialScrollSnapshot,
    messages,
    pendingScrollToMessageId,
    scrollRestoreKey,
    scrollToBottom,
    scrollToMessageId,
    showInitialLoading,
    virtualListEnabled,
    virtuosoMountScrollTop,
  ]);

  const handleAtBottomStateChange = useCallback(
    (atBottom: boolean) => {
      if (suppressAutoScrollRef.current || pendingScrollToMessageId) {
        return;
      }

      stickToBottomRef.current = atBottom;
      persistScrollPosition();
    },
    [pendingScrollToMessageId, persistScrollPosition],
  );

  const handleFollowOutput = useCallback(
    (isAtBottom: boolean): FollowOutputScalarType => {
      if (suppressAutoScrollRef.current || pendingScrollToMessageId || scrollToMessageId) {
        return false;
      }

      const lastMessage = messages[messages.length - 1];
      const isOwnNewMessage =
        lastMessage?.isOwn === true ||
        lastMessage?.id.startsWith('local-') ||
        (lastMessage ? isAppearingMessage(lastMessage) && lastMessage.isOwn : false);

      if (isOwnNewMessage) {
        stickToBottomRef.current = true;
        return 'smooth';
      }

      if (isAtBottom || stickToBottomRef.current) {
        return 'auto';
      }

      return false;
    },
    [messages, pendingScrollToMessageId, scrollToMessageId],
  );

  const handleStartReached = useCallback(() => {
    if (
      !onLoadOlder ||
      !hasMoreOlder ||
      loadingOlder ||
      loadOlderStartReachedRef.current ||
      pendingScrollToMessageId ||
      suppressAutoScrollRef.current
    ) {
      return;
    }

    loadOlderStartReachedRef.current = true;
    onLoadOlder();
  }, [hasMoreOlder, loadingOlder, onLoadOlder, pendingScrollToMessageId]);

  const handleTotalListHeightChanged = useCallback(() => {
    requestStickToBottomIfNeeded();
  }, [requestStickToBottomIfNeeded]);

  const publishMessageListEntryGauges = useCallback(() => {
    if (!isPerfEnabled()) {
      return;
    }

    perfSetGauge('messageList:totalEntries', listEntries.length);
    perfSetGauge('messageList:mountedMessageRows', countMessageRowsInScroller(scrollContainerRef.current));
  }, [listEntries.length]);

  useEffect(() => {
    if (!isPerfEnabled() || showInitialLoading || messages.length === 0) {
      return;
    }

    let innerFrame = 0;
    const outerFrame = window.requestAnimationFrame(() => {
      innerFrame = window.requestAnimationFrame(() => {
        publishMessageListEntryGauges();
      });
    });

    return () => {
      window.cancelAnimationFrame(outerFrame);
      window.cancelAnimationFrame(innerFrame);
    };
  }, [
    conversationId,
    editingId,
    listEntries,
    loadingOlder,
    messages.length,
    publishMessageListEntryGauges,
    showInitialLoading,
    virtualListEnabled,
  ]);

  const handleRangeChanged = useCallback(
    (range: ListRange) => {
      if (!isPerfEnabled() || !virtualListEnabled) {
        return;
      }

      const visible = Math.max(0, range.endIndex - range.startIndex + 1);
      perfSetGauge('messageList:virtuosoVisibleRows', visible);
      publishMessageListEntryGauges();
    },
    [publishMessageListEntryGauges, virtualListEnabled],
  );

  const startEdit = useCallback((message: MessageItem) => {
    setEditingId(message.id);
    setEditDraft(message.content);
    editingOriginalRef.current = message.content;
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditDraft('');
    editingOriginalRef.current = '';
  }, []);

  const saveEdit = useCallback(async () => {
    if (!editingId || editSaving) {
      return;
    }

    const nextContent = editDraft.trim();

    if (!nextContent) {
      return;
    }

    if (nextContent === editingOriginalRef.current.trim()) {
      setEditingId(null);
      setEditDraft('');
      editingOriginalRef.current = '';
      return;
    }

    setEditSaving(true);

    try {
      const result = await onEditMessage(editingId, nextContent);
      if (result === false) {
        return;
      }

      setEditingId(null);
      setEditDraft('');
      editingOriginalRef.current = '';
    } finally {
      setEditSaving(false);
    }
  }, [editDraft, editSaving, editingId, onEditMessage]);

  const renderListEntry = useCallback(
    (entry: MessageListEntry) => {
      if (entry.kind === 'date') {
        return <DateDivider label={entry.label} />;
      }

      if (entry.kind === 'unread') {
        return <UnreadDivider />;
      }

      const message = entry.message;

      return (
        <MessageRow
          message={message}
          replyTarget={replyTargetByMessageId.get(message.id) ?? null}
          isHighlighted={highlightedMessageIds.includes(message.id)}
          currentUserId={currentUserId}
          highlightTerm={highlightTerm}
          conversationId={conversationId}
          expandedThreadMessageId={expandedThreadMessageId}
          editingId={editingId}
          editDraft={editDraft}
          editSaving={editSaving}
          onEditDraftChange={setEditDraft}
          onStartEdit={startEdit}
          onCancelEdit={cancelEdit}
          onSaveEdit={saveEdit}
          onAddReaction={onAddReaction}
          onReplyMessage={onReplyMessage}
          onAiReplyMessage={onAiReplyMessage}
          aiReplyLoadingMessageId={aiReplyLoadingMessageId}
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
    },
    [
      aiReplyLoadingMessageId,
      allowMessageAppear,
      conversationDetails,
      conversationId,
      conversationKind,
      currentUserId,
      editDraft,
      editSaving,
      editingId,
      expandedThreadMessageId,
      hideIncomingSenderMeta,
      highlightTerm,
      highlightedMessageIds,
      onAddReaction,
      onAiReplyMessage,
      onDeleteMessage,
      onEditMessage,
      onForwardMessage,
      onJumpToMessage,
      onPinMessage,
      onReplyInThread,
      onReplyMessage,
      onRetryMessage,
      onSaveMessage,
      onSendThreadMessage,
      onUnsaveMessage,
      onVotePoll,
      replyTargetByMessageId,
      savedMessageIds,
      saveEdit,
      setEditDraft,
      sendProgressByMessageId,
      showReactionAuthors,
      startEdit,
      cancelEdit,
      threadsEnabled,
    ],
  );

  const virtuosoComponents = useMemo((): Components<MessageListEntry> => {
    return {
      Scroller: messageListVirtuosoScroller,
      List: messageListVirtuosoList,
      Item: MessageListVirtuosoItem,
      Header: () =>
        loadingOlder ? (
          <div
            className="box-border flex w-full max-w-full justify-center px-6 py-2 text-xs text-app-muted"
            role="status"
          >
            Loading earlier messages…
          </div>
        ) : null,
      Footer: () => (
        <div className="box-border w-full max-w-full px-6">
          {peerBlockedByCurrentUser ? <BlockedByYouDivider key="blocked-by-you" /> : null}
          <div ref={bottomAnchorRef} aria-hidden="true" className="h-px shrink-0" />
        </div>
      ),
    };
  }, [loadingOlder, peerBlockedByCurrentUser]);

  const attachScrollContainerRef = useCallback((ref: HTMLElement | null) => {
    scrollContainerRef.current = ref instanceof HTMLDivElement ? ref : null;
  }, []);

  const virtuosoItemContent = useCallback(
    (_index: number, entry: MessageListEntry) => (
      <div className="box-border w-full min-w-0 max-w-full px-6 pb-2.5">{renderListEntry(entry)}</div>
    ),
    [renderListEntry],
  );

  const virtuosoInitialTopIndex = useMemo(() => {
    if (virtuosoMountScrollTop !== undefined) {
      return 0;
    }

    return Math.max(0, listEntries.length - 1);
  }, [listEntries.length, virtuosoMountScrollTop]);

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
      {showRefreshing ? (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-10 h-0.5 overflow-hidden bg-app-border"
          aria-hidden="true"
        >
          <div className="h-full w-1/3 animate-[shimmer_1s_ease-in-out_infinite] bg-accent/70" />
        </div>
      ) : null}

      {virtualListEnabled ? (
        <Virtuoso
          key={conversationId ?? 'message-list'}
          ref={virtuosoRef}
          className="flex min-h-0 min-w-0 w-full flex-1 flex-col"
          style={{ minHeight: 0, height: '100%', width: '100%', maxWidth: '100%' }}
          data={listEntries}
          firstItemIndex={virtuosoFirstItemIndex}
          computeItemKey={(_index, entry) => entry.key}
          components={virtuosoComponents}
          scrollerRef={attachScrollContainerRef}
          initialTopMostItemIndex={virtuosoInitialTopIndex}
          initialScrollTop={virtuosoMountScrollTop}
          alignToBottom={virtuosoAlignToBottom}
          atBottomThreshold={STICK_TO_BOTTOM_THRESHOLD_PX}
          atBottomStateChange={handleAtBottomStateChange}
          followOutput={handleFollowOutput}
          startReached={handleStartReached}
          totalListHeightChanged={handleTotalListHeightChanged}
          rangeChanged={handleRangeChanged}
          defaultItemHeight={80}
          increaseViewportBy={{ top: 320, bottom: 480 }}
          itemContent={virtuosoItemContent}
        />
      ) : (
        <div
          ref={scrollContainerRef}
          className="message-list-scroll flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-6 py-4"
        >
          <div ref={contentRef} className="flex flex-col gap-2.5">
            {loadingOlder ? (
              <div className="flex justify-center py-2 text-xs text-app-muted" role="status">
                Loading earlier messages…
              </div>
            ) : null}
            {listEntries.map((entry) => (
              <div key={entry.key}>{renderListEntry(entry)}</div>
            ))}
            {peerBlockedByCurrentUser ? <BlockedByYouDivider key="blocked-by-you" /> : null}
            <div ref={bottomAnchorRef} aria-hidden="true" className="h-px shrink-0" />
          </div>
        </div>
      )}
    </MessageListSurface>
  );
}
