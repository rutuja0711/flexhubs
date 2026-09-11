import {
  APP_ICON_LARGE_SRC,
  APP_ICON_SRC,
  APP_LOGO_HORIZONTAL_SRC,
  APP_LOGO_SYMBOL_SRC,
} from './logoAssets';

type LogoProps = {
  className?: string;
};

export function AppLogoMark({ className = 'h-9 w-9' }: LogoProps) {
  return (
    <img
      src={APP_LOGO_SYMBOL_SRC}
      alt="FlexHubs"
      className={`object-contain ${className}`}
      draggable={false}
    />
  );
}

export function AppLogoHorizontal({ className = 'h-10 w-auto max-w-full' }: LogoProps) {
  return (
    <img
      src={APP_LOGO_HORIZONTAL_SRC}
      alt="FlexHubs"
      className={`object-contain object-left ${className}`}
      draggable={false}
    />
  );
}

export function AppIcon({ className = 'h-9 w-9' }: LogoProps) {
  return (
    <img
      src={APP_ICON_SRC}
      alt="FlexHubs"
      className={`rounded-xl object-contain ${className}`}
      draggable={false}
    />
  );
}

export function AppNotificationIcon({ className = 'h-9 w-9' }: LogoProps) {
  return (
    <img
      src={APP_ICON_LARGE_SRC}
      alt=""
      aria-hidden="true"
      className={`rounded-xl object-contain ${className}`}
      draggable={false}
    />
  );
}
