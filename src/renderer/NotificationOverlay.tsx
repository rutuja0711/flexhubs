import React, { useEffect, useState } from 'react';
import { FlexHubsDesktopNotification, FlexHubsNotificationData } from './ui/notifications/FlexHubsDesktopNotification';

function normalizePayload(raw: Partial<FlexHubsNotificationData> & { tag?: string }): FlexHubsNotificationData {
  const id = raw.id ?? raw.tag ?? `toast-${Date.now()}`;
  const title = (raw.title ?? 'FlexHubs').trim() || 'FlexHubs';
  const body = raw.body?.trim() ?? '';
  const timestamp = raw.timestamp ?? new Date().toISOString();

  return {
    id,
    type: raw.type ?? 'text_message',
    title,
    body,
    timestamp,
    subtitle: raw.subtitle,
    priority: raw.priority,
    isUnread: raw.isUnread ?? true,
    avatarInitials: raw.avatarInitials,
    avatarUrl: raw.avatarUrl,
    isSystem: raw.isSystem,
    onClick: () => {
      window.electronAPI?.sendNotificationAction?.('click');
    },
  };
}

export default function NotificationOverlay() {
  const [notification, setNotification] = useState<FlexHubsNotificationData | null>(null);

  useEffect(() => {
    document.documentElement.classList.add('notification-shell');
    document.body.style.backgroundColor = 'transparent';
    document.documentElement.style.backgroundColor = 'transparent';

    const handleRender = (payload: Partial<FlexHubsNotificationData> & { tag?: string }) => {
      setNotification(normalizePayload(payload));
    };

    const cleanupRender = window.electronAPI?.onNotificationRender?.(handleRender);
    window.electronAPI?.sendNotificationReady?.();

    return () => {
      cleanupRender?.();
    };
  }, []);

  if (!notification) {
    return null;
  }

  return (
    <div
      className="flex h-full w-full items-start justify-end overflow-hidden p-2"
      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
    >
      <FlexHubsDesktopNotification data={notification} />
    </div>
  );
}
