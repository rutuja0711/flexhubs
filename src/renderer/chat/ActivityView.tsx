import { useMemo, useState } from 'react';
import type { NotificationItem, PendingFriendItem } from '../../shared/messages';
import { isNotificationClickable } from '../../shared/messages';
import type { ConversationItem } from '../../shared/chat';
import { validateSearchQuery } from '../../shared/chat';
import { formatNotificationDisplayBody } from '../../shared/calls';
import { formatConversationTimestamp } from './format';
import { SearchIcon, Avatar } from './ChatIcons';
import {
  FiCheck,
  FiMoreHorizontal,
  FiCalendar,
  FiImage,
  FiMic,
  FiFileText,
  FiHeart,
  FiX,
  FiBarChart2,
  FiMessageSquare,
  FiAtSign,
  FiCornerDownRight,
  FiUserPlus,
  FiUsers
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
  isProcessing
}: {
  item: ActivityListItem;
  conversations: ConversationItem[];
  onRespondFriend?: (id: string, status: 'ACCEPTED' | 'DECLINED') => void;
  isProcessing?: boolean;
}) {
  const matchedConv = item.notification?.conversationId
    ? conversations.find(c => c.id === item.notification?.conversationId)
    : null;

  let mainTitle = item.title;
  let bodyText = item.body;
  let useHubAvatar = false;
  let extractedNameForAvatar = '';

  // Extract name for avatar lookup if we need a user avatar
  if (item.kind === 'reaction') {
    extractedNameForAvatar = mainTitle.split('reacted')[0].split('+')[0].trim();
  } else if (item.kind === 'mention') {
    if (bodyText.includes('mentioned you:')) {
      extractedNameForAvatar = bodyText.split('mentioned you:')[0].trim();
      bodyText = bodyText.split('mentioned you:')[1].trim();
    } else if (item.title.includes('mentioned you')) {
      extractedNameForAvatar = item.title.split('mentioned you')[0].trim();
    } else if (bodyText.includes(':')) {
      extractedNameForAvatar = bodyText.split(':')[0].trim();
    }
  } else if (bodyText.includes(':')) {
    extractedNameForAvatar = bodyText.split(':')[0].trim();
  }

  if (matchedConv && matchedConv.kind !== 'direct') {
    if (item.kind === 'message' || item.kind === 'file' || item.kind === 'photo' || item.kind === 'voice' || item.kind === 'mention') {
      if (item.kind === 'mention') {
        mainTitle = `${extractedNameForAvatar || 'Someone'} mentioned you`;
        bodyText = `${bodyText} · ${matchedConv.title}`;
      } else {
        mainTitle = matchedConv.title;
      }
      useHubAvatar = true;
    } else if (item.kind === 'reply') {
      if (item.title === 'Reply') {
        let name = 'Someone';
        if (bodyText.includes('replied to you:')) {
          name = bodyText.split('replied to you:')[0].trim();
          bodyText = bodyText.split('replied to you:')[1].trim();
        } else if (bodyText.includes(':')) {
          name = bodyText.split(':')[0].trim();
        }
        mainTitle = `${name} replied in ${matchedConv.title}`;
        if (!bodyText.startsWith(`${name}:`)) {
          bodyText = `${name}: ${bodyText}`;
        }
      } else {
        const nameMatch = item.title.match(/^(.*?) replied/i);
        if (nameMatch) {
          mainTitle = `${nameMatch[1]} replied in ${matchedConv.title}`;
        }
      }
      useHubAvatar = true;
    } else if (item.kind === 'reaction') {
      if (!bodyText.includes('·')) {
        bodyText = `${bodyText} · ${matchedConv.title}`;
      }
      useHubAvatar = false;
    } else if (item.kind === 'calendar') {
      useHubAvatar = true;
    }
  } else {
    // Direct or system
    if (item.title === 'New Message') {
      mainTitle = matchedConv ? matchedConv.title : (extractedNameForAvatar || 'New Message');
    } else if (item.title === 'Reply') {
      mainTitle = matchedConv ? matchedConv.title : 'Reply';
      if (bodyText.includes('replied to you:')) {
        bodyText = bodyText.replace('replied to you:', ':');
      }
    } else if (item.title === 'Request accepted') {
      if (bodyText.includes('accepted your friend request')) {
        const name = bodyText.split('accepted your friend request')[0].trim();
        mainTitle = `${name} accepted your friend request`;
        bodyText = '';
        extractedNameForAvatar = name;
      }
    } else if (item.kind === 'request') {
      mainTitle = 'Friend request';
      if (!bodyText) {
        bodyText = `${extractedNameForAvatar || 'Someone'} sent you a friend request`;
      }
    } else if (item.kind === 'hub-invite') {
      mainTitle = 'Hub invitation';
    }
  }

  let avatarUrl = null;
  let initials = 'U';

  if (useHubAvatar && matchedConv) {
    avatarUrl = matchedConv.avatarUrl;
    initials = matchedConv.avatarInitials;
  } else {
    const matchedUser = conversations.find(c => c.kind === 'direct' && c.title === (extractedNameForAvatar || mainTitle));
    if (matchedUser) {
      avatarUrl = matchedUser.avatarUrl;
      initials = matchedUser.avatarInitials;
    } else {
      initials = (extractedNameForAvatar || mainTitle).substring(0, 2).toUpperCase() || 'U';
    }
  }

  return (
    <div className="flex w-full items-start justify-between gap-4 py-2 px-2 hover:bg-app-card/40 rounded-xl transition-colors cursor-pointer group">
      <div className="flex items-start gap-4 flex-1 min-w-0">
        <div className="relative shrink-0 mt-0.5">
          {item.kind === 'request' ? (
            <div className="h-10 w-10 rounded-full bg-accent/10 flex items-center justify-center text-accent">
              <FiUserPlus className="h-4 w-4" />
            </div>
          ) : item.kind === 'hub-invite' ? (
            <div className="h-10 w-10 rounded-full bg-accent/10 flex items-center justify-center text-accent">
              <FiUsers className="h-4 w-4" />
            </div>
          ) : (
            <Avatar imageUrl={avatarUrl} initials={initials} size="md" />
          )}
        </div>

        <div className="flex flex-col min-w-0 flex-1 justify-center">
          <p className="text-[14px] text-app-text font-semibold truncate flex items-center gap-2">
            {mainTitle}
            {item.isUnread && <span className="h-1.5 w-1.5 rounded-full bg-accent shrink-0" />}
          </p>
          {bodyText && (
            <div className="text-[13px] text-app-muted font-normal mt-0.5">
              <span className={`line-clamp-2 leading-relaxed ${item.kind === 'reaction' ? 'italic' : ''}`}>
                {bodyText}
              </span>
            </div>
          )}

          {item.kind === 'request' && item.id.startsWith('pending-') && (
            <div className="flex gap-2 shrink-0 mt-3">
              <button
                disabled={isProcessing}
                onClick={(e) => {
                  e.stopPropagation();
                  if (onRespondFriend) onRespondFriend(item.id.replace('pending-', ''), 'ACCEPTED');
                }}
                className="px-4 py-1.5 rounded-full bg-accent text-white text-xs font-semibold hover:bg-accent/90 transition-colors shadow-sm disabled:opacity-50"
              >
                {isProcessing ? '...' : 'Accept'}
              </button>
              <button
                disabled={isProcessing}
                onClick={(e) => {
                  e.stopPropagation();
                  if (onRespondFriend) onRespondFriend(item.id.replace('pending-', ''), 'DECLINED');
                }}
                className="px-4 py-1.5 rounded-full bg-app-surface border border-app-border text-app-text text-xs font-semibold hover:bg-app-card transition-colors disabled:opacity-50"
              >
                {isProcessing ? '...' : 'Decline'}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4 shrink-0 pt-1">
        <span className="text-xs text-app-muted w-14 text-right shrink-0">
          {formatConversationTimestamp(item.createdAt)}
        </span>
        {item.kind !== 'request' && (
          <button className="px-3 py-1.5 rounded-full bg-accent/5 text-accent text-[11px] font-bold hover:bg-accent/10 transition-colors shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100">
            {item.kind === 'calendar' ? 'View event' : 'Open'}
          </button>
        )}
      </div>
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
  const [lastUpdatedSlot, setLastUpdatedSlot] = useState<1 | 2>(2);
  const [viewMode, setViewMode] = useState<'list' | 'split'>('list');

  const [processingId, setProcessingId] = useState<string | null>(null);

  const handleFilterClick = (filterId: ActivityFilter) => {
    if (viewMode === 'split') {
      if (filterId === priority1) {
        setLastUpdatedSlot(1);
      } else if (filterId === priority2) {
        setLastUpdatedSlot(2);
      } else {
        if (lastUpdatedSlot === 1) {
          setPriority2(filterId);
          setLastUpdatedSlot(2);
        } else {
          setPriority1(filterId);
          setLastUpdatedSlot(1);
        }
      }
    } else {
      setActiveFilter(filterId);
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
    const pendingItems: ActivityListItem[] = pendingFriends.map((item) => ({
      id: `pending-${item.id}`,
      title: item.title,
      body: item.body,
      createdAt: item.createdAt,
      kind: 'request',
      notification: null,
      isUnread: true,
    }));

    const notificationItems: ActivityListItem[] = notifications.map((item) => ({
      id: item.id,
      title: item.title,
      body: formatNotificationDisplayBody(item.body),
      createdAt: item.createdAt,
      kind: classifyNotification(item),
      notification: item,
      isUnread: !item.isRead,
    }));

    return [...pendingItems, ...notificationItems].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [notifications, pendingFriends]);

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
                  onClick={() => item.notification && onNotificationClick(item.notification)}
                  className="border-b border-app-border/30 last:border-0 cursor-pointer"
                >
                  <ActivityRowContent
                    item={item}
                    conversations={conversations}
                    onRespondFriend={handleRespondFriend}
                    isProcessing={processingId === item.id.replace('pending-', '')}
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
          <div className="flex bg-app-card border border-app-border rounded-xl p-0.5 shrink-0 shadow-sm">
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-app-inset text-app-text shadow-sm' : 'text-app-muted hover:text-app-text'}`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
            </button>
            <button
              onClick={() => setViewMode('split')}
              className={`p-1.5 rounded-lg transition-colors ${viewMode === 'split' ? 'bg-app-inset text-app-text shadow-sm' : 'text-app-muted hover:text-app-text'}`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="18" rx="1"></rect><rect x="14" y="3" width="7" height="18" rx="1"></rect></svg>
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
            {FILTERS.map(filter => {
              if (viewMode === 'split') {
                const isSelected = filter.id === priority1 || filter.id === priority2;
                return (
                  <button
                    key={filter.id}
                    onClick={() => handleFilterClick(filter.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all ${isSelected
                        ? 'border-accent bg-accent/5 text-accent shadow-sm'
                        : 'border-app-border/80 bg-app-surface text-app-muted hover:bg-app-card hover:text-app-text'
                      }`}
                  >
                    <div className={`h-2.5 w-2.5 rounded-full flex items-center justify-center border transition-all ${isSelected ? 'border-accent' : 'border-app-muted/60'
                      }`}>
                      {isSelected && <div className="h-1.5 w-1.5 rounded-full bg-accent" />}
                    </div>
                    <span className="text-[13px] font-medium">{filter.label}</span>
                  </button>
                );
              } else {
                const isActive = activeFilter === filter.id;
                let count = 0;
                if (filter.id === 'All') count = combinedItems.filter(i => i.isUnread).length;
                else if (filter.id === 'Unread') count = unreadCount;
                else if (filter.id === 'Requests') count = combinedItems.filter(i => i.kind === 'request' && i.isUnread).length;
                else if (filter.id === 'Reactions') count = combinedItems.filter(i => i.kind === 'reaction' && i.isUnread).length;
                else if (filter.id === 'Mentions') count = combinedItems.filter(i => i.kind === 'mention' && i.isUnread).length;
                else if (filter.id === 'Replies') count = combinedItems.filter(i => i.kind === 'reply' && i.isUnread).length;

                return (
                  <button
                    key={filter.id}
                    onClick={() => handleFilterClick(filter.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[13px] font-medium transition-all ${isActive
                        ? 'border-accent/40 bg-accent/5 text-accent shadow-sm'
                        : 'border-app-border/80 bg-app-surface text-app-muted hover:bg-app-card hover:text-app-text'
                      }`}
                  >
                    {filter.icon && <span className="opacity-70">{filter.icon}</span>}
                    {filter.label}
                    {(count > 0 && filter.id !== 'Unread') && (
                      <span className="ml-0.5 text-accent font-bold">
                        {count}
                      </span>
                    )}
                  </button>
                )
              }
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
            <div className="flex-1 bg-app-surface border border-app-border/80 rounded-2xl overflow-hidden flex flex-col shadow-sm">
              <div className="px-5 py-4 border-b border-app-border/60 bg-app-card/30 flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-accent" />
                <h2 className="font-bold text-app-text text-[14px]">{priority1}</h2>
              </div>
              <div className="flex-1 overflow-y-auto p-2">
                {renderSplitColumn(priority1)}
              </div>
            </div>

            {/* Priority 2 Column */}
            <div className="flex-1 bg-app-surface border border-app-border/80 rounded-2xl overflow-hidden flex flex-col shadow-sm">
              <div className="px-5 py-4 border-b border-app-border/60 bg-app-card/30 flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-accent" />
                <h2 className="font-bold text-app-text text-[14px]">{priority2}</h2>
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
