import React, { ReactNode } from 'react';
import { AppLogoMark } from '../../brand/AppLogo';
import { RemoteImage } from '../../RemoteImage';
import { FiFileText, FiPlay, FiCalendar, FiPhoneMissed, FiCheck, FiX, FiVideo, FiPhone } from 'react-icons/fi';
import { BsMicFill } from 'react-icons/bs';

// ============================================================================
// 1. Core Types
// ============================================================================
export type NotificationPriority = 'high' | 'medium' | 'low';

export type NotificationBaseProps = {
  id: string;
  isUnread?: boolean;
  priority?: NotificationPriority;
  onClick?: () => void;
  onDismiss?: () => void;
  timestamp: string | Date;
  className?: string;
};

// ============================================================================
// 2. Component Building Blocks
// ============================================================================

export function FlexHubsBadge({ className = '' }: { className?: string }) {
  return (
    <div className={`absolute -bottom-1 -right-1 h-[22px] w-[22px] rounded-full bg-white border-[2.5px] border-[#101116] p-[2px] flex items-center justify-center shadow-md z-10 ${className}`}>
      <AppLogoMark className="h-full w-full text-accent drop-shadow-sm" />
    </div>
  );
}

export function NotificationAvatar({
  initials,
  avatarUrl,
  icon,
}: {
  initials?: string;
  avatarUrl?: string | null;
  icon?: ReactNode;
}) {
  return (
    <div className="relative shrink-0">
      <div className="h-14 w-14 overflow-hidden rounded-[16px] bg-app-chat-hover flex items-center justify-center text-app-text font-bold text-[18px] relative z-0">
        {avatarUrl ? (
          <RemoteImage src={avatarUrl} className="h-full w-full object-cover" />
        ) : icon ? (
          <div className="text-xl text-app-text">{icon}</div>
        ) : (
          initials
        )}
      </div>
      <FlexHubsBadge />
    </div>
  );
}

export function NotificationTimestamp({ timestamp, isUnread }: { timestamp: string | Date; isUnread?: boolean }) {
  const dateObj = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  let formatted = typeof timestamp === 'string' ? timestamp : 'Now';
  if (!isNaN(dateObj.getTime())) {
    formatted = dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase();
  }
  return (
    <div className="flex items-center gap-2 shrink-0">
      <span className="text-xs font-medium text-app-muted whitespace-nowrap">{formatted}</span>
      {isUnread && <div className="h-2 w-2 rounded-full bg-accent shadow-[0_0_8px_rgba(233,30,99,0.5)]" />}
    </div>
  );
}

export function NotificationPriorityIndicator({ priority }: { priority?: NotificationPriority }) {
  if (priority !== 'high') return null;
  return <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-1/2 bg-accent rounded-r-md" />;
}

export function NotificationCard({
  children,
  onClick,
  isUnread,
  priority,
  className = '',
}: { children: ReactNode } & NotificationBaseProps) {
  return (
    <div
      className={`pointer-events-auto relative flex items-start gap-3.5 rounded-2xl border border-[#1f212b] bg-[#101116]/95 p-3.5 shadow-2xl backdrop-blur-xl transition-all hover:bg-[#15161c]/95 hover:border-accent/40 w-[380px] max-w-[90vw] cursor-pointer animate-in fade-in slide-in-from-right-4 duration-200 ${className}`}
      onClick={(e) => {
        if (onClick) {
          e.stopPropagation();
          onClick();
        }
      }}
      role="button"
      tabIndex={0}
    >
      <NotificationPriorityIndicator priority={priority} />
      {children}
    </div>
  );
}

export function NotificationActions({ children }: { children: ReactNode }) {
  return <div className="mt-2.5 flex items-center gap-2">{children}</div>;
}

export function NotificationActionBtn({
  children,
  onClick,
  primary,
}: {
  children: ReactNode;
  onClick: (e: React.MouseEvent) => void;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      className={`flex-1 rounded-xl px-3 py-1.5 text-[13px] font-semibold transition-colors ${
        primary
          ? 'bg-accent text-white hover:bg-accent-hover shadow-sm'
          : 'bg-app-chat-hover text-app-text hover:bg-app-border/80'
      }`}
      onClick={(e) => {
        e.stopPropagation();
        onClick(e);
      }}
    >
      {children}
    </button>
  );
}

export function NotificationMedia({ children }: { children: ReactNode }) {
  return <div className="mt-2 flex items-center gap-1.5">{children}</div>;
}

export function NotificationMediaThumbnail({ src, count, isVideo }: { src?: string | null; count?: number; isVideo?: boolean }) {
  if (count !== undefined) {
    return (
      <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[10px] border border-app-border bg-app-chat-hover text-[11px] font-bold text-app-text shadow-sm">
        +{count}
      </div>
    );
  }
  return (
    <div className="relative h-[38px] w-[38px] shrink-0 overflow-hidden rounded-[10px] border border-app-border bg-black/20 shadow-sm">
      {src && <RemoteImage src={src} className="h-full w-full object-cover" />}
      {isVideo && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
          <FiPlay className="text-white drop-shadow-md text-xs" />
        </div>
      )}
    </div>
  );
}

export function NotificationFile({ name, size }: { name: string; size?: string }) {
  return (
    <div className="mt-2 flex items-center gap-2 rounded-lg border border-app-border/60 bg-app-chat-hover/50 p-2">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-accent/10 text-accent">
        <FiFileText size={14} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12px] font-medium text-app-text">{name}</p>
        {size && <p className="text-[10px] text-app-muted">{size}</p>}
      </div>
    </div>
  );
}

export function NotificationVoiceNote({ durationStr }: { durationStr: string }) {
  return (
    <div className="mt-2 flex items-center gap-2 rounded-full border border-app-border/60 bg-app-chat-hover/50 p-1.5 pr-4 w-4/5">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-white shadow-sm">
        <FiPlay size={10} className="ml-0.5" />
      </div>
      <div className="flex-1 flex items-center gap-0.5 opacity-60">
        {[...Array(15)].map((_, i) => (
          <div key={i} className="w-0.5 h-3 bg-app-text rounded-full" style={{ height: `${Math.max(2, Math.random() * 12)}px` }} />
        ))}
      </div>
      <span className="text-[10px] font-medium text-app-text shrink-0">{durationStr}</span>
    </div>
  );
}

// ============================================================================
// 3. Main Container
// ============================================================================

export function NotificationContainer({
  children,
  stackedCount,
  onDismissAll,
}: {
  children: ReactNode;
  stackedCount?: number;
  onDismissAll?: () => void;
}) {
  return (
    <div className="flex flex-col gap-2 w-[380px] max-w-[90vw]">
      {stackedCount && stackedCount > 1 && (
        <div className="flex items-center justify-between px-1 mb-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-app-muted">{stackedCount} new notifications</span>
          {onDismissAll && (
            <button onClick={onDismissAll} className="text-[11px] font-semibold text-accent hover:text-accent-hover transition-colors">
              Clear all
            </button>
          )}
        </div>
      )}
      {children}
    </div>
  );
}
