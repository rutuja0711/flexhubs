import type { NotificationItem, PendingFriendItem } from '../../shared/messages';
import { formatConversationTimestamp } from './format';

type NotificationsPanelProps = {
  notifications: NotificationItem[];
  pendingFriends: PendingFriendItem[];
  loading: boolean;
  error: string;
  onClose: () => void;
  onNotificationClick: (notification: NotificationItem) => void;
};

function PanelItem({
  title,
  body,
  createdAt,
  onClick,
}: {
  title: string;
  body: string;
  createdAt: string;
  onClick?: () => void;
}) {
  const content = (
    <>
      <div className="mb-1 flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-app-text">{title}</p>
        {createdAt ? (
          <span className="shrink-0 text-xs text-app-muted">
            {formatConversationTimestamp(createdAt)}
          </span>
        ) : null}
      </div>
      {body ? <p className="text-sm leading-snug text-app-muted">{body}</p> : null}
    </>
  );

  if (!onClick) {
    return (
      <div className="border-b border-app-border px-4 py-3 last:border-b-0">{content}</div>
    );
  }

  return (
    <button
      type="button"
      className="block w-full border-b border-app-border px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-app-chat-hover"
      onClick={onClick}
    >
      {content}
    </button>
  );
}

export function NotificationsPanel({
  notifications,
  pendingFriends,
  loading,
  error,
  onClose,
  onNotificationClick,
}: NotificationsPanelProps) {
  const hubInvites = notifications.filter((item) =>
    item.type.toLowerCase().includes('hub') || item.title.toLowerCase().includes('hub invite'),
  );

  const otherNotifications = notifications.filter((item) => !hubInvites.includes(item));

  return (
    <>
      <button
        type="button"
        aria-label="Close notifications"
        className="fixed inset-0 z-40 bg-black/20"
        onClick={onClose}
      />
      <div className="absolute top-12 right-4 z-50 w-[320px] overflow-hidden rounded-[14px] border border-app-border bg-app-surface shadow-app">
        <div className="border-b border-app-border px-4 py-3">
          <h2 className="text-sm font-semibold text-app-text">Notifications</h2>
        </div>

        <div className="max-h-[420px] overflow-y-auto">
          {loading ? (
            <p className="px-4 py-6 text-sm text-app-muted" role="status">
              Loading notifications...
            </p>
          ) : null}

          {!loading && error ? (
            <p className="px-4 py-6 text-sm text-accent-soft" role="alert">
              {error}
            </p>
          ) : null}

          {!loading && !error ? (
            <>
              {pendingFriends.map((item) => (
                <PanelItem
                  key={`pending-${item.id}`}
                  title={item.title}
                  body={item.body}
                  createdAt={item.createdAt}
                />
              ))}

              {hubInvites.map((item) => (
                <PanelItem
                  key={`hub-${item.id}`}
                  title={item.title || 'Hub invite'}
                  body={item.body}
                  createdAt={item.createdAt}
                  onClick={() => onNotificationClick(item)}
                />
              ))}

              {otherNotifications.map((item) => (
                <PanelItem
                  key={item.id}
                  title={item.title}
                  body={item.body}
                  createdAt={item.createdAt}
                  onClick={() => onNotificationClick(item)}
                />
              ))}

              {pendingFriends.length === 0 &&
              hubInvites.length === 0 &&
              otherNotifications.length === 0 ? (
                <p className="px-4 py-6 text-sm text-app-muted" role="status">
                  No notifications right now.
                </p>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </>
  );
}
