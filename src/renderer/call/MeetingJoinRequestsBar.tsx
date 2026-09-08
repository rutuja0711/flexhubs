import type { MeetingJoinRequestItem } from '../../shared/calls';

type MeetingJoinRequestsBarProps = {
  requests: MeetingJoinRequestItem[];
  awaitingApproval: boolean;
  canModerate: boolean;
  busy: boolean;
  onApprove: (requestId: string) => void;
  onDeny: (requestId: string) => void;
};

export function MeetingJoinRequestsBar({
  requests,
  awaitingApproval,
  canModerate,
  busy,
  onApprove,
  onDeny,
}: MeetingJoinRequestsBarProps) {
  if (awaitingApproval) {
    return (
      <div className="border-b border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
        Waiting for the host to let you into the meeting…
      </div>
    );
  }

  if (!canModerate || requests.length === 0) {
    return null;
  }

  return (
    <div className="border-b border-white/10 bg-black/30 px-4 py-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/55">
        Join requests
      </p>
      <div className="space-y-2">
        {requests.map((request) => (
          <div
            key={request.id}
            className="flex items-center justify-between gap-3 rounded-xl bg-white/5 px-3 py-2"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">{request.requester.username}</p>
              <p className="text-xs text-white/50">Wants to rejoin the meeting</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                disabled={busy}
                className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20 disabled:opacity-50"
                onClick={() => onDeny(request.id)}
              >
                Deny
              </button>
              <button
                type="button"
                disabled={busy}
                className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                onClick={() => onApprove(request.id)}
              >
                Allow
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
