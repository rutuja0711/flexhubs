import { useState, useMemo } from 'react';
import type { SavedMessageItem } from '../../shared/features';
import { formatSavedMessageTime } from './format';
import { SearchIcon, Avatar } from './ChatIcons';
import { FiBookmark, FiSearch, FiX } from 'react-icons/fi';

type SavedViewProps = {
  items: SavedMessageItem[];
  loading: boolean;
  error: string;
  onRetry: () => void;
  onSelect: (item: SavedMessageItem) => void;
  onUnsave?: (item: SavedMessageItem) => void;
};

type SavedFilter = 'All' | 'Messages' | 'Files' | 'Links' | 'Images';

function classifySavedMessage(item: SavedMessageItem): SavedFilter {
  const content = (item.content || '').toLowerCase();
  
  if (item.mediaUrl || content.includes('shared a photo') || content.includes('photo') || content.includes('.jpg') || content.includes('.png') || content.includes('.gif') || content.includes('.jpeg')) {
    return 'Images';
  }
  if (content.includes('shared a file') || content.includes('.pdf') || content.includes('.doc') || content.includes('.csv') || content.includes('.zip')) {
    return 'Files';
  }
  if (content.includes('http://') || content.includes('https://') || content.match(/\w+\.\w+/)) {
    // If it has a link but also could be a message with a link.
    // For simplicity, we'll classify any content containing a URL as a Link if it's not a file/image.
    if (content.includes('http')) {
      return 'Links';
    }
  }
  return 'Messages';
}

export function SavedView({ items, loading, error, onRetry, onSelect, onUnsave }: SavedViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<SavedFilter>('All');

  const filteredItems = useMemo(() => {
    let result = items;
    
    // Apply search
    if (searchQuery.trim()) {
      const lowerQuery = searchQuery.toLowerCase();
      result = result.filter(
        (i) =>
          i.content?.toLowerCase().includes(lowerQuery) ||
          i.senderName?.toLowerCase().includes(lowerQuery) ||
          i.conversationTitle?.toLowerCase().includes(lowerQuery)
      );
    }
    
    // Apply visual type filter
    if (activeFilter !== 'All') {
      result = result.filter((i) => classifySavedMessage(i) === activeFilter);
    }
    
    return result;
  }, [items, searchQuery, activeFilter]);

  // Group by date
  const groupedItems = useMemo(() => {
    const groups: Record<string, { dateStr: string; items: SavedMessageItem[] }> = {};

    filteredItems.forEach((item) => {
      const d = item.savedAt ? new Date(item.savedAt) : new Date();
      const now = new Date();
      const isToday =
        d.getDate() === now.getDate() &&
        d.getMonth() === now.getMonth() &&
        d.getFullYear() === now.getFullYear();
      const isYesterday =
        d.getDate() === now.getDate() - 1 &&
        d.getMonth() === now.getMonth() &&
        d.getFullYear() === now.getFullYear();

      let groupKey = 'Older';
      if (isToday) groupKey = 'Today';
      else if (isYesterday) groupKey = 'Yesterday';

      if (!groups[groupKey]) {
        groups[groupKey] = {
          dateStr: d.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
          }),
          items: [],
        };
      }
      groups[groupKey].items.push(item);
    });

    return groups;
  }, [filteredItems]);

  return (
    <div className="flex h-full flex-col bg-app-surface text-app-text font-sans">
      <header className="px-10 pt-10 pb-4">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-app-text mb-1">
              Saved Messages
            </h1>
            <p className="text-[13px] text-app-muted">
              Your saved messages in one place
            </p>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-app-muted text-[13px] font-medium bg-app-card border border-app-border">
            {items.length} saved
          </div>
        </div>

        <div className="flex gap-4 mb-2">
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-app-muted">
              <SearchIcon />
            </span>
            <input
              type="text"
              placeholder="Search saved messages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-app-card/60 border border-app-border/80 rounded-xl py-2 pl-10 pr-10 text-[13px] text-app-text focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all placeholder:text-app-muted/70"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-app-muted hover:text-app-text transition-colors"
              >
                <FiX className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-4">
          {(['All', 'Messages', 'Files', 'Links', 'Images'] as SavedFilter[]).map((filter) => {
            const isActive = activeFilter === filter;
            let count = 0;
            if (filter === 'All') count = items.length;
            else count = items.filter(i => classifySavedMessage(i) === filter).length;

            if (count === 0 && filter !== 'All') return null;

            return (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[13px] font-medium transition-all ${
                  isActive
                    ? 'border-accent/40 bg-accent/5 text-accent shadow-sm'
                    : 'border-app-border/80 bg-app-surface text-app-muted hover:bg-app-card hover:text-app-text'
                }`}
              >
                {filter}
                <span className={`ml-0.5 font-bold ${isActive ? 'text-accent' : 'text-app-muted/70'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-8 pb-10">
        {loading ? (
          <div className="py-16 text-center text-[13px] text-app-muted">
            Loading saved messages...
          </div>
        ) : error ? (
          <div className="py-16 text-center">
            <p className="text-[13px] text-accent-soft mb-3">{error}</p>
            <button
              onClick={onRetry}
              className="px-4 py-2 rounded-xl bg-app-card border border-app-border text-[13px] font-semibold hover:bg-app-inset transition-colors"
            >
              Try again
            </button>
          </div>
        ) : filteredItems.length === 0 ? (
          searchQuery ? (
            <div className="py-20 flex flex-col items-center justify-center text-center">
              <div className="h-12 w-12 rounded-full border border-dashed border-app-border flex items-center justify-center mb-4">
                <FiSearch className="h-5 w-5 text-app-muted/50" />
              </div>
              <p className="text-[14px] font-semibold text-app-text">
                No saved messages found
              </p>
              <p className="text-[13px] text-app-muted mt-1 max-w-[250px]">
                Try another search term.
              </p>
              <button
                onClick={() => setSearchQuery('')}
                className="mt-4 px-4 py-1.5 rounded-lg border border-app-border text-sm hover:bg-app-card transition-colors text-app-text"
              >
                Clear search
              </button>
            </div>
          ) : (
            <div className="py-20 flex flex-col items-center justify-center text-center">
              <div className="h-12 w-12 rounded-full border border-dashed border-app-border flex items-center justify-center mb-4">
                <FiBookmark className="h-5 w-5 text-app-muted/50" />
              </div>
              <p className="text-[14px] font-semibold text-app-text">
                No saved messages
              </p>
              <p className="text-[13px] text-app-muted mt-1 max-w-[250px]">
                Save important messages from any conversation and find them here.
              </p>
            </div>
          )
        ) : (
          <div className="flex flex-col gap-6">
            {Object.entries(groupedItems).map(([groupName, group]) => (
              <div key={groupName}>
                <div className="flex items-center justify-between mb-2 border-b border-app-border/40 pb-2 px-2">
                  <h2 className="text-[13px] font-bold text-app-text">{groupName}</h2>
                </div>
                <div className="flex flex-col">
                  {group.items.map((item) => (
                    <div
                      key={item.id}
                      className="group flex w-full items-start justify-between gap-4 py-3 px-2 hover:bg-app-card/40 rounded-xl transition-colors cursor-pointer border-b border-app-border/30 last:border-0"
                      onClick={() => onSelect(item)}
                    >
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="shrink-0 mt-0.5">
                          <Avatar
                            initials={item.senderName?.substring(0, 2).toUpperCase() || 'U'}
                            size="md"
                            imageUrl={null}
                          />
                        </div>
                        <div className="flex flex-col min-w-0 flex-1">
                          <p className="text-[14px] text-app-text font-semibold truncate flex items-center gap-2">
                            {item.senderName || 'Unknown User'}
                            <span className="text-xs text-app-muted font-normal">
                              · {item.conversationTitle || item.source}
                            </span>
                          </p>
                          <div className="mt-1 flex gap-3 w-full items-start">
                            {item.mediaUrl && (
                              <div className="relative group/media z-10 shrink-0">
                                <img
                                  src={item.mediaUrl}
                                  alt="Saved media"
                                  className="h-10 w-10 object-cover rounded-md border border-app-border shadow-sm"
                                />
                                <div className="absolute left-12 top-1/2 -translate-y-1/2 opacity-0 group-hover/media:opacity-100 pointer-events-none transition-opacity duration-200 z-[100]">
                                  <div className="bg-app-card border border-app-border rounded-xl shadow-2xl p-1 w-48 h-48">
                                    <img
                                      src={item.mediaUrl}
                                      alt="Preview large"
                                      className="w-full h-full object-cover rounded-lg"
                                    />
                                  </div>
                                </div>
                              </div>
                            )}
                            <span className="text-[14px] text-app-text/90 line-clamp-3 mt-0.5">
                              {item.content}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-xs text-app-muted hidden sm:block">
                          Saved {item.savedAt ? formatSavedMessageTime(item.savedAt) : 'recently'}
                        </span>
                        <button
                          className="px-3 py-1 text-xs font-semibold rounded bg-app-card hover:bg-app-inset border border-app-border text-app-text transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelect(item);
                          }}
                        >
                          Open
                        </button>
                        {onUnsave && (
                          <button
                            className="p-1.5 text-accent hover:bg-accent/10 rounded-lg transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              onUnsave(item);
                            }}
                            title="Unsave message"
                          >
                            <FiBookmark className="h-4 w-4 fill-current" />
                          </button>
                        )}
                      </div>
                      <div className="sm:hidden absolute right-3 bottom-3 text-xs text-app-muted group-hover:hidden">
                         {item.savedAt ? formatSavedMessageTime(item.savedAt) : ''}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
