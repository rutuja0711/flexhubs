export type TimezoneOption = {
  value: string;
  label: string;
};

const FALLBACK_TIMEZONES = [
  'UTC',
  'Asia/Calcutta',
  'America/New_York',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Asia/Tokyo',
  'Australia/Sydney',
];

export function getTimezoneOffsetLabel(timeZone: string, date = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      timeZoneName: 'shortOffset',
    }).formatToParts(date);

    return parts.find((part) => part.type === 'timeZoneName')?.value ?? 'GMT';
  } catch {
    return 'GMT';
  }
}

export function formatTimezoneLabel(timeZone: string): string {
  return `${timeZone} (${getTimezoneOffsetLabel(timeZone)})`;
}

export function getTimezoneOptions(): TimezoneOption[] {
  const intlWithSupported = Intl as typeof Intl & {
    supportedValuesOf?: (key: string) => string[];
  };

  const values =
    typeof intlWithSupported.supportedValuesOf === 'function'
      ? intlWithSupported.supportedValuesOf('timeZone')
      : FALLBACK_TIMEZONES;

  return values
    .map((value) => ({
      value,
      label: formatTimezoneLabel(value),
    }))
    .sort((left, right) => left.label.localeCompare(right.label));
}
