import type { SavedMessageItem } from '../../shared/features';
import { formatSavedMessageTime } from './format';

type SavedViewProps = {
  items: SavedMessageItem[];
  loading: boolean;
  error: string;
  onRetry: () => void;
  onSelect: (item: SavedMessageItem) => void;
};

function formatSavedMessageContent(content: string): string {
  const trimmed = content.trim();

  if (!trimmed || trimmed === 'sticker') {
    return 'Sticker';
  }

  return trimmed;
}

function isEmojiLikeContent(content: string): boolean {
  const trimmed = content.trim();

  if (!trimmed || trimmed.length > 8) {
    return false;
  }

  return !/[a-zA-Z0-9]/.test(trimmed);
}

function formatSavedMessageMeta(item: SavedMessageItem): string {
  const parts = [
    item.conversationTitle || null,
    item.senderName || null,
    item.messageAt ? formatSavedMessageTime(item.messageAt) : null,
  ].filter((part): part is string => Boolean(part));

  if (parts.length > 0) {
    return parts.join(' · ');
  }

  return item.source;
}

export function SavedView({ items, loading, error, onRetry, onSelect }: SavedViewProps) {
  return (
    <div className="flex h-full flex-col bg-app-chat-bg">
      <header className="border-b border-app-border px-8 py-6 bg-app-surface/50 backdrop-blur-sm">
        <h1 className="text-2xl font-bold text-app-text tracking-tight">Saved Messages</h1>
        <p className="mt-1 text-xs text-app-muted">Bookmarks and messages you saved for quick access.</p>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-8 py-5">
        {loading ? <p className="text-sm text-app-muted">Loading saved messages...</p> : null}
        {!loading && error ? (
          <div role="alert" className="rounded-2xl border border-app-border bg-app-card/60 p-6 text-center max-w-xl mx-auto">
            <p className="mb-3 text-sm text-accent-soft">{error}</p>
            <button type="button" className="rounded-xl border border-app-border bg-app-surface px-4 py-2 text-xs font-semibold text-app-text hover:bg-app-chat-hover transition-colors" onClick={onRetry}>
              Try again
            </button>
          </div>
        ) : null}
        {!loading && !error ? (
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-2.5">
            {items.map((item) => {
              const content = formatSavedMessageContent(item.content);
              const emojiLike = isEmojiLikeContent(item.content);

              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={!item.conversationId}
                  className="w-full rounded-2xl border border-app-border bg-app-card/60 p-4 text-left transition-all duration-150 hover:bg-app-card hover:shadow-xs disabled:cursor-default"
                  onClick={() => onSelect(item)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <p
                      className={`min-w-0 flex-1 break-words text-app-text ${
                        emojiLike ? 'text-2xl leading-none' : 'text-sm font-medium leading-relaxed'
                      }`}
                    >
                      {content}
                    </p>
                    {item.savedAt ? (
                      <span className="shrink-0 pt-0.5 text-[11px] text-app-muted">
                        {formatSavedMessageTime(item.savedAt)}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-xs text-app-muted font-normal">{formatSavedMessageMeta(item)}</p>
                </button>
              );
            })}
            {items.length === 0 ? (
              <p className="py-12 text-center text-sm text-app-muted">No saved messages yet.</p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
