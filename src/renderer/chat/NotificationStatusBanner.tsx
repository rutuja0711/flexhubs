import type { ProfileSettings } from '../../shared/profile';

type NotificationStatusBannerProps = {
  settings: ProfileSettings;
  onOpenSettings: () => void;
};

function formatUntil(until: string | null): string | null {
  if (!until) {
    return null;
  }

  const timestamp = new Date(until).getTime();

  if (!Number.isFinite(timestamp) || timestamp <= Date.now()) {
    return null;
  }

  return new Date(until).toLocaleString();
}

export function NotificationStatusBanner({
  settings,
  onOpenSettings,
}: NotificationStatusBannerProps) {
  const snoozeUntil = formatUntil(settings.snoozeUntil);
  const dndUntil = formatUntil(settings.dndUntil);
  const snoozeActive = Boolean(snoozeUntil);
  const dndActive = settings.dndEnabled;

  if (!dndActive && !snoozeActive) {
    return null;
  }

  const message = dndActive
    ? dndUntil
      ? `Do not disturb is on until ${dndUntil}.`
      : 'Do not disturb is on — notifications are muted.'
    : `Notifications snoozed until ${snoozeUntil}.`;

  return (
    <div
      className="flex items-center justify-between gap-3 border-b border-accent/25 bg-accent/10 px-4 py-2.5 text-sm text-accent-soft"
      role="status"
    >
      <span>{message}</span>
      <button
        type="button"
        className="shrink-0 font-medium text-accent transition-colors hover:text-accent-hover"
        onClick={onOpenSettings}
      >
        Notification settings
      </button>
    </div>
  );
}
