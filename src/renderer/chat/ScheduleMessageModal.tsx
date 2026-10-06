import { useCallback, useEffect, useMemo, useState } from 'react';
import { isPendingScheduledMessage, type ScheduledMessageItem } from '../../shared/extras';
import {
  deleteConversationScheduledMessage,
  loadConversationScheduledMessages,
} from '../chatApi';
import { formatConversationTimestamp } from './format';
import { validateScheduleMessageContent } from '../../shared/messages';
import {
  defaultScheduleDateTimeLocal,
  formatDateTimeLocalValue,
  validateScheduledTime,
} from './scheduleDateTime';

type ScheduleMessageModalProps = {
  open: boolean;
  initialContent: string;
  busy: boolean;
  conversationId?: string;
  onClose: () => void;
  onSchedule: (content: string, scheduledAt: string) => void;
  onUnauthorized?: (status?: number) => boolean;
  onScheduledListChanged?: () => void;
};

export function ScheduleMessageModal({
  open,
  initialContent,
  busy,
  conversationId,
  onClose,
  onSchedule,
  onUnauthorized,
  onScheduledListChanged,
}: ScheduleMessageModalProps) {
  const [content, setContent] = useState(initialContent);
  const [scheduledAt, setScheduledAt] = useState(() => defaultScheduleDateTimeLocal());
  const [timeError, setTimeError] = useState('');
  const [contentError, setContentError] = useState('');
  const [pendingScheduled, setPendingScheduled] = useState<ScheduledMessageItem[]>([]);
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const minValue = useMemo(() => formatDateTimeLocalValue(new Date()), [open]);

  const refreshPendingScheduled = useCallback(async () => {
    if (!conversationId) {
      setPendingScheduled([]);
      return;
    }

    const result = await loadConversationScheduledMessages(conversationId);

    if (!result.ok) {
      if (onUnauthorized?.(result.status)) {
        return;
      }

      return;
    }

    setPendingScheduled(
      result.data.filter(
        (item) => isPendingScheduledMessage(item) && item.content.replace(/\s+/g, ' ').trim().length > 0,
      ),
    );
  }, [conversationId, onUnauthorized]);

  useEffect(() => {
    if (!open) {
      return;
    }

    setContent(initialContent);
    setScheduledAt(defaultScheduleDateTimeLocal());
    setTimeError('');
    setContentError('');
    void refreshPendingScheduled();
  }, [initialContent, open, refreshPendingScheduled]);

  const handleCancelScheduled = async (item: ScheduledMessageItem) => {
    if (!conversationId) {
      return;
    }

    setCancelingId(item.id);
    const result = await deleteConversationScheduledMessage(conversationId, item.id);
    setCancelingId(null);

    if (!result.ok) {
      if (onUnauthorized?.(result.status)) {
        return;
      }

      return;
    }

    await refreshPendingScheduled();
    onScheduledListChanged?.();
  };

  if (!open) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        aria-label="Close schedule dialog"
        className="fixed inset-0 z-40 cursor-default bg-black/60 backdrop-blur-md animate-fade-in"
        onClick={() => !busy && onClose()}
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="pointer-events-auto relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-3xl border border-app-border/80 bg-app-surface/95 backdrop-blur-2xl p-6 shadow-2xl animate-pop-in origin-center">
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-app-border-strong to-transparent pointer-events-none" />

          <h3 className="text-base font-semibold text-app-text tracking-tight">Schedule message</h3>
          <p className="mt-0.5 text-xs text-app-muted">Send this message automatically at a specified time.</p>

          <label className="mb-1.5 mt-5 block text-xs font-medium text-app-muted">Message</label>
          <textarea
            value={content}
            disabled={busy}
            rows={4}
            placeholder="Type the message to send…"
            className="mb-1 w-full rounded-xl border border-app-border/70 bg-app-surface-input px-3.5 py-2.5 text-sm text-app-text outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
            onChange={(event) => {
              setContent(event.target.value);
              setContentError('');
            }}
          />
          {contentError ? (
            <p className="mb-3 text-xs font-medium text-accent-soft">{contentError}</p>
          ) : (
            <div className="mb-3" />
          )}

          <label className="mb-1.5 block text-xs font-medium text-app-muted">Send at</label>
          <input
            type="datetime-local"
            value={scheduledAt}
            min={minValue}
            disabled={busy}
            className="datetime-input mb-1 w-full rounded-xl border border-app-border/70 bg-app-surface-input px-3.5 py-2.5 text-sm text-app-text outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
            onChange={(event) => {
              setScheduledAt(event.target.value);
              setTimeError('');
            }}
          />
          {timeError ? <p className="mb-4 text-xs font-medium text-accent-soft">{timeError}</p> : <div className="mb-4" />}

          {conversationId && pendingScheduled.length > 0 ? (
            <div className="mb-4 border-t border-app-border/60 pt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-app-muted">
                Pending in this chat
              </p>
              <ul className="space-y-2">
                {pendingScheduled.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-start justify-between gap-2 rounded-xl border border-app-border/60 bg-app-card/50 px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-app-text">{item.content.trim()}</p>
                      <p className="mt-0.5 text-[11px] text-app-muted">
                        {item.scheduledAt ? formatConversationTimestamp(item.scheduledAt) : 'Scheduled'}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={cancelingId === item.id}
                      className="shrink-0 text-[11px] font-semibold text-accent-soft hover:underline disabled:opacity-50"
                      onClick={() => void handleCancelScheduled(item)}
                    >
                      {cancelingId === item.id ? '…' : 'Cancel'}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="flex justify-end gap-2.5 pt-2">
            <button
              type="button"
              disabled={busy}
              className="rounded-xl border border-app-border/70 bg-app-card px-4 py-2 text-xs font-semibold text-app-text hover:bg-app-inset transition-colors disabled:opacity-50"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={busy || !content.trim() || !scheduledAt}
              className="rounded-xl bg-gradient-to-r from-accent to-[#632a38] px-4 py-2 text-xs font-semibold text-white shadow-md shadow-accent/20 hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 transition-all"
              onClick={() => {
                const contentValidation = validateScheduleMessageContent(content);
                if (!contentValidation.ok) {
                  setContentError(contentValidation.error);
                  return;
                }

                const validation = validateScheduledTime(scheduledAt);

                if (!validation.ok) {
                  setTimeError(validation.error);
                  return;
                }

                onSchedule(contentValidation.content, new Date(validation.timestamp).toISOString());
              }}
            >
              Schedule message
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
