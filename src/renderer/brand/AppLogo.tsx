import type { SVGProps } from 'react';
import {
  APP_ICON_LARGE_SRC,
  APP_ICON_SRC,
  APP_LOGO_HORIZONTAL_SRC,
  APP_LOGO_SYMBOL_SRC,
  APP_LOGO_WHITE_SRC,
} from './logoAssets';

type LogoProps = {
  className?: string;
  wordmarkClassName?: string;
  theme?: 'dark' | 'light' | 'auto';
  showWordmark?: boolean;
};

/**
 * Image component rendering the exact official white-wordmark Flexhubs logo
 */
export function AppLogoWhite({ className = 'h-10 w-auto' }: LogoProps) {
  return (
    <img
      src={APP_LOGO_WHITE_SRC}
      alt="Flexhubs"
      className={`object-contain object-left ${className}`}
      draggable={false}
    />
  );
}

/**
 * Razor-sharp SVG Symbol Mark for Flexhubs with Brand Wine gradient.
 */
export function FlexhubsSymbolSvg({ className = 'w-9 h-9', ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className}`}
      aria-label="Flexhubs logo symbol"
      {...props}
    >
      <defs>
        <linearGradient id="flexhubs-wine-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#943853" />
          <stop offset="50%" stopColor="#802D45" />
          <stop offset="100%" stopColor="#661E33" />
        </linearGradient>
        <linearGradient id="flexhubs-wine-accent" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#A84362" />
          <stop offset="100%" stopColor="#78253D" />
        </linearGradient>
      </defs>

      {/* Main Stylized 'F' Body with dynamic ribbon slice */}
      <path
        d="M20 34C20 22.95 28.95 14 40 14H86C92.63 14 98 19.37 98 26C98 32.63 92.63 38 86 38H43C38.03 38 34 42.03 34 47V48.5C39.5 45.8 46.2 45 53 45C62.5 45 71 49.5 78 55.5L87 63L78 70.5C71 76.5 62.5 81 53 81C46.2 81 39.5 80.2 34 77.5V90C34 96.63 28.63 102 22 102H20V34Z"
        fill="url(#flexhubs-wine-grad)"
      />
      <path
        d="M20 70C35 68 47 52 61 52C69 52 76 57 86 63C76 69 69 74 61 74C47 74 35 58 20 70Z"
        fill="white"
        fillOpacity="0.95"
      />
      <path
        d="M57 49C62.5 49 67.8 52.2 73.2 56.8L81 63L73.2 69.2C67.8 73.8 62.5 77 57 77C52.5 77 48.2 75.2 44.5 72.8C49.5 71 54.2 67.5 57.5 63C54.2 58.5 49.5 55 44.5 53.2C48.2 50.8 52.5 49 57 49Z"
        fill="url(#flexhubs-wine-accent)"
      />
    </svg>
  );
}

/**
 * High-definition Flexhubs horizontal brand logo
 */
export function AppLogoHorizontal({
  className = 'h-10 w-auto',
  wordmarkClassName = '',
  theme = 'auto',
}: LogoProps) {
  if (theme === 'dark') {
    return (
      <div className={`inline-flex items-center select-none ${className}`}>
        <AppLogoWhite className="h-full w-auto max-w-full" />
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      {/* Symbol */}
      <div className="relative flex items-center justify-center shrink-0">
        <FlexhubsSymbolSvg className="h-8 w-8 sm:h-9 sm:w-9 filter drop-shadow-sm transition-transform duration-200 hover:scale-105" />
      </div>

      {/* Modern Wordmark */}
      <span
        className={`font-extrabold tracking-[-0.035em] text-xl sm:text-2xl leading-none font-sans ${
          theme === 'light'
            ? 'text-[#14151a]'
            : 'text-app-text'
        } ${wordmarkClassName}`}
        style={{ letterSpacing: '-0.04em' }}
      >
        Flex<span className="text-accent">hubs</span>
      </span>
    </div>
  );
}

export function AppLogoMark({ className = 'h-9 w-9' }: LogoProps) {
  return (
    <img
      src={APP_LOGO_SYMBOL_SRC}
      alt="Flexhubs"
      className={`shrink-0 object-contain ${className}`}
      draggable={false}
    />
  );
}

export function AppIcon({ className = 'h-9 w-9' }: LogoProps) {
  return (
    <div className={`relative inline-flex items-center justify-center rounded-xl overflow-hidden shadow-md bg-gradient-to-br from-[#2a131b] to-[#12080d] p-1.5 ${className}`}>
      <FlexhubsSymbolSvg className="h-full w-full" />
    </div>
  );
}

export function AppNotificationIcon({ className = 'h-9 w-9' }: LogoProps) {
  return (
    <div className={`relative inline-flex items-center justify-center rounded-xl bg-gradient-to-br from-[#943853] to-[#661E33] p-1.5 shadow-md ${className}`}>
      <FlexhubsSymbolSvg className="h-full w-full" />
    </div>
  );
}

/** Fallback exports for backward compatibility */
export { APP_ICON_SRC, APP_ICON_LARGE_SRC, APP_LOGO_SYMBOL_SRC, APP_LOGO_HORIZONTAL_SRC, APP_LOGO_WHITE_SRC };
