import type { RealtimeConnectionStatus } from '../../shared/realtime';

type RealtimeStatusIndicatorProps = {
  status: RealtimeConnectionStatus;
  compact?: boolean;
};

function statusLabel(status: RealtimeConnectionStatus): string {
  switch (status) {
    case 'connected':
      return 'Connected';
    case 'connecting':
      return 'Connecting…';
    case 'disconnected':
      return 'Reconnecting…';
    case 'unavailable':
      return 'Realtime unavailable';
    default:
      return 'Offline';
  }
}

function statusDotClass(status: RealtimeConnectionStatus): string {
  switch (status) {
    case 'connected':
      return 'bg-[#3ecf8e]';
    case 'connecting':
      return 'bg-yellow-500 animate-pulse';
    case 'disconnected':
      return 'bg-orange-500 animate-pulse';
    case 'unavailable':
      return 'bg-[#666666]';
    default:
      return 'bg-[#666666]';
  }
}

export function RealtimeStatusIndicator({ status, compact = false }: RealtimeStatusIndicatorProps) {
  const label = statusLabel(status);

  return (
    <div
      className={`flex items-center gap-2 ${compact ? 'text-[0.6875rem]' : 'text-xs'} text-app-muted`}
      role="status"
      aria-live="polite"
      title={compact ? label : undefined}
    >
      <span className={`h-2 w-2 shrink-0 rounded-full ${statusDotClass(status)}`} aria-hidden="true" />
      {!compact ? <span>{label}</span> : null}
    </div>
  );
}
