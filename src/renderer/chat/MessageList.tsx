import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
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
  isCalendarEventAnnouncementMessage,
  parseCalendarEventAnnouncementContent,
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
import { formatMessageDayDivider, formatMessageTimestamp, messageDayKey } from './format';
import { Avatar, EnhanceSparkleIcon } from './ChatIcons';
import { MessageMenu } from './MessageMenu';
import { ReactionChip } from './ReactionChip';
import { ReactionPicker } from './ReactionPicker';
import { MessageContent, MessageReplyPreview } from './MessageContent';
import {
  normalizeConversationScrollSnapshot,
  type ConversationScrollSnapshot,
} from '../conversationScrollCache';
import { JumpToLatestButton } from './JumpToLatestButton';
import { ChatTypingIndicator } from './ChatTypingIndicator';
import type { ChatTypingParticipant } from '../features/chat/lib/chatPageHelpers';
import { canEditMessage, isTextSelectionContext } from '../../shared/messageComposer';
import { MessageContextMenu } from './MessageContextMenu';
import { buildMessageContextMenuItems } from './messageContextMenuItems';
import { useToast } from '../ui/Toast';
import { CalendarEventMessage } from './CalendarEventMessage';
import { countMessagesBelowAnchor } from './messageListNewBelow';
import {
  STICK_TO_BOTTOM_THRESHOLD_PX,
  VIRTUOSO_AUTOSCROLL_MIN_INTERVAL_MS,
  VIRTUOSO_BASE_FIRST_ITEM_INDEX,
  findMessageEntryIndex,
  firstMessageEntryId,
  resolveScrollRestoreTarget,
  virtuosoDataIndex,
} from './messageListScroll';

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

const LOAD_OLDER_TOP_THRESHOLD_PX = 120;

function countMessageRowsInScroller(container: HTMLElement | null): number {
  if (!container) {
    return 0;
  }

  return container.querySelectorAll('[data-message-id]').length;
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
  onOpenComposerEdit?: (message: MessageItem) => void;
  onMessageContextMenu?: (
    message: MessageItem,
    position: { top: number; left: number },
    selectedText: string | null,
  ) => void;
  onAddReaction: (messageId: string, emoji: string) => void;
  onReplyMessage: (messageId: string) => void;
  onAiReplyMessage?: (messageId: string) => void;
  aiReplyLoadingMessageId?: string | null;
  onReplyInThread: (messageId: string) => void;
  onJumpToMessage?: (messageId: string) => void;
  onEditMessage: (
    messageId: string,
    content: string,
    options?: { keptMedia?: MessageItem['media']; addedFile?: File | null },
  ) => void | Promise<boolean>;
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
  onViewCalendarEvent?: (eventId: string) => void;
  memberProfilePopupEnabled?: boolean;
  pollVotingMessageId?: string | null;
  onOpenMemberProfile?: (
    anchor: {
      userId: string;
      displayName: string;
      avatarUrl?: string | null;
      avatarInitials?: string;
    },
    position: { top: number; left: number },
  ) => void;
  onProfileImageClick?: (imageUrl: string) => void;
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

  if (isCalendarEventAnnouncementMessage(message)) {
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
      {message.createdAt ? formatMessageTimestamp(message.createdAt) : null}
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
    prev.aiReplyLoadingMessageId === next.aiReplyLoadingMessageId &&
    prev.threadsEnabled === next.threadsEnabled &&
    prev.showReactionAuthors === next.showReactionAuthors &&
    prev.allowMessageAppear === next.allowMessageAppear &&
    prev.conversationDetails === next.conversationDetails &&
    prev.conversationKind === next.conversationKind &&
    prev.hideIncomingSenderMeta === next.hideIncomingSenderMeta &&
    prev.savedMessageIds === next.savedMessageIds &&
    prev.sendProgressByMessageId === next.sendProgressByMessageId &&
    prev.sendProgressByMessageId?.[prev.message.id] === next.sendProgressByMessageId?.[next.message.id] &&
    prev.onViewCalendarEvent === next.onViewCalendarEvent &&
    prev.memberProfilePopupEnabled === next.memberProfilePopupEnabled &&
    prev.onOpenMemberProfile === next.onOpenMemberProfile
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
  onOpenComposerEdit,
  onMessageContextMenu,
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
  pollVotingMessageId = null,
  onViewCalendarEvent,
  memberProfilePopupEnabled = false,
  onOpenMemberProfile,
  onProfileImageClick,
}: MessageRowProps) {
  const calendarAnnouncement = parseCalendarEventAnnouncementContent(message.content);
  if (calendarAnnouncement) {
    return (
      <div data-message-id={message.id} className="flex w-full justify-center px-2 py-2.5">
        <CalendarEventMessage event={calendarAnnouncement} onViewEvent={onViewCalendarEvent} />
      </div>
    );
  }

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
  const isPoll = isPollMessage(message);
  const isCallLog = isCallLogMessage(message);
  const isCalendarAnnouncement = isCalendarEventAnnouncementMessage(message);
  const isMediaOnly =
    !isPoll &&
    !isCallLog &&
    !isCalendarAnnouncement &&
    (isMediaOnlyMessage(message) || isVoiceOnlyMessage(message));
  const hasMedia = (message.media?.length ?? 0) > 0;
  const isTextOnly = !isPoll && !isCallLog && !isCalendarAnnouncement && !isMediaOnly && !hasMedia;
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

  const openMemberProfile = (event: MouseEvent<HTMLElement>) => {
    if (!memberProfilePopupEnabled || !onOpenMemberProfile) {
      return;
    }

    const senderId = message.senderId?.trim();
    if (!senderId || senderId === currentUserId) {
      return;
    }

    event.stopPropagation();
    event.preventDefault();

    onOpenMemberProfile(
      {
        userId: senderId,
        displayName: message.senderName?.trim() || senderId,
        avatarUrl: message.senderAvatarUrl ?? null,
        avatarInitials: message.senderInitials,
      },
      { top: event.clientY, left: event.clientX },
    );
  };

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
      tabIndex={0}
      className={`message-row group flex ${showIncomingSenderMeta ? 'gap-3' : 'gap-0'} ${message.isOwn ? 'flex-row-reverse' : 'flex-row'} ${
        allowMessageAppear && isAppearingMessage(message)
          ? message.isOwn
            ? 'message-appear message-appear-own'
            : 'message-appear'
          : ''
      } ${message.isOwn && message.status === 'failed' ? 'opacity-80' : ''} ${
        isHighlighted ? 'message-target-highlight rounded-2xl p-2' : ''
      }`}
      onContextMenu={(event) => {
        event.preventDefault();
        const selectedText = isTextSelectionContext(event.target);

        onMessageContextMenu?.(
          message,
          { top: event.clientY, left: event.clientX },
          selectedText,
        );
      }}
      onKeyDown={(event) => {
        if (event.key === 'F10' && event.shiftKey) {
          event.preventDefault();
          const rect = event.currentTarget.getBoundingClientRect();

          onMessageContextMenu?.(
            message,
            { top: rect.top + rect.height / 2, left: rect.left + rect.width / 2 },
            null,
          );
        }
      }}
    >
      {showIncomingSenderMeta ? (
        <div className="shrink-0">
          <Avatar
            imageUrl={message.senderAvatarUrl ?? null}
            initials={message.senderInitials}
            size="sm"
            onImageClick={onProfileImageClick}
            imagePreviewLabel={
              message.senderName ? `View ${message.senderName}'s profile photo` : 'View profile photo'
            }
          />
        </div>
      ) : null}
      <div className={`flex max-w-[70%] flex-col ${message.isOwn ? 'items-end' : 'items-start'}`}>
        {showIncomingSenderMeta ? (
          memberProfilePopupEnabled && onOpenMemberProfile ? (
            <button
              type="button"
              className="mb-1 cursor-pointer text-left text-xs font-semibold text-app-muted transition-colors hover:text-app-text"
              onClick={openMemberProfile}
            >
              {message.senderName}
            </button>
          ) : (
            <p className="mb-1 text-xs font-semibold text-app-muted">{message.senderName}</p>
          )
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
                    pollDisabled={pollVotingMessageId === message.id}
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
                    pollDisabled={pollVotingMessageId === message.id}
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
              className={`mb-1 flex shrink-0 items-center gap-0.5 rounded-xl border border-app-border/70 bg-app-elevated px-1 py-0.5 shadow-lg opacity-0 transition-all duration-200 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 ${
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
                canEdit={canEditMessage(message, currentUserId)}
                isPinned={isPinned}
                isSaved={savedMessageIds.has(message.id)}
                isDeleted={message.content.trim() === 'This message was deleted.'}
                isSending={isSending}
                hasDownloadableMedia={hasDownloadableMedia}
                align={message.isOwn ? 'right' : 'left'}
                showReplyInThread={threadsEnabled}
                onReply={() => onReplyMessage(message.id)}
                onReplyInThread={() => onReplyInThread(message.id)}
                onEdit={() => onOpenComposerEdit?.(message)}
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

        {threadsEnabled && message.threadReplyCount && message.threadReplyCount > 0 ? (
          <div className={`mt-1 flex flex-col ${message.isOwn ? 'items-end' : 'items-start'}`}>
            <button
              type="button"
              className="group/reply flex items-center gap-1.5 text-xs text-accent-soft hover:text-accent transition-colors"
              onClick={() => onReplyInThread(message.id)}
            >
              <FiChevronUp className="text-[10px]" />
              <span className="font-medium">{message.threadReplyCount} {message.threadReplyCount === 1 ? 'reply' : 'replies'} - {formatMessageTimestamp(message.createdAt)}</span>
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
  threadSyncing?: boolean;
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
  onLoadOlder?: () => boolean | void;
  unreadAnchorMessageId?: string | null;
  onScrollToMessageComplete?: (messageId: string) => void;
  currentUserId: string | null;
  onAddReaction: (messageId: string, emoji: string) => void;
  onReplyMessage: (messageId: string) => void;
  onAiReplyMessage?: (messageId: string) => void;
  aiReplyLoadingMessageId?: string | null;
  onReplyInThread: (messageId: string) => void;
  onJumpToMessage?: (messageId: string) => void;
  onOpenComposerEdit?: (message: MessageItem) => void;
  onEditMessage: (
    messageId: string,
    content: string,
    options?: { keptMedia?: MessageItem['media']; addedFile?: File | null },
  ) => void | Promise<boolean>;
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
  pollVotingMessageId?: string | null;
  /** True when the signed-in user blocked the direct-chat peer (not shown to the blocked party). */
  peerBlockedByCurrentUser?: boolean;
  onViewCalendarEvent?: (eventId: string) => void;
  memberProfilePopupEnabled?: boolean;
  onOpenMemberProfile?: (
    anchor: {
      userId: string;
      displayName: string;
      avatarUrl?: string | null;
      avatarInitials?: string;
    },
    position: { top: number; left: number },
  ) => void;
  onProfileImageClick?: (imageUrl: string) => void;
  typingParticipants?: ChatTypingParticipant[];
  /** When true, typing is shown above the composer instead of in the message list footer. */
  suppressTypingIndicator?: boolean;
  onAtBottomChange?: (atBottom: boolean) => void;
};

export function MessageList({
  messages,
  loading,
  threadSyncing = false,
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
  onOpenComposerEdit,
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
  pollVotingMessageId = null,
  peerBlockedByCurrentUser = false,
  onViewCalendarEvent,
  memberProfilePopupEnabled = false,
  onOpenMemberProfile,
  onProfileImageClick,
  typingParticipants = [],
  suppressTypingIndicator = false,
  onAtBottomChange,
}: MessageListProps) {
  perfRecordRender('MessageList');
  const virtualListEnabled = isMessageListVirtualizationEnabled();
  const toast = useToast();

  const [messageContextMenu, setMessageContextMenu] = useState<{
    message: MessageItem;
    position: { top: number; left: number };
    selectedText: string | null;
  } | null>(null);
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
  const loadOlderAnchorMessageIdRef = useRef<string | null>(null);
  const jumpAnchorMessageIdRef = useRef<string | null>(null);
  const topVisibleMessageIdRef = useRef<string | null>(null);
  const virtuosoFirstItemIndexRef = useRef(VIRTUOSO_BASE_FIRST_ITEM_INDEX);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const [newMessagesBelow, setNewMessagesBelow] = useState(0);
  const virtuosoAutoscrollLastAtRef = useRef(0);
  const scrollPersistReadyRef = useRef(false);
  const unreadScrollDoneRef = useRef<string | null>(null);
  const resolvedInitialScrollSnapshot = useMemo(
    () => normalizeConversationScrollSnapshot(initialScrollSnapshot),
    [initialScrollSnapshot],
  );
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
    jumpAnchorMessageIdRef.current = null;
    setShowJumpToLatest(false);
    setNewMessagesBelow(0);
    listEntriesFirstKeyRef.current = null;
    listEntriesLengthRef.current = 0;
    restoredScrollForConversationRef.current = null;
    stickToBottomRef.current = true;
    suppressAutoScrollRef.current = false;
    scrollPersistReadyRef.current = false;
    setVirtuosoFirstItemIndex(VIRTUOSO_BASE_FIRST_ITEM_INDEX);
    virtuosoFirstItemIndexRef.current = VIRTUOSO_BASE_FIRST_ITEM_INDEX;
    topVisibleMessageIdRef.current = null;
    setMessageContextMenu(null);
    unreadScrollDoneRef.current = null;
  }, [conversationId]);

  useEffect(() => {
    const readyTimer = window.setTimeout(() => {
      scrollPersistReadyRef.current = true;
    }, 350);

    return () => window.clearTimeout(readyTimer);
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
    if (!conversationId || !onSaveScrollPosition || !scrollPersistReadyRef.current) {
      return;
    }

    const container = scrollContainerRef.current;
    if (!container) {
      return;
    }

    onSaveScrollPosition({
      scrollTop: container.scrollTop,
      stickToBottom: stickToBottomRef.current,
      anchorMessageId: topVisibleMessageIdRef.current,
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

  const triggerLoadOlder = useCallback(
    (options?: { fromScroll?: boolean }) => {
      if (!onLoadOlder || !hasMoreOlder || loadingOlder) {
        return;
      }

      if (options?.fromScroll && loadOlderStartReachedRef.current) {
        return;
      }

      loadOlderAnchorMessageIdRef.current =
        topVisibleMessageIdRef.current ?? firstMessageEntryId(listEntries);

      const started = onLoadOlder();
      if (options?.fromScroll) {
        loadOlderStartReachedRef.current = started !== false;
      }
    },
    [hasMoreOlder, listEntries, loadingOlder, onLoadOlder],
  );

  const virtuosoMountScrollTop = useMemo(() => {
    if (!virtualListEnabled) {
      return undefined;
    }

    if (scrollToMessageId || pendingScrollToMessageId) {
      return undefined;
    }

    if (resolvedInitialScrollSnapshot && !resolvedInitialScrollSnapshot.stickToBottom) {
      return resolvedInitialScrollSnapshot.scrollTop;
    }

    return undefined;
  }, [
    pendingScrollToMessageId,
    resolvedInitialScrollSnapshot,
    scrollToMessageId,
    virtualListEnabled,
  ]);

  const scrollRestoreTarget = useMemo(
    () => resolveScrollRestoreTarget(resolvedInitialScrollSnapshot, listEntries),
    [listEntries, resolvedInitialScrollSnapshot],
  );

  const openAtUnreadAnchor = Boolean(
    unreadAnchorMessageId &&
      !scrollToMessageId &&
      !pendingScrollToMessageId &&
      (!scrollRestoreTarget || scrollRestoreTarget.mode === 'bottom'),
  );

  const virtuosoAlignToBottom = virtuosoMountScrollTop === undefined && !openAtUnreadAnchor;

  const requestStickToBottomIfNeeded = useCallback(() => {
    if (
      threadSyncing ||
      suppressAutoScrollRef.current ||
      pendingScrollToMessageId ||
      scrollToMessageId
    ) {
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
  }, [pendingScrollToMessageId, scrollToMessageId, threadSyncing]);

  useEffect(() => {
    if (!virtualListEnabled) {
      registerMessageListVirtuosoLayoutSync(null);
      return;
    }

    registerMessageListVirtuosoLayoutSync(requestStickToBottomIfNeeded);
    return () => registerMessageListVirtuosoLayoutSync(null);
  }, [requestStickToBottomIfNeeded, virtualListEnabled]);

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
      setVirtuosoFirstItemIndex((current) => {
        const next = current - prependedCount;
        virtuosoFirstItemIndexRef.current = next;
        return next;
      });
    }

    listEntriesFirstKeyRef.current = nextFirstKey;
    listEntriesLengthRef.current = nextLength;
  }, [listEntries, virtualListEnabled]);

  useEffect(() => {
    if (!loadingOlder) {
      loadOlderStartReachedRef.current = false;
    }
  }, [loadingOlder]);

  useEffect(() => {
    virtuosoFirstItemIndexRef.current = virtuosoFirstItemIndex;
  }, [virtuosoFirstItemIndex]);

  useEffect(() => {
    if (!virtualListEnabled || loadingOlder || !loadOlderAnchorMessageIdRef.current) {
      return;
    }

    const anchorId = loadOlderAnchorMessageIdRef.current;
    loadOlderAnchorMessageIdRef.current = null;

    const entryIndex = findMessageEntryIndex(listEntries, anchorId);
    if (entryIndex < 0 || !virtuosoRef.current) {
      return;
    }

    let innerFrame = 0;
    const outerFrame = window.requestAnimationFrame(() => {
      innerFrame = window.requestAnimationFrame(() => {
        virtuosoRef.current?.scrollToIndex({
          index: entryIndex,
          align: 'start',
          behavior: 'auto',
        });
      });
    });

    return () => {
      window.cancelAnimationFrame(outerFrame);
      window.cancelAnimationFrame(innerFrame);
    };
  }, [listEntries, loadingOlder, virtualListEnabled]);

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
    if (threadSyncing) {
      suppressAutoScrollRef.current = true;
      return;
    }

    let innerFrame = 0;
    const settleTimer = window.setTimeout(() => {
      if (
        pendingScrollToMessageId ||
        scrollToMessageId ||
        unreadAnchorMessageId ||
        (resolvedInitialScrollSnapshot && !resolvedInitialScrollSnapshot.stickToBottom)
      ) {
        suppressAutoScrollRef.current = false;
        return;
      }

      innerFrame = window.requestAnimationFrame(() => {
        suppressAutoScrollRef.current = false;
        if (stickToBottomRef.current) {
          setShowJumpToLatest(false);
          setNewMessagesBelow(0);
          jumpAnchorMessageIdRef.current = null;
          requestStickToBottomIfNeeded();
        }
      });
    }, 120);

    return () => {
      window.clearTimeout(settleTimer);
      window.cancelAnimationFrame(innerFrame);
    };
  }, [
    pendingScrollToMessageId,
    requestStickToBottomIfNeeded,
    resolvedInitialScrollSnapshot,
    scrollToBottom,
    scrollToMessageId,
    threadSyncing,
    unreadAnchorMessageId,
  ]);

  const syncJumpToLatestUi = useCallback(
    (atBottom: boolean) => {
      if (atBottom) {
        setShowJumpToLatest(false);
        jumpAnchorMessageIdRef.current = null;
        setNewMessagesBelow(0);
        return;
      }

      if (!jumpAnchorMessageIdRef.current) {
        jumpAnchorMessageIdRef.current = messages[messages.length - 1]?.id ?? null;
      }

      const below = jumpAnchorMessageIdRef.current
        ? countMessagesBelowAnchor(messages, jumpAnchorMessageIdRef.current)
        : 0;

      setNewMessagesBelow(below);
      setShowJumpToLatest(below > 0);
    },
    [messages],
  );

  useEffect(() => {
    if (!showJumpToLatest || !jumpAnchorMessageIdRef.current) {
      return;
    }

    setNewMessagesBelow(countMessagesBelowAnchor(messages, jumpAnchorMessageIdRef.current));
  }, [messages, showJumpToLatest]);

  const handleJumpToLatest = useCallback(() => {
    jumpAnchorMessageIdRef.current = null;
    setNewMessagesBelow(0);
    setShowJumpToLatest(false);
    stickToBottomRef.current = true;
    suppressAutoScrollRef.current = false;
    scrollToBottom('smooth');
  }, [scrollToBottom]);

  const handleAtBottomStateChange = useCallback(
    (atBottom: boolean) => {
      stickToBottomRef.current = atBottom;
      onAtBottomChange?.(atBottom);

      if (!atBottom) {
        syncJumpToLatestUi(false);
        if (!suppressAutoScrollRef.current && !pendingScrollToMessageId) {
          persistScrollPosition();
        }
        return;
      }

      if (suppressAutoScrollRef.current || pendingScrollToMessageId) {
        return;
      }

      syncJumpToLatestUi(true);
      persistScrollPosition();
    },
    [onAtBottomChange, pendingScrollToMessageId, persistScrollPosition, syncJumpToLatestUi],
  );

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

    if (openAtUnreadAnchor) {
      stickToBottomRef.current = false;
      suppressAutoScrollRef.current = false;
      return;
    }

  if (resolvedInitialScrollSnapshot && !resolvedInitialScrollSnapshot.stickToBottom) {
      stickToBottomRef.current = false;
      suppressAutoScrollRef.current = false;
      return;
    }

    if (resolvedInitialScrollSnapshot?.stickToBottom) {
      stickToBottomRef.current = true;
      suppressAutoScrollRef.current = false;
      return;
    }

    if (completedScrollTargetRef.current) {
      stickToBottomRef.current = false;
      suppressAutoScrollRef.current = false;
      return;
    }

    stickToBottomRef.current = true;
    suppressAutoScrollRef.current = false;
  }, [openAtUnreadAnchor, pendingScrollToMessageId, resolvedInitialScrollSnapshot, scrollToMessageId]);

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

      if (container.scrollHeight <= container.clientHeight + 1) {
        stickToBottomRef.current = true;
        onAtBottomChange?.(true);
        if (!suppressAutoScrollRef.current && !pendingScrollToMessageId) {
          syncJumpToLatestUi(true);
          persistScrollPosition();
        }
        return;
      }

      const distanceFromBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight;
      const atBottom = distanceFromBottom < STICK_TO_BOTTOM_THRESHOLD_PX;
      stickToBottomRef.current = atBottom;
      onAtBottomChange?.(atBottom);

      if (!atBottom) {
        syncJumpToLatestUi(false);
      } else if (!suppressAutoScrollRef.current && !pendingScrollToMessageId) {
        syncJumpToLatestUi(true);
      }

      if (!suppressAutoScrollRef.current && !pendingScrollToMessageId) {
        persistScrollPosition();
      }

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
        triggerLoadOlder({ fromScroll: true });
      }
    };

    container.addEventListener('scroll', onScroll, { passive: true });
    return () => container.removeEventListener('scroll', onScroll);
  }, [
    hasMoreOlder,
    loadingOlder,
    pendingScrollToMessageId,
    persistScrollPosition,
    onAtBottomChange,
    syncJumpToLatestUi,
    triggerLoadOlder,
    virtualListEnabled,
  ]);

  useEffect(() => {
    const container = scrollContainerRef.current;

    if (
      !container ||
      !onLoadOlder ||
      !hasMoreOlder ||
      loadingOlder ||
      threadSyncing ||
      showInitialLoading ||
      pendingScrollToMessageId
    ) {
      return;
    }

    if (virtualListEnabled) {
      if (container.scrollHeight <= container.clientHeight + 8) {
        triggerLoadOlder({ fromScroll: true });
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
      triggerLoadOlder();
    }
  }, [
    hasMoreOlder,
    loadingOlder,
    messages.length,
    onLoadOlder,
    pendingScrollToMessageId,
    showInitialLoading,
    threadSyncing,
    triggerLoadOlder,
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

  useLayoutEffect(() => {
    if (
      showInitialLoading ||
      messages.length === 0 ||
      !conversationId ||
      pendingScrollToMessageId ||
      scrollToMessageId
    ) {
      return;
    }

    if (restoredScrollForConversationRef.current === conversationId) {
      return;
    }

    if (!scrollRestoreTarget || scrollRestoreTarget.mode === 'bottom') {
      return;
    }

    if (scrollRestoreTarget.mode === 'anchor') {
      const entryIndex = findMessageEntryIndex(listEntries, scrollRestoreTarget.messageId);

      if (entryIndex < 0) {
        return;
      }
    }

    restoredScrollForConversationRef.current = conversationId;
    suppressAutoScrollRef.current = true;
    stickToBottomRef.current = false;

    if (scrollRestoreTarget.mode === 'anchor') {
      const entryIndex = findMessageEntryIndex(listEntries, scrollRestoreTarget.messageId);

      if (entryIndex >= 0 && virtualListEnabled && virtuosoRef.current) {
        virtuosoRef.current.scrollToIndex({
          index: entryIndex,
          align: 'start',
          behavior: 'auto',
        });
      } else if (entryIndex >= 0) {
        const container = scrollContainerRef.current;
        const element = container?.querySelector(
          `[data-message-id="${scrollRestoreTarget.messageId}"]`,
        );

        if (container && element instanceof HTMLElement) {
          const elementTop =
            element.getBoundingClientRect().top -
            container.getBoundingClientRect().top +
            container.scrollTop;

          container.scrollTop = Math.max(0, elementTop - 12);
        }
      }
    } else if (scrollRestoreTarget.mode === 'scrollTop') {
      const targetTop = scrollRestoreTarget.scrollTop;

      if (virtualListEnabled && virtuosoRef.current) {
        virtuosoRef.current.scrollTo({ top: targetTop, behavior: 'auto' });
      } else {
        const container = scrollContainerRef.current;

        if (container) {
          const maxTop = Math.max(0, container.scrollHeight - container.clientHeight);
          container.scrollTop = Math.min(targetTop, maxTop);
        }
      }
    }

    lastMessageIdRef.current = messages[messages.length - 1]?.id ?? null;

    const timer = window.setTimeout(() => {
      suppressAutoScrollRef.current = false;
    }, 200);

    return () => window.clearTimeout(timer);
  }, [
    conversationId,
    listEntries,
    messages,
    pendingScrollToMessageId,
    scrollRestoreKey,
    scrollRestoreTarget,
    scrollToMessageId,
    showInitialLoading,
    virtualListEnabled,
  ]);

  useLayoutEffect(() => {
    if (!openAtUnreadAnchor || !unreadAnchorMessageId || showInitialLoading || messages.length === 0) {
      return;
    }

    const token = `${conversationId}:${unreadAnchorMessageId}`;

    if (unreadScrollDoneRef.current === token) {
      return;
    }

    const entryIndex = findMessageEntryIndex(listEntries, unreadAnchorMessageId);

    if (entryIndex < 0) {
      return;
    }

    unreadScrollDoneRef.current = token;
    stickToBottomRef.current = false;
    suppressAutoScrollRef.current = true;

    if (virtualListEnabled && virtuosoRef.current) {
      virtuosoRef.current.scrollToIndex({
        index: entryIndex,
        align: 'center',
        behavior: 'auto',
      });
    } else {
      const container = scrollContainerRef.current;
      const element = container?.querySelector(`[data-message-id="${unreadAnchorMessageId}"]`);

      if (container && element instanceof HTMLElement) {
        const elementTop =
          element.getBoundingClientRect().top -
          container.getBoundingClientRect().top +
          container.scrollTop;

        container.scrollTop = Math.max(0, elementTop - Math.round(container.clientHeight * 0.35));
      }
    }

    lastMessageIdRef.current = messages[messages.length - 1]?.id ?? null;

    const timer = window.setTimeout(() => {
      suppressAutoScrollRef.current = false;
    }, 300);

    return () => window.clearTimeout(timer);
  }, [
    conversationId,
    listEntries,
    messages,
    openAtUnreadAnchor,
    showInitialLoading,
    unreadAnchorMessageId,
    virtualListEnabled,
  ]);

  useEffect(() => {
    if (threadSyncing || !virtualListEnabled || showInitialLoading) {
      return;
    }

    const lastMessage = messages[messages.length - 1];
    const lastId = lastMessage?.id ?? null;
    const previousLastId = lastMessageIdRef.current;

    if (!previousLastId) {
      lastMessageIdRef.current = lastId;
      return;
    }

    if (
      lastId &&
      previousLastId &&
      lastId !== previousLastId &&
      !stickToBottomRef.current &&
      !suppressAutoScrollRef.current &&
      !pendingScrollToMessageId &&
      !scrollToMessageId
    ) {
      syncJumpToLatestUi(false);
    }

    lastMessageIdRef.current = lastId;
  }, [
    messages,
    pendingScrollToMessageId,
    scrollToMessageId,
    showInitialLoading,
    syncJumpToLatestUi,
    virtualListEnabled,
  ]);

  useEffect(() => {
    if (threadSyncing || showInitialLoading || messages.length === 0) {
      return;
    }

    const lastMessage = messages[messages.length - 1];
    const lastId = lastMessage?.id ?? null;
    const previousLastId = lastMessageIdRef.current;
    const isInitialLoad = previousLastId === null;
    const appendedNewMessage = Boolean(lastId && previousLastId && lastId !== previousLastId);

    const shouldRestoreHistoryPosition =
      scrollRestoreTarget != null && scrollRestoreTarget.mode !== 'bottom';

    if (virtualListEnabled) {
      if (isInitialLoad) {
        lastMessageIdRef.current = lastId;
      }

      const shouldPinToBottomOnMount =
        isInitialLoad &&
        !unreadAnchorMessageId &&
        !pendingScrollToMessageId &&
        !scrollToMessageId &&
        !completedScrollTargetRef.current &&
        !shouldRestoreHistoryPosition &&
        stickToBottomRef.current;

      if (shouldPinToBottomOnMount) {
        let innerFrame = 0;
        const outerFrame = window.requestAnimationFrame(() => {
          innerFrame = window.requestAnimationFrame(() => {
            scrollToBottom('auto');
            requestStickToBottomIfNeeded();
          });
        });

        return () => {
          window.cancelAnimationFrame(outerFrame);
          window.cancelAnimationFrame(innerFrame);
        };
      }

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
      (isInitialLoad &&
        !unreadAnchorMessageId &&
        !pendingScrollToMessageId &&
        !scrollToMessageId &&
        !completedScrollTargetRef.current &&
        !shouldRestoreHistoryPosition) ||
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
    requestStickToBottomIfNeeded,
    scrollRestoreTarget,
    scrollToBottom,
    scrollToMessageId,
    showInitialLoading,
    threadSyncing,
    unreadAnchorMessageId,
    virtualListEnabled,
  ]);

  const handleFollowOutput = useCallback(
    (isAtBottom: boolean): FollowOutputScalarType => {
      if (
        threadSyncing ||
        suppressAutoScrollRef.current ||
        pendingScrollToMessageId ||
        scrollToMessageId
      ) {
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

      if (isAtBottom) {
        stickToBottomRef.current = true;
        return 'auto';
      }

      return false;
    },
    [messages, pendingScrollToMessageId, scrollToMessageId, threadSyncing],
  );

  const handleStartReached = useCallback(() => {
    triggerLoadOlder({ fromScroll: true });
  }, [triggerLoadOlder]);

  const handleAtTopStateChange = useCallback(
    (atTop: boolean) => {
      if (!atTop) {
        return;
      }

      handleStartReached();
    },
    [handleStartReached],
  );

  const handleTotalListHeightChanged = useCallback(() => {
    if (threadSyncing || loadingOlder || loadOlderAnchorMessageIdRef.current) {
      return;
    }

    if (!stickToBottomRef.current) {
      return;
    }

    requestStickToBottomIfNeeded();
  }, [loadingOlder, requestStickToBottomIfNeeded, threadSyncing]);

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
    listEntries,
    loadingOlder,
    messages.length,
    publishMessageListEntryGauges,
    showInitialLoading,
    virtualListEnabled,
  ]);

  const handleRangeChanged = useCallback(
    (range: ListRange) => {
      if (virtualListEnabled) {
        const dataIndex = virtuosoDataIndex(virtuosoFirstItemIndexRef.current, range.startIndex);

        if (dataIndex >= 0 && dataIndex < listEntries.length) {
          const entry = listEntries[dataIndex];

          if (entry.kind === 'message') {
            topVisibleMessageIdRef.current = entry.message.id;
          }
        }
      }

      if (!isPerfEnabled() || !virtualListEnabled) {
        return;
      }

      const visible = Math.max(0, range.endIndex - range.startIndex + 1);
      perfSetGauge('messageList:virtuosoVisibleRows', visible);
      publishMessageListEntryGauges();
    },
    [listEntries, publishMessageListEntryGauges, virtualListEnabled],
  );

  const copyToClipboard = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
        toast.success('Copied to clipboard.');
      } catch {
        toast.error('Could not copy to clipboard.');
      }
    },
    [toast],
  );

  const copyImageToClipboard = useCallback(
    async (url: string) => {
      try {
        const blob = await fetchMediaBlob(url);
        const mimeType =
          blob.type && blob.type.startsWith('image/') ? blob.type : 'image/png';

        await navigator.clipboard.write([
          new ClipboardItem({
            [mimeType]: blob.type === mimeType ? blob : new Blob([blob], { type: mimeType }),
          }),
        ]);
        toast.success('Image copied to clipboard.');
      } catch {
        toast.error('Could not copy image to clipboard.');
      }
    },
    [toast],
  );

  const openMessageContextMenu = useCallback(
    (message: MessageItem, position: { top: number; left: number }, selectedText: string | null) => {
      setMessageContextMenu({ message, position, selectedText });
    },
    [],
  );

  const handleOpenMemberProfile = useCallback(
    (
      anchor: {
        userId: string;
        displayName: string;
        avatarUrl?: string | null;
        avatarInitials?: string;
      },
      position: { top: number; left: number },
    ) => {
      setMessageContextMenu(null);
      onOpenMemberProfile?.(anchor, position);
    },
    [onOpenMemberProfile],
  );

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
          onOpenComposerEdit={onOpenComposerEdit}
          onMessageContextMenu={openMessageContextMenu}
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
          pollVotingMessageId={pollVotingMessageId}
          onViewCalendarEvent={onViewCalendarEvent}
          memberProfilePopupEnabled={memberProfilePopupEnabled}
          onOpenMemberProfile={handleOpenMemberProfile}
          onProfileImageClick={onProfileImageClick}
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
      expandedThreadMessageId,
      openMessageContextMenu,
      onOpenComposerEdit,
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
      onViewCalendarEvent,
      handleOpenMemberProfile,
      memberProfilePopupEnabled,
      onVotePoll,
      replyTargetByMessageId,
      savedMessageIds,
      sendProgressByMessageId,
      pollVotingMessageId,
      showReactionAuthors,
      threadsEnabled,
    ],
  );

  const virtuosoComponents = useMemo((): Components<MessageListEntry> => {
    return {
      Scroller: messageListVirtuosoScroller,
      List: messageListVirtuosoList,
      Item: MessageListVirtuosoItem,
      Header: () => {
        if (loadingOlder) {
          return (
            <div
              className="box-border flex w-full max-w-full justify-center px-6 py-2 text-xs text-app-muted"
              role="status"
            >
              Loading earlier messages…
            </div>
          );
        }

        if (!hasMoreOlder || !onLoadOlder) {
          return null;
        }

        return (
          <div className="box-border flex w-full max-w-full justify-center px-6 py-2">
            <button
              type="button"
              className="relative z-20 rounded-full border border-app-border/70 bg-app-elevated px-3 py-1.5 text-xs font-medium text-app-text shadow-sm transition hover:bg-app-chat-hover"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                triggerLoadOlder();
              }}
            >
              Load earlier messages
            </button>
          </div>
        );
      },
      Footer: () => (
        <div className="box-border w-full max-w-full px-6">
          {peerBlockedByCurrentUser ? <BlockedByYouDivider key="blocked-by-you" /> : null}
          {!suppressTypingIndicator && typingParticipants.length > 0 ? (
            <div className="flex justify-start pb-1">
              <ChatTypingIndicator participants={typingParticipants} />
            </div>
          ) : null}
          <div ref={bottomAnchorRef} aria-hidden="true" className="h-px shrink-0" />
        </div>
      ),
    };
  }, [
    hasMoreOlder,
    loadingOlder,
    onLoadOlder,
    peerBlockedByCurrentUser,
    suppressTypingIndicator,
    triggerLoadOlder,
    typingParticipants,
  ]);

  const attachScrollContainerRef = useCallback((ref: HTMLElement | null) => {
    scrollContainerRef.current = ref instanceof HTMLDivElement ? ref : null;
  }, []);

  const virtuosoItemContent = useCallback(
    (_index: number, entry: MessageListEntry) => (
      <div className="box-border w-full min-w-0 max-w-full px-6 pb-2.5">{renderListEntry(entry)}</div>
    ),
    [renderListEntry],
  );

  const contextMenuItems = useMemo(() => {
    if (!messageContextMenu) {
      return [];
    }

    const message = messageContextMenu.message;
    const isPinned = Boolean(message.pinnedAt);
    const media = message.media?.[0];

    return buildMessageContextMenuItems({
      message,
      currentUserId,
      isPinned,
      isSaved: savedMessageIds.has(message.id),
      threadsEnabled,
      selectedText: messageContextMenu.selectedText,
      onAddReaction: () => onAddReaction(message.id, '👍'),
      onReply: () => onReplyMessage(message.id),
      onReplyInThread: () => onReplyInThread(message.id),
      onCopyText: (text) => void copyToClipboard(text),
      onForward: () => onForwardMessage(message.id),
      onPinToggle: () => onPinMessage(message.id, isPinned),
      onSave: () => onSaveMessage(message.id),
      onUnsave: () => onUnsaveMessage(message.id),
      onEdit: () => onOpenComposerEdit?.(message),
      onDeleteForMe: () => onDeleteMessage(message.id, 'me'),
      onDeleteForEveryone: () => onDeleteMessage(message.id, 'everyone'),
      onOpenMedia: () => {
        if (media?.url) {
          window.open(media.url, '_blank', 'noopener,noreferrer');
        }
      },
      onDownloadMedia: () => {
        if (media?.url) {
          const link = document.createElement('a');
          link.href = media.url;
          link.download = media.name ?? 'download';
          link.rel = 'noopener';
          link.click();
        }
      },
      onCopyMediaLink: () => {
        if (media?.url) {
          void copyToClipboard(media.url);
        }
      },
      onCopyImage: () => {
        if (media?.url) {
          void copyImageToClipboard(media.url);
        }
      },
    });
  }, [
    copyImageToClipboard,
    copyToClipboard,
    currentUserId,
    messageContextMenu,
    onAddReaction,
    onDeleteMessage,
    onForwardMessage,
    onOpenComposerEdit,
    onPinMessage,
    onReplyInThread,
    onReplyMessage,
    onSaveMessage,
    onUnsaveMessage,
    savedMessageIds,
    threadsEnabled,
  ]);

  const virtuosoInitialTopIndex = useMemo(() => {
    if (scrollRestoreTarget?.mode === 'anchor') {
      const entryIndex = findMessageEntryIndex(listEntries, scrollRestoreTarget.messageId);
      if (entryIndex >= 0) {
        return entryIndex;
      }
    }

    if (openAtUnreadAnchor && unreadAnchorMessageId) {
      const unreadIndex = findMessageEntryIndex(listEntries, unreadAnchorMessageId);
      if (unreadIndex >= 0) {
        return unreadIndex;
      }
    }

    if (virtuosoMountScrollTop !== undefined) {
      return 0;
    }

    return Math.max(0, listEntries.length - 1);
  }, [
    listEntries,
    openAtUnreadAnchor,
    scrollRestoreTarget,
    unreadAnchorMessageId,
    virtuosoMountScrollTop,
  ]);

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
        {!suppressTypingIndicator && typingParticipants.length > 0 ? (
          <div className="flex min-h-0 flex-1 flex-col justify-end px-6 pb-2">
            <div className="flex justify-start">
              <ChatTypingIndicator participants={typingParticipants} />
            </div>
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-app-muted" role="status">
            No messages yet. Say hello.
          </div>
        )}
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

      {showJumpToLatest ? (
        <JumpToLatestButton newMessageCount={newMessagesBelow} onClick={handleJumpToLatest} />
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
          startReachedThreshold={320}
          atTopStateChange={handleAtTopStateChange}
          totalListHeightChanged={handleTotalListHeightChanged}
          rangeChanged={handleRangeChanged}
          defaultItemHeight={80}
          increaseViewportBy={{ top: 600, bottom: 480 }}
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
            {!suppressTypingIndicator && typingParticipants.length > 0 ? (
              <div className="flex justify-start pb-1">
                <ChatTypingIndicator participants={typingParticipants} />
              </div>
            ) : null}
            <div ref={bottomAnchorRef} aria-hidden="true" className="h-px shrink-0" />
          </div>
        </div>
      )}

      {messageContextMenu ? (
        <MessageContextMenu
          items={contextMenuItems}
          position={messageContextMenu.position}
          onClose={() => setMessageContextMenu(null)}
        />
      ) : null}
    </MessageListSurface>
  );
}
