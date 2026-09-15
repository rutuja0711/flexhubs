import type { FlexhubCallLog } from '../../shared/calls';
import { formatCallLogPreview } from '../../shared/calls';

type CallMessageProps = {
  callLog: FlexhubCallLog;
  currentUserId: string | null;
  compact?: boolean;
};

export function CallMessage({ callLog, currentUserId, compact = false }: CallMessageProps) {
  const label = formatCallLogPreview(callLog, currentUserId);

  if (compact) {
    return <span className="text-sm">{label}</span>;
  }

  return (
    <div className="inline-flex min-w-[180px] flex-col rounded-xl bg-app-inset/50 px-3 py-2">
      <p className="text-sm font-medium text-app-text">{label}</p>
      <p className="text-xs capitalize text-app-muted">{callLog.outcome.replace('_', ' ')}</p>
    </div>
  );
}
