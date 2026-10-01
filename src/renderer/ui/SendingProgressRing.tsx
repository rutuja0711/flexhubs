import { useEffect, useRef, useState } from 'react';
import { easeOutCubic } from '../uploadProgress';

type SendingProgressRingProps = {
  progress?: number | null;
  size?: number;
  className?: string;
  showLabel?: boolean;
};

export function SendingProgressRing({
  progress = null,
  size = 44,
  className = '',
  showLabel = true,
}: SendingProgressRingProps) {
  const stroke = 3;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const target =
    typeof progress === 'number' ? Math.max(0, Math.min(100, progress)) : null;
  const [display, setDisplay] = useState(target ?? 0);
  const displayRef = useRef(display);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (target == null) {
      return;
    }

    const from = displayRef.current;
    const to = target;

    if (Math.abs(from - to) < 0.4) {
      displayRef.current = to;
      setDisplay(to);
      return;
    }

    const start = performance.now();
    const duration = Math.min(520, Math.max(200, Math.abs(to - from) * 12));

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const value = from + (to - from) * easeOutCubic(t);
      displayRef.current = value;
      setDisplay(value);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [target]);

  const isIndeterminate = target == null;
  const dashOffset = circumference * (1 - display / 100);
  const labelSize = size >= 40 ? 'text-[11px]' : 'text-[9px]';

  return (
    <div
      className={`relative flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
      role="status"
      aria-label={
        isIndeterminate ? 'Sending' : `Sending ${Math.round(display)} percent`
      }
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-white/20"
        />
        {isIndeterminate ? (
          <g
            className="animate-spin"
            style={{ transformOrigin: `${size / 2}px ${size / 2}px` }}
          >
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${circumference * 0.26} ${circumference}`}
              className="text-white"
            />
          </g>
        ) : (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            className="text-white transition-[stroke-dashoffset] duration-150 ease-out"
          />
        )}
      </svg>
      {!isIndeterminate && showLabel && size >= 32 ? (
        <span
          className={`pointer-events-none absolute inset-0 flex items-center justify-center font-semibold tabular-nums text-white ${labelSize}`}
        >
          {Math.round(display)}
        </span>
      ) : null}
    </div>
  );
}
