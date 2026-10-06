const SCHEDULE_MIN_LEAD_MS = 60_000;

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** Format a Date for `<input type="datetime-local" />` (local wall time). */
export function formatDateTimeLocalValue(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function defaultScheduleDateTimeLocal(minLeadMs = SCHEDULE_MIN_LEAD_MS): string {
  const next = new Date(Date.now() + minLeadMs);
  next.setSeconds(0, 0);
  next.setMilliseconds(0);
  return formatDateTimeLocalValue(next);
}

/** Parse `datetime-local` value as local wall time. */
export function parseDateTimeLocalValue(value: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value.trim());

  if (!match) {
    return Number.NaN;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hours = Number(match[4]);
  const minutes = Number(match[5]);

  return new Date(year, month - 1, day, hours, minutes, 0, 0).getTime();
}

export function validateScheduledTime(
  value: string,
  minLeadMs = SCHEDULE_MIN_LEAD_MS,
): { ok: true; timestamp: number } | { ok: false; error: string } {
  const timestamp = parseDateTimeLocalValue(value);

  if (!Number.isFinite(timestamp)) {
    return { ok: false, error: 'Choose a valid date and time.' };
  }

  const minimum = Date.now() + minLeadMs;

  if (timestamp < minimum) {
    return { ok: false, error: 'Choose a time at least 1 minute from now.' };
  }

  return { ok: true, timestamp };
}

export { SCHEDULE_MIN_LEAD_MS };
