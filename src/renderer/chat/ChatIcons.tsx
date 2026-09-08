import { useEffect, useState, type ReactNode } from 'react';

export function FlexLogo() {
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-sm font-bold text-white">
      F
    </div>
  );
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

export function BuildingIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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
      className={`absolute -top-0.5 -right-0.5 z-10 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[0.5625rem] font-bold leading-none text-white ring-2 ${ringClass}`}
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
      className={`relative flex w-full flex-col items-center gap-1 rounded-xl px-2 py-2.5 text-[0.6875rem] transition-colors ${
        active ? 'bg-accent/15 text-accent-soft' : 'text-app-muted hover:bg-app-chat-hover hover:text-app-text'
      }`}
      onClick={onClick}
    >
      <span className="relative inline-flex">
        {children}
        <NotificationBadge count={badge ?? 0} />
      </span>
      <span className="leading-none">{label}</span>
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

export function SparkleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3L13.5 8.5L19 10L13.5 11.5L12 17L10.5 11.5L5 10L10.5 8.5L12 3Z"
        stroke="currentColor"
        strokeWidth="1.75"
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
      className={`absolute right-0 bottom-0 h-3 w-3 rounded-full border-2 border-app-chat-sidebar ${STATUS_COLORS[status]}`}
      aria-hidden="true"
    />
  );
}

export function Avatar({
  imageUrl,
  initials,
  size = 'md',
}: {
  imageUrl: string | null;
  initials: string;
  size?: 'sm' | 'md';
}) {
  const [failed, setFailed] = useState(false);
  const sizeClass = size === 'sm' ? 'h-8 w-8 text-xs' : 'h-10 w-10 text-sm';

  useEffect(() => {
    setFailed(false);
  }, [imageUrl]);

  if (imageUrl && !failed) {
    return (
      <img
        src={imageUrl}
        alt=""
        className={`${sizeClass} rounded-full object-cover`}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <div
      className={`${sizeClass} flex items-center justify-center rounded-full bg-app-avatar-fallback font-semibold text-app-text`}
    >
      {initials}
    </div>
  );
}
