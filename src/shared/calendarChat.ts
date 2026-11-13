export type FlexhubCalendarEventAnnouncement = {
  v: 1;
  eventId: string;
  title: string;
  startsAt: string;
  endsAt: string | null;
  action: 'scheduled' | 'updated';
};

const ROOT_KEY = 'flexhubCalendarEvent';

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function buildCalendarEventAnnouncementContent(
  announcement: FlexhubCalendarEventAnnouncement,
): string {
  return JSON.stringify({
    [ROOT_KEY]: announcement,
  });
}

export function parseCalendarEventAnnouncementContent(
  content: string,
): FlexhubCalendarEventAnnouncement | null {
  const trimmed = content.trim();
  if (!trimmed.startsWith('{')) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    const record = asRecord(parsed);
    const payload = asRecord(record?.[ROOT_KEY]) ?? record;

    if (!payload) {
      return null;
    }

    const eventId = readString(payload.eventId);
    const title = readString(payload.title);
    const startsAt = readString(payload.startsAt);
    const actionRaw = readString(payload.action);

    if (!eventId || !title || !startsAt) {
      return null;
    }

    const action = actionRaw === 'updated' ? 'updated' : 'scheduled';

    return {
      v: 1,
      eventId,
      title,
      startsAt,
      endsAt: readString(payload.endsAt),
      action,
    };
  } catch {
    return null;
  }
}

export function isCalendarEventAnnouncementMessage(
  message: Pick<{ content: string; messageType: string | null }, 'content' | 'messageType'>,
): boolean {
  if (parseCalendarEventAnnouncementContent(message.content)) {
    return true;
  }

  return String(message.messageType ?? '').toUpperCase() === 'CALENDAR';
}

function defaultEndsAt(startsAt: string): string {
  const start = new Date(startsAt);
  if (Number.isNaN(start.getTime())) {
    return startsAt;
  }
  return new Date(start.getTime() + 30 * 60_000).toISOString();
}

export function formatCalendarEventAnnouncementWhen(
  startsAt: string,
  endsAt: string | null,
): string {
  const start = new Date(startsAt);
  if (Number.isNaN(start.getTime())) {
    return '';
  }

  const end = new Date(endsAt?.trim() || defaultEndsAt(startsAt));
  const now = new Date();
  const today =
    start.getFullYear() === now.getFullYear() &&
    start.getMonth() === now.getMonth() &&
    start.getDate() === now.getDate();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow =
    start.getFullYear() === tomorrow.getFullYear() &&
    start.getMonth() === tomorrow.getMonth() &&
    start.getDate() === tomorrow.getDate();

  const dayLabel = today ? 'Today' : isTomorrow ? 'Tomorrow' : start.toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  const timeFormat: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };
  const startTime = start.toLocaleTimeString([], timeFormat);
  const endTime = Number.isNaN(end.getTime())
    ? ''
    : end.toLocaleTimeString([], timeFormat);

  return endTime ? `${dayLabel} • ${startTime} – ${endTime}` : `${dayLabel} • ${startTime}`;
}
