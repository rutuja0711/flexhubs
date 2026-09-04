import type { SavedMessageItem } from '../../shared/features';
import { formatConversationTimestamp } from './format';

type SavedViewProps = {
  items: SavedMessageItem[];
  loading: boolean;
  error: string;
  onRetry: () => void;
  onSelect: (item: SavedMessageItem) => void;
};

export function SavedView({ items, loading, error, onRetry, onSelect }: SavedViewProps) {
  return (
    <div className="flex h-full flex-col bg-app-chat-bg">
      <header className="border-b border-app-border px-8 py-6">
        <h1 className="text-[1.75rem] font-bold text-app-text">Saved messages</h1>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-8 py-4">
        {loading ? <p className="text-sm text-app-muted">Loading saved messages...</p> : null}
        {!loading && error ? (
          <div role="alert">
            <p className="mb-3 text-sm text-accent-soft">{error}</p>
            <button type="button" className="rounded-[10px] border border-app-border px-3 py-2 text-sm" onClick={onRetry}>
              Try again
            </button>
          </div>
        ) : null}
        {!loading && !error ? (
          <div className="flex flex-col">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                disabled={!item.conversationId}
                className="border-b border-app-border py-4 text-left transition-colors hover:bg-app-chat-hover disabled:cursor-default disabled:hover:bg-transparent"
                onClick={() => onSelect(item)}
              >
                <p className="mb-1 text-app-text">{item.content}</p>
                <p className="text-sm text-app-muted">
                  {item.source}
                  {item.createdAt ? ` · ${formatConversationTimestamp(item.createdAt)}` : ''}
                </p>
              </button>
            ))}
            {items.length === 0 ? (
              <p className="py-8 text-sm text-app-muted">No saved messages yet.</p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
