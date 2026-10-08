import { useEffect } from 'react';
import { useToast } from '../Toast';

function formatIncomingNotificationMessage(payload: {
  title?: string;
  subtitle?: string;
  body?: string;
}): string {
  const title = (payload.title ?? 'FlexHubs').trim() || 'FlexHubs';
  const detail = [payload.subtitle, payload.body]
    .map((part) => (typeof part === 'string' ? part.trim() : ''))
    .filter(Boolean)
    .join(' · ');

  return detail ? `${title} · ${detail}` : title;
}

/** Routes main-process in-app alerts to the single top toast stack (no bottom duplicate). */
export function DesktopNotificationToastBridge() {
  const toast = useToast();

  useEffect(() => {
    const cleanup = window.electronAPI?.onNotificationToast?.((payload) => {
      toast.info(formatIncomingNotificationMessage(payload ?? {}), {
        action: {
          label: 'Open',
          onClick: () => {
            window.electronAPI?.sendDesktopToastClick?.({
              tag: payload?.tag ?? payload?.id,
              conversationId: payload?.conversationId ?? null,
              messageId: payload?.messageId ?? null,
            });
          },
        },
      });
    });

    return () => {
      cleanup?.();
    };
  }, [toast]);

  return null;
}
