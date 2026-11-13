import { FiCalendar } from 'react-icons/fi';
import type { FlexhubCalendarEventAnnouncement } from '../../shared/calendarChat';
import { formatCalendarEventAnnouncementWhen } from '../../shared/calendarChat';

type CalendarEventMessageProps = {
  event: FlexhubCalendarEventAnnouncement;
  onViewEvent?: (eventId: string) => void;
};

export function CalendarEventMessage({ event, onViewEvent }: CalendarEventMessageProps) {
  const whenLabel = formatCalendarEventAnnouncementWhen(event.startsAt, event.endsAt);
  const headline =
    event.action === 'updated'
      ? `Event updated: ${event.title}`
      : `Meeting scheduled: ${event.title}`;

  return (
    <div className="flex w-full max-w-2xl items-center gap-3 rounded-2xl border border-app-border bg-app-chat-bg/80 px-4 py-3 shadow-sm">
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-500/15 text-rose-500"
        aria-hidden
      >
        <FiCalendar className="h-4 w-4" strokeWidth={2.25} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-app-text">{headline}</p>
        {whenLabel ? <p className="mt-0.5 text-xs text-app-muted">{whenLabel}</p> : null}
      </div>

      {onViewEvent ? (
        <button
          type="button"
          onClick={() => onViewEvent(event.eventId)}
          className="shrink-0 rounded-xl border border-app-border bg-app-surface px-3 py-1.5 text-xs font-medium text-app-text transition-colors hover:bg-app-chat-hover"
        >
          View Event →
        </button>
      ) : null}
    </div>
  );
}
