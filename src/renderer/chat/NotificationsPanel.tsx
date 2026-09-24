import { useEffect } from 'react';
import { formatNotificationDisplayBody } from '../../shared/calls';
import type { NotificationItem, PendingFriendItem } from '../../shared/messages';
import { formatConversationTimestamp } from './format';

type NotificationsPanelProps = {
  notifications: NotificationItem[];
  pendingFriends: PendingFriendItem[];
  loading: boolean;
  error: string;
  containerRef: React.RefObject<HTMLElement | null>;
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
        <p className="text-xs font-semibold text-app-text">{title}</p>
        {createdAt ? (
          <span className="shrink-0 text-[10px] font-medium text-app-muted">
            {formatConversationTimestamp(createdAt)}
          </span>
        ) : null}
      </div>
      {body ? <p className="text-xs leading-relaxed text-app-muted/90">{body}</p> : null}
    </>
  );

  if (!onClick) {
    return (
      <div className="border-b border-app-border/60 px-3.5 py-2.5 last:border-b-0">{content}</div>
    );
  }

  return (
    <button
      type="button"
      className="block w-full border-b border-app-border/60 px-3.5 py-2.5 text-left transition-colors hover:bg-app-chat-hover/80 last:border-b-0"
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
  containerRef,
  onClose,
  onNotificationClick,
}: NotificationsPanelProps) {
  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [containerRef, onClose]);

  const hubInvites = notifications.filter((item) =>
    item.type.toLowerCase().includes('hub') || item.title.toLowerCase().includes('hub invite'),
  );

  const otherNotifications = notifications.filter((item) => !hubInvites.includes(item));

  return (
    <div
      className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-app-border/70 bg-app-chat-sidebar shadow-lg shadow-black/[0.06] dark:shadow-black/30 animate-notification-drop origin-top"
      role="dialog"
      aria-label="Notifications"
    >
      <div className="border-b border-app-border/60 bg-black/[0.03] px-4 py-3 dark:bg-white/[0.03]">
        <h2 className="text-xs font-bold uppercase tracking-wider text-app-text">Notifications</h2>
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
                body={formatNotificationDisplayBody(item.body)}
                createdAt={item.createdAt}
              />
            ))}

            {hubInvites.map((item) => (
              <PanelItem
                key={`hub-${item.id}`}
                title={item.title || 'Hub invite'}
                body={formatNotificationDisplayBody(item.body)}
                createdAt={item.createdAt}
                onClick={() => onNotificationClick(item)}
              />
            ))}

            {otherNotifications.map((item) => (
              <PanelItem
                key={item.id}
                title={item.title}
                body={formatNotificationDisplayBody(item.body)}
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
  );
}
