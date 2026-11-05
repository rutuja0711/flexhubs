import { useEffect, useMemo, useRef, useState } from 'react';
import type { HubInviteItem } from '../../shared/features';
import type { ConversationItem } from '../../shared/chat';
import { hubConversationMatchesTarget, isJoinedHubConversation } from '../../shared/chat';
import {
  findFriendRequestNotificationForPending,
  findHubInviteForNotification,
  isCalendarInviteNotification,
  isFriendRequestNotification,
  isGroupMembershipAddedNotification,
  isHubInviteNotification,
  isPendingHubInviteNotification,
  type NotificationItem,
  type PendingFriendItem,
} from '../../shared/messages';
import { CalendarEventInviteActions } from './CalendarEventInviteActions';
import { formatNotificationDisplayBody } from '../../shared/calls';
import { SearchIcon } from './ChatIcons';
import {
  mapActivityListItemToFlexHubsData,
  type FlexHubsNotificationData,
} from '../ui/notifications/FlexHubsDesktopNotification';
import {
  NotificationAvatar,
  NotificationMedia,
  NotificationMediaThumbnail,
} from '../ui/notifications/DesktopNotificationSystem';
import { formatNotificationRelativeTime } from '../ui/notifications/notificationTime';
import { AppLogoMark } from '../brand/AppLogo';
import {
  FiCheck,
  FiHeart,
  FiX,
  FiAtSign,
  FiCornerDownRight,
  FiUserPlus,
  FiPhone,
  FiSettings,
  FiMoreVertical,
  FiBell,
  FiBarChart2,
  FiChevronDown,
  FiHash,
} from 'react-icons/fi';

const ACTIVITY_FILTER_STORAGE_KEY = 'flexhubs:activity-filter';

const FILTERS = [
  { id: 'All', label: 'All' },
  { id: 'Unread', label: 'Unread' },
  { id: 'Mentions', label: 'Mentions' },
  { id: 'Replies', label: 'Replies' },
  { id: 'Reactions', label: 'Reactions' },
  { id: 'FriendRequests', label: 'Friend Requests' },
  { id: 'Calls', label: 'Calls' },
] as const;

type ActivityFilter = (typeof FILTERS)[number]['id'];
type ActivityKind =
  | 'message'
  | 'reaction'
  | 'mention'
  | 'reply'
  | 'request'
  | 'calendar'
  | 'file'
  | 'voice'
  | 'call'
  | 'photo'
  | 'hub-invite';

type ActivityListItem = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  kind: ActivityKind;
  notification: NotificationItem | null;
  isUnread: boolean;
  respondFriendRequestId: string | null;
  respondFriendUserId: string | null;
  linkedNotificationId: string | null;
  respondHubInviteId: string | null;
  respondCalendarEventId: string | null;
};

function readStoredFilter(): ActivityFilter {
  try {
    const stored = sessionStorage.getItem(ACTIVITY_FILTER_STORAGE_KEY);
    if (stored && FILTERS.some((entry) => entry.id === stored)) {
      return stored as ActivityFilter;
    }
  } catch {
    // ignore
  }
  return 'All';
}

function classifyNotification(item: NotificationItem): ActivityKind {
  if (isGroupMembershipAddedNotification(item) || isPendingHubInviteNotification(item)) {
    return 'hub-invite';
  }

  if (isFriendRequestNotification(item)) {
    return 'request';
  }

  const type = item.type.toUpperCase();
  if (type === 'GROUP_INVITE') {
    return 'hub-invite';
  }

  const haystack = `${item.type} ${item.title} ${item.body}`.toLowerCase();

  if (haystack.includes('missed') && haystack.includes('call')) {
    return 'call';
  }
  if (haystack.includes('reaction') || haystack.includes('reacted')) return 'reaction';
  if (haystack.includes('mention')) return 'mention';
  if (haystack.includes('reply') || haystack.includes('replied')) return 'reply';
  if (haystack.includes('calendar') || haystack.includes('event')) return 'calendar';
  if (isHubInviteNotification(item)) return 'hub-invite';
  if (haystack.includes('friend request') || haystack.includes('sent you a friend request')) {
    return 'request';
  }
  if (haystack.includes('shared a file') || haystack.includes('.pdf')) return 'file';
  if (haystack.includes('voice message') || haystack.includes('audio call')) return 'voice';
  if (haystack.includes('shared a photo') || haystack.includes('photo')) return 'photo';

  return 'message';
}

function groupItemsByDate(items: ActivityListItem[]) {
  const groups: Record<string, { dateStr: string; items: ActivityListItem[] }> = {};
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  items.forEach((item) => {
    const d = new Date(item.createdAt);
    const isToday =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();
    const isYesterday =
      d.getDate() === yesterday.getDate() &&
      d.getMonth() === yesterday.getMonth() &&
      d.getFullYear() === yesterday.getFullYear();

    let groupKey = 'Earlier';
    if (isToday) groupKey = 'Today';
    else if (isYesterday) groupKey = 'Yesterday';

    if (!groups[groupKey]) {
      groups[groupKey] = {
        dateStr: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
        items: [],
      };
    }
    groups[groupKey].items.push(item);
  });

  return groups;
}

function hubInviteStillPending(
  inviteId: string | null,
  hubInvites: HubInviteItem[],
  conversations: ConversationItem[],
): boolean {
  if (!inviteId) {
    return false;
  }

  const invite = hubInvites.find((entry) => entry.id === inviteId);

  if (!invite) {
    return false;
  }

  const conversation = conversations.find((item) => hubConversationMatchesTarget(item, invite));

  if (conversation && isJoinedHubConversation(conversation)) {
    return false;
  }

  return true;
}

function activityHeadline(item: ActivityListItem, presentation: FlexHubsNotificationData): string {
  switch (item.kind) {
    case 'mention':
      return 'Mentioned you';
    case 'reply':
      return 'Replied to your message';
    case 'reaction':
      return presentation.body?.trim() || 'Reacted to your message';
    case 'request':
      return 'Sent you a friend request';
    case 'hub-invite':
      return presentation.body?.trim() || 'Hub invitation';
    case 'calendar':
      return 'Calendar update';
    case 'call':
      return presentation.body?.trim() || 'Missed call';
    case 'voice':
      return 'Voice message';
    case 'file':
      return 'Shared a file';
    case 'photo':
      return 'Shared a photo';
    default:
      return 'New message';
  }
}

function filterIcon(filterId: ActivityFilter) {
  switch (filterId) {
    case 'Unread':
      return <FiCheck className="h-3.5 w-3.5" />;
    case 'Mentions':
      return <FiAtSign className="h-3.5 w-3.5" />;
    case 'Replies':
      return <FiCornerDownRight className="h-3.5 w-3.5" />;
    case 'Reactions':
      return <FiHeart className="h-3.5 w-3.5" />;
    case 'FriendRequests':
      return <FiUserPlus className="h-3.5 w-3.5" />;
    case 'Calls':
      return <FiPhone className="h-3.5 w-3.5" />;
    default:
      return null;
  }
}

function ActivityCardMenu({
  item,
  onOpen,
  onMarkRead,
}: {
  item: ActivityListItem;
  onOpen: () => void;
  onMarkRead?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [open]);

  const canOpen =
    item.kind !== 'request' &&
    !(item.kind === 'hub-invite' && item.respondHubInviteId) &&
    Boolean(item.notification || item.kind === 'hub-invite');

  const canMarkRead = Boolean(item.notification && item.isUnread && onMarkRead);

  if (!canOpen && !canMarkRead) {
    return (
      <button
        type="button"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-app-muted/40"
        disabled
        aria-hidden
      >
        <FiMoreVertical className="h-4 w-4" />
      </button>
    );
  }

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        aria-label="Activity options"
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => !current);
        }}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-app-muted transition-colors hover:bg-app-inset hover:text-app-text"
      >
        <FiMoreVertical className="h-4 w-4" />
      </button>
      {open ? (
        <div className="absolute right-0 top-[calc(100%+4px)] z-50 min-w-[160px] rounded-xl border border-app-border bg-app-elevated p-1 shadow-xl shadow-black/30">
          {canOpen ? (
            <button
              type="button"
              className="flex w-full rounded-lg px-3 py-2 text-left text-[13px] font-medium text-app-text hover:bg-app-inset"
              onClick={(event) => {
                event.stopPropagation();
                setOpen(false);
                onOpen();
              }}
            >
              Open
            </button>
          ) : null}
          {canMarkRead ? (
            <button
              type="button"
              className="flex w-full rounded-lg px-3 py-2 text-left text-[13px] font-medium text-app-text hover:bg-app-inset"
              onClick={(event) => {
                event.stopPropagation();
                setOpen(false);
                onMarkRead?.();
              }}
            >
              Mark as read
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ActivityFeedCard({
  item,
  conversations,
  onOpen,
  onMarkRead,
  onRespondFriend,
  onRespondHubInvite,
  isProcessing,
  calendarInviteStatusByEventId,
  onCalendarInviteResponded,
  onUnauthorized,
}: {
  item: ActivityListItem;
  conversations: ConversationItem[];
  onOpen: () => void;
  onMarkRead?: (notificationId: string) => void;
  onRespondFriend?: (
    requestId: string,
    status: 'ACCEPTED' | 'DECLINED',
    context: { userId: string; notificationId: string | null },
  ) => void;
  onRespondHubInvite?: (inviteId: string, accept: boolean, linkedNotificationId?: string | null) => void;
  isProcessing?: boolean;
  calendarInviteStatusByEventId?: Record<string, string | null | undefined>;
  onCalendarInviteResponded?: () => void;
  onUnauthorized?: (status?: number) => boolean;
}) {
  const presentation = mapActivityListItemToFlexHubsData(item, conversations, {
    onClick: onOpen,
  });

  const senderName = presentation.title?.trim() || 'Someone';
  const headline = activityHeadline(item, presentation);
  const messagePreview =
    item.kind === 'reaction' || item.kind === 'mention' || item.kind === 'reply' || item.kind === 'message'
      ? presentation.body?.trim()
      : item.kind === 'request' || item.kind === 'hub-invite'
        ? undefined
        : presentation.body?.trim();

  const extraMediaCount =
    presentation.mediaPreviewCount && presentation.mediaPreviewCount > 1
      ? presentation.mediaPreviewCount - 1
      : undefined;

  const showFriendActions = Boolean(item.respondFriendRequestId && onRespondFriend);
  const showHubInviteActions = Boolean(item.respondHubInviteId && onRespondHubInvite);
  const isInteractive =
    item.kind !== 'request' && !(item.kind === 'hub-invite' && item.respondHubInviteId);

  return (
    <article
      role="button"
      tabIndex={isInteractive ? 0 : undefined}
      onClick={() => {
        if (!isInteractive) {
          return;
        }
        onOpen();
      }}
      onKeyDown={(event) => {
        if (!isInteractive) {
          return;
        }
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen();
        }
      }}
      className={`group relative flex flex-col gap-3 rounded-2xl border px-4 py-3.5 shadow-sm transition-all duration-200 ${
        item.isUnread
          ? 'border-accent/25 bg-app-card shadow-accent/5 hover:border-accent/40 hover:shadow-md'
          : 'border-app-border/70 bg-app-card/50 hover:border-app-border-strong hover:bg-app-card/80'
      } ${isInteractive ? 'cursor-pointer' : ''}`}
    >
      {item.isUnread ? (
        <span
          className="absolute left-0 top-4 h-8 w-1 rounded-r-full bg-accent"
          aria-hidden="true"
        />
      ) : null}

      <div className="flex items-start gap-3">
        {presentation.isSystem ? (
          <AppLogoMark className="h-10 w-10 shrink-0" />
        ) : (
          <NotificationAvatar
            initials={presentation.avatarInitials}
            avatarUrl={presentation.avatarUrl}
            compact
          />
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-[14px] font-semibold text-app-text">{senderName}</p>
              <p className="mt-0.5 text-[13px] leading-snug text-app-muted">{headline}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2 pt-0.5">
              <span className="whitespace-nowrap text-[11px] font-medium text-app-muted">
                {formatNotificationRelativeTime(item.createdAt)}
              </span>
              {item.isUnread ? (
                <span
                  className="h-2 w-2 rounded-full bg-accent shadow-[0_0_8px_rgba(233,30,99,0.45)]"
                  aria-label="Unread"
                />
              ) : null}
            </div>
          </div>

          {messagePreview ? (
            <p className="mt-1.5 line-clamp-3 text-[13px] leading-snug text-app-muted">
              {messagePreview}
            </p>
          ) : null}

          {presentation.mediaPreviewUrl ? (
            <div className="mt-2">
              <NotificationMedia>
                <NotificationMediaThumbnail
                  src={presentation.mediaPreviewUrl}
                  count={extraMediaCount}
                  isVideo={presentation.mediaIsVideo}
                />
              </NotificationMedia>
            </div>
          ) : null}

          {presentation.subtitle?.trim() ? (
            <p className="mt-2 flex items-center gap-1.5 text-[12px] font-medium text-app-muted">
              <FiHash className="h-3 w-3 shrink-0 opacity-70" aria-hidden="true" />
              <span className="truncate">{presentation.subtitle.trim()}</span>
            </p>
          ) : null}

        </div>

        <ActivityCardMenu
          item={item}
          onOpen={onOpen}
          onMarkRead={
            item.notification && onMarkRead
              ? () => onMarkRead(item.notification!.id)
              : undefined
          }
        />
      </div>

      {showFriendActions ? (
        <div className="flex items-center justify-end gap-2 border-t border-app-border/40 pt-3">
          <button
            type="button"
            title="Decline"
            disabled={isProcessing}
            className="rounded-xl border border-app-border bg-app-surface px-4 py-2 text-[13px] font-semibold text-app-muted transition-colors hover:bg-app-inset hover:text-app-text disabled:opacity-50"
            onClick={(event) => {
              event.stopPropagation();
              if (!item.respondFriendRequestId || !item.respondFriendUserId) {
                return;
              }
              onRespondFriend?.(item.respondFriendRequestId, 'DECLINED', {
                userId: item.respondFriendUserId,
                notificationId: item.linkedNotificationId,
              });
            }}
          >
            Decline
          </button>
          <button
            type="button"
            title="Accept"
            disabled={isProcessing}
            className="rounded-xl bg-accent px-4 py-2 text-[13px] font-semibold text-white shadow-sm transition hover:brightness-110 disabled:opacity-50"
            onClick={(event) => {
              event.stopPropagation();
              if (!item.respondFriendRequestId || !item.respondFriendUserId) {
                return;
              }
              onRespondFriend?.(item.respondFriendRequestId, 'ACCEPTED', {
                userId: item.respondFriendUserId,
                notificationId: item.linkedNotificationId,
              });
            }}
          >
            Accept
          </button>
        </div>
      ) : null}

      {showHubInviteActions ? (
        <div className="flex items-center justify-end gap-2 border-t border-app-border/40 pt-3">
          <button
            type="button"
            title="Decline"
            disabled={isProcessing}
            className="rounded-xl border border-app-border bg-app-surface px-4 py-2 text-[13px] font-semibold text-app-muted transition-colors hover:bg-app-inset hover:text-app-text disabled:opacity-50"
            onClick={(event) => {
              event.stopPropagation();
              onRespondHubInvite?.(item.respondHubInviteId!, false, item.linkedNotificationId);
            }}
          >
            Decline
          </button>
          <button
            type="button"
            title="Accept"
            disabled={isProcessing}
            className="rounded-xl bg-accent px-4 py-2 text-[13px] font-semibold text-white shadow-sm transition hover:brightness-110 disabled:opacity-50"
            onClick={(event) => {
              event.stopPropagation();
              onRespondHubInvite?.(item.respondHubInviteId!, true, item.linkedNotificationId);
            }}
          >
            Accept
          </button>
        </div>
      ) : null}

      {item.respondCalendarEventId ? (
        <div
          className="border-t border-app-border/40 pt-3"
          onClick={(event) => event.stopPropagation()}
        >
          <CalendarEventInviteActions
            compact
            eventId={item.respondCalendarEventId}
            responseStatus={calendarInviteStatusByEventId?.[item.respondCalendarEventId]}
            onComplete={onCalendarInviteResponded}
            onUnauthorized={onUnauthorized}
          />
        </div>
      ) : null}
    </article>
  );
}

function ActivitySplitFilterPicker({
  value,
  tone,
  ariaLabel,
  onChange,
}: {
  value: ActivityFilter;
  tone: 'violet' | 'sky';
  ariaLabel: string;
  onChange: (filter: ActivityFilter) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = FILTERS.find((filter) => filter.id === value) ?? FILTERS[0];

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [open]);

  const toneStyle =
    tone === 'violet'
      ? {
          dot: 'bg-violet-400',
          triggerBorder: 'border-violet-500/35 hover:border-violet-500/55',
          triggerRing: 'focus-visible:ring-violet-500/35',
          menuActive: 'bg-violet-500/12 text-app-text',
          check: 'text-violet-400',
        }
      : {
          dot: 'bg-sky-400',
          triggerBorder: 'border-sky-500/35 hover:border-sky-500/55',
          triggerRing: 'focus-visible:ring-sky-500/35',
          menuActive: 'bg-sky-500/12 text-app-text',
          check: 'text-sky-400',
        };

  return (
    <div ref={rootRef} className="relative min-w-0 flex-1">
      <button
        type="button"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((current) => !current)}
        className={`flex w-full items-center gap-2.5 rounded-xl border bg-app-surface-input/90 px-3 py-2.5 text-left shadow-sm transition-colors ${toneStyle.triggerBorder} focus-visible:outline-none focus-visible:ring-2 ${toneStyle.triggerRing}`}
      >
        <span className={`h-2 w-2 shrink-0 rounded-full ${toneStyle.dot}`} aria-hidden="true" />
        {filterIcon(value) ? (
          <span className="shrink-0 text-app-muted">{filterIcon(value)}</span>
        ) : null}
        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-app-text">
          {selected.label}
        </span>
        <FiChevronDown
          className={`h-4 w-4 shrink-0 text-app-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <ul
          role="listbox"
          aria-label={ariaLabel}
          className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 max-h-64 overflow-y-auto rounded-xl border border-app-border bg-app-elevated p-1 shadow-2xl shadow-black/25 backdrop-blur-xl"
        >
          {FILTERS.map((filter) => {
            const isSelected = filter.id === value;
            return (
              <li key={filter.id} role="option" aria-selected={isSelected}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(filter.id);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-[13px] font-medium transition-colors ${
                    isSelected ? toneStyle.menuActive : 'text-app-text hover:bg-app-inset'
                  }`}
                >
                  {filterIcon(filter.id) ? (
                    <span className={isSelected ? 'text-app-text' : 'text-app-muted'}>
                      {filterIcon(filter.id)}
                    </span>
                  ) : null}
                  <span className="flex-1">{filter.label}</span>
                  {isSelected ? (
                    <FiCheck className={`h-4 w-4 shrink-0 ${toneStyle.check}`} aria-hidden="true" />
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

export type ActivityViewProps = {
  notifications: NotificationItem[];
  pendingFriends: PendingFriendItem[];
  hubInvites: HubInviteItem[];
  conversations: ConversationItem[];
  loading: boolean;
  error: string;
  onRetry: () => void;
  onNotificationClick: (notification: NotificationItem) => void;
  onRespondFriend?: (
    requestId: string,
    status: 'ACCEPTED' | 'DECLINED',
    context: { userId: string; notificationId: string | null },
  ) => void;
  onRespondHubInvite?: (inviteId: string, accept: boolean, linkedNotificationId?: string | null) => void;
  onMarkAllRead?: () => void;
  onMarkNotificationRead?: (notificationId: string) => void;
  onOpenNotificationSettings?: () => void;
  calendarInviteStatusByEventId?: Record<string, string | null | undefined>;
  onCalendarInviteResponded?: () => void;
  onUnauthorized?: (status?: number) => boolean;
};

export function ActivityView({
  notifications,
  pendingFriends,
  hubInvites,
  conversations,
  loading,
  error,
  onRetry,
  onNotificationClick,
  onRespondFriend,
  onRespondHubInvite,
  onMarkAllRead,
  onMarkNotificationRead,
  onOpenNotificationSettings,
  calendarInviteStatusByEventId,
  onCalendarInviteResponded,
  onUnauthorized,
}: ActivityViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<ActivityFilter>(readStoredFilter);
  const [viewMode, setViewMode] = useState<'list' | 'split'>('list');
  const [priority1, setPriority1] = useState<ActivityFilter>('Mentions');
  const [priority2, setPriority2] = useState<ActivityFilter>('Replies');
  const [splitAssignTarget, setSplitAssignTarget] = useState<1 | 2>(2);
  const [showSplitPriorityGuide, setShowSplitPriorityGuide] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    try {
      sessionStorage.setItem(ACTIVITY_FILTER_STORAGE_KEY, activeFilter);
    } catch {
      // ignore
    }
  }, [activeFilter]);

  const enableSplitView = () => {
    setViewMode('split');
    setShowSplitPriorityGuide(true);
    setSplitAssignTarget(2);
  };

  const enableListView = () => {
    setViewMode('list');
    setShowSplitPriorityGuide(false);
  };

  const assignSplitColumn = (slot: 1 | 2, filterId: ActivityFilter) => {
    setShowSplitPriorityGuide(true);
    if (slot === 1) {
      setPriority1(filterId);
      setSplitAssignTarget(2);
    } else {
      setPriority2(filterId);
      setSplitAssignTarget(1);
    }
  };

  const handleFilterClick = (filterId: ActivityFilter) => {
    if (viewMode === 'split') {
      setShowSplitPriorityGuide(true);

      if (filterId === priority1) {
        setSplitAssignTarget(1);
        return;
      }
      if (filterId === priority2) {
        setSplitAssignTarget(2);
        return;
      }

      if (splitAssignTarget === 1) {
        setPriority1(filterId);
        setSplitAssignTarget(2);
      } else {
        setPriority2(filterId);
        setSplitAssignTarget(1);
      }
      return;
    }

    setActiveFilter(filterId);
  };

  const handleRespondFriend = async (
    requestId: string,
    status: 'ACCEPTED' | 'DECLINED',
    context: { userId: string; notificationId: string | null },
  ) => {
    if (!onRespondFriend) return;
    setProcessingId(requestId);
    try {
      await Promise.resolve(onRespondFriend(requestId, status, context));
    } finally {
      setProcessingId(null);
    }
  };

  const handleRespondHubInvite = async (
    inviteId: string,
    accept: boolean,
    linkedNotificationId?: string | null,
  ) => {
    if (!onRespondHubInvite) return;
    setProcessingId(inviteId);
    try {
      await Promise.resolve(onRespondHubInvite(inviteId, accept, linkedNotificationId));
    } finally {
      setProcessingId(null);
    }
  };

  const combinedItems = useMemo<ActivityListItem[]>(() => {
    const pendingUserIds = new Set(pendingFriends.map((item) => item.userId).filter(Boolean));
    const usedHubInviteIds = new Set<string>();
    const items: ActivityListItem[] = [];

    const pendingFriendItems: ActivityListItem[] = pendingFriends.map((item) => {
      const linked = findFriendRequestNotificationForPending(item, notifications);

      return {
        id: `pending-${item.requestId}`,
        title: item.title,
        body: item.body,
        createdAt: item.createdAt,
        kind: 'request',
        notification: linked,
        isUnread: true,
        respondFriendRequestId: item.requestId,
        respondFriendUserId: item.userId,
        linkedNotificationId: linked?.id ?? null,
        respondHubInviteId: null,
        respondCalendarEventId: null,
      };
    });

    for (const notification of notifications) {
      if (isFriendRequestNotification(notification)) {
        if (notification.actorUserId && pendingUserIds.has(notification.actorUserId)) {
          continue;
        }
        continue;
      }

      if (isGroupMembershipAddedNotification(notification)) {
        const hubName =
          notification.body.match(/added you to\s+(.+)$/i)?.[1]?.trim() ??
          notification.title.trim() ??
          'Hub';
        const inviter =
          notification.body.match(/^(.+?)\s+added you to/i)?.[1]?.trim() ?? 'Someone';

        items.push({
          id: notification.id,
          title: hubName,
          body: `${inviter} added you to this hub`,
          createdAt: notification.createdAt,
          kind: 'hub-invite',
          notification,
          isUnread: !notification.isRead,
          respondFriendRequestId: null,
          respondFriendUserId: null,
          linkedNotificationId: notification.id,
          respondHubInviteId: null,
          respondCalendarEventId: null,
        });
        continue;
      }

      if (isPendingHubInviteNotification(notification)) {
        const matched = findHubInviteForNotification(notification, hubInvites);
        const inviteId = matched?.id ?? notification.inviteId ?? null;
        if (!hubInviteStillPending(inviteId, hubInvites, conversations)) {
          continue;
        }
        if (inviteId) {
          usedHubInviteIds.add(inviteId);
        }

        const inviteRecord = inviteId ? hubInvites.find((entry) => entry.id === inviteId) : matched;
        const hubName = inviteRecord?.channelName ?? 'Hub';
        const inviter = inviteRecord?.inviterName ?? inviteRecord?.invitedBy ?? 'Someone';

        items.push({
          id: inviteId ? `hub-invite-${inviteId}` : notification.id,
          title: hubName,
          body: `${inviter} invited you to join`,
          createdAt: notification.createdAt,
          kind: 'hub-invite',
          notification,
          isUnread: !notification.isRead,
          respondFriendRequestId: null,
          respondFriendUserId: null,
          linkedNotificationId: notification.id,
          respondHubInviteId: inviteId,
          respondCalendarEventId: null,
        });
        continue;
      }

      const kind = classifyNotification(notification);
      const respondCalendarEventId =
        isCalendarInviteNotification(notification) && notification.eventId
          ? notification.eventId
          : null;

      items.push({
        id: notification.id,
        title: notification.title,
        body: formatNotificationDisplayBody(notification.body),
        createdAt: notification.createdAt,
        kind,
        notification,
        isUnread: !notification.isRead,
        respondFriendRequestId: null,
        respondFriendUserId: null,
        linkedNotificationId: notification.id,
        respondHubInviteId: null,
        respondCalendarEventId,
      });
    }

    for (const invite of hubInvites) {
      if (usedHubInviteIds.has(invite.id)) {
        continue;
      }

      if (!hubInviteStillPending(invite.id, hubInvites, conversations)) {
        continue;
      }

      items.push({
        id: `hub-invite-${invite.id}`,
        title: invite.channelName,
        body: `${invite.inviterName} invited you to join`,
        createdAt: invite.createdAt,
        kind: 'hub-invite',
        notification: null,
        isUnread: true,
        respondFriendRequestId: null,
        respondFriendUserId: null,
        linkedNotificationId: null,
        respondHubInviteId: invite.id,
        respondCalendarEventId: null,
      });
    }

    return [...pendingFriendItems, ...items].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [conversations, hubInvites, notifications, pendingFriends]);

  const unreadCount = combinedItems.filter((item) => item.isUnread).length;

  const filterUnreadCount = (filter: ActivityFilter) => {
    if (filter === 'All') {
      return unreadCount;
    }
    if (filter === 'Unread') {
      return unreadCount;
    }
    if (filter === 'FriendRequests') {
      return combinedItems.filter((item) => item.kind === 'request' && item.isUnread).length;
    }
    if (filter === 'Calls') {
      return combinedItems.filter((item) => item.kind === 'call' && item.isUnread).length;
    }
    if (filter === 'Reactions') {
      return combinedItems.filter((item) => item.kind === 'reaction' && item.isUnread).length;
    }
    if (filter === 'Mentions') {
      return combinedItems.filter((item) => item.kind === 'mention' && item.isUnread).length;
    }
    if (filter === 'Replies') {
      return combinedItems.filter((item) => item.kind === 'reply' && item.isUnread).length;
    }
    return 0;
  };

  const filterItemsByCategory = (items: ActivityListItem[], filter: ActivityFilter) => {
    let next = items;
    if (filter === 'FriendRequests') {
      next = next.filter((item) => item.kind === 'request');
    } else if (filter === 'Calls') {
      next = next.filter((item) => item.kind === 'call');
    } else if (filter === 'Reactions') {
      next = next.filter((item) => item.kind === 'reaction');
    } else if (filter === 'Mentions') {
      next = next.filter((item) => item.kind === 'mention');
    } else if (filter === 'Replies') {
      next = next.filter((item) => item.kind === 'reply');
    } else if (filter === 'Unread') {
      next = next.filter((item) => item.isUnread);
    }

    const q = searchQuery.trim().toLowerCase();
    if (q) {
      next = next.filter(
        (item) => item.title.toLowerCase().includes(q) || item.body.toLowerCase().includes(q),
      );
    }

    return next;
  };

  const filteredItems = useMemo(
    () => filterItemsByCategory(combinedItems, activeFilter),
    [activeFilter, combinedItems, searchQuery],
  );

  const openActivityItem = (item: ActivityListItem) => {
    if (item.kind === 'request') {
      return;
    }

    if (item.kind === 'hub-invite') {
      if (item.respondHubInviteId) {
        return;
      }

      if (item.notification) {
        onNotificationClick(item.notification);
      }

      return;
    }

    if (item.notification) {
      onNotificationClick(item.notification);
    }
  };

  const DATE_GROUP_ORDER = ['Today', 'Yesterday', 'Earlier'] as const;

  const renderActivityGroups = (items: ActivityListItem[]) => {
    if (items.length === 0) {
      return null;
    }

    const groups = groupItemsByDate(items);

    return (
      <div className="flex w-full flex-col gap-6">
        {DATE_GROUP_ORDER.filter((key) => groups[key]?.items.length).map((groupName) => (
          <section key={groupName}>
            <div className="mb-3 flex items-center gap-3 px-1">
              <h2 className="text-[12px] font-bold uppercase tracking-wider text-app-muted">
                {groupName}
              </h2>
              <div className="h-px flex-1 bg-app-border/50" />
            </div>
            <div className="flex flex-col gap-3">
              {groups[groupName].items.map((item) => (
                <ActivityFeedCard
                  key={item.id}
                  item={item}
                  conversations={conversations}
                  onOpen={() => openActivityItem(item)}
                  onMarkRead={onMarkNotificationRead}
                  onRespondFriend={handleRespondFriend}
                  onRespondHubInvite={handleRespondHubInvite}
                  isProcessing={
                    (Boolean(item.respondFriendRequestId) &&
                      processingId === item.respondFriendRequestId) ||
                    (Boolean(item.respondHubInviteId) && processingId === item.respondHubInviteId)
                  }
                  calendarInviteStatusByEventId={calendarInviteStatusByEventId}
                  onCalendarInviteResponded={onCalendarInviteResponded}
                  onUnauthorized={onUnauthorized}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    );
  };

  const renderSplitColumn = (filter: ActivityFilter) => {
    const columnItems = filterItemsByCategory(combinedItems, filter);
    const content = renderActivityGroups(columnItems);

    if (content) {
      return content;
    }

    return (
      <div className="p-8 text-center text-sm text-app-muted">
        No {filter === 'All' ? 'activity' : filter.toLowerCase()}
      </div>
    );
  };

  const emptyMessage = () => {
    switch (activeFilter) {
      case 'Unread':
        return { title: "You're all caught up", body: 'New notifications will appear here.' };
      case 'Mentions':
        return { title: 'No mentions yet', body: 'When someone mentions you, it shows up here.' };
      case 'FriendRequests':
        return { title: 'No friend requests', body: 'Pending friend requests will appear here.' };
      case 'Calls':
        return { title: 'No call activity', body: 'Missed calls and call updates show up here.' };
      default:
        return { title: 'No activity found', body: 'Try another filter or check back later.' };
    }
  };

  return (
    <div className="flex h-full flex-col bg-app-surface text-app-text">
      <header className="shrink-0 border-b border-app-border/40 bg-app-surface px-8 pb-4 pt-8">
        <div className="flex w-full flex-col gap-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight text-app-text">Activity</h1>
                {unreadCount > 0 ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-2.5 py-0.5 text-[12px] font-semibold text-accent">
                    <FiBell className="h-3.5 w-3.5" aria-hidden="true" />
                    {unreadCount} unread
                  </span>
                ) : null}
              </div>
              <p className="mt-1 max-w-lg text-[13px] leading-relaxed text-app-muted">
                Stay updated with everything happening across your workspace.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {onMarkAllRead ? (
                <button
                  type="button"
                  onClick={onMarkAllRead}
                  className="rounded-xl border border-app-border bg-app-card/60 px-3.5 py-2 text-[13px] font-semibold text-app-text transition-colors hover:bg-app-inset"
                >
                  Mark all as read
                </button>
              ) : null}
              {onOpenNotificationSettings ? (
                <button
                  type="button"
                  onClick={onOpenNotificationSettings}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-app-border bg-app-card/60 text-app-muted transition-colors hover:bg-app-inset hover:text-app-text"
                  title="Notification settings"
                  aria-label="Notification settings"
                >
                  <FiSettings className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          </div>

          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-app-muted">
                <SearchIcon />
              </span>
              <input
                type="search"
                placeholder="Search activities..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="w-full rounded-xl border border-app-border/80 bg-app-card/70 py-2.5 pl-10 pr-4 text-[13px] text-app-text shadow-sm transition-all placeholder:text-app-muted/70 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
              />
            </div>

            <div
              className="flex shrink-0 rounded-xl border border-app-border bg-app-card p-0.5 shadow-sm"
              role="group"
              aria-label="Activity layout"
            >
              <button
                type="button"
                title="Single list"
                aria-pressed={viewMode === 'list'}
                onClick={enableListView}
                className={`rounded-lg p-2 transition-colors ${
                  viewMode === 'list'
                    ? 'bg-app-inset text-app-text shadow-sm'
                    : 'text-app-muted hover:text-app-text'
                }`}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <line x1="8" y1="6" x2="21" y2="6" />
                  <line x1="8" y1="12" x2="21" y2="12" />
                  <line x1="8" y1="18" x2="21" y2="18" />
                  <line x1="3" y1="6" x2="3.01" y2="6" />
                  <line x1="3" y1="12" x2="3.01" y2="12" />
                  <line x1="3" y1="18" x2="3.01" y2="18" />
                </svg>
              </button>
              <button
                type="button"
                title="Priority split view"
                aria-pressed={viewMode === 'split'}
                onClick={enableSplitView}
                className={`rounded-lg p-2 transition-colors ${
                  viewMode === 'split'
                    ? 'bg-app-inset text-app-text shadow-sm'
                    : 'text-app-muted hover:text-app-text'
                }`}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect x="3" y="3" width="7" height="18" rx="1" />
                  <rect x="14" y="3" width="7" height="18" rx="1" />
                </svg>
              </button>
            </div>
          </div>

        
          <div
            className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar"
            role="tablist"
            aria-label={viewMode === 'split' ? 'Assign activity filters to columns' : 'Filter activity'}
          >
            {FILTERS.map((filter) => {
              const splitSlot =
                filter.id === priority1 ? 1 : filter.id === priority2 ? 2 : null;
              const isActive = viewMode === 'list' && activeFilter === filter.id;
              const count = filterUnreadCount(filter.id);
              const icon = filterIcon(filter.id);
              const isSplitSelected = splitSlot !== null;

              return (
                <button
                  key={filter.id}
                  type="button"
                  role="tab"
                  aria-selected={viewMode === 'list' ? isActive : isSplitSelected}
                  onClick={() => handleFilterClick(filter.id)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-[13px] font-semibold transition-all ${
                    viewMode === 'list'
                      ? isActive
                        ? 'bg-accent text-white shadow-md shadow-accent/25'
                        : 'border border-transparent text-app-muted hover:border-app-border hover:bg-app-card/80 hover:text-app-text'
                      : isSplitSelected
                        ? splitSlot === 1
                          ? 'border-violet-500/50 bg-violet-500/10 text-app-text shadow-sm'
                          : 'border-sky-500/50 bg-sky-500/10 text-app-text shadow-sm'
                        : 'border border-transparent text-app-muted hover:border-app-border hover:bg-app-card/80 hover:text-app-text'
                  }`}
                >
                  {icon ? (
                    <span
                      className={
                        viewMode === 'list' && isActive
                          ? 'text-white/90'
                          : viewMode === 'split' && isSplitSelected
                            ? 'opacity-90'
                            : 'opacity-80'
                      }
                    >
                      {icon}
                    </span>
                  ) : null}
                  {filter.label}
                  {viewMode === 'list' && count > 0 && filter.id !== 'Unread' ? (
                    <span
                      className={`ml-0.5 min-w-[1.25rem] rounded-md px-1.5 text-center text-[11px] font-bold ${
                        isActive ? 'bg-white/20 text-white' : 'bg-accent/15 text-accent'
                      }`}
                    >
                      {count}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-8 py-6">
        {viewMode === 'list' ? (
          <div className="min-h-0 flex-1 overflow-y-auto">
            {loading ? (
              <div className="py-20 text-center text-[13px] text-app-muted">Loading activity…</div>
            ) : error ? (
              <div className="py-20 text-center">
                <p className="mb-3 text-[13px] text-accent-soft">{error}</p>
                <button
                  type="button"
                  onClick={onRetry}
                  className="rounded-xl border border-app-border bg-app-card px-4 py-2 text-[13px] font-semibold transition-colors hover:bg-app-inset"
                >
                  Try again
                </button>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="flex flex-col items-center py-24 text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-dashed border-app-border bg-app-card/50">
                  <FiBell className="h-6 w-6 text-app-muted/60" />
                </div>
                <p className="text-[15px] font-semibold text-app-text">{emptyMessage().title}</p>
                <p className="mt-1 text-[13px] text-app-muted">{emptyMessage().body}</p>
              </div>
            ) : (
              renderActivityGroups(filteredItems)
            )}
          </div>
        ) : loading ? (
          <div className="flex-1 py-20 text-center text-[13px] text-app-muted">Loading activity…</div>
        ) : error ? (
          <div className="flex-1 py-20 text-center">
            <p className="mb-3 text-[13px] text-accent-soft">{error}</p>
            <button
              type="button"
              onClick={onRetry}
              className="rounded-xl border border-app-border bg-app-card px-4 py-2 text-[13px] font-semibold transition-colors hover:bg-app-inset"
            >
              Try again
            </button>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 gap-6 overflow-hidden">
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-violet-500/25 bg-app-surface shadow-sm">
              <div className="border-b border-app-border/60 bg-app-card/30 px-4 py-3">
                <ActivitySplitFilterPicker
                  value={priority1}
                  tone="violet"
                  ariaLabel="Left column filter"
                  onChange={(filterId) => assignSplitColumn(1, filterId)}
                />
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-2">{renderSplitColumn(priority1)}</div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-sky-500/25 bg-app-surface shadow-sm">
              <div className="border-b border-app-border/60 bg-app-card/30 px-4 py-3">
                <ActivitySplitFilterPicker
                  value={priority2}
                  tone="sky"
                  ariaLabel="Right column filter"
                  onChange={(filterId) => assignSplitColumn(2, filterId)}
                />
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-2">{renderSplitColumn(priority2)}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
