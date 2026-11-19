import { useEffect, useRef, useState } from 'react';
import { FiBell, FiBellOff } from 'react-icons/fi';
import {
  formatNotificationQuietUntil,
  isAppSnoozeActive,
  resolveSnoozeSelectValue,
  type ProfileSettings,
} from '../../shared/profile';
import { saveNotificationSettings } from '../chatApi';
import { useToast } from '../ui/Toast';

const SNOOZE_OPTIONS = [
  { label: 'Notifications on', value: 'off' },
  { label: '30 minutes', value: '30m' },
  { label: '1 hour', value: '1h' },
  { label: '4 hours', value: '4h' },
  { label: '8 hours', value: '8h' },
  { label: '24 hours', value: '24h' },
  { label: 'Until tomorrow', value: 'tomorrow' },
  { label: 'Forever', value: 'forever' },
] as const;

type NotificationSnoozeMenuProps = {
  settings: ProfileSettings | null;
  onSettingsUpdated: (settings: ProfileSettings) => void;
  onOpenNotificationSettings?: () => void;
};

export function NotificationSnoozeMenu({
  settings,
  onSettingsUpdated,
  onOpenNotificationSettings,
}: NotificationSnoozeMenuProps) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [snoozeValue, setSnoozeValue] = useState('off');
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (settings) {
      setSnoozeValue(resolveSnoozeSelectValue(settings));
    }
  }, [settings]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [open]);

  if (!settings) {
    return null;
  }

  const snoozeActive = isAppSnoozeActive(settings);
  const dndActive = settings.dndEnabled;
  const indicatorActive = snoozeActive || dndActive;

  const statusLine = snoozeActive
    ? settings.snoozedForever
      ? 'Snoozed until you turn it off'
      : formatNotificationQuietUntil(settings.snoozeUntil) ?? 'Notifications paused'
    : dndActive
      ? formatNotificationQuietUntil(settings.dndUntil) ?? 'Do not disturb'
      : 'All notifications on';

  const handleSelect = async (value: string) => {
    if (busy || value === snoozeValue) {
      setOpen(false);
      return;
    }

    setBusy(true);
    const result = await saveNotificationSettings({ snoozeValue: value });
    setBusy(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    onSettingsUpdated(result.data);
    setSnoozeValue(value);
    setOpen(false);

    const label = SNOOZE_OPTIONS.find((option) => option.value === value)?.label ?? 'Snooze updated';
    toast.success(value === 'off' ? 'Notifications turned on.' : label);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={
          snoozeActive ? 'Notifications snoozed. Open snooze menu.' : 'Open notification snooze menu'
        }
        title={statusLine}
        className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-all duration-200 active:scale-95 ${
          indicatorActive
            ? 'bg-accent/15 text-accent hover:bg-accent/20'
            : 'text-app-muted hover:bg-app-chat-hover hover:text-app-text'
        }`}
        onClick={() => setOpen((current) => !current)}
      >
        {indicatorActive ? (
          <FiBellOff className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
        ) : (
          <FiBell className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
        )}
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+6px)] z-[80] w-56 overflow-hidden rounded-xl border border-app-border bg-app-surface py-1 shadow-lg shadow-black/25"
        >
          <div className="border-b border-app-border/60 px-3 py-2">
            <p className="text-xs font-semibold text-app-text">Snooze notifications</p>
            <p className="mt-0.5 text-[11px] text-app-muted">{statusLine}</p>
          </div>
          {SNOOZE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="menuitemradio"
              aria-checked={snoozeValue === option.value}
              disabled={busy}
              className={`flex w-full items-center px-3 py-2 text-left text-sm transition-colors hover:bg-app-chat-hover disabled:opacity-50 ${
                snoozeValue === option.value ? 'font-semibold text-accent' : 'text-app-text'
              }`}
              onClick={() => {
                void handleSelect(option.value);
              }}
            >
              {option.label}
            </button>
          ))}
          {onOpenNotificationSettings ? (
            <button
              type="button"
              role="menuitem"
              className="mt-1 w-full border-t border-app-border/60 px-3 py-2 text-left text-xs font-medium text-app-muted transition-colors hover:bg-app-chat-hover hover:text-app-text"
              onClick={() => {
                setOpen(false);
                onOpenNotificationSettings();
              }}
            >
              All notification settings…
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}