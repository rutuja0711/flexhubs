import type { CalendarEventItem } from '../shared/features';

const REMINDED_EVENTS_KEY = 'flexhubs.calendar.reminded';

function readRemindedEventIds(): Set<string> {
  try {
    const stored = sessionStorage.getItem(REMINDED_EVENTS_KEY);
    if (!stored) {
      return new Set();
    }

    const parsed = JSON.parse(stored) as unknown;
    if (!Array.isArray(parsed)) {
      return new Set();
    }

    return new Set(parsed.filter((value): value is string => typeof value === 'string'));
  } catch {
    return new Set();
  }
}

function writeRemindedEventIds(ids: Set<string>): void {
  sessionStorage.setItem(REMINDED_EVENTS_KEY, JSON.stringify([...ids]));
}

export function scheduleCalendarReminders(
  events: CalendarEventItem[],
  onReminder: (event: CalendarEventItem) => void,
): () => void {
  const timers: number[] = [];
  const reminded = readRemindedEventIds();
  const now = Date.now();
  const maxDelayMs = 7 * 24 * 60 * 60 * 1000;

  for (const event of events) {
    if (!event.startsAt || reminded.has(event.id)) {
      continue;
    }

    const startsAt = new Date(event.startsAt).getTime();
    if (Number.isNaN(startsAt)) {
      continue;
    }

    const delay = startsAt - now;
    if (delay <= 0 || delay > maxDelayMs) {
      continue;
    }

    const timer = window.setTimeout(() => {
      reminded.add(event.id);
      writeRemindedEventIds(reminded);
      onReminder(event);
    }, delay);

    timers.push(timer);
  }

  return () => {
    for (const timer of timers) {
      window.clearTimeout(timer);
    }
  };
}
