import { useMemo, useState } from 'react';
import type { NotificationItem, PendingFriendItem } from '../../shared/messages';
import { isNotificationClickable } from '../../shared/messages';
import type { ConversationItem } from '../../shared/chat';
import { validateSearchQuery } from '../../shared/chat';
import { formatConversationTimestamp } from './format';
import { SearchIcon } from './ChatIcons';

const FILTERS = ['All', 'Unread', 'Requests', 'Mentions', 'Replies', 'Reactions'] as const;

type ActivityFilter = (typeof FILTERS)[number];
type ActivityKind = 'message' | 'reaction' | 'mention' | 'reply' | 'request' | 'calendar';

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

  if (haystack.includes('reaction')) {
    return 'reaction';
  }

  if (haystack.includes('mention')) {
    return 'mention';
  }

  if (haystack.includes('reply') || haystack.includes('replied')) {
    return 'reply';
  }

  if (
    haystack.includes('calendar') ||
    haystack.includes('event accepted') ||
    haystack.includes('event declined') ||
    haystack.includes('event shared')
  ) {
    return 'calendar';
  }

  if (
    haystack.includes('hub invite') ||
    haystack.includes('group invitation') ||
    haystack.includes('group invite') ||
    haystack.includes('friend request') ||
    haystack.includes('added you')
  ) {
    return 'request';
  }

  return 'message';
}

function ActivityKindIcon({ kind }: { kind: ActivityKind }) {
  const iconClass = 'text-accent-soft';

  if (kind === 'reaction') {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true" className={iconClass}>
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" />
        <circle cx="9" cy="10" r="1" fill="currentColor" />
        <circle cx="15" cy="10" r="1" fill="currentColor" />
        <path d="M8.5 14.5c1.2 1.3 2.6 2 3.5 2s2.3-.7 3.5-2" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      </svg>
    );
  }

  if (kind === 'mention') {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true" className={iconClass}>
        <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.75" />
        <path
          d="M16 8v5a3 3 0 1 0 6 0v-1a8 8 0 1 0-2.343 5.657"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  if (kind === 'reply') {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true" className={iconClass}>
        <path
          d="M9 17H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v3"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="m13 15 3-3-3-3M16 12H9" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (kind === 'request') {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true" className={iconClass}>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="1.75" />
        <path d="M19 8v6M22 11h-6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      </svg>
    );
  }

  if (kind === 'calendar') {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true" className={iconClass}>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true" className={iconClass}>
      <path
        d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ActivityRowContent({ item }: { item: ActivityListItem }) {
  return (
    <>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-accent/25 bg-accent/[0.08]">
        <ActivityKindIcon kind={item.kind} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-app-text">{item.title}</p>
        {item.body ? <p className="mt-0.5 text-sm text-app-muted">{item.body}</p> : null}
      </div>
      {item.createdAt ? (
        <span className="shrink-0 pt-0.5 text-xs text-app-muted">
          {formatConversationTimestamp(item.createdAt)}
        </span>
      ) : null}
    </>
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
  const [searchError, setSearchError] = useState('');
  const [activeFilter, setActiveFilter] = useState<ActivityFilter>('All');

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
      body: item.body,
      createdAt: item.createdAt,
      kind: classifyNotification(item),
      notification: item,
      isUnread: !item.isRead,
    }));

    return [...pendingItems, ...notificationItems];
  }, [notifications, pendingFriends]);

  const filteredItems = useMemo(() => {
    const validation = validateSearchQuery(searchQuery);
    let items = combinedItems;

    if (activeFilter === 'Requests') {
      items = items.filter((item) => item.kind === 'request');
    } else if (activeFilter === 'Reactions') {
      items = items.filter((item) => item.kind === 'reaction');
    } else if (activeFilter === 'Mentions') {
      items = items.filter((item) => item.kind === 'mention');
    } else if (activeFilter === 'Replies') {
      items = items.filter((item) => item.kind === 'reply');
    } else if (activeFilter === 'Unread') {
      items = items.filter((item) => item.isUnread);
    }

    if (validation.ok && validation.value) {
      const query = validation.value.toLowerCase();
      items = items.filter(
        (item) =>
          item.title.toLowerCase().includes(query) || item.body.toLowerCase().includes(query),
      );
    }

    return items;
  }, [activeFilter, combinedItems, searchQuery]);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    const validation = validateSearchQuery(value);
    setSearchError(validation.ok ? '' : validation.error);
  };

  return (
    <div className="flex h-full flex-col bg-app-chat-bg">
      <header className="border-b border-app-border px-8 py-6">
        <h1 className="mb-4 text-[1.75rem] font-bold text-app-text">Activity</h1>
        <div className="relative max-w-3xl">
          <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-app-placeholder">
            <SearchIcon />
          </span>
          <input
            type="text"
            value={searchQuery}
            placeholder="Search people, chats, messages..."
            aria-invalid={Boolean(searchError)}
            className={`w-full rounded-[12px] border bg-app-surface-input py-3 pr-4 pl-11 text-sm text-app-text outline-none placeholder:text-app-placeholder ${
              searchError ? 'border-accent' : 'border-app-border'
            }`}
            onChange={(event) => handleSearchChange(event.target.value)}
          />
        </div>
        {searchError ? (
          <p className="mt-2 text-xs text-accent-soft" role="alert">
            {searchError}
          </p>
        ) : null}
      </header>

      <div className="flex flex-wrap gap-2 border-b border-app-border px-8 py-4">
        {FILTERS.map((filter) => (
          <button
            key={filter}
            type="button"
            className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
              activeFilter === filter
                ? 'border-accent text-accent-soft'
                : 'border-app-border text-app-muted hover:border-app-border-strong hover:text-app-text'
            }`}
            onClick={() => setActiveFilter(filter)}
          >
            {filter}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-8 py-4">
        {loading ? (
          <p className="text-sm text-app-muted" role="status">
            Loading activity...
          </p>
        ) : null}

        {!loading && error ? (
          <div role="alert">
            <p className="mb-3 text-sm text-accent-soft">{error}</p>
            <button
              type="button"
              className="rounded-[10px] border border-app-border bg-app-surface px-3 py-2 text-sm text-app-text"
              onClick={onRetry}
            >
              Try again
            </button>
          </div>
        ) : null}

        {!loading && !error ? (
          <div className="flex flex-col">
            {filteredItems.map((item) => {
              const isClickable =
                Boolean(item.notification) &&
                isNotificationClickable(item.notification!, conversations);

              if (isClickable && item.notification) {
                return (
                  <button
                    key={item.id}
                    type="button"
                    className="flex w-full items-start gap-3 border-b border-app-border/40 px-1 py-4 text-left transition-colors hover:bg-app-chat-hover"
                    onClick={() => onNotificationClick(item.notification!)}
                  >
                    <ActivityRowContent item={item} />
                  </button>
                );
              }

              return (
                <div key={item.id} className="border-b border-app-border/40 px-1 py-4">
                  <div className="flex items-start gap-3">
                    <ActivityRowContent item={item} />
                  </div>
                  {item.kind === 'request' && onRespondFriend ? (
                    <div className="mt-3 flex gap-2 pl-[52px]">
                      <button
                        type="button"
                        className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-accent-hover"
                        onClick={() => onRespondFriend(item.id.replace('pending-', ''), 'ACCEPTED')}
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        className="rounded-lg border border-app-border bg-app-surface px-3 py-1.5 text-xs font-semibold text-app-text transition-colors hover:bg-app-chat-hover"
                        onClick={() => onRespondFriend(item.id.replace('pending-', ''), 'DECLINED')}
                      >
                        Decline
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })}

            {filteredItems.length === 0 ? (
              <p className="py-8 text-sm text-app-muted" role="status">
                No activity matches this filter.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
