import type { MainView } from '../../shared/nav';
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
import { getUserAvatarUrl, getUserInitials } from '../../shared/user';

type NavRailProps = {
  unreadCount: number;
  user: unknown;
  activeView: MainView;
  onNavigate: (view: MainView) => void;
};

export function NavRail({ unreadCount, user, activeView, onNavigate }: NavRailProps) {
  return (
    <aside className="flex w-[72px] shrink-0 flex-col items-center border-r border-app-border bg-app-chat-rail py-4">
      <div className="mb-6">
        <FlexLogo />
      </div>

      <nav className="flex w-full flex-1 flex-col gap-1 px-2" aria-label="Main navigation">
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

      <div className="mt-auto flex w-full flex-col items-center gap-3 px-2 pb-1">
        <button
          type="button"
          aria-label="Quick actions"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-white transition-colors hover:bg-accent-hover"
        >
          <SparkleIcon />
        </button>
        <button
          type="button"
          aria-label="Back to chats"
          className="relative rounded-full"
          onClick={() => onNavigate('chat')}
        >
          <Avatar
            imageUrl={getUserAvatarUrl(user)}
            initials={getUserInitials(user)}
            size="sm"
          />
          <span
            className="absolute right-0 bottom-0 h-3 w-3 rounded-full border-2 border-app-chat-rail bg-[#3ecf8e]"
            aria-hidden="true"
          />
        </button>
      </div>
    </aside>
  );
}
