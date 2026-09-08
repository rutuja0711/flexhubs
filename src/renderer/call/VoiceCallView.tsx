import type { CallSession } from '../callManager';

type VoiceCallViewProps = {
  session: CallSession;
  durationLabel: string;
  micEnabled: boolean;
  statusLabel: string;
};

export function VoiceCallView({ session, durationLabel, micEnabled, statusLabel }: VoiceCallViewProps) {
  const title = session.peerLabel || 'Call';
  const initial = title.slice(0, 1).toUpperCase() || '?';
  const isConnected = session.phase === 'active';

  return (
    <div className="relative flex h-full min-h-[280px] flex-col items-center justify-center overflow-hidden px-6 py-8">
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-accent/25 via-[#1a1220] to-[#0d0e12]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -left-16 top-8 h-40 w-40 rounded-full bg-accent/20 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -right-10 bottom-10 h-36 w-36 rounded-full bg-accent-soft/15 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative mb-6">
        {isConnected ? (
          <>
            <span className="absolute -inset-4 rounded-full border border-accent/20 animate-pulse" aria-hidden="true" />
            <span className="absolute -inset-8 rounded-full border border-accent/10 animate-ping" aria-hidden="true" />
          </>
        ) : null}

        {session.peerAvatar ? (
          <img
            src={session.peerAvatar}
            alt=""
            className="relative h-28 w-28 rounded-full border-4 border-white/10 object-cover shadow-[0_20px_60px_rgba(0,0,0,0.45)]"
          />
        ) : (
          <div className="relative flex h-28 w-28 items-center justify-center rounded-full border-4 border-white/10 bg-accent/20 text-4xl font-semibold text-white shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
            {initial}
          </div>
        )}
      </div>

      <p className="relative truncate text-xl font-semibold text-white">{title}</p>
      <p className="relative mt-1 text-sm text-white/65">{statusLabel}</p>

      {durationLabel ? (
        <p className="relative mt-3 rounded-full bg-black/25 px-3 py-1 text-sm font-medium tabular-nums text-white/80">
          {durationLabel}
        </p>
      ) : null}

      <div className="relative mt-8 flex items-end gap-1.5 h-8">
        {[0, 1, 2, 3, 4].map((bar) => (
          <span
            key={bar}
            className={`w-1.5 rounded-full bg-accent-soft/80 ${
              isConnected && micEnabled ? 'animate-pulse' : 'opacity-30'
            }`}
            style={{
              height: `${18 + (bar % 3) * 10}px`,
              animationDelay: `${bar * 120}ms`,
            }}
            aria-hidden="true"
          />
        ))}
      </div>
    </div>
  );
}
