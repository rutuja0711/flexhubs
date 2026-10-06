import { AppLogoMark } from '../brand/AppLogo';
import { BuildingIcon, UserPlusIcon } from './ChatIcons';
type ChatWelcomeProps = {
  workspaceName: string;
  onFindPeople: () => void;
};

export function ChatWelcome({ workspaceName, onFindPeople }: ChatWelcomeProps) {
  const shortName = workspaceName.replace(/ Workspace$/, '');

  return (
    <div className="relative flex flex-1 items-center justify-center bg-app-chat-bg p-8 overflow-hidden">
      {/* Ambient background glow */}
      <div className="pointer-events-none absolute h-96 w-96 rounded-full bg-accent/10 blur-3xl" />
      
      <div className="relative max-w-md text-center rounded-3xl border border-app-border bg-app-surface/60 backdrop-blur-xl p-8 shadow-2xl">
        <div className="relative mx-auto mb-6 flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl bg-[#160c12] p-3 shadow-lg shadow-accent/20">
          <AppLogoMark className="h-full w-full" />
        </div>

        <h2 className="mb-2 text-2xl font-bold tracking-tight text-app-text">Welcome to {shortName}</h2>
        <p className="mb-6 text-xs leading-relaxed text-app-muted">
          Tap a teammate in the sidebar to start messaging.
        </p>

        <div className="mb-6 inline-flex items-center gap-2 rounded-2xl bg-app-chat-panel/80 px-4 py-2 text-xs text-app-muted">
          <span className="text-accent-soft">
            <BuildingIcon />
          </span>
          <span>{shortName} teammates appear in your sidebar.</span>
        </div>

        <div>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-accent to-[#5c2431] px-5 py-2.5 text-xs font-semibold text-white shadow-md shadow-accent/25 transition-all hover:shadow-accent-glow hover:scale-105 active:scale-95"
            onClick={onFindPeople}
          >
            <UserPlusIcon />
            <span>Find people</span>
          </button>
        </div>
      </div>
    </div>
  );
}
