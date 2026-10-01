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
};

export function NavRail({ unreadCount, user, activeView, onNavigate, onOpenFlexAi, onLogout }: NavRailProps) {
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
  const navItemKeys: MainView[] = ['activity', 'calls', 'hubs', 'saved', 'calendar'];
  const activeNavIndex = navItemKeys.indexOf(activeView);
  const isRailViewActive = activeNavIndex !== -1;
  const showSuperAdminNav = userIsSuperAdmin(user);

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
          label="Hubs"
          active={activeView === 'hubs'}
          onClick={() => onNavigate('hubs')}
        >
          <BuildingIcon />
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
        {/* Ask Flex AI Button */}
        <div className="group relative z-[80]">
          <button
            type="button"
            aria-label="Ask Flex"
            className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-accent via-accent to-[#5c2431] text-white shadow-md shadow-accent/30 transition-all duration-200 hover:shadow-accent-glow hover:scale-105 active:scale-95"
            onClick={onOpenFlexAi}
          >
            <SparkleIcon />
            <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-soft opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-accent-soft" />
            </span>
          </button>
          <div
            className="pointer-events-none absolute top-1/2 left-0 z-[80] flex -translate-y-1/2 items-center rounded-2xl border border-app-border/70 bg-app-surface/95 backdrop-blur-md py-2 pr-4 pl-2 opacity-0 shadow-xl transition-all duration-200 group-hover:translate-x-3 group-hover:opacity-100 group-focus-within:translate-x-3 group-focus-within:opacity-100"
            aria-hidden="true"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent text-white shadow-sm shadow-accent/30">
              <SparkleIcon />
            </span>
            <span className="ml-2.5 whitespace-nowrap text-xs font-semibold text-app-text tracking-wide">Ask Flex!</span>
          </div>
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
              className={`absolute right-0 bottom-0 h-3 w-3 rounded-full ring-2 ring-app-chat-rail shadow-sm ${userPresenceDotClass(presenceStatus)}`}
              aria-hidden="true"
            />
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
                <FiSettings className="shrink-0 text-sm text-app-muted" />
                <span>Profile & settings</span>
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-medium text-app-text transition-colors hover:bg-black/[0.05] dark:hover:bg-white/[0.08] hover:text-accent dark:hover:text-accent-soft"
                onClick={() => {
                  setMenuOpen(false);
                  onNavigate('organization');
                }}
              >
                <BuildingIcon />
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
                  <FiShield className="shrink-0 text-sm text-app-muted" />
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
                <FiSun className="shrink-0 text-sm text-app-muted" />
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
                <FiLogOut className="shrink-0 text-sm" />
                <span>Sign out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
