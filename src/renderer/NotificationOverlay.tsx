import React, { useEffect, useState } from 'react';
import { FlexHubsDesktopNotification, FlexHubsNotificationData } from './ui/notifications/FlexHubsDesktopNotification';

export default function NotificationOverlay() {
  const [notification, setNotification] = useState<FlexHubsNotificationData | null>(null);

  useEffect(() => {
    // Make sure background is totally transparent
    document.body.style.backgroundColor = 'transparent';
    document.documentElement.style.backgroundColor = 'transparent';
    
    // Provide a small drag region if needed, but frameless usually handles it.
    
    const handleRender = (payload: FlexHubsNotificationData) => {
      setNotification({
        ...payload,
        onClick: () => {
          window.electronAPI?.sendNotificationAction?.('click');
        },
        onDismiss: () => {
          window.electronAPI?.sendNotificationAction?.('dismiss');
        },
      });
    };

    const cleanupRender = window.electronAPI?.onNotificationRender?.(handleRender);

    return () => {
      cleanupRender?.();
    };
  }, []);

  if (!notification) {
    return null;
  }

  return (
    <div
      className="flex h-full w-full items-start justify-end overflow-hidden p-2 pointer-events-none"
      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
    >
      <div className="pointer-events-auto">
        <FlexHubsDesktopNotification data={notification} />
      </div>
    </div>
  );
}
