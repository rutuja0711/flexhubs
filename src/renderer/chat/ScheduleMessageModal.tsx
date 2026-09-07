import { useEffect, useMemo, useState } from 'react';

type ScheduleMessageModalProps = {
  open: boolean;
  initialContent: string;
  busy: boolean;
  onClose: () => void;
  onSchedule: (content: string, scheduledAt: string) => void;
};

function defaultScheduleValue(): string {
  const next = new Date(Date.now() + 60 * 60_000);
  next.setSeconds(0, 0);

  const offsetMinutes = next.getTimezoneOffset();
  const local = new Date(next.getTime() - offsetMinutes * 60_000);
  return local.toISOString().slice(0, 16);
}

export function ScheduleMessageModal({
  open,
  initialContent,
  busy,
  onClose,
  onSchedule,
}: ScheduleMessageModalProps) {
  const [content, setContent] = useState(initialContent);
  const [scheduledAt, setScheduledAt] = useState(defaultScheduleValue);
  const [timeError, setTimeError] = useState('');
  const minValue = useMemo(() => defaultScheduleValue(), [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    setContent(initialContent);
    setScheduledAt(defaultScheduleValue());
    setTimeError('');
  }, [initialContent, open]);

  if (!open) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        aria-label="Close schedule dialog"
        className="fixed inset-0 z-40 cursor-default bg-black/50"
        onClick={() => !busy && onClose()}
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl border border-app-border bg-app-surface p-5 shadow-xl">
          <h3 className="text-lg font-semibold text-app-text">Schedule message</h3>
          <p className="mt-1 text-sm text-app-muted">Send this message later at a set time.</p>

          <label className="mb-1 mt-4 block text-sm text-app-muted">Message</label>
          <textarea
            value={content}
            disabled={busy}
            rows={4}
            className="mb-4 w-full rounded-xl border border-app-border bg-app-surface-input px-3 py-2.5 text-sm text-app-text outline-none focus:border-accent"
            onChange={(event) => setContent(event.target.value)}
          />

          <label className="mb-1 block text-sm text-app-muted">Send at</label>
          <input
            type="datetime-local"
            value={scheduledAt}
            min={minValue}
            disabled={busy}
            className="datetime-input mb-1 w-full rounded-xl border border-app-border bg-app-surface-input px-3 py-2.5 text-sm text-app-text outline-none focus:border-accent"
            onChange={(event) => {
              setScheduledAt(event.target.value);
              setTimeError('');
            }}
          />
          {timeError ? <p className="mb-4 text-sm text-accent-soft">{timeError}</p> : <div className="mb-4" />}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={busy}
              className="rounded-lg px-4 py-2 text-sm text-app-muted hover:bg-app-chat-hover disabled:opacity-50"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={busy || !content.trim() || !scheduledAt}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => {
                const scheduledTime = Date.parse(scheduledAt);

                if (!Number.isFinite(scheduledTime) || scheduledTime <= Date.now()) {
                  setTimeError('Choose a date and time in the future.');
                  return;
                }

                onSchedule(content.trim(), new Date(scheduledAt).toISOString());
              }}
            >
              {busy ? 'Scheduling…' : 'Schedule'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
