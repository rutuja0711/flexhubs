import { useEffect, useRef, useState } from 'react';
import {
  FlexHubsDesktopNotification,
  type FlexHubsNotificationData,
} from './FlexHubsDesktopNotification';

const TOAST_VISIBLE_MS = 7000;

function normalizeToastPayload(
  raw: Partial<FlexHubsNotificationData> & {
    tag?: string;
    conversationId?: string | null;
    messageId?: string | null;
  },
): FlexHubsNotificationData & { tag?: string; conversationId?: string | null; messageId?: string | null } {
  const tag = raw.tag ?? raw.id;
  return {
    id: raw.id ?? tag ?? `toast-${Date.now()}`,
    type: raw.type ?? 'text_message',
    title: (raw.title ?? 'FlexHubs').trim() || 'FlexHubs',
    body: raw.body?.trim() ?? '',
    timestamp: raw.timestamp ?? new Date().toISOString(),
    subtitle: raw.subtitle,
    priority: raw.priority,
    isUnread: raw.isUnread ?? true,
    avatarInitials: raw.avatarInitials,
    avatarUrl: raw.avatarUrl,
    isSystem: raw.isSystem,
    tag,
    conversationId: raw.conversationId ?? null,
    messageId: raw.messageId ?? null,
  };
}

export function DesktopToastHost() {
  const [toast, setToast] = useState<
    (FlexHubsNotificationData & { tag?: string; conversationId?: string | null; messageId?: string | null }) | null
  >(null);
  const hideTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const clearHideTimer = () => {
      if (hideTimerRef.current != null) {
        window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };

    const scheduleHide = () => {
      clearHideTimer();
      hideTimerRef.current = window.setTimeout(() => {
        setToast(null);
        hideTimerRef.current = null;
      }, TOAST_VISIBLE_MS);
    };

    const handleToast = (
      payload: Partial<FlexHubsNotificationData> & {
        tag?: string;
        conversationId?: string | null;
        messageId?: string | null;
      },
    ) => {
      setToast(normalizeToastPayload(payload));
      scheduleHide();
    };

    const cleanup = window.electronAPI?.onNotificationToast?.(handleToast);

    return () => {
      cleanup?.();
      clearHideTimer();
    };
  }, []);

  if (!toast) {
    return null;
  }

  const dismissAndNavigate = () => {
    window.electronAPI?.sendDesktopToastClick?.({
      tag: toast.tag ?? toast.id,
      conversationId: toast.conversationId ?? null,
      messageId: toast.messageId ?? null,
    });
    setToast(null);
  };

  return (
    <div
      className="pointer-events-none fixed bottom-5 right-5 z-[12000] flex max-w-[calc(100vw-2rem)] justify-end"
      aria-live="polite"
    >
      <div className="pointer-events-auto">
        <FlexHubsDesktopNotification
          variant="toast"
          data={{
            ...toast,
            onClick: dismissAndNavigate,
          }}
        />
      </div>
    </div>
  );
}
