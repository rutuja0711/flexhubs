import { useState } from 'react';
import type { FileItem } from '../../shared/features';

const FILTERS = ['all', 'images', 'docs', 'other'] as const;

type FileFilter = (typeof FILTERS)[number];

type FilesViewProps = {
  items: FileItem[];
  loading: boolean;
  error: string;
  activeFilter: FileFilter;
  onFilterChange: (filter: FileFilter) => void;
  onRetry: () => void;
};

export function FilesView({
  items,
  loading,
  error,
  activeFilter,
  onFilterChange,
  onRetry,
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
              className={`rounded-full border px-3 py-1.5 text-sm capitalize ${
                activeFilter === filter
                  ? 'border-accent text-accent-soft'
                  : 'border-app-border text-app-muted'
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
          <div className="grid gap-3 md:grid-cols-2">
            {items.map((item) => (
              <div key={item.id} className="rounded-[12px] border border-app-border bg-app-surface p-4">
                <p className="font-medium text-app-text">{item.name}</p>
                <p className="text-sm text-app-muted">
                  {item.sharedBy}
                  {item.conversationName ? ` · ${item.conversationName}` : ''}
                </p>
              </div>
            ))}
            {items.length === 0 ? <p className="text-sm text-app-muted">No files in this filter.</p> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
