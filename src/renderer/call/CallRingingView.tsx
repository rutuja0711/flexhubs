import { FiPhone, FiPhoneOff } from 'react-icons/fi';
import type { CallSession } from '../callManager';

type CallRingingViewProps = {
  session: CallSession;
  busy: boolean;
  onAccept: () => void;
  onReject: () => void;
  onCancel: () => void;
};

export function CallRingingView({
  session,
  busy,
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

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <div className="flex w-full max-w-md flex-col items-center overflow-hidden rounded-[28px] border border-app-border bg-app-elevated px-8 py-10 shadow-app">
        <div className="relative mb-6">
          <span
            className={`absolute inset-0 rounded-full bg-accent/20 ${
              isIncomingCallee || isOutgoingCaller ? 'animate-ping' : ''
            }`}
            aria-hidden="true"
          />
          <span
            className={`absolute -inset-3 rounded-full border border-accent/30 ${
              isIncomingCallee || isOutgoingCaller ? 'animate-pulse' : ''
            }`}
            aria-hidden="true"
          />
          {session.peerAvatar ? (
            <img
              src={session.peerAvatar}
              alt=""
              className="relative h-28 w-28 rounded-full border-4 border-white/10 object-cover shadow-lg"
            />
          ) : (
            <div className="relative flex h-28 w-28 items-center justify-center rounded-full bg-accent/15 text-4xl font-semibold text-accent-soft">
              {initial}
            </div>
          )}
        </div>

        <p className="truncate text-xl font-semibold text-app-text">{title}</p>
        <p className="mt-2 text-sm text-app-muted">
          {phase === 'connecting'
            ? 'Connecting...'
            : isIncomingCallee
              ? session.video
                ? 'Incoming video call'
                : 'Incoming voice call'
              : isOutgoingCaller
                ? session.video
                  ? 'Calling with video...'
                  : 'Calling...'
                : 'In call'}
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {isIncomingCallee ? (
            <>
              {phase === 'incoming' ? (
                <button
                  type="button"
                  disabled={busy}
                  className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-5 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
                  onClick={onAccept}
                >
                  <FiPhone /> Accept
                </button>
              ) : null}
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-full bg-red-500 px-5 py-3 text-sm font-semibold text-white hover:opacity-90"
                onClick={onReject}
              >
                <FiPhoneOff /> Decline
              </button>
            </>
          ) : null}

          {isOutgoingCaller ? (
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-full bg-red-500 px-5 py-3 text-sm font-semibold text-white hover:opacity-90"
              onClick={onCancel}
            >
              <FiPhoneOff /> {phase === 'outgoing' ? 'Cancel' : 'End call'}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
