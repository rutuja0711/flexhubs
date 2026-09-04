import type { GlobalSearchResult, SearchPerson } from '../../shared/search';
import { Avatar } from './ChatIcons';

type GlobalSearchResultsProps = {
  results: GlobalSearchResult;
  onSelectPerson: (person: SearchPerson) => void;
  onSelectChat: (chatId: string) => void;
};

export function GlobalSearchResults({
  results,
  onSelectPerson,
  onSelectChat,
}: GlobalSearchResultsProps) {
  return (
    <div className="px-2 pb-4">
      {results.people.length > 0 ? (
        <section className="mb-4">
          <p className="px-2 py-2 text-[0.6875rem] font-semibold tracking-[0.08em] text-app-muted uppercase">
            People
          </p>
          <div className="flex flex-col gap-0.5">
            {results.people.map((person) => (
              <button
                key={person.id}
                type="button"
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-app-chat-hover"
                onClick={() => onSelectPerson(person)}
              >
                <Avatar imageUrl={person.avatarUrl} initials={person.initials} size="sm" />
                <span className="text-sm font-medium text-app-text">{person.name}</span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {results.chats.length > 0 ? (
        <section>
          <p className="px-2 py-2 text-[0.6875rem] font-semibold tracking-[0.08em] text-app-muted uppercase">
            Chats
          </p>
          <div className="flex flex-col gap-0.5">
            {results.chats.map((chat) => (
              <button
                key={chat.id}
                type="button"
                className="rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-app-chat-hover"
                onClick={() => onSelectChat(chat.id)}
              >
                <p className="text-sm font-medium text-app-text">{chat.title}</p>
                {chat.subtitle ? (
                  <p className="truncate text-xs text-app-muted">{chat.subtitle}</p>
                ) : null}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {results.people.length === 0 && results.chats.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-app-muted" role="status">
          No people or chats found.
        </p>
      ) : null}
    </div>
  );
}
