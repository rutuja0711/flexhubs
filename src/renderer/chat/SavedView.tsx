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
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-3">
            {items.map((item) => {
              const content = formatSavedMessageContent(item.content);
              const emojiLike = isEmojiLikeContent(item.content);

              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={!item.conversationId}
                  className="w-full rounded-xl border border-app-border bg-app-surface px-4 py-3 text-left transition-colors hover:bg-app-chat-hover disabled:cursor-default disabled:hover:bg-app-surface"
                  onClick={() => onSelect(item)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <p
                      className={`min-w-0 flex-1 break-words text-app-text ${
                        emojiLike ? 'text-2xl leading-none' : 'text-base leading-snug'
                      }`}
                    >
                      {content}
                    </p>
                    {item.savedAt ? (
                      <span className="shrink-0 pt-0.5 text-sm text-app-muted">
                        {formatSavedMessageTime(item.savedAt)}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm text-app-muted">{formatSavedMessageMeta(item)}</p>
                </button>
              );
            })}
            {items.length === 0 ? (
              <p className="py-8 text-sm text-app-muted">No saved messages yet.</p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
