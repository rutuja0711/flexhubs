import type { CalendarEventItem } from '../../shared/features';
import { formatConversationTimestamp } from './format';

type CalendarViewProps = {
  events: CalendarEventItem[];
  loading: boolean;
  error: string;
  onRetry: () => void;
};

export function CalendarView({ events, loading, error, onRetry }: CalendarViewProps) {
  return (
    <div className="flex h-full flex-col bg-app-chat-bg">
      <header className="flex items-center justify-between border-b border-app-border px-8 py-6">
        <h1 className="text-[1.75rem] font-bold text-app-text">Calendar</h1>
        <button
          type="button"
          disabled
          title="Scheduling events is not available in the desktop app yet"
          className="cursor-not-allowed rounded-[10px] bg-accent/50 px-4 py-2 text-sm font-semibold text-white/80"
        >
          New event
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-8 py-8">
        {loading ? <p className="text-sm text-app-muted">Loading calendar...</p> : null}
        {!loading && error ? (
          <div role="alert">
            <p className="mb-3 text-sm text-accent-soft">{error}</p>
            <button type="button" className="rounded-[10px] border border-app-border px-3 py-2 text-sm" onClick={onRetry}>
              Try again
            </button>
          </div>
        ) : null}
        {!loading && !error && events.length === 0 ? (
          <div className="mx-auto max-w-md text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[16px] border border-app-border bg-app-chat-panel text-app-muted">
              📅
            </div>
            <h2 className="mb-2 text-lg font-semibold text-app-text">Nothing scheduled yet</h2>
            <p className="text-sm text-app-muted">
              Create a private event or schedule a message from chat to see it here. Scheduling from
              the desktop app is coming later — for now you can view existing events.
            </p>
          </div>
        ) : null}
        {!loading && !error && events.length > 0 ? (
          <div className="flex flex-col gap-3">
            {events.map((event) => (
              <div key={event.id} className="rounded-[12px] border border-app-border bg-app-surface p-4">
                <p className="font-medium text-app-text">{event.title}</p>
                {event.startsAt ? (
                  <p className="text-sm text-app-muted">{formatConversationTimestamp(event.startsAt)}</p>
                ) : null}
                {event.description ? <p className="mt-1 text-sm text-app-muted">{event.description}</p> : null}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
