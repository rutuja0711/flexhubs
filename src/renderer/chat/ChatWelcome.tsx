import { AppLogoMark } from '../brand/AppLogo';
import { BuildingIcon, UserPlusIcon } from './ChatIcons';
type ChatWelcomeProps = {
  workspaceName: string;
  onFindPeople: () => void;
};

export function ChatWelcome({ workspaceName, onFindPeople }: ChatWelcomeProps) {
  const shortName = workspaceName.replace(/ Workspace$/, '');

  return (
    <div className="flex flex-1 items-center justify-center bg-app-chat-bg p-8">
      <div className="max-w-lg text-center">
        <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-[24px] border border-app-border bg-app-chat-panel p-4">
          <AppLogoMark className="h-full w-full" />
        </div>

        <h2 className="mb-3 text-[1.75rem] font-bold text-app-text">Welcome to {shortName}</h2>
        <p className="mb-6 text-[0.9375rem] leading-normal text-app-muted">
          Tap a teammate in the sidebar to start messaging. Friend requests are optional.
        </p>

        <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-app-border bg-app-chat-panel px-4 py-2 text-sm text-app-muted">
          <span className="text-accent-soft">
            <BuildingIcon />
          </span>
          <span>{shortName} teammates appear below your chats in the sidebar.</span>
        </div>

        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-[12px] bg-accent px-5 py-3 text-[0.9375rem] font-semibold text-white transition-colors hover:bg-accent-hover active:bg-accent-active"
          onClick={onFindPeople}
        >
          <UserPlusIcon />
          Find people
        </button>
      </div>
    </div>
  );
}
