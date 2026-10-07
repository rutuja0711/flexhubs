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
  const visibleItems = activeTab === 'media' ? activeItems : activeItems.slice(0, previewLimit);
  const hasMore = activeTab === 'media' ? false : activeItems.length > previewLimit;

  return (
    <section className="pb-2">
      <div className="mb-3 flex items-center justify-between gap-2 px-1 mt-1">
        <span className="text-[10px] font-bold tracking-wider text-app-muted uppercase">
          Media, links and docs
        </span>
        {activeItems.length > 0 ? (
          <span className="text-[12px] text-app-muted">{activeItems.length}</span>
        ) : null}
      </div>

      <div className="mb-4 flex gap-2 px-1">
        {(['media', 'docs', 'links'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            className={`rounded-[10px] px-4 py-[5px] text-[13px] capitalize transition-colors ${
              activeTab === tab
                ? 'border border-app-border bg-app-inset text-app-text'
                : 'text-app-muted hover:bg-app-chat-hover hover:text-app-text'
            }`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="px-1">
        {loadingTab === activeTab ? (
          <p className="py-6 text-center text-[13px] text-app-muted">Loading...</p>
        ) : error ? (
          <p className="py-4 text-[13px] text-accent-soft" role="alert">
            {error}
          </p>
        ) : visibleItems.length === 0 ? (
          <div className="rounded-[12px] border border-dashed border-app-border py-8 flex flex-col items-center justify-center">
            <span className="text-[13px] text-app-muted">No {activeTab} shared yet.</span>
          </div>
        ) : activeTab === 'media' ? (
          <div className="grid grid-cols-4 gap-2 max-h-[300px] overflow-y-auto">
            {visibleItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className="aspect-square overflow-hidden rounded-[10px] bg-app-elevated transition-opacity hover:opacity-80"
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
          <div className="space-y-[10px] max-h-[300px] overflow-y-auto pr-1">
            {visibleItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className="flex w-full items-center gap-3 rounded-[12px] border border-app-border/40 bg-transparent px-3 py-2.5 text-left transition-colors hover:bg-app-chat-hover"
                onClick={() => openSharedItem(item)}
              >
                <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] bg-accent/15 text-accent-soft">
                  {activeTab === 'links' ? <FiLink className="text-[15px]" /> : <FiFile className="text-[15px]" />}
                </div>
                <span className="min-w-0 flex-1 truncate text-[13px] text-app-text">{item.name}</span>
                <FiChevronRight className="shrink-0 text-app-muted text-sm" />
              </button>
            ))}
          </div>
        )}
      </div>

      {onViewAll && activeItems.length > 0 ? (
        <button
          type="button"
          className="mt-3 ml-1 flex items-center gap-1 text-[13px] font-medium text-accent-soft transition-colors hover:text-accent"
          onClick={() => onViewAll(activeTab)}
        >
          View all {activeItems.length}
          <FiChevronRight className="text-base" />
        </button>
      ) : null}
    </section>
  );
}
