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
    <div className="border-t border-app-border px-4 py-4">
      <p className="mb-3 text-[0.6875rem] font-semibold tracking-[0.08em] text-app-muted uppercase">
        Start a chat with a teammate
      </p>
      <div className="flex flex-col gap-1 pb-4">
        {teammates.map((teammate) => {
          const isOpening = openingTeammateId === teammate.id;

          return (
          <button
            key={teammate.id}
            type="button"
            disabled={isOpening}
            className={`flex items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-app-chat-hover disabled:cursor-wait disabled:opacity-60 ${isOpening ? 'bg-app-chat-hover' : ''}`}
            onClick={() => onSelect(teammate.id)}
          >
            <Avatar imageUrl={teammate.avatarUrl} initials={teammate.initials} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-app-text">{teammate.name}</p>
              {isOpening ? (
                <p className="truncate text-xs text-app-muted">Opening chat...</p>
              ) : teammate.statusMessage ? (
                <p className="truncate text-xs text-app-muted">{teammate.statusMessage}</p>
              ) : null}
            </div>
          </button>
          );
        })}
      </div>
    </div>
  );
}
