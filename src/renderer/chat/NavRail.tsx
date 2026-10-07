import { useState, useRef, useEffect } from 'react';
import { FiBell, FiLogOut, FiSettings, FiShield, FiSun, FiBookmark } from 'react-icons/fi';
import type { MainView } from '../../shared/nav';
import { apiStatusToUi, userPresenceDotClass, type UserPresenceStatus } from '../../shared/profile';
import { userIsSuperAdmin } from '../../shared/superadmin';
import {
  Avatar,
  BuildingIcon,
  CalendarNavIcon,
  CallsNavIcon,
  FlexLogo,
  NavIconButton,
  SparkleIcon,
} from './ChatIcons';
import { getUserAvatarUrl, getUserInitials, getUserDisplayName } from '../../shared/user';
import { useTheme } from '../theme/ThemeProvider';
import { getEffectivePresenceStatus, subscribePresenceManager } from '../presenceManager';

type NavRailProps = {
  unreadCount: number;
  user: unknown;
  activeView: MainView;
  onNavigate: (view: MainView) => void;
  onOpenFlexAi?: () => void;
  onLogout?: () => void;
  hasUpdateBadge?: boolean;
};

export function NavRail({ unreadCount, user, activeView, onNavigate, onOpenFlexAi, onLogout, hasUpdateBadge }: NavRailProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [presenceStatus, setPresenceStatus] = useState<UserPresenceStatus>(() => getEffectivePresenceStatus());
  const menuRef = useRef<HTMLDivElement>(null);
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    const syncPresence = () => {
      setPresenceStatus(getEffectivePresenceStatus());
    };

    syncPresence();
    return subscribePresenceManager(syncPresence);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);
  const navItemKeys: MainView[] = ['activity', 'calls', 'saved', 'calendar'];
  const activeNavIndex = navItemKeys.indexOf(activeView);
  const isRailViewActive = activeNavIndex !== -1;
  const showSuperAdminNav = userIsSuperAdmin(user);
  const menuIconClass = 'h-4 w-4 shrink-0 text-app-muted';

  return (
    <aside className="relative z-[80] flex w-[76px] shrink-0 flex-col items-center overflow-visible border-r border-app-border bg-app-chat-rail py-4 transition-colors">
      <button
        type="button"
        onClick={() => onNavigate('chat')}
        className="group mb-6 flex h-12 w-12 items-center justify-center rounded-2xl p-2 transition-all duration-200 hover:bg-black/[0.05] dark:hover:bg-white/[0.08] hover:scale-105 active:scale-95 focus:outline-none"
        aria-label="FlexHubs Home"
      >
        <FlexLogo className="h-9 w-9 transition-transform group-hover:scale-105" />
      </button>

      <nav className="relative flex w-full flex-1 flex-col gap-1.5 px-2" aria-label="Main navigation">
        {/* Sliding Active Indicator */}
        <div 
          className="pointer-events-none absolute left-2 right-2 rounded-2xl bg-accent/15 dark:bg-accent/25 shadow-sm shadow-accent/15 transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)]"
          style={{
            height: '58px',
            transform: `translateY(${isRailViewActive ? `${activeNavIndex * 64}px` : '0px'})`,
            opacity: isRailViewActive ? 1 : 0,
            visibility: isRailViewActive ? 'visible' : 'hidden',
          }}
          aria-hidden="true"
        />
        <NavIconButton
          label="Activity"
          badge={unreadCount}
          active={activeView === 'activity'}
          onClick={() => onNavigate('activity')}
        >
          <FiBell className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
        </NavIconButton>
        <NavIconButton
          label="Calls"
          active={activeView === 'calls'}
          onClick={() => onNavigate('calls')}
        >
          <CallsNavIcon />
        </NavIconButton>
        <NavIconButton
          label="Saved"
          active={activeView === 'saved'}
          onClick={() => onNavigate('saved')}
        >
          <FiBookmark className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
        </NavIconButton>

        <NavIconButton
          label="Calendar"
          active={activeView === 'calendar'}
          onClick={() => onNavigate('calendar')}
        >
          <CalendarNavIcon />
        </NavIconButton>
      </nav>

      <div className="mt-auto flex w-full flex-col items-center gap-3.5 overflow-visible px-2 pb-1">
        {/* Ask Flex AI — expands to the right from a fixed left anchor so it stays on-screen */}
        <div className="relative h-11 w-full">
          <button
            type="button"
            aria-label="Ask Flex"
            title="Ask Flex!"
            className="group/flex-ai absolute bottom-0 left-1/2 z-[80] flex h-11 w-11 max-w-[calc(100vw-5rem)] -translate-x-1/2 items-center justify-center gap-0 overflow-hidden rounded-2xl border border-transparent bg-gradient-to-br from-accent via-accent to-[#5c2431] text-white shadow-md shadow-accent/30 transition-[left,width,transform,box-shadow,padding,gap] duration-200 ease-out hover:left-0 hover:w-[min(148px,calc(100vw-5rem))] hover:translate-x-0 hover:justify-start hover:gap-2 hover:border-accent/20 hover:pr-3 hover:pl-2 hover:shadow-accent-glow focus-visible:left-0 focus-visible:w-[min(148px,calc(100vw-5rem))] focus-visible:translate-x-0 focus-visible:justify-start focus-visible:gap-2 focus-visible:pr-3 focus-visible:pl-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:scale-[0.98]"
            onClick={onOpenFlexAi}
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center group-hover/flex-ai:h-8 group-hover/flex-ai:w-8 group-focus-visible/flex-ai:h-8 group-focus-visible/flex-ai:w-8">
              <SparkleIcon className="shrink-0" />
            </span>
            <span className="min-w-0 max-w-0 overflow-hidden whitespace-nowrap text-xs font-semibold tracking-wide opacity-0 transition-[max-width,opacity] duration-200 ease-out group-hover/flex-ai:max-w-[5.5rem] group-hover/flex-ai:opacity-100 group-focus-visible/flex-ai:max-w-[5.5rem] group-focus-visible/flex-ai:opacity-100">
              Ask Flex!
            </span>
            <span className="pointer-events-none absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5 transition-opacity duration-200 group-hover/flex-ai:opacity-0 group-focus-visible/flex-ai:opacity-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-soft opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent-soft" />
            </span>
          </button>
        </div>

        {/* User Profile Avatar & Menu */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            aria-label="User menu"
            className="relative rounded-full p-1 transition-all duration-200 hover:ring-2 hover:ring-accent/40 hover:scale-105 active:scale-95 focus:outline-none"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <Avatar
              imageUrl={getUserAvatarUrl(user)}
              initials={getUserInitials(user)}
              size="sm"
            />
            <span
              className={`absolute -right-px -bottom-px z-20 h-3 w-3 rounded-full ring-[2.5px] ring-app-chat-rail shadow-[0_0_0_1px_rgba(0,0,0,0.35)] ${userPresenceDotClass(presenceStatus)}`}
              aria-hidden="true"
            />
            {hasUpdateBadge && (
              <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-accent ring-2 ring-app-chat-rail animate-pulse" />
            )}
          </button>
          
          {menuOpen && (
            <div className="absolute bottom-10 left-full ml-4 w-60 rounded-2xl border border-app-border bg-app-surface/98 dark:bg-app-elevated/95 backdrop-blur-xl p-1.5 shadow-2xl z-50 animate-pop-in origin-bottom-left">
              <div className="mb-1.5 px-3.5 py-2.5 bg-black/[0.03] dark:bg-white/[0.03] rounded-xl">
                <div className="truncate text-sm font-bold text-app-text">{getUserDisplayName(user)}</div>
                <div className="text-[11px] font-medium text-app-muted">{apiStatusToUi(presenceStatus)}</div>
              </div>
              <button
                type="button"
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-medium text-app-text transition-colors hover:bg-black/[0.05] dark:hover:bg-white/[0.08] hover:text-accent dark:hover:text-accent-soft"
                onClick={() => {
                  setMenuOpen(false);
                  onNavigate('profile');
                }}
              >
                <div className="flex min-w-0 flex-1 items-center gap-2.5">
                  <FiSettings className={menuIconClass} strokeWidth={1.75} aria-hidden="true" />
                  <span className="truncate">Profile & settings</span>
                </div>
                {hasUpdateBadge && <span className="h-2 w-2 rounded-full bg-accent animate-pulse shrink-0" />}
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-medium text-app-text transition-colors hover:bg-black/[0.05] dark:hover:bg-white/[0.08] hover:text-accent dark:hover:text-accent-soft"
                onClick={() => {
                  setMenuOpen(false);
                  onNavigate('organization');
                }}
              >
                <BuildingIcon className={menuIconClass} size={16} />
                <span>Organization</span>
              </button>
              {showSuperAdminNav ? (
                <button
                  type="button"
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-medium text-app-text transition-colors hover:bg-black/[0.05] dark:hover:bg-white/[0.08] hover:text-accent dark:hover:text-accent-soft"
                  onClick={() => {
                    setMenuOpen(false);
                    onNavigate('superadmin');
                  }}
                >
                  <FiShield className={menuIconClass} strokeWidth={1.75} aria-hidden="true" />
                  <span>Super Admin</span>
                </button>
              ) : null}
              <button
                type="button"
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-medium text-app-text transition-colors hover:bg-black/[0.05] dark:hover:bg-white/[0.08] hover:text-accent dark:hover:text-accent-soft"
                onClick={() => {
                  setMenuOpen(false);
                  toggleTheme();
                }}
              >
                <FiSun className={menuIconClass} strokeWidth={1.75} aria-hidden="true" />
                <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
              </button>
              <div className="my-1 h-px bg-app-border" />
              <button
                type="button"
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-medium text-rose-600 dark:text-rose-400 transition-colors hover:bg-rose-50 dark:hover:bg-rose-950/30"
                onClick={() => {
                  setMenuOpen(false);
                  if (onLogout) onLogout();
                }}
              >
                <FiLogOut
                  className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400"
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
                <span>Sign out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
