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
  FiUserPlus
} from 'react-icons/fi';

const FILTERS = [
  { id: 'All', label: 'All', icon: null },
  { id: 'Unread', label: 'Unread', icon: <FiCheck className="h-3 w-3" /> },
  { id: 'Mentions', label: '@ Mentions', icon: null },
  { id: 'Replies', label: 'Replies', icon: <FiCornerDownRight className="h-3 w-3" /> },
  { id: 'Reactions', label: 'Reactions', icon: <FiHeart className="h-3 w-3" /> },
  { id: 'Requests', label: 'Requests', icon: <FiUserPlus className="h-3 w-3" /> },
] as const;

type ActivityFilter = (typeof FILTERS)[number]['id'];
type ActivityKind = 'message' | 'reaction' | 'mention' | 'reply' | 'request' | 'calendar' | 'file' | 'voice' | 'photo';

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
  if (haystack.includes('invite') || haystack.includes('request') || haystack.includes('added you')) return 'request';
  if (haystack.includes('shared a file') || haystack.includes('.pdf')) return 'file';
  if (haystack.includes('voice message') || haystack.includes('audio call')) return 'voice';
  if (haystack.includes('shared a photo') || haystack.includes('photo')) return 'photo';
  
  return 'message';
}

// Replaced by inline logic in ActivityRowContent

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

function ActivityRowContent({ item, conversations }: { item: ActivityListItem, conversations: ConversationItem[] }) {
  const matchedConv = item.notification?.conversationId 
    ? conversations.find(c => c.id === item.notification?.conversationId)
    : null;
    
  let extractedName = '';
  let mainTitle = item.title;
  let subTitle = '';
  let bodyText = item.body;
  
  const titleParts = item.title.split(/(mentioned you|sent you a message|shared a photo|shared a file|reacted to your message|sent a voice message|replied to your message|shared|replied to you)/i);
  
  if (titleParts.length > 1) {
    mainTitle = titleParts[0].trim();
    subTitle = titleParts[1] + (titleParts[2] || '');
    extractedName = mainTitle;
  } else if (item.title === 'Request accepted' || item.title === 'New Message' || item.title === 'Reply' || item.title === 'Calendar event shared' || item.title === 'Event starting now') {
    
    if (item.title === 'New Message') {
      if (bodyText.includes(':')) {
        extractedName = bodyText.split(':')[0].trim();
        bodyText = bodyText.split(':').slice(1).join(':').trim();
      } else if (matchedConv?.kind === 'direct') {
        extractedName = matchedConv.title;
      } else {
        extractedName = 'Someone';
      }
      mainTitle = extractedName;
      subTitle = 'sent you a message';
    } else if (item.title === 'Reply') {
      if (bodyText.includes('replied to you:')) {
        extractedName = bodyText.split('replied to you:')[0].trim();
        bodyText = bodyText.split('replied to you:')[1].trim();
      } else if (matchedConv?.kind === 'direct') {
        extractedName = matchedConv.title;
      }
      if (extractedName) {
        mainTitle = extractedName;
        subTitle = 'replied to your message';
      }
    } else if (item.title === 'Request accepted') {
      if (bodyText.includes('accepted your friend request')) {
        extractedName = bodyText.split('accepted your friend request')[0].trim();
      }
      if (extractedName) {
        mainTitle = extractedName;
        subTitle = 'accepted your friend request';
        bodyText = ''; // Clear redundant body
      }
    } else if (item.title === 'Calendar event shared') {
       if (bodyText.includes('shared')) {
         extractedName = bodyText.split('shared')[0].trim();
         mainTitle = extractedName;
         subTitle = 'shared a calendar event';
         bodyText = bodyText.split('shared')[1].trim();
       }
    }
  }

  // Fallback cleanup
  if (extractedName && bodyText.startsWith(extractedName + ':')) {
    bodyText = bodyText.replace(extractedName + ':', '').trim();
  }
  
  let avatarUrl = null;
  let initials = extractedName.substring(0, 2).toUpperCase() || 'U';
  
  const matchedUser = conversations.find(c => c.kind === 'direct' && c.title === extractedName);
  if (matchedUser) {
    avatarUrl = matchedUser.avatarUrl;
    initials = matchedUser.avatarInitials;
  } else if (matchedConv && matchedConv.kind === 'direct') {
    avatarUrl = matchedConv.avatarUrl;
    initials = matchedConv.avatarInitials;
  }
  
  let subIcon = null;
  let avatarBadge = null;
  
  if (item.kind === 'photo') {
    subIcon = <FiImage className="h-3.5 w-3.5 text-blue-500 shrink-0 mt-0.5" />;
    avatarBadge = <div className="bg-blue-100 rounded-full p-[3px]"><FiImage className="h-2 w-2 text-blue-600" /></div>;
  } else if (item.kind === 'file') {
    subIcon = <FiFileText className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />;
    avatarBadge = <div className="bg-red-100 rounded-full p-[3px]"><FiFileText className="h-2 w-2 text-red-600" /></div>;
  } else if (item.kind === 'calendar') {
    avatarBadge = <div className="bg-red-100 rounded-full p-[3px]"><FiCalendar className="h-2 w-2 text-accent" /></div>;
  } else if (item.kind === 'reaction') {
    avatarBadge = <div className="bg-red-50 rounded-full p-[3px]"><FiHeart className="h-2 w-2 text-accent fill-current" /></div>;
  } else if (item.kind === 'mention') {
    avatarBadge = <div className="bg-app-inset rounded-full p-[3px]"><FiAtSign className="h-2 w-2 text-app-text" /></div>;
  } else if (item.kind === 'reply') {
    avatarBadge = <div className="bg-app-inset rounded-full p-[3px]"><FiCornerDownRight className="h-2 w-2 text-app-text" /></div>;
  }
  
  return (
    <div className="flex w-full items-center justify-between gap-4 py-1">
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <div className="relative shrink-0">
          <Avatar imageUrl={avatarUrl} initials={initials} size="md" />
          {avatarBadge && (
            <div className="absolute -bottom-1 -right-1 bg-app-card rounded-full p-[2px] shadow-sm ring-1 ring-app-card">
              {avatarBadge}
            </div>
          )}
        </div>
        
        <div className="flex flex-col min-w-0 flex-1 justify-center relative">
          <p className="text-[13px] text-app-text truncate flex items-center gap-2">
            <span>
              <span className="font-bold text-app-text">{mainTitle}</span>
              {subTitle && <span className="text-app-muted font-normal ml-1">{subTitle}</span>}
            </span>
            {item.isUnread && <span className="h-2 w-2 rounded-full bg-accent shrink-0" />}
          </p>
          {bodyText && (
            <div className="mt-0.5 text-[13px] text-app-muted truncate flex items-start gap-1.5 font-normal">
              {subIcon}
              <span className={`truncate ${item.kind === 'reaction' ? 'italic' : ''}`}>
                {bodyText}
              </span>
            </div>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-4 shrink-0">
        {item.kind === 'reaction' ? (
          <div className="px-4 text-accent"><FiHeart className="h-4 w-4 fill-current" /></div>
        ) : (
          <button className="px-4 py-1.5 rounded-full bg-accent/10 text-accent text-xs font-semibold hover:bg-accent/20 transition-colors shrink-0">
            {item.kind === 'calendar' ? 'View event' : 'Open'}
          </button>
        )}
        <span className="text-xs text-app-muted w-16 text-right shrink-0">
          {formatConversationTimestamp(item.createdAt)}
        </span>
        <button className="text-app-muted hover:text-app-text p-1 shrink-0">
          <FiMoreHorizontal className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

type ActivityViewProps = {
  notifications: NotificationItem[];
  pendingFriends: PendingFriendItem[];
  conversations: ConversationItem[];
  loading: boolean;
  error: string;
  onRetry: () => void;
  onNotificationClick: (notification: NotificationItem) => void;
  onRespondFriend?: (id: string, status: 'ACCEPTED' | 'DECLINED') => void;
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
}: ActivityViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<ActivityFilter>('All');
  const [showBanner, setShowBanner] = useState(true);

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

  const filteredItems = useMemo(() => {
    let items = combinedItems;
    if (activeFilter === 'Requests') items = items.filter(i => i.kind === 'request');
    else if (activeFilter === 'Reactions') items = items.filter(i => i.kind === 'reaction');
    else if (activeFilter === 'Mentions') items = items.filter(i => i.kind === 'mention');
    else if (activeFilter === 'Replies') items = items.filter(i => i.kind === 'reply');
    else if (activeFilter === 'Unread') items = items.filter(i => i.isUnread);

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(i => i.title.toLowerCase().includes(q) || i.body.toLowerCase().includes(q));
    }
    return items;
  }, [activeFilter, combinedItems, searchQuery]);

  const groupedItems = groupItemsByDate(filteredItems);
  const unreadCount = combinedItems.filter(i => i.isUnread).length;

  return (
    <div className="flex h-full flex-col bg-app-surface text-app-text font-sans">
      <header className="px-8 pt-8 pb-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-app-text">Activity</h1>
            <p className="text-sm text-app-muted mt-1">Stay updated with what's happening in your workspace</p>
          </div>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent/10 text-accent text-xs font-semibold hover:bg-accent/20 transition-colors">
            <FiCheck className="h-3.5 w-3.5" />
            Mark all as read
          </button>
        </div>
        
        <div className="relative mt-6">
          <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-app-muted">
            <SearchIcon />
          </span>
          <input
            type="text"
            placeholder="Search chats, messages, contacts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-app-card/60 border border-app-border/80 rounded-xl py-2.5 pl-10 pr-16 text-sm text-app-text focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all placeholder:text-app-muted/70"
          />
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <span className="text-[10px] font-medium text-app-muted bg-app-inset border border-app-border px-1.5 py-0.5 rounded">Ctrl K</span>
          </div>
        </div>
      </header>

      <div className="px-8 py-3 flex gap-2.5 overflow-x-auto no-scrollbar border-b border-app-border/40">
        {FILTERS.map(filter => {
          const isActive = activeFilter === filter.id;
          let count = 0;
          if (filter.id === 'All') count = combinedItems.filter(i => i.isUnread).length;
          else if (filter.id === 'Unread') count = unreadCount; // Wait, Unread filter tab doesn't need a count since All shows total unread
          else if (filter.id === 'Requests') count = combinedItems.filter(i => i.kind === 'request' && i.isUnread).length;
          else if (filter.id === 'Reactions') count = combinedItems.filter(i => i.kind === 'reaction' && i.isUnread).length;
          else if (filter.id === 'Mentions') count = combinedItems.filter(i => i.kind === 'mention' && i.isUnread).length;
          else if (filter.id === 'Replies') count = combinedItems.filter(i => i.kind === 'reply' && i.isUnread).length;
          
          return (
            <button
              key={filter.id}
              onClick={() => setActiveFilter(filter.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[13px] font-medium transition-all ${
                isActive 
                  ? 'border border-accent bg-accent/5 text-accent shadow-sm' 
                  : 'border border-app-border/80 bg-app-surface text-app-muted hover:bg-app-card hover:text-app-text'
              }`}
            >
              {filter.icon && <span className="opacity-80">{filter.icon}</span>}
              {filter.label}
              {(count > 0 && filter.id !== 'Unread') && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  isActive ? 'bg-accent text-white' : 'bg-app-inset text-app-muted'
                }`}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className="flex-1 overflow-y-auto px-8 pb-10">
        {showBanner && (
          <div className="mt-6 mb-8 flex items-center justify-between bg-[#fcf8f9] dark:bg-accent/5 border border-accent/10 rounded-2xl p-4 shadow-sm relative overflow-hidden">
            <div className="flex items-center gap-4 relative z-10">
              <div className="bg-white dark:bg-app-card p-2 rounded-xl shadow-sm border border-app-border/50 text-accent">
                <FiBarChart2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-app-text text-sm">{combinedItems.length} notifications</h3>
                <p className="text-xs text-app-muted mt-0.5">{unreadCount} unread - Keep up with your team's activity</p>
              </div>
            </div>
            <div className="flex items-center gap-4 relative z-10 mr-4">
               <div className="text-right">
                  <h3 className="font-bold text-app-text text-sm">You're all caught up!</h3>
                  <p className="text-xs text-app-muted mt-0.5">Great job staying connected</p>
               </div>
            </div>
            <button 
              onClick={() => setShowBanner(false)}
              className="absolute top-3 right-3 text-app-muted hover:text-app-text p-1 z-10"
            >
              <FiX className="h-4 w-4" />
            </button>
          </div>
        )}

        {loading ? (
          <div className="py-12 text-center text-sm text-app-muted">Loading activity...</div>
        ) : error ? (
          <div className="py-12 text-center">
            <p className="text-sm text-accent-soft mb-3">{error}</p>
            <button onClick={onRetry} className="px-4 py-2 rounded-xl bg-app-card border border-app-border text-sm font-semibold hover:bg-app-inset transition-colors">Try again</button>
          </div>
        ) : filteredItems.length === 0 ? (
           <div className="py-12 text-center text-sm text-app-muted">No activity matches this filter.</div>
        ) : (
          <div className="flex flex-col gap-8 mt-6">
            {Object.entries(groupedItems).map(([groupName, group]) => (
              <div key={groupName}>
                <div className="flex items-center justify-between mb-4 border-b border-app-border/30 pb-2">
                  <h2 className="text-sm font-bold text-app-text">{groupName}</h2>
                  <span className="text-[11px] font-medium text-app-muted">{group.dateStr}</span>
                </div>
                <div className="flex flex-col gap-1">
                  {group.items.map(item => (
                    <button
                      key={item.id}
                      onClick={() => item.notification && onNotificationClick(item.notification)}
                      className="group text-left px-2 py-2.5 rounded-xl hover:bg-app-card/60 transition-colors"
                    >
                      <ActivityRowContent item={item} conversations={conversations} />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
