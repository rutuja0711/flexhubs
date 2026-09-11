import { useState, useRef, useEffect } from 'react';
import { FiLogOut, FiSettings, FiSun } from 'react-icons/fi';
import type { MainView } from '../../shared/nav';
import { apiStatusToUi, userPresenceDotClass, type UserPresenceStatus } from '../../shared/profile';
import {
  ActivityNavIcon,
  Avatar,
  BuildingIcon,
  CalendarNavIcon,
  FilesNavIcon,
  FlexLogo,
  NavIconButton,
  SavedNavIcon,
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
  const navItemKeys: MainView[] = ['activity', 'hubs', 'saved', 'calendar', 'files'];
  const activeNavIndex = navItemKeys.indexOf(activeView);
  const isRailViewActive = activeNavIndex !== -1;

  return (
    <aside className="relative z-[80] flex w-[72px] shrink-0 flex-col items-center overflow-visible border-r border-app-border bg-app-chat-rail py-4">
      <button
        type="button"
        onClick={() => onNavigate('chat')}
        className="mb-6 flex items-center justify-center rounded-xl p-1.5 transition-transform hover:scale-105 active:scale-95 focus:outline-none"
        aria-label="FlexHubs Home"
      >
        <FlexLogo />
      </button>

      <nav className="relative flex w-full flex-1 flex-col gap-1 px-2" aria-label="Main navigation">
        {/* Sliding Active Indicator */}
        <div 
          className="pointer-events-none absolute left-2 right-2 rounded-xl bg-accent/15 transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)]"
          style={{
            height: '60px',
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
          <ActivityNavIcon />
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
          <SavedNavIcon />
        </NavIconButton>
        <NavIconButton
          label="Calendar"
          active={activeView === 'calendar'}
          onClick={() => onNavigate('calendar')}
        >
          <CalendarNavIcon />
        </NavIconButton>
        <NavIconButton
          label="Files"
          active={activeView === 'files'}
          onClick={() => onNavigate('files')}
        >
          <FilesNavIcon />
        </NavIconButton>
      </nav>

      <div className="mt-auto flex w-full flex-col items-center gap-3 overflow-visible px-2 pb-1">
        <div className="group relative z-[80]">
          <button
            type="button"
            aria-label="Ask Flex"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-white transition-all duration-200 hover:bg-accent-hover active:scale-95 hover:shadow-md"
            onClick={onOpenFlexAi}
          >
            <SparkleIcon />
          </button>
          <div
            className="pointer-events-none absolute top-1/2 left-0 z-[80] flex -translate-y-1/2 items-center rounded-full border border-app-border bg-app-surface py-1.5 pr-4 pl-1.5 opacity-0 shadow-app transition-all duration-200 group-hover:translate-x-2 group-hover:opacity-100 group-focus-within:translate-x-2 group-focus-within:opacity-100"
            aria-hidden="true"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-white">
              <SparkleIcon />
            </span>
            <span className="ml-2 whitespace-nowrap text-sm font-semibold text-app-text">Ask Flex!</span>
          </div>
        </div>
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            aria-label="User menu"
            className="relative rounded-full"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <Avatar
              imageUrl={getUserAvatarUrl(user)}
              initials={getUserInitials(user)}
              size="sm"
            />
            <span
              className={`absolute right-0 bottom-0 h-3 w-3 rounded-full border-2 border-app-chat-rail ${userPresenceDotClass(presenceStatus)}`}
              aria-hidden="true"
            />
          </button>
          
          {menuOpen && (
            <div className="absolute bottom-10 left-full ml-4 w-56 rounded-xl border border-app-border bg-app-elevated py-2 shadow-lg z-50 animate-pop-in origin-bottom-left">
              <div className="mb-2 border-b border-app-border/40 px-4 py-2">
                <div className="truncate text-sm font-bold text-app-text">{getUserDisplayName(user)}</div>
                <div className="text-xs text-app-muted">{apiStatusToUi(presenceStatus)}</div>
              </div>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-app-text hover:bg-app-chat-hover"
                onClick={() => {
                  setMenuOpen(false);
                  onNavigate('profile');
                }}
              >
                <FiSettings className="shrink-0 text-base" />
                Profile & settings
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-app-text hover:bg-app-chat-hover"
                onClick={() => {
                  setMenuOpen(false);
                  onNavigate('organization');
                }}
              >
                <BuildingIcon />
                Organization
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-app-text hover:bg-app-chat-hover"
                onClick={() => {
                  setMenuOpen(false);
                  toggleTheme();
                }}
              >
                <FiSun className="shrink-0 text-base" />
                {theme === 'dark' ? 'Light mode' : 'Dark mode'}
              </button>
              <div className="my-1 border-t border-app-border/40" />
              <button
                type="button"
                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-app-text hover:bg-app-chat-hover"
                onClick={() => {
                  setMenuOpen(false);
                  if (onLogout) onLogout();
                }}
              >
                <FiLogOut className="shrink-0 text-base" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
