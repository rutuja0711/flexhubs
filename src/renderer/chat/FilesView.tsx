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
      <header className="border-b border-app-border px-8 py-6">
        <h1 className="mb-4 text-[1.75rem] font-bold text-app-text">Files</h1>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((filter) => (
            <button
              key={filter}
              type="button"
              className={`rounded-full px-3 py-1.5 text-sm capitalize ${
                activeFilter === filter
                  ? 'bg-accent text-white'
                  : 'border border-app-border text-app-muted hover:text-app-text'
              }`}
              onClick={() => onFilterChange(filter)}
            >
              {filter}
            </button>
          ))}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-8 py-4">
        {loading ? <p className="text-sm text-app-muted">Loading files...</p> : null}
        {!loading && error ? (
          <div role="alert">
            <p className="mb-3 text-sm text-accent-soft">{error}</p>
            <button type="button" className="rounded-[10px] border border-app-border px-3 py-2 text-sm" onClick={onRetry}>
              Try again
            </button>
          </div>
        ) : null}
        {!loading && !error ? (
          <div className="flex flex-col gap-2">
            {items.map((item) => {
              const canOpenInChat = Boolean(item.conversationId);
              const subtitle = fileSubtitle(item);

              return (
                <div
                  key={item.id}
                  className={`flex items-center gap-3 rounded-[12px] border border-app-border bg-app-surface px-4 py-3 ${
                    canOpenInChat ? 'transition-colors hover:bg-app-chat-hover' : ''
                  }`}
                >
                  <button
                    type="button"
                    disabled={!canOpenInChat}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left disabled:cursor-default"
                    onClick={() => {
                      if (canOpenInChat) {
                        onOpenInChat(item);
                      }
                    }}
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-app-chat-panel text-app-muted">
                      {item.url && isImageFile(item) ? (
                        <img src={item.url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-lg">📄</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-app-text">{item.name}</p>
                      {subtitle ? (
                        <p className="truncate text-sm text-app-muted">{subtitle}</p>
                      ) : null}
                    </div>
                  </button>
                  {item.createdAt ? (
                    <p className="shrink-0 text-xs text-app-muted">
                      {formatConversationTimestamp(item.createdAt)}
                    </p>
                  ) : null}
                </div>
              );
            })}
            {items.length === 0 ? <p className="text-sm text-app-muted">No files in this filter.</p> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
