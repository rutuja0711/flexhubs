import type { FileItem } from '../../shared/features';
import { formatConversationTimestamp } from './format';

const FILTERS = ['all', 'images', 'docs', 'other'] as const;

type FileFilter = (typeof FILTERS)[number];

type FilesViewProps = {
  items: FileItem[];
  loading: boolean;
  error: string;
  activeFilter: FileFilter;
  onFilterChange: (filter: FileFilter) => void;
  onRetry: () => void;
  onOpenInChat: (item: FileItem) => void;
};

function fileSubtitle(item: FileItem): string {
  return [item.sharedBy, item.conversationName].filter(Boolean).join(' · ');
}

function isImageFile(item: FileItem): boolean {
  const mime = item.mimeType?.toLowerCase() ?? '';
  const name = item.name.toLowerCase();
  return mime.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/.test(name);
}

export function FilesView({
  items,
  loading,
  error,
  activeFilter,
  onFilterChange,
  onRetry,
  onOpenInChat,
}: FilesViewProps) {
  return (
    <div className="flex h-full flex-col bg-app-chat-bg">
      <header className="border-b border-app-border/50 px-8 py-6 bg-app-surface/50 backdrop-blur-sm">
        <h1 className="mb-3 text-2xl font-bold text-app-text tracking-tight">Shared Files</h1>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((filter) => (
            <button
              key={filter}
              type="button"
              className={`rounded-xl px-3.5 py-1.5 text-xs font-medium capitalize transition-all duration-150 ${
                activeFilter === filter
                  ? 'border border-accent/40 bg-accent/15 text-accent-soft font-semibold shadow-xs'
                  : 'border border-app-border/60 bg-app-card/40 text-app-muted hover:border-app-border hover:text-app-text hover:bg-app-card'
              }`}
              onClick={() => onFilterChange(filter)}
            >
              {filter}
            </button>
          ))}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-8 py-5">
        {loading ? <p className="text-sm text-app-muted">Loading files...</p> : null}
        {!loading && error ? (
          <div role="alert" className="rounded-2xl border border-app-border/70 bg-app-card/60 p-6 text-center max-w-xl mx-auto">
            <p className="mb-3 text-sm text-accent-soft">{error}</p>
            <button type="button" className="rounded-xl border border-app-border bg-app-surface px-4 py-2 text-xs font-semibold text-app-text hover:bg-app-chat-hover transition-colors" onClick={onRetry}>
              Try again
            </button>
          </div>
        ) : null}
        {!loading && !error ? (
          <div className="flex flex-col gap-2 max-w-4xl">
            {items.map((item) => {
              const canOpenInChat = Boolean(item.conversationId);
              const subtitle = fileSubtitle(item);

              return (
                <div
                  key={item.id}
                  className={`flex items-center gap-3.5 rounded-2xl border border-app-border/60 bg-app-card/50 p-3.5 transition-all duration-150 ${
                    canOpenInChat ? 'hover:bg-app-card hover:border-app-border hover:shadow-xs' : ''
                  }`}
                >
                  <button
                    type="button"
                    disabled={!canOpenInChat}
                    className="flex min-w-0 flex-1 items-center gap-3.5 text-left disabled:cursor-default group"
                    onClick={() => {
                      if (canOpenInChat) {
                        onOpenInChat(item);
                      }
                    }}
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-app-inset/80 border border-app-border/50 text-app-muted">
                      {item.url && isImageFile(item) ? (
                        <img src={item.url} alt="" className="h-full w-full object-cover group-hover:scale-105 transition-transform" />
                      ) : (
                        <span className="text-base">📄</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-app-text tracking-tight group-hover:text-accent-soft transition-colors">{item.name}</p>
                      {subtitle ? (
                        <p className="truncate text-xs text-app-muted mt-0.5">{subtitle}</p>
                      ) : null}
                    </div>
                  </button>
                  {item.createdAt ? (
                    <p className="shrink-0 text-[11px] text-app-muted">
                      {formatConversationTimestamp(item.createdAt)}
                    </p>
                  ) : null}
                </div>
              );
            })}
            {items.length === 0 ? <p className="py-12 text-center text-sm text-app-muted">No files in this filter.</p> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
