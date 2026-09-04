import { useMemo, useState } from 'react';
import type { NotificationItem, PendingFriendItem } from '../../shared/messages';
import { validateSearchQuery } from '../../shared/chat';
import { formatConversationTimestamp } from './format';
import { SearchIcon } from './ChatIcons';

const FILTERS = ['All', 'Unread', 'Requests', 'Mentions', 'Replies', 'Reactions'] as const;

type ActivityFilter = (typeof FILTERS)[number];

type ActivityViewProps = {
  notifications: NotificationItem[];
  pendingFriends: PendingFriendItem[];
  loading: boolean;
  error: string;
  onRetry: () => void;
  onNotificationClick: (notification: NotificationItem) => void;
  onRespondFriend?: (id: string, status: 'ACCEPTED' | 'DECLINED') => void;
};

export function ActivityView({
  notifications,
  pendingFriends,
  loading,
  error,
  onRetry,
  onNotificationClick,
  onRespondFriend,
}: ActivityViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchError, setSearchError] = useState('');
  const [activeFilter, setActiveFilter] = useState<ActivityFilter>('All');

  const combinedItems = useMemo(() => {
    const pendingItems = pendingFriends.map((item) => ({
      id: `pending-${item.id}`,
      title: item.title,
      body: item.body,
      createdAt: item.createdAt,
      kind: 'request' as const,
      notification: null as NotificationItem | null,
    }));

    const notificationItems = notifications.map((item) => ({
      id: item.id,
      title: item.title,
      body: item.body,
      createdAt: item.createdAt,
      kind:
        item.type.toLowerCase().includes('reaction') || item.title.toLowerCase().includes('reaction')
          ? ('reaction' as const)
          : item.type.toLowerCase().includes('mention') || item.title.toLowerCase().includes('mention')
            ? ('mention' as const)
            : item.type.toLowerCase().includes('hub') || item.title.toLowerCase().includes('hub invite')
              ? ('request' as const)
              : ('message' as const),
      notification: item,
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
          <div className="flex flex-col gap-1">
            {filteredItems.map((item) => {
              const isClickable = Boolean(item.notification);

              if (isClickable && item.notification) {
                return (
                  <button
                    key={item.id}
                    type="button"
                    className="flex w-full items-start justify-between gap-4 rounded-xl px-3 py-3 text-left transition-colors hover:bg-app-chat-hover"
                    onClick={() => onNotificationClick(item.notification!)}
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-app-text">{item.title}</p>
                      <p className="text-sm text-app-muted">{item.body}</p>
                    </div>
                    {item.createdAt ? (
                      <span className="shrink-0 text-xs text-app-muted">
                        {formatConversationTimestamp(item.createdAt)}
                      </span>
                    ) : null}
                  </button>
                );
              }

              return (
                <div
                  key={item.id}
                  className="flex flex-col gap-2 rounded-xl px-3 py-3"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-medium text-app-text">{item.title}</p>
                      <p className="text-sm text-app-muted">{item.body}</p>
                    </div>
                    {item.createdAt ? (
                      <span className="shrink-0 pt-1 text-xs text-app-muted">
                        {formatConversationTimestamp(item.createdAt)}
                      </span>
                    ) : null}
                  </div>
                  {item.kind === 'request' && onRespondFriend ? (
                    <div className="mt-1 flex gap-2">
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
