import { SearchIcon } from './ChatIcons';

type InConversationSearchBarProps = {
  value: string;
  error: string;
  resultCount: number;
  onChange: (value: string) => void;
  onClose: () => void;
};

export function InConversationSearchBar({
  value,
  error,
  resultCount,
  onChange,
  onClose,
}: InConversationSearchBarProps) {
  return (
    <div className="border-b border-app-border/50 bg-app-surface/60 backdrop-blur-md px-6 py-2.5">
      <div className="flex items-center gap-3">
        <div
          className={`relative flex min-w-0 flex-1 items-center rounded-2xl border bg-app-surface-input/80 transition-all ${
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
          />
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
          <span className="shrink-0 text-xs tabular-nums text-app-muted font-medium px-2 py-1 rounded-lg bg-app-inset/80 border border-app-border/40">
            {resultCount} {resultCount === 1 ? 'match' : 'matches'}
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
