import { useState } from 'react';
import { respondToCalendarEvent } from '../extrasApi';

type CalendarEventInviteActionsProps = {
  eventId: string;
  responseStatus?: string | null;
  onComplete?: () => void;
  onUnauthorized?: (status?: number) => boolean;
  compact?: boolean;
};

function normalizeStatus(status: string | null | undefined): string | null {
  if (!status) {
    return null;
  }

  const upper = status.toUpperCase();
  if (upper === 'REJECTED') {
    return 'DECLINED';
  }

  return upper;
}

export function CalendarEventInviteActions({
  eventId,
  responseStatus = null,
  onComplete,
  onUnauthorized,
  compact = false,
}: CalendarEventInviteActionsProps) {
  const [busy, setBusy] = useState<'accept' | 'decline' | null>(null);
  const [localStatus, setLocalStatus] = useState<string | null>(normalizeStatus(responseStatus));

  const status = localStatus ?? normalizeStatus(responseStatus);

  if (status === 'ACCEPTED') {
    return (
      <p className={`font-medium text-emerald-400 ${compact ? 'text-xs px-2 pb-2' : 'text-sm'}`}>
        You accepted this invitation.
      </p>
    );
  }

  if (status === 'DECLINED') {
    return (
      <p className={`font-medium text-app-muted ${compact ? 'text-xs px-2 pb-2' : 'text-sm'}`}>
        You declined this invitation.
      </p>
    );
  }

  const respond = async (accept: boolean) => {
    setBusy(accept ? 'accept' : 'decline');
    const result = await respondToCalendarEvent(eventId, accept);
    setBusy(null);

    if (!result.ok) {
      if (onUnauthorized?.(result.status)) {
        return;
      }
      return;
    }

    setLocalStatus(accept ? 'ACCEPTED' : 'DECLINED');
    onComplete?.();
  };

  return (
    <div
      className={`flex gap-2 ${compact ? 'px-2 pb-2' : 'pt-1'}`}
      onClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        disabled={busy !== null}
        className="flex-1 rounded-xl bg-accent px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-accent-hover disabled:opacity-60"
        onClick={() => void respond(true)}
      >
        {busy === 'accept' ? 'Accepting…' : 'Accept'}
      </button>
      <button
        type="button"
        disabled={busy !== null}
        className="flex-1 rounded-xl border border-app-border bg-app-card px-3 py-2 text-xs font-semibold text-app-text hover:bg-app-inset disabled:opacity-60"
        onClick={() => void respond(false)}
      >
        {busy === 'decline' ? 'Declining…' : 'Decline'}
      </button>
    </div>
  );
}
