import { useEffect, useState, type ReactNode } from 'react';
import { AppLogoMark } from '../brand/AppLogo';
import { RemoteImage } from '../RemoteImage';

export function FlexLogo({ className = 'h-10 w-10' }: { className?: string }) {
  return <AppLogoMark className={className} />;
}

export function BellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M13.73 21a2 2 0 0 1-3.46 0"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SearchIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.75" />
      <path d="M20 20L16.65 16.65" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

export function PlusIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function PinIcon({ className = '', size = 14 }: { className?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path
        d="M12 17V22M9 3H15L14 10L18 12V15H6V12L10 10L9 3Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function HeartChatIcon() {
  return (
    <svg width="42" height="42" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M21 11.5C21 16.75 16.75 20 12 20C12 20 5 16.75 5 11.5C5 8.5 7 6.5 9.5 6.5C10.75 6.5 12 7.25 12 8.5C12 7.25 13.25 6.5 14.5 6.5C17 6.5 21 8.5 21 11.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function BuildingIcon({ className = '', size = 16 }: { className?: string; size?: number } = {}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path
        d="M3 21H21M5 21V7L12 3L19 7V21M9 21V13H15V21"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function UserPlusIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M16 21V19C16 16.79 14.21 15 12 15H7C4.79 15 3 16.79 3 19V21M14.5 7.5C14.5 9.71 12.71 11.5 10.5 11.5C8.29 11.5 6.5 9.71 6.5 7.5C6.5 5.29 8.29 3.5 10.5 3.5C12.71 3.5 14.5 5.29 14.5 7.5ZM19 8V14M16 11H22"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type NavIconProps = {
  label: string;
  active?: boolean;
  badge?: number;
  onClick?: () => void;
  children: ReactNode;
};

export function NotificationBadge({
  count,
  ringClass = 'ring-app-chat-rail',
}: {
  count: number;
  ringClass?: string;
}) {
  if (count <= 0) {
    return null;
  }

  return (
    <span
      className={`absolute -top-1 -right-1 z-10 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent px-1 text-[0.625rem] font-bold leading-none text-white shadow-sm shadow-accent/40 ring-2 ${ringClass}`}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}

export function NavIconButton({ label, active, badge, onClick, children }: NavIconProps) {
  return (
    <button
      type="button"
      aria-label={badge && badge > 0 ? `${label}, ${badge} unread` : label}
      aria-current={active ? 'page' : undefined}
      className={`group relative z-10 flex h-[58px] w-full flex-col items-center justify-center gap-1 rounded-2xl text-[0.6875rem] font-medium transition-all duration-200 active:scale-95 ${
        active
          ? 'text-accent dark:text-white font-semibold'
          : 'text-app-muted hover:bg-black/[0.05] dark:hover:bg-white/[0.08] hover:text-accent dark:hover:text-white'
      }`}
      onClick={onClick}
    >
      <span className="relative inline-flex items-center justify-center transition-transform duration-200 group-hover:scale-105">
        {children}
        <NotificationBadge count={badge ?? 0} />
      </span>
      <span className="leading-none tracking-tight">{label}</span>
    </button>
  );
}

export function ActivityNavIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CallsNavIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M22 16.92V19.92C22.0011 20.1986 21.9441 20.4742 21.8325 20.7294C21.7209 20.9846 21.5573 21.2137 21.3522 21.402C21.1472 21.5902 20.9053 21.7336 20.6425 21.8228C20.3797 21.912 20.102 21.9451 19.826 21.92C16.7428 21.5857 13.787 20.5342 11.19 18.85C8.77382 17.3148 6.72533 15.2663 5.19001 12.85C3.49998 10.2412 2.44824 7.271 2.12001 4.18C2.09501 3.90347 2.12788 3.62476 2.21649 3.36162C2.3051 3.09849 2.44756 2.85669 2.63476 2.65162C2.82196 2.44655 3.0498 2.28271 3.30379 2.17052C3.55777 2.05833 3.83233 2.00026 4.11001 2H7.11001C7.59531 1.99522 8.06679 2.16708 8.43376 2.48353C8.80073 2.79999 9.04207 3.23945 9.11001 3.72C9.23662 4.68007 9.47144 5.62273 9.81001 6.53C9.94454 6.88792 9.97366 7.27691 9.8939 7.65088C9.81415 8.02485 9.62886 8.36811 9.36001 8.64L8.09001 9.91C9.51355 12.4136 11.5864 14.4865 14.09 15.91L15.36 14.64C15.6319 14.3711 15.9751 14.1858 16.3491 14.1061C16.7231 14.0263 17.1121 14.0555 17.47 14.19C18.3773 14.5286 19.3199 14.7634 20.28 14.89C20.7658 14.9586 21.2094 15.2032 21.5265 15.5775C21.8437 15.9518 22.0122 16.4296 22 16.92Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SavedNavIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M19 21L12 17L5 21V5C5 4.47 5.21 3.96 5.59 3.59C5.96 3.21 6.47 3 7 3H17C17.53 3 18.04 3.21 18.41 3.59C18.79 3.96 19 4.47 19 5V21Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CalendarNavIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <path d="M16 2V6M8 2V6M3 10H21" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

export function FilesNavIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M22 19C22 19.5304 21.7893 20.0391 21.4142 20.4142C21.0391 20.7893 20.5304 21 20 21H4C3.46957 21 2.96086 20.7893 2.58579 20.4142C2.21071 20.0391 2 19.5304 2 19V5C2 4.46957 2.21071 3.96086 2.58579 3.58579C2.96086 3.21071 3.46957 3 4 3H9L11 6H20C20.5304 6 21.0391 6.21071 21.4142 6.58579C21.7893 6.96086 22 7.46957 22 8V19Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path
        d="M12 3L13.5 8.5L19 10L13.5 11.5L12 17L10.5 11.5L5 10L10.5 8.5L12 3Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** AI enhance — main sparkle plus two smaller stars (matches web composer). */
export function EnhanceSparkleIcon({ className }: { className?: string }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const STATUS_COLORS = {
  online: 'bg-[#3ecf8e]',
  away: 'bg-[#f5c451]',
  dnd: 'bg-accent',
  offline: 'bg-[#666666]',
} as const;

export function PresenceDot({ status }: { status: keyof typeof STATUS_COLORS | null }) {
  if (!status) {
    return null;
  }

  return (
    <span
      className={`absolute right-0 bottom-0 h-3 w-3 rounded-full ring-2 ring-app-chat-sidebar shadow-sm ${STATUS_COLORS[status]}`}
      aria-hidden="true"
    />
  );
}

export function Avatar({
  imageUrl,
  initials,
  size = 'md',
  loading = 'lazy',
}: {
  imageUrl: string | null;
  initials: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  loading?: 'eager' | 'lazy';
}) {
  const [failed, setFailed] = useState(false);
  const sizeClass =
    size === 'xs'
      ? 'h-5 w-5 text-[9px] font-bold'
      : size === 'sm'
      ? 'h-8 w-8 text-xs'
      : size === 'xl'
        ? 'h-24 w-24 text-3xl font-bold'
        : size === 'lg'
          ? 'h-20 w-20 text-2xl font-bold'
          : 'h-10 w-10 text-sm font-semibold';

  useEffect(() => {
    setFailed(false);
  }, [imageUrl]);

  if (imageUrl && !failed) {
    return (
      <div className={`relative ${sizeClass}`}>
        <div
          className={`absolute inset-0 flex items-center justify-center rounded-full bg-app-avatar-fallback text-app-text ring-1 ring-white/10 shadow-sm ${sizeClass}`}
          aria-hidden
        >
          {initials}
        </div>
        <RemoteImage
          src={imageUrl}
          alt=""
          loading={loading}
          className={`relative z-10 ${sizeClass} rounded-full object-cover ring-1 ring-white/10 shadow-sm`}
          onError={() => setFailed(true)}
        />
      </div>
    );
  }

  return (
    <div
      className={`${sizeClass} flex items-center justify-center rounded-full bg-app-avatar-fallback font-semibold text-app-text ring-1 ring-white/10 shadow-sm`}
    >
      {initials}
    </div>
  );
}

export function StackedAvatar({
  avatars,
  totalCount,
}: {
  avatars: { url: string | null; initials: string }[];
  totalCount: number;
}) {
  const displayAvatars = avatars.slice(0, 3);
  const extraCount = totalCount > 3 ? totalCount - 3 : 0;

  return (
    <div className="relative h-10 w-10 shrink-0">
      {displayAvatars.length === 1 && (
        <div className="absolute inset-0">
          <Avatar imageUrl={displayAvatars[0].url} initials={displayAvatars[0].initials} loading="eager" />
        </div>
      )}
      {displayAvatars.length === 2 && (
        <>
          <div className="absolute left-0 top-0 z-10 h-[26px] w-[26px] overflow-hidden rounded-full ring-2 ring-app-surface">
            <Avatar imageUrl={displayAvatars[0].url} initials={displayAvatars[0].initials} size="sm" loading="eager" />
          </div>
          <div className="absolute bottom-0 right-0 z-20 h-[26px] w-[26px] overflow-hidden rounded-full ring-2 ring-app-surface">
            <Avatar imageUrl={displayAvatars[1].url} initials={displayAvatars[1].initials} size="sm" loading="lazy" />
          </div>
        </>
      )}
      {displayAvatars.length >= 3 && (
        <>
          <div className="absolute left-0 top-0 z-10 h-6 w-6 overflow-hidden rounded-full ring-2 ring-app-surface">
            <Avatar imageUrl={displayAvatars[0].url} initials={displayAvatars[0].initials} size="sm" loading="eager" />
          </div>
          <div className="absolute right-0 top-1 z-20 h-6 w-6 overflow-hidden rounded-full ring-2 ring-app-surface">
            <Avatar imageUrl={displayAvatars[1].url} initials={displayAvatars[1].initials} size="sm" loading="lazy" />
          </div>
          <div className="absolute bottom-0 left-1 z-30 h-6 w-6 overflow-hidden rounded-full ring-2 ring-app-surface">
            <Avatar imageUrl={displayAvatars[2].url} initials={displayAvatars[2].initials} size="sm" loading="lazy" />
          </div>
        </>
      )}
      {extraCount > 0 && (
        <div className="absolute bottom-0 right-0 z-40 flex h-5 w-5 items-center justify-center rounded-full bg-app-inset text-[10px] font-bold text-app-muted ring-2 ring-app-surface">
          +{extraCount}
        </div>
      )}
    </div>
  );
}
