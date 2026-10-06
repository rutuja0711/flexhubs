import { FiPhone, FiPhoneOff, FiX } from 'react-icons/fi';
import type { CallSession } from '../callManager';

type CallRingingViewProps = {
  session: CallSession;
  busy: boolean;
  notice?: string;
  onAccept: () => void;
  onReject: () => void;
  onCancel: () => void;
};

export function CallRingingView({
  session,
  busy,
  notice = '',
  onAccept,
  onReject,
  onCancel,
}: CallRingingViewProps) {
  const title = session.peerLabel || 'Call';
  const initial = title.slice(0, 1).toUpperCase() || '?';
  const phase = session.phase;
  const isIncomingCallee =
    (phase === 'incoming' || phase === 'connecting') && !session.isInitiator;
  const isOutgoingCaller = phase === 'outgoing' || (phase === 'connecting' && session.isInitiator);

  const statusLabel =
    phase === 'connecting'
      ? 'Connecting...'
      : isIncomingCallee
        ? session.video
          ? 'Incoming video call'
          : 'Incoming voice call'
        : isOutgoingCaller
          ? session.video
            ? 'Calling with video…'
            : 'Calling…'
          : 'In call';

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[9999] flex justify-end px-3 pb-2 pt-[max(0.75rem,env(safe-area-inset-top,0px))] sm:px-4 sm:pb-3 sm:pt-[max(1rem,env(safe-area-inset-top,0px))]">
      <div
        className="pointer-events-auto w-full max-w-[min(100%,22rem)] overflow-hidden rounded-2xl border border-app-border bg-app-elevated shadow-app animate-in slide-in-from-top-2 fade-in duration-200"
        role="dialog"
        aria-label={statusLabel}
      >
        <div className="flex items-start gap-3 px-3 py-3 sm:px-4">
          <div className="relative shrink-0">
            {isIncomingCallee || isOutgoingCaller ? (
              <span
                className="absolute -inset-1 rounded-full bg-accent/15 animate-pulse"
                aria-hidden="true"
              />
            ) : null}
            {session.peerAvatar ? (
              <img
                src={session.peerAvatar}
                alt=""
                className="relative h-11 w-11 rounded-full border border-app-border object-cover"
              />
            ) : (
              <div className="relative flex h-11 w-11 items-center justify-center rounded-full bg-accent/15 text-sm font-semibold text-accent-soft">
                {initial}
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1 pt-0.5">
            <p className="truncate text-sm font-semibold text-app-text">{title}</p>
            <p className="mt-0.5 text-xs text-app-muted">{statusLabel}</p>
            {notice ? (
              <p className="mt-1 line-clamp-2 text-[11px] text-app-muted" role="status">
                {notice}
              </p>
            ) : null}
          </div>

          <button
            type="button"
            aria-label="Dismiss"
            className="shrink-0 rounded-lg p-1.5 text-app-muted hover:bg-app-chat-hover hover:text-app-text"
            onClick={isIncomingCallee ? onReject : onCancel}
          >
            <FiX className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-app-border px-3 py-2.5 sm:px-4">
          {isIncomingCallee ? (
            <>
              {phase === 'incoming' ? (
                <button
                  type="button"
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60"
                  onClick={onAccept}
                >
                  <FiPhone className="h-3.5 w-3.5" />
                  Accept
                </button>
              ) : null}
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-xl bg-red-500 px-3 py-2 text-xs font-semibold text-white hover:opacity-90"
                onClick={onReject}
              >
                <FiPhoneOff className="h-3.5 w-3.5" />
                Decline
              </button>
            </>
          ) : null}

          {isOutgoingCaller ? (
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-xl bg-red-500 px-3 py-2 text-xs font-semibold text-white hover:opacity-90"
              onClick={onCancel}
            >
              <FiPhoneOff className="h-3.5 w-3.5" />
              {phase === 'outgoing' ? 'Cancel' : 'End call'}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
