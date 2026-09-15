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
        className="fixed inset-0 z-40 cursor-default bg-black/60 backdrop-blur-md animate-fade-in"
        onClick={() => !busy && onClose()}
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="pointer-events-auto relative w-full max-w-md overflow-hidden rounded-3xl border border-app-border/80 bg-app-surface/95 backdrop-blur-2xl p-6 shadow-2xl animate-pop-in origin-center">
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-app-border-strong to-transparent pointer-events-none" />

          <h3 className="text-base font-semibold text-app-text tracking-tight">Schedule message</h3>
          <p className="mt-0.5 text-xs text-app-muted">Send this message automatically at a specified time.</p>

          <label className="mb-1.5 mt-5 block text-xs font-medium text-app-muted">Message</label>
          <textarea
            value={content}
            disabled={busy}
            rows={4}
            className="mb-4 w-full rounded-xl border border-app-border/70 bg-app-surface-input px-3.5 py-2.5 text-sm text-app-text outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
            onChange={(event) => setContent(event.target.value)}
          />

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
                const scheduledTime = Date.parse(scheduledAt);

                if (!Number.isFinite(scheduledTime) || scheduledTime <= Date.now()) {
                  setTimeError('Choose a date and time in the future.');
                  return;
                }

                onSchedule(content.trim(), new Date(scheduledTime).toISOString());
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
