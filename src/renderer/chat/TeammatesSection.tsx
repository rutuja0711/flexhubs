import type { TeammateItem } from '../../shared/messages';
import { Avatar } from './ChatIcons';

type TeammatesSectionProps = {
  teammates: TeammateItem[];
  openingTeammateId?: string | null;
  onSelect: (memberId: string) => void;
};

export function TeammatesSection({ teammates, openingTeammateId = null, onSelect }: TeammatesSectionProps) {
  if (teammates.length === 0) {
    return null;
  }

  return (
    <div className="border-t border-app-border/40 px-3 py-3.5">
      <p className="mb-2 px-2 text-[0.6875rem] font-semibold tracking-wider text-app-muted/75 uppercase">
        Start a chat with a teammate
      </p>
      <div className="flex flex-col gap-0.5 pb-2">
        {teammates.map((teammate) => {
          const isOpening = openingTeammateId === teammate.id;

          return (
          <button
            key={teammate.id}
            type="button"
            disabled={isOpening}
            className={`flex items-center gap-3 rounded-2xl px-2.5 py-2 text-left transition-all duration-200 border border-transparent hover:bg-app-chat-hover/70 hover:border-app-border/40 disabled:cursor-wait disabled:opacity-60 ${isOpening ? 'bg-app-chat-hover border-app-border/50' : ''}`}
            onClick={() => onSelect(teammate.id)}
          >
            <Avatar imageUrl={teammate.avatarUrl} initials={teammate.initials} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-app-text">{teammate.name}</p>
              {isOpening ? (
                <p className="truncate text-[11px] text-accent-soft mt-0.5">Opening chat...</p>
              ) : teammate.statusMessage ? (
                <p className="truncate text-[11px] text-app-muted mt-0.5">{teammate.statusMessage}</p>
              ) : null}
            </div>
          </button>
          );
        })}
      </div>
    </div>
  );
}
