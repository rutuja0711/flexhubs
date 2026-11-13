import type { ReactNode } from 'react';
import { FiCheck, FiClock, FiMinus } from 'react-icons/fi';
import {
  apiStatusToUi,
  uiStatusToApi,
  type UserPresenceStatus,
} from '../../shared/profile';
import { getEffectivePresenceStatus, setManualPresenceStatus, syncPresenceToServer } from '../presenceManager';

export type PresenceStatusUiLabel = 'Available' | 'Busy' | 'Do not disturb' | 'Away';

export const PRESENCE_STATUS_UI_OPTIONS: {
  label: PresenceStatusUiLabel;
  dotClass: string;
}[] = [
  { label: 'Available', dotClass: 'bg-[#3ecf8e]' },
  { label: 'Busy', dotClass: 'bg-orange-500' },
  { label: 'Do not disturb', dotClass: 'bg-red-500' },
  { label: 'Away', dotClass: 'bg-yellow-500' },
];

export function presenceUiLabelFromEffectiveStatus(): PresenceStatusUiLabel {
  const label = apiStatusToUi(getEffectivePresenceStatus());
  if (label === 'Available' || label === 'Busy' || label === 'Do not disturb' || label === 'Away') {
    return label;
  }
  return 'Available';
}

export function PresenceStatusIcon({
  label,
  className = 'h-4 w-4',
}: {
  label: PresenceStatusUiLabel | string;
  className?: string;
}) {
  const base = `inline-flex shrink-0 items-center justify-center rounded-full ${className}`;

  if (label === 'Available') {
    return (
      <span className={`${base} bg-[#3ecf8e] text-white`} aria-hidden="true">
        <FiCheck className="h-2.5 w-2.5 stroke-[3]" />
      </span>
    );
  }

  if (label === 'Busy') {
    return <span className={`${base} bg-red-500`} aria-hidden="true" />;
  }

  if (label === 'Do not disturb') {
    return (
      <span className={`${base} bg-red-500 text-white`} aria-hidden="true">
        <FiMinus className="h-2.5 w-2.5 stroke-[3]" />
      </span>
    );
  }

  if (label === 'Away') {
    return (
      <span className={`${base} bg-yellow-500 text-[#1a1200]`} aria-hidden="true">
        <FiClock className="h-2.5 w-2.5 stroke-[2.5]" />
      </span>
    );
  }

  return <span className={`${base} bg-app-muted`} aria-hidden="true" />;
}

export function presenceDotClassForUiLabel(label: string): string {
  return PRESENCE_STATUS_UI_OPTIONS.find((option) => option.label === label)?.dotClass ?? 'bg-[#3ecf8e]';
}

export async function applyUserPresenceUiLabel(
  label: PresenceStatusUiLabel,
  statusMessage = '',
): Promise<{ ok: true } | { ok: false; error: string; previous: UserPresenceStatus }> {
  const previous = getEffectivePresenceStatus();
  const apiStatus = uiStatusToApi(label);
  setManualPresenceStatus(apiStatus, statusMessage);
  const result = await syncPresenceToServer();

  if (!result.ok) {
    setManualPresenceStatus(previous, statusMessage);
    return { ok: false, error: result.error, previous };
  }

  return { ok: true };
}

export function presenceStatusMenuItems(): { label: PresenceStatusUiLabel; icon: ReactNode }[] {
  return PRESENCE_STATUS_UI_OPTIONS.map((option) => ({
    label: option.label,
    icon: <PresenceStatusIcon label={option.label} className="h-[18px] w-[18px]" />,
  }));
}
