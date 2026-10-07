import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
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
  const cardShellRef = useRef<HTMLDivElement>(null);

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

  useLayoutEffect(() => {
    if (!notification || !cardShellRef.current) {
      return;
    }

    const node = cardShellRef.current;
    const reportSize = () => {
      const rect = node.getBoundingClientRect();
      const width = Math.ceil(rect.width + 16);
      const height = Math.ceil(rect.height + 16);
      window.electronAPI?.setNotificationWindowSize?.({ width, height });
    };

    reportSize();
    const observer = new ResizeObserver(reportSize);
    observer.observe(node);
    return () => observer.disconnect();
  }, [notification]);

  if (!notification) {
    return null;
  }

  return (
    <div
      className="flex h-full w-full items-start justify-end overflow-hidden p-2 pointer-events-none"
      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
    >
      <div ref={cardShellRef} className="pointer-events-auto">
        <FlexHubsDesktopNotification data={notification} />
      </div>
    </div>
  );
}
