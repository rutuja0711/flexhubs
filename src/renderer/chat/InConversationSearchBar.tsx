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
    <div className="border-b border-app-border bg-app-chat-bg px-6 py-3">
      <div className="flex items-center gap-3">
        <div
          className={`relative flex min-w-0 flex-1 items-center rounded-[12px] border bg-app-surface-input transition-colors ${
            error ? 'border-accent' : 'border-accent/75 focus-within:border-accent'
          }`}
        >
          <span className="pointer-events-none flex h-11 w-11 shrink-0 items-center justify-center text-app-muted">
            <SearchIcon className="h-[18px] w-[18px]" />
          </span>
          <input
            type="text"
            value={value}
            placeholder="Search in conversation"
            aria-invalid={Boolean(error)}
            autoFocus
            className="min-w-0 flex-1 bg-transparent py-2.5 pr-3 text-sm text-app-text outline-none placeholder:text-app-placeholder"
            onChange={(event) => onChange(event.target.value)}
          />
          {value ? (
            <button
              type="button"
              aria-label="Clear search"
              className="mr-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-app-muted transition-colors hover:bg-app-chat-hover hover:text-app-text"
              onClick={() => onChange('')}
            >
              ×
            </button>
          ) : null}
        </div>

        <button
          type="button"
          aria-label="Close search"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-app-muted transition-colors hover:bg-app-chat-hover hover:text-app-text"
          onClick={onClose}
        >
          ×
        </button>

        {value.trim() ? (
          <span className="shrink-0 text-sm tabular-nums text-app-muted">
            {resultCount} result{resultCount === 1 ? '' : 's'}
          </span>
        ) : null}
      </div>
      {error ? (
        <p className="mt-2 text-xs text-accent-soft" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
