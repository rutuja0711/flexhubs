import { FiSquare, FiTrash2 } from 'react-icons/fi';

type VoiceInlineRecordingProps = {
  elapsedSec: number;
  onCancel: () => void;
  onStop: () => void;
  variant?: 'note' | 'typing';
};

function formatElapsed(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export function VoiceInlineRecording({
  elapsedSec,
  onCancel,
  onStop,
  variant = 'note',
}: VoiceInlineRecordingProps) {
  const isTyping = variant === 'typing';
  const pulseClass = isTyping ? 'bg-accent' : 'bg-red-500';
  const labelClass = isTyping ? 'text-accent' : 'text-red-500';

  return (
    <div className="flex min-h-[36px] min-w-0 flex-1 items-center gap-2 px-1">
      <button
        type="button"
        aria-label={isTyping ? 'Cancel voice typing' : 'Cancel recording'}
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full hover:bg-red-500/10 ${labelClass}`}
        onClick={onCancel}
      >
        <FiTrash2 className="text-base" />
      </button>
      <div className="flex min-w-0 flex-1 items-center gap-2 rounded-full bg-app-inset/70 px-3 py-1.5">
        <span className="relative flex h-2 w-2 shrink-0">
          <span
            className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-50 ${pulseClass}`}
          />
          <span className={`relative inline-flex h-2 w-2 rounded-full ${pulseClass}`} />
        </span>
        <span className={`text-sm font-semibold tabular-nums ${labelClass}`}>{formatElapsed(elapsedSec)}</span>
        <span className="truncate text-xs text-app-muted">
          {isTyping ? 'Listening…' : 'Recording…'}
        </span>
      </div>
      <button
        type="button"
        aria-label={isTyping ? 'Stop voice typing' : 'Stop recording'}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-white hover:opacity-90"
        onClick={onStop}
      >
        <FiSquare className="text-xs" />
      </button>
    </div>
  );
}
