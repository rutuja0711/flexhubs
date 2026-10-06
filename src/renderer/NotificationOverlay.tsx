import React, { useEffect, useState } from 'react';
import { FlexHubsDesktopNotification, FlexHubsNotificationData } from './ui/notifications/FlexHubsDesktopNotification';

export default function NotificationOverlay() {
  const [notification, setNotification] = useState<FlexHubsNotificationData | null>(null);

  useEffect(() => {
    // Make sure background is totally transparent
    document.body.style.backgroundColor = 'transparent';
    document.documentElement.style.backgroundColor = 'transparent';
    
    // Provide a small drag region if needed, but frameless usually handles it.
    
    const cleanup = window.electronAPI?.onDesktopNotificationClick?.(() => {
        // Not used directly here since we send IPC from main
    });

    // Listen for new payloads from main process
    const handleRender = (payload: FlexHubsNotificationData) => {
      setNotification({
        ...payload,
        onClick: () => {
          window.electronAPI?.sendNotificationAction?.('click');
        },
        onDismiss: () => {
          window.electronAPI?.sendNotificationAction?.('dismiss');
        }
      });
    };

    const cleanupRender = window.electronAPI?.onNotificationRender?.(handleRender);

    return () => {
       cleanupRender?.();
    };

    return () => {
       // cleanup
    };
  }, []);

  if (!notification) {
    return null;
  }

  return (
    <div className="h-screen w-screen overflow-hidden p-2 flex items-start justify-end" style={{ WebkitAppRegion: 'no-drag' } as any}>
      <FlexHubsDesktopNotification data={notification} />
    </div>
  );
}
