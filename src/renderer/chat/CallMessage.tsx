import { FiPhone, FiPhoneIncoming, FiPhoneMissed, FiPhoneOff, FiVideo } from 'react-icons/fi';
import type { FlexhubCallLog } from '../../shared/calls';
import { formatCallLogPreview } from '../../shared/calls';

type CallMessageProps = {
  callLog: FlexhubCallLog;
  currentUserId: string | null;
  compact?: boolean;
};

function CallIcon({ callLog, currentUserId }: { callLog: FlexhubCallLog; currentUserId: string | null }) {
  const isInitiator = currentUserId != null && callLog.initiatorId === currentUserId;

  if (callLog.outcome === 'missed') {
    return <FiPhoneMissed className="shrink-0 text-base text-red-400" aria-hidden="true" />;
  }

  if (callLog.outcome === 'declined' || callLog.outcome === 'cancelled') {
    return <FiPhoneOff className="shrink-0 text-base text-app-muted" aria-hidden="true" />;
  }

  if (callLog.mode === 'video') {
    return <FiVideo className="shrink-0 text-base text-emerald-400" aria-hidden="true" />;
  }

  if (!isInitiator && callLog.outcome === 'completed') {
    return <FiPhoneIncoming className="shrink-0 text-base text-emerald-400" aria-hidden="true" />;
  }

  return <FiPhone className="shrink-0 text-base text-emerald-400" aria-hidden="true" />;
}

export function CallMessage({ callLog, currentUserId, compact = false }: CallMessageProps) {
  const label = formatCallLogPreview(callLog, currentUserId);

  if (compact) {
    return (
      <span className="inline-flex items-center gap-2 text-sm">
        <CallIcon callLog={callLog} currentUserId={currentUserId} />
        <span>{label}</span>
      </span>
    );
  }

  return (
    <div className="inline-flex min-w-[180px] items-center gap-3 rounded-xl border border-app-border/60 bg-app-inset/40 px-3 py-2">
      <CallIcon callLog={callLog} currentUserId={currentUserId} />
      <div className="min-w-0">
        <p className="text-sm font-medium text-app-text">{label}</p>
        <p className="text-xs capitalize text-app-muted">{callLog.outcome.replace('_', ' ')}</p>
      </div>
    </div>
  );
}
