import { useEffect, useState } from 'react';
import { FiBellOff, FiMoon } from 'react-icons/fi';
import {
  formatNotificationQuietUntil,
  isAppSnoozeActive,
  type ProfileSettings,
} from '../../shared/profile';

type NotificationStatusBannerProps = {
  settings: ProfileSettings;
  onOpenSettings: () => void;
};

function useQuietStatusTick(active: boolean): void {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!active) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setTick((value) => value + 1);
    }, 30_000);

    return () => window.clearInterval(intervalId);
  }, [active]);
}

export function NotificationStatusBanner({
  settings,
  onOpenSettings,
}: NotificationStatusBannerProps) {
  const snoozeUntilLabel = formatNotificationQuietUntil(settings.snoozeUntil);
  const dndUntilLabel = formatNotificationQuietUntil(settings.dndUntil);
  const snoozeActive = isAppSnoozeActive(settings);
  const dndActive = settings.dndEnabled;

  useQuietStatusTick(snoozeActive || dndActive);

  if (!dndActive && !snoozeActive) {
    return null;
  }

  const isSnooze = snoozeActive;
  const title = isSnooze ? 'Notifications snoozed' : 'Do not disturb';
  const subtitle = isSnooze
    ? settings.snoozedForever
      ? 'Until you turn snooze off'
      : snoozeUntilLabel ?? 'Notifications paused'
    : dndUntilLabel ?? 'Notifications paused';

  return (
    <button
      type="button"
      onClick={onOpenSettings}
      className="mx-3 mb-2 mt-1 flex w-[calc(100%-1.5rem)] items-center gap-3 rounded-xl border border-rose-200/90 bg-rose-50/95 px-3 py-2.5 text-left shadow-sm shadow-rose-900/[0.04] transition-colors hover:bg-rose-100/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:border-rose-900/55 dark:bg-rose-950/40 dark:shadow-black/20 dark:hover:bg-rose-950/55"
      aria-label={`${title}. ${subtitle}. Open notification settings.`}
    >
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-200/80 text-rose-900 dark:bg-rose-900/70 dark:text-rose-100"
        aria-hidden="true"
      >
        {isSnooze ? (
          <FiBellOff className="h-[18px] w-[18px]" strokeWidth={1.75} />
        ) : (
          <FiMoon className="h-[18px] w-[18px]" strokeWidth={1.75} />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-rose-950 dark:text-rose-50">
          {title}
        </span>
        <span className="mt-0.5 block truncate text-xs font-medium text-rose-800/80 dark:text-rose-200/75">
          {subtitle}
        </span>
      </span>
    </button>
  );
}
