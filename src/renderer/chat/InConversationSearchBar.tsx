import { FiChevronDown, FiChevronUp } from 'react-icons/fi';
import { SearchIcon } from './ChatIcons';

type InConversationSearchBarProps = {
  value: string;
  error: string;
  resultCount: number;
  activeMatchIndex: number;
  onChange: (value: string) => void;
  onClose: () => void;
  onPreviousMatch: () => void;
  onNextMatch: () => void;
};

export function InConversationSearchBar({
  value,
  error,
  resultCount,
  activeMatchIndex,
  onChange,
  onClose,
  onPreviousMatch,
  onNextMatch,
}: InConversationSearchBarProps) {
  const hasMatches = resultCount > 0;
  const displayIndex = hasMatches ? activeMatchIndex + 1 : 0;

  return (
    <div className="border-b border-app-border/50 bg-app-surface/80 backdrop-blur-xl px-6 py-2.5">
      <div className="flex items-center gap-3">
        <div
          className={`relative flex min-w-0 flex-1 items-center rounded-2xl border bg-app-surface-input/90 transition-all ${
            error ? 'border-accent' : 'border-app-border/70 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20'
          }`}
        >
          <span className="pointer-events-none flex h-10 w-10 shrink-0 items-center justify-center text-app-muted">
            <SearchIcon className="h-4 w-4" />
          </span>
          <input
            type="text"
            value={value}
            placeholder="Search in conversation..."
            aria-invalid={Boolean(error)}
            autoFocus
            className="min-w-0 flex-1 bg-transparent py-2 pr-1 text-xs text-app-text outline-none placeholder:text-app-placeholder"
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                if (event.shiftKey) {
                  onPreviousMatch();
                } else {
                  onNextMatch();
                }
              }
            }}
          />
          {value.trim() && hasMatches ? (
            <div className="mr-1 flex shrink-0 items-center gap-0.5">
              <button
                type="button"
                aria-label="Previous search result"
                className="flex h-7 w-7 items-center justify-center rounded-lg text-app-muted transition-colors hover:bg-app-inset hover:text-app-text disabled:opacity-40"
                disabled={!hasMatches}
                onClick={onPreviousMatch}
              >
                <FiChevronUp className="h-4 w-4" strokeWidth={2} />
              </button>
              <button
                type="button"
                aria-label="Next search result"
                className="flex h-7 w-7 items-center justify-center rounded-lg text-app-muted transition-colors hover:bg-app-inset hover:text-app-text disabled:opacity-40"
                disabled={!hasMatches}
                onClick={onNextMatch}
              >
                <FiChevronDown className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>
          ) : null}
          <button
            type="button"
            aria-label="Close search"
            className="mr-1.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl text-app-muted transition-colors hover:bg-app-inset hover:text-app-text"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        {value.trim() ? (
          <span className="shrink-0 text-xs tabular-nums text-app-muted font-medium px-2.5 py-1 rounded-lg bg-app-inset/90 border border-app-border/50 min-w-[4.5rem] text-center">
            {hasMatches ? `${displayIndex} / ${resultCount}` : '0 matches'}
          </span>
        ) : null}
      </div>
      {error ? (
        <p className="mt-1.5 text-xs text-accent-soft font-medium" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
