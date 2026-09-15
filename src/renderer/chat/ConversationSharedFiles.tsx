import { useCallback, useEffect, useRef, useState } from 'react';
import { FiChevronRight, FiFile, FiLink } from 'react-icons/fi';
import type { FileItem } from '../../shared/features';
import { loadConversationFiles } from '../chatApi';
import { RemoteImage } from '../RemoteImage';

type SharedFilesTab = 'media' | 'docs' | 'links';

type ConversationSharedFilesProps = {
  conversationId: string;
  initialTab?: SharedFilesTab;
  previewLimit?: number;
  onViewAll?: (tab: SharedFilesTab) => void;
};

function isImageFile(item: FileItem): boolean {
  const mimeType = item.mimeType?.toLowerCase() ?? '';
  const name = item.name.toLowerCase();

  return (
    mimeType.startsWith('image/') ||
    mimeType === 'image/gif' ||
    /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(name)
  );
}

function openSharedItem(item: FileItem): void {
  const url = item.url?.trim();

  if (!url) {
    return;
  }

  if (window.electronAPI?.openExternalUrl) {
    void window.electronAPI.openExternalUrl(url);
    return;
  }

  window.open(url, '_blank', 'noopener,noreferrer');
}

export function ConversationSharedFiles({
  conversationId,
  initialTab = 'media',
  previewLimit = 8,
  onViewAll,
}: ConversationSharedFilesProps) {
  const [activeTab, setActiveTab] = useState<SharedFilesTab>(initialTab);
  const [itemsByTab, setItemsByTab] = useState<Partial<Record<SharedFilesTab, FileItem[]>>>({});
  const [loadingTab, setLoadingTab] = useState<SharedFilesTab | null>(null);
  const [error, setError] = useState('');
  const loadedTabsRef = useRef<Set<SharedFilesTab>>(new Set());

  const loadTab = useCallback(async (tab: SharedFilesTab) => {
    if (loadedTabsRef.current.has(tab)) {
      return;
    }

    loadedTabsRef.current.add(tab);
    setLoadingTab(tab);
    setError('');

    const result = await loadConversationFiles(conversationId, tab);

    setLoadingTab(null);

    if (!result.ok) {
      loadedTabsRef.current.delete(tab);
      setError(result.error);
      return;
    }

    setItemsByTab((current) => ({
      ...current,
      [tab]: result.data,
    }));
  }, [conversationId]);

  useEffect(() => {
    loadedTabsRef.current = new Set();
    setItemsByTab({});
    setError('');
    setActiveTab(initialTab);
  }, [conversationId, initialTab]);

  useEffect(() => {
    void loadTab('media');
  }, [conversationId, loadTab]);

  useEffect(() => {
    if (activeTab === 'media') {
      return;
    }

    void loadTab(activeTab);
  }, [activeTab, loadTab]);

  const activeItems = itemsByTab[activeTab] ?? [];
  const visibleItems = activeItems.slice(0, previewLimit);
  const hasMore = activeItems.length > previewLimit;

  return (
    <section className="border-b border-app-border/40 p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold tracking-wider text-app-muted uppercase">
          Media, links and docs
        </span>
        {activeItems.length > 0 ? (
          <span className="text-xs text-app-muted">{activeItems.length}</span>
        ) : null}
      </div>

      <div className="mb-3 flex gap-2">
        {(['media', 'docs', 'links'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            className={`rounded-lg px-3 py-1.5 text-sm capitalize transition-colors ${
              activeTab === tab
                ? 'border border-accent/40 bg-accent/10 font-medium text-accent-soft'
                : 'text-app-muted hover:bg-app-chat-hover hover:text-app-text'
            }`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {loadingTab === activeTab ? (
        <p className="py-6 text-center text-sm text-app-muted">Loading...</p>
      ) : error ? (
        <p className="py-4 text-sm text-accent-soft" role="alert">
          {error}
        </p>
      ) : visibleItems.length === 0 ? (
        <p className="rounded-xl border border-dashed border-app-border px-3 py-6 text-center text-sm text-app-muted">
          No {activeTab} shared yet.
        </p>
      ) : activeTab === 'media' ? (
        <div className="grid grid-cols-4 gap-2">
          {visibleItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className="aspect-square overflow-hidden rounded-lg bg-app-elevated transition-opacity hover:opacity-80"
              onClick={() => openSharedItem(item)}
              aria-label={item.name}
            >
              {item.url && isImageFile(item) ? (
                <RemoteImage
                  src={item.url}
                  alt={item.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-app-muted">
                  <FiFile />
                </div>
              )}
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {visibleItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className="flex w-full items-center gap-3 rounded-xl border border-app-border bg-app-elevated px-3 py-2.5 text-left transition-colors hover:bg-app-chat-hover"
              onClick={() => openSharedItem(item)}
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent-soft">
                {activeTab === 'links' ? <FiLink /> : <FiFile />}
              </div>
              <span className="min-w-0 flex-1 truncate text-sm text-app-text">{item.name}</span>
              <FiChevronRight className="shrink-0 text-app-muted" />
            </button>
          ))}
        </div>
      )}

      {onViewAll && activeItems.length > 0 ? (
        <button
          type="button"
          className="mt-3 flex items-center gap-1 text-sm font-medium text-accent-soft transition-colors hover:text-accent"
          onClick={() => onViewAll(activeTab)}
        >
          View all {activeItems.length}
          <FiChevronRight className="text-base" />
        </button>
      ) : null}
    </section>
  );
}
