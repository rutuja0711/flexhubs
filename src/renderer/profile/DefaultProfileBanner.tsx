import { useId } from 'react';

type DefaultProfileBannerProps = {
  className?: string;
  /** Rounded top corners when embedded in cards. */
  roundedTop?: boolean;
};

export function DefaultProfileBanner({ className = '', roundedTop = true }: DefaultProfileBannerProps) {
  const id = useId().replace(/:/g, '');
  const waveA = `fh-wave-a-${id}`;
  const waveB = `fh-wave-b-${id}`;

  return (
    <div
      className={`relative h-full w-full overflow-hidden bg-[#1a0a12] ${roundedTop ? 'rounded-t-2xl' : ''} ${className}`.trim()}
      aria-hidden
    >
      <div className="absolute inset-0 bg-gradient-to-br from-[#5a1830] via-[#1a0a12] to-[#080608]" />
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 400 96"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id={waveA} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#b83659" stopOpacity="0.72" />
            <stop offset="100%" stopColor="#972c44" stopOpacity="0.08" />
          </linearGradient>
          <linearGradient id={waveB} x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#e04d6f" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#3b0f1f" stopOpacity="0.1" />
          </linearGradient>
        </defs>
        <path
          d="M0,72 C80,28 160,88 240,52 C300,24 360,64 400,40 L400,96 L0,96 Z"
          fill={`url(#${waveA})`}
        />
        <path
          d="M0,88 C120,48 200,96 320,56 C360,40 380,72 400,64 L400,96 L0,96 Z"
          fill={`url(#${waveB})`}
          opacity="0.92"
        />
        <ellipse cx="320" cy="22" rx="120" ry="40" fill="#c43d5c" fillOpacity="0.2" />
        <ellipse cx="90" cy="18" rx="80" ry="28" fill="#972c44" fillOpacity="0.15" />
      </svg>
      <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
    </div>
  );
}