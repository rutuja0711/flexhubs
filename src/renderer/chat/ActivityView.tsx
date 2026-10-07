import { useEffect, useMemo, useRef, useState } from 'react';
import type { ConversationItem } from '../../shared/chat';
import {
  resolveFriendRequestUserId,
  type NotificationItem,
  type PendingFriendItem,
} from '../../shared/messages';
import { formatNotificationDisplayBody } from '../../shared/calls';
import { SearchIcon } from './ChatIcons';
import {
  FlexHubsDesktopNotification,
  mapActivityListItemToFlexHubsData,
} from '../ui/notifications/FlexHubsDesktopNotification';
import {
  FiCheck,
  FiHeart,
  FiX,
  FiBarChart2,
  FiAtSign,
  FiCornerDownRight,
  FiUserPlus,
  FiChevronDown,
} from 'react-icons/fi';

const FILTERS = [
  { id: 'All', label: 'All', icon: null },
  { id: 'Unread', label: 'Unread', icon: <FiCheck className="h-3 w-3" /> },
  { id: 'Mentions', label: 'Mentions', icon: <FiAtSign className="h-3 w-3" /> },
  { id: 'Replies', label: 'Replies', icon: <FiCornerDownRight className="h-3 w-3" /> },
  { id: 'Reactions', label: 'Reactions', icon: <FiHeart className="h-3 w-3" /> },
  { id: 'Requests', label: 'Requests', icon: <FiUserPlus className="h-3 w-3" /> },
] as const;

type ActivityFilter = (typeof FILTERS)[number]['id'];
type ActivityKind = 'message' | 'reaction' | 'mention' | 'reply' | 'request' | 'calendar' | 'file' | 'voice' | 'photo' | 'hub-invite';

type ActivityListItem = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  kind: ActivityKind;
  notification: NotificationItem | null;
  isUnread: boolean;
  respondUserId: string | null;
};

function classifyNotification(item: NotificationItem): ActivityKind {
  const haystack = `${item.type} ${item.title} ${item.body}`.toLowerCase();

  if (haystack.includes('reaction') || haystack.includes('reacted')) return 'reaction';
  if (haystack.includes('mention')) return 'mention';
  if (haystack.includes('reply') || haystack.includes('replied')) return 'reply';
  if (haystack.includes('calendar') || haystack.includes('event')) return 'calendar';
  if (haystack.includes('hub') && (haystack.includes('invite') || haystack.includes('join'))) return 'hub-invite';
  if (haystack.includes('friend request') || haystack.includes('added you')) return 'request';
  if (haystack.includes('shared a file') || haystack.includes('.pdf')) return 'file';
  if (haystack.includes('voice message') || haystack.includes('audio call')) return 'voice';
  if (haystack.includes('shared a photo') || haystack.includes('photo')) return 'photo';

  return 'message';
}

function groupItemsByDate(items: ActivityListItem[]) {
  const groups: Record<string, { dateStr: string, items: ActivityListItem[] }> = {};

  items.forEach(item => {
    const d = new Date(item.createdAt);
    const now = new Date();
    const isToday = d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    const isYesterday = d.getDate() === now.getDate() - 1 && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();

    let groupKey = 'Older';
    if (isToday) groupKey = 'Today';
    else if (isYesterday) groupKey = 'Yesterday';

    if (!groups[groupKey]) {
      groups[groupKey] = {
        dateStr: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
        items: []
      };
    }
    groups[groupKey].items.push(item);
  });

  return groups;
}

function ActivityRowContent({
  item,
  conversations,
  onRespondFriend,
  isProcessing,
}: {
  item: ActivityListItem;
  conversations: ConversationItem[];
  onRespondFriend?: (id: string, status: 'ACCEPTED' | 'DECLINED') => void;
  isProcessing?: boolean;
}) {
  const presentation = mapActivityListItemToFlexHubsData(item, conversations, {
    onRespondFriend,
    isProcessing,
  });

  return <FlexHubsDesktopNotification variant="activity" data={presentation} />;
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
        {selected.icon ? (
          <span className="shrink-0 text-app-muted">{selected.icon}</span>
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
                    isSelected
                      ? toneStyle.menuActive
                      : 'text-app-text hover:bg-app-inset'
                  }`}
                >
                  {filter.icon ? (
                    <span className={isSelected ? 'text-app-text' : 'text-app-muted'}>
                      {filter.icon}
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
  conversations: ConversationItem[];
  loading: boolean;
  error: string;
  onRetry: () => void;
  onNotificationClick: (notification: NotificationItem) => void;
  onRespondFriend?: (id: string, status: 'ACCEPTED' | 'DECLINED') => void;
  onMarkAllRead?: () => void;
};

export function ActivityView({
  notifications,
  pendingFriends,
  conversations,
  loading,
  error,
  onRetry,
  onNotificationClick,
  onRespondFriend,
  onMarkAllRead,
}: ActivityViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<ActivityFilter>('All');

  // We keep track of the two quick-access priority filters
  const [priority1, setPriority1] = useState<ActivityFilter>('Mentions');
  const [priority2, setPriority2] = useState<ActivityFilter>('Replies');
  const [splitAssignTarget, setSplitAssignTarget] = useState<1 | 2>(2);
  const [viewMode, setViewMode] = useState<'list' | 'split'>('list');
  const [showSplitPriorityGuide, setShowSplitPriorityGuide] = useState(false);

  const [processingId, setProcessingId] = useState<string | null>(null);

  const enableSplitView = () => {
    setViewMode('split');
    setShowSplitPriorityGuide(true);
    setSplitAssignTarget(2);
  };

  const enableListView = () => {
    setViewMode('list');
    setShowSplitPriorityGuide(false);
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

  const handleRespondFriend = async (id: string, status: 'ACCEPTED' | 'DECLINED') => {
    if (!onRespondFriend) return;
    setProcessingId(id);
    try {
      await Promise.resolve(onRespondFriend(id, status));
    } finally {
      setProcessingId(null);
    }
  };

  const combinedItems = useMemo<ActivityListItem[]>(() => {
    const pendingUserIds = new Set(
      pendingFriends.map((item) => item.userId || item.id).filter(Boolean),
    );

    const pendingItems: ActivityListItem[] = pendingFriends.map((item) => ({
      id: `pending-${item.id}`,
      title: item.title,
      body: item.body,
      createdAt: item.createdAt,
      kind: 'request',
      notification: null,
      isUnread: true,
      respondUserId: item.userId || item.id,
    }));

    const notificationItems: ActivityListItem[] = notifications
      .map((item) => {
        const kind = classifyNotification(item);
        const respondUserId =
          kind === 'request' ? resolveFriendRequestUserId(item, conversations) : null;

        return {
          id: item.id,
          title: item.title,
          body: formatNotificationDisplayBody(item.body),
          createdAt: item.createdAt,
          kind,
          notification: item,
          isUnread: !item.isRead,
          respondUserId,
        };
      })
      .filter((item) => {
        if (item.kind !== 'request' || !item.respondUserId) {
          return true;
        }

        return !pendingUserIds.has(item.respondUserId);
      });

    return [...pendingItems, ...notificationItems].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [conversations, notifications, pendingFriends]);

  const filterItemsByCategory = (items: ActivityListItem[], filter: ActivityFilter) => {
    let next = items;
    if (filter === 'Requests') next = next.filter((i) => i.kind === 'request');
    else if (filter === 'Reactions') next = next.filter((i) => i.kind === 'reaction');
    else if (filter === 'Mentions') next = next.filter((i) => i.kind === 'mention');
    else if (filter === 'Replies') next = next.filter((i) => i.kind === 'reply');
    else if (filter === 'Unread') next = next.filter((i) => i.isUnread);

    const q = searchQuery.trim().toLowerCase();
    if (q) {
      next = next.filter(
        (i) => i.title.toLowerCase().includes(q) || i.body.toLowerCase().includes(q),
      );
    }

    return next;
  };

  const filteredItems = useMemo(
    () => filterItemsByCategory(combinedItems, activeFilter),
    [activeFilter, combinedItems, searchQuery],
  );

  const unreadCount = combinedItems.filter(i => i.isUnread).length;

  const DATE_GROUP_ORDER = ['Today', 'Yesterday', 'Older'] as const;

  const renderActivityGroups = (items: ActivityListItem[]) => {
    if (items.length === 0) {
      return null;
    }

    const groups = groupItemsByDate(items);

    return (
      <div className="flex flex-col gap-6">
        {DATE_GROUP_ORDER.filter((key) => groups[key]?.items.length).map((groupName) => (
          <div key={groupName}>
            <div className="flex items-center justify-between mb-2 border-b border-app-border/40 pb-2 px-2">
              <h3 className="text-[13px] font-bold text-app-text">{groupName}</h3>
            </div>
            <div className="flex flex-col">
              {groups[groupName].items.map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    if (item.kind === 'request') {
                      return;
                    }

                    if (item.notification) {
                      onNotificationClick(item.notification);
                    }
                  }}
                  className={`border-b border-app-border/30 last:border-0 ${item.kind === 'request' ? '' : 'cursor-pointer'}`}
                >
                  <ActivityRowContent
                    item={item}
                    conversations={conversations}
                    onRespondFriend={handleRespondFriend}
                    isProcessing={
                      Boolean(item.respondUserId) && processingId === item.respondUserId
                    }
                  />
                </div>
              ))}
            </div>
          </div>
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

  return (
    <div className="flex h-full flex-col bg-app-surface text-app-text font-sans">
      <header className="px-10 pt-10 pb-4">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-app-text mb-1">Activity</h1>
            <p className="text-[13px] text-app-muted">Stay updated with what's happening in your workspace</p>
          </div>
          <button
            onClick={onMarkAllRead}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-app-muted hover:text-accent transition-colors text-[13px] font-medium"
          >
            Mark all as read
          </button>
        </div>
        <div className="flex gap-4 mb-6">
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-app-muted">
              <SearchIcon />
            </span>
            <input
              type="text"
              placeholder="Search chats, messages, contacts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-app-card/60 border border-app-border/80 rounded-xl py-2 pl-10 pr-16 text-[13px] text-app-text focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all placeholder:text-app-muted/70"
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
              className={`rounded-lg p-1.5 transition-colors ${viewMode === 'list' ? 'bg-app-inset text-app-text shadow-sm' : 'text-app-muted hover:text-app-text'}`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
            </button>
            <button
              type="button"
              title="Priority split view"
              aria-pressed={viewMode === 'split'}
              onClick={enableSplitView}
              className={`rounded-lg p-1.5 transition-colors ${viewMode === 'split' ? 'bg-app-inset text-app-text shadow-sm' : 'text-app-muted hover:text-app-text'}`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="18" rx="1"></rect><rect x="14" y="3" width="7" height="18" rx="1"></rect></svg>
            </button>
          </div>
        </div>

        {viewMode === 'split' && showSplitPriorityGuide ? (
          <div className="mb-4 flex items-start gap-3 rounded-2xl border border-accent/25 bg-accent/10 px-4 py-3.5">
            <FiBarChart2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-app-text">See your priority messages</p>
              <p className="mt-0.5 text-xs leading-relaxed text-app-muted">
                Pick two tabs below — they appear in the left and right columns. Tap a tab again to
                choose which column to update next, or use the column menus to change a panel.
              </p>
            </div>
          </div>
        ) : null}

        <div
          className="flex items-center justify-between"
          role="tablist"
          aria-label={viewMode === 'split' ? 'Assign activity filters to columns' : 'Filter activity'}
        >
          <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
            {FILTERS.map((filter) => {
              const splitSlot =
                filter.id === priority1 ? 1 : filter.id === priority2 ? 2 : null;
              const isActive = viewMode === 'list' && activeFilter === filter.id;

              let count = 0;
              if (filter.id === 'All') count = combinedItems.filter((i) => i.isUnread).length;
              else if (filter.id === 'Unread') count = unreadCount;
              else if (filter.id === 'Requests') {
                count = combinedItems.filter((i) => i.kind === 'request' && i.isUnread).length;
              } else if (filter.id === 'Reactions') {
                count = combinedItems.filter((i) => i.kind === 'reaction' && i.isUnread).length;
              } else if (filter.id === 'Mentions') {
                count = combinedItems.filter((i) => i.kind === 'mention' && i.isUnread).length;
              } else if (filter.id === 'Replies') {
                count = combinedItems.filter((i) => i.kind === 'reply' && i.isUnread).length;
              }

              const isSplitSelected = splitSlot !== null;

              return (
                <button
                  key={filter.id}
                  type="button"
                  role="tab"
                  aria-selected={viewMode === 'list' ? isActive : isSplitSelected}
                  onClick={() => handleFilterClick(filter.id)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium transition-all ${
                    viewMode === 'list'
                      ? isActive
                        ? 'border-accent bg-accent text-white shadow-sm shadow-accent/25'
                        : 'border-app-border/80 bg-app-surface text-app-muted hover:border-app-border-strong hover:bg-app-card hover:text-app-text'
                      : isSplitSelected
                        ? splitSlot === 1
                          ? 'border-violet-500/50 bg-violet-500/10 text-app-text shadow-sm'
                          : 'border-sky-500/50 bg-sky-500/10 text-app-text shadow-sm'
                        : 'border-app-border/80 bg-app-surface text-app-muted hover:border-app-border-strong hover:bg-app-card hover:text-app-text'
                  }`}
                >
                  {filter.icon ? <span className={isActive ? 'text-white/90' : 'opacity-70'}>{filter.icon}</span> : null}
                  {filter.label}
                  {viewMode === 'list' && count > 0 && filter.id !== 'Unread' ? (
                    <span
                      className={`ml-0.5 rounded-full px-1.5 text-[11px] font-bold ${
                        isActive ? 'bg-white/20 text-white' : 'text-accent'
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

      <div className="flex-1 overflow-y-auto px-8 pb-10 flex gap-6">
        {viewMode === 'list' ? (
          <div className="flex-1">
            {loading ? (
              <div className="py-16 text-center text-[13px] text-app-muted">Loading activity...</div>
            ) : error ? (
              <div className="py-16 text-center">
                <p className="text-[13px] text-accent-soft mb-3">{error}</p>
                <button onClick={onRetry} className="px-4 py-2 rounded-xl bg-app-card border border-app-border text-[13px] font-semibold hover:bg-app-inset transition-colors">Try again</button>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="py-20 flex flex-col items-center justify-center text-center">
                <div className="h-12 w-12 rounded-full border border-dashed border-app-border flex items-center justify-center mb-4">
                  <FiCheck className="h-5 w-5 text-app-muted/50" />
                </div>
                <p className="text-[14px] font-semibold text-app-text">
                  {activeFilter === 'Unread' ? "You're all caught up" :
                    activeFilter === 'Mentions' ? "No mentions yet" :
                      activeFilter === 'Requests' ? "No pending requests" :
                        "No activity found"}
                </p>
                <p className="text-[13px] text-app-muted mt-1 max-w-[250px]">
                  {activeFilter === 'Unread' ? "When you get new notifications, they'll show up here." : "Check back later for new updates."}
                </p>
              </div>
            ) : (
              renderActivityGroups(filteredItems)
            )}
          </div>
        ) : loading ? (
          <div className="flex-1 py-16 text-center text-[13px] text-app-muted">Loading activity...</div>
        ) : error ? (
          <div className="flex-1 py-16 text-center">
            <p className="text-[13px] text-accent-soft mb-3">{error}</p>
            <button
              onClick={onRetry}
              className="px-4 py-2 rounded-xl bg-app-card border border-app-border text-[13px] font-semibold hover:bg-app-inset transition-colors"
            >
              Try again
            </button>
          </div>
        ) : (
          <>
            {/* Priority 1 Column */}
            <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-violet-500/25 bg-app-surface shadow-sm">
              <div className="border-b border-app-border/60 bg-app-card/30 px-4 py-3">
                <ActivitySplitFilterPicker
                  value={priority1}
                  tone="violet"
                  ariaLabel="Left column filter"
                  onChange={(filterId) => assignSplitColumn(1, filterId)}
                />
              </div>
              <div className="flex-1 overflow-y-auto p-2">
                {renderSplitColumn(priority1)}
              </div>
            </div>

            <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-sky-500/25 bg-app-surface shadow-sm">
              <div className="border-b border-app-border/60 bg-app-card/30 px-4 py-3">
                <ActivitySplitFilterPicker
                  value={priority2}
                  tone="sky"
                  ariaLabel="Right column filter"
                  onChange={(filterId) => assignSplitColumn(2, filterId)}
                />
              </div>
              <div className="flex-1 overflow-y-auto p-2">
                {renderSplitColumn(priority2)}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
