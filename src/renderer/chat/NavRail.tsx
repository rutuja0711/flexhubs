import { useState, useRef, useEffect } from 'react';
import { FiBell, FiChevronRight, FiSettings, FiShield, FiBookmark } from 'react-icons/fi';
import type { MainView } from '../../shared/nav';
import { userPresenceDotClass, type UserPresenceStatus } from '../../shared/profile';
import { userIsSuperAdmin } from '../../shared/superadmin';
import {
  Avatar,
  CalendarNavIcon,
  CallsNavIcon,
  FlexLogo,
  NavIconButton,
  SparkleIcon,
} from './ChatIcons';
import {
  getUserAvatarUrl,
  getUserEmail,
  getUserInitials,
  getUserDisplayName,
  getWorkspaceShortName,
} from '../../shared/user';
import { getEffectivePresenceStatus, subscribePresenceManager } from '../presenceManager';
import { useToast } from '../ui/Toast';
import {
  applyUserPresenceUiLabel,
  PresenceStatusIcon,
  presenceStatusMenuItems,
  presenceUiLabelFromEffectiveStatus,
  type PresenceStatusUiLabel,
} from './presenceStatusUi';

type NavRailProps = {
  unreadCount: number;
  user: unknown;
  activeView: MainView;
  onNavigate: (view: MainView) => void;
  onGoHome?: () => void;
  onOpenFlexAi?: () => void;
  onLogout?: () => void;
  hasUpdateBadge?: boolean;
};

export function NavRail({ unreadCount, user, activeView, onNavigate, onGoHome, onOpenFlexAi, onLogout, hasUpdateBadge }: NavRailProps) {
  const toast = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [presenceStatus, setPresenceStatus] = useState<UserPresenceStatus>(() => getEffectivePresenceStatus());
  const [statusUiLabel, setStatusUiLabel] = useState<PresenceStatusUiLabel>(() => presenceUiLabelFromEffectiveStatus());
  const [statusSaving, setStatusSaving] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const syncPresence = () => {
      setPresenceStatus(getEffectivePresenceStatus());
      setStatusUiLabel(presenceUiLabelFromEffectiveStatus());
    };

    syncPresence();
    return subscribePresenceManager(syncPresence);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
        setStatusMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const handleStatusSelect = async (label: PresenceStatusUiLabel) => {
    if (statusSaving) {
      return;
    }

    if (label === statusUiLabel) {
      setStatusMenuOpen(false);
      return;
    }

    setStatusSaving(true);
    const result = await applyUserPresenceUiLabel(label);
    setStatusSaving(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    setStatusUiLabel(label);
    setStatusMenuOpen(false);
  };

  const navItemKeys: MainView[] = ['activity', 'calls', 'saved', 'calendar'];
  const activeNavIndex = navItemKeys.indexOf(activeView);
  const isRailViewActive = activeNavIndex !== -1;
  const showSuperAdminNav = userIsSuperAdmin(user);
  const menuIconClass = 'h-4 w-4 shrink-0 text-app-muted';
  const displayName = getUserDisplayName(user);
  const email = getUserEmail(user);
  const workspaceName = getWorkspaceShortName(user);

  const isChatHome = activeView === 'chat';

  return (
    <aside className="relative z-[80] flex w-[76px] shrink-0 flex-col items-center overflow-visible border-r border-app-border bg-app-chat-rail py-4 transition-colors">
      <button
        type="button"
        onClick={() => {
          if (onGoHome) {
            onGoHome();
            return;
          }
          onNavigate('chat');
        }}
        className={`group mb-6 flex h-12 w-12 items-center justify-center rounded-2xl p-2 transition-all duration-200 hover:bg-black/[0.05] dark:hover:bg-white/[0.08] hover:scale-105 active:scale-95 focus:outline-none ${
          isChatHome ? 'bg-black/[0.06] dark:bg-white/[0.1] ring-1 ring-accent/25' : ''
        }`}
        aria-label="FlexHubs Home"
      >
        <FlexLogo className="h-9 w-9 transition-transform group-hover:scale-105" />
      </button>

      <nav className="relative flex w-full flex-1 flex-col gap-1.5 px-2" aria-label="Main navigation">
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
        <div className="relative h-11 w-full">
          <button
            type="button"
            aria-label="Ask Flex"
            title="Ask Flex!"
            className="group/flex-ai absolute bottom-0 left-1/2 z-[80] flex h-11 w-11 max-w-[calc(100vw-5rem)] -translate-x-1/2 items-center justify-center gap-0 overflow-hidden rounded-2xl border border-transparent bg-gradient-to-br from-accent via-accent to-accent-active text-white shadow-md shadow-accent/30 transition-[left,width,transform,box-shadow,padding,gap] duration-200 ease-out hover:left-0 hover:w-[min(148px,calc(100vw-5rem))] hover:translate-x-0 hover:justify-start hover:gap-2 hover:border-accent/20 hover:pr-3 hover:pl-2 hover:shadow-accent-glow focus-visible:left-0 focus-visible:w-[min(148px,calc(100vw-5rem))] focus-visible:translate-x-0 focus-visible:justify-start focus-visible:gap-2 focus-visible:pr-3 focus-visible:pl-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:scale-[0.98]"
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

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            aria-label="User menu"
            aria-expanded={menuOpen}
            className="relative rounded-full p-1 transition-all duration-200 hover:ring-2 hover:ring-accent/40 hover:scale-105 active:scale-95 focus:outline-none"
            onClick={() => {
              setMenuOpen((open) => {
                if (open) {
                  setStatusMenuOpen(false);
                }
                return !open;
              });
            }}
          >
            <div className="relative isolate inline-flex shrink-0">
              <Avatar
                imageUrl={getUserAvatarUrl(user)}
                initials={getUserInitials(user)}
                size="sm"
              />
              <span
                className={`pointer-events-none absolute bottom-0 right-0 z-50 box-border h-3 w-3 rounded-full border-2 border-app-chat-rail ${userPresenceDotClass(presenceStatus)}`}
                aria-hidden="true"
              />
            </div>
            {hasUpdateBadge && (
              <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-accent ring-2 ring-app-chat-rail animate-pulse" />
            )}
          </button>
          
          {menuOpen && (
            <div className="absolute bottom-10 left-full ml-4 w-[min(300px,calc(100vw-6rem))] overflow-visible rounded-2xl border border-app-border bg-app-surface shadow-2xl z-50 animate-pop-in origin-bottom-left dark:bg-[#1f1f1f]">
              <div className="border-b border-app-border px-4 py-2.5">
                <span className="truncate text-xs font-semibold text-app-muted">{workspaceName}</span>
              </div>

              <div className="px-4 py-4">
                <div className="flex gap-3">
                  <div className="relative isolate shrink-0">
                    <Avatar
                      imageUrl={getUserAvatarUrl(user)}
                      initials={getUserInitials(user)}
                      size="md"
                    />
                    <span className="absolute -bottom-0.5 -right-0.5 z-50">
                      <PresenceStatusIcon label={statusUiLabel} className="h-[14px] w-[14px] ring-2 ring-app-surface dark:ring-[#1f1f1f]" />
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold text-app-text">{displayName}</div>
                    {email ? (
                      <div className="truncate text-xs text-app-muted">{email}</div>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="relative px-2 pb-2">
                <button
                  type="button"
                  disabled={statusSaving}
                  aria-expanded={statusMenuOpen}
                  aria-haspopup="menu"
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-app-text transition-colors hover:bg-black/[0.05] dark:hover:bg-white/[0.06] disabled:opacity-60 ${
                    statusMenuOpen ? 'ring-1 ring-app-border' : ''
                  }`}
                  onClick={() => setStatusMenuOpen((open) => !open)}
                >
                  <PresenceStatusIcon label={statusUiLabel} className="h-[18px] w-[18px]" />
                  <span className="min-w-0 flex-1 truncate font-medium">{statusUiLabel}</span>
                  <FiChevronRight className="h-4 w-4 shrink-0 text-app-muted" aria-hidden="true" />
                </button>

                {statusMenuOpen ? (
                  <div
                    role="menu"
                    className="absolute left-[calc(100%+8px)] top-0 z-[120] w-[min(220px,calc(100vw-8rem))] overflow-hidden rounded-xl border border-app-border bg-app-surface py-1 shadow-2xl dark:bg-[#1f1f1f]"
                  >
                    {presenceStatusMenuItems().map((item) => {
                      const isActive = item.label === statusUiLabel;

                      return (
                        <button
                          key={item.label}
                          type="button"
                          role="menuitem"
                          disabled={statusSaving}
                          className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-black/[0.05] dark:hover:bg-white/[0.06] disabled:opacity-60 ${
                            isActive ? 'bg-black/[0.04] dark:bg-white/[0.05]' : 'text-app-text'
                          }`}
                          onClick={() => void handleStatusSelect(item.label)}
                        >
                          {item.icon}
                          <span className="truncate">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>

              <div className="mx-3 border-t border-app-border" />

              <div className="p-1.5">
                <button
                  type="button"
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-medium text-app-text transition-colors hover:bg-black/[0.05] dark:hover:bg-white/[0.08] hover:text-accent dark:hover:text-accent-soft"
                  onClick={() => {
                    setMenuOpen(false);
                    setStatusMenuOpen(false);
                    onNavigate('profile');
                  }}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2.5">
                    <FiSettings className={menuIconClass} strokeWidth={1.75} aria-hidden="true" />
                    <span className="truncate">Profile & settings</span>
                  </div>
                  {hasUpdateBadge ? <span className="h-2 w-2 shrink-0 rounded-full bg-accent animate-pulse" /> : null}
                </button>
                {showSuperAdminNav ? (
                  <button
                    type="button"
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-medium text-app-text transition-colors hover:bg-black/[0.05] dark:hover:bg-white/[0.08] hover:text-accent dark:hover:text-accent-soft"
                    onClick={() => {
                      setMenuOpen(false);
                      setStatusMenuOpen(false);
                      onNavigate('superadmin');
                    }}
                  >
                    <FiShield className={menuIconClass} strokeWidth={1.75} aria-hidden="true" />
                    <span>Super Admin</span>
                  </button>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
