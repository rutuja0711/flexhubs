import { useState, useMemo, useEffect } from 'react';
import type { ConversationItem } from '../../shared/chat';
import { FiSearch, FiCheck } from 'react-icons/fi';

type ForwardMessageModalProps = {
  open: boolean;
  conversations: ConversationItem[];
  currentConversationId: string;
  loading?: boolean;
  error?: string;
  onClose: () => void;
  onForward: (targetConversationIds: string[]) => void;
};

export function ForwardMessageModal({
  open,
  conversations,
  currentConversationId,
  loading = false,
  error = '',
  onClose,
  onForward,
}: ForwardMessageModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (open) {
      setSearchQuery('');
      setSelectedIds([]);
    }
  }, [open]);

  if (!open) {
    return null;
  }

  const filteredTargets = useMemo(() => {
    return (conversations || []).filter(
      (conversation) =>
        conversation &&
        conversation.id !== currentConversationId &&
        conversation?.title?.toLowerCase() !== 'saved messages' &&
        (conversation?.title || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [conversations, currentConversationId, searchQuery]);

  const toggleSelection = (id: string) => {
    setSelectedIds(current => {
      if (current.includes(id)) {
        return current.filter(x => x !== id);
      }
      if (current.length >= 10) {
        return current;
      }
      return [...current, id];
    });
  };

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/60 p-4 backdrop-blur-md animate-fade-in">
      <div
        className="relative flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-3xl border border-app-border/80 bg-app-surface/95 backdrop-blur-2xl shadow-2xl animate-pop-in origin-center"
        role="dialog"
        aria-labelledby="forward-title"
      >
        <div className="border-b border-app-border/50 px-6 py-5 shrink-0">
          <div className="flex items-center justify-between gap-3">
            <h3 id="forward-title" className="text-base font-semibold text-app-text tracking-tight">
              Forward message
            </h3>
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-xl text-app-muted transition-colors hover:bg-app-inset hover:text-app-text"
              onClick={onClose}
              aria-label="Close"
            >
              ✕
            </button>
          </div>
          <div className="mt-4 relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted" />
            <input
              type="text"
              placeholder="Search people, groups, or hubs..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-app-inset border border-app-border rounded-xl py-2.5 pl-9 pr-3 text-sm text-app-text outline-none focus:border-accent transition-colors"
            />
          </div>
        </div>

        {error ? (
          <p className="border-b border-app-border/50 px-6 py-3 text-xs text-accent-soft font-medium shrink-0" role="alert">
            {error}
          </p>
        ) : null}

        <div className="overflow-y-auto flex-1 p-2 space-y-0.5">
          {filteredTargets.length === 0 ? (
            <p className="px-4 py-8 text-center text-xs text-app-muted">No other conversations available.</p>
          ) : (
            filteredTargets.map((conversation) => {
              const isSelected = selectedIds.includes(conversation.id);
              return (
                <button
                  key={conversation.id}
                  type="button"
                  disabled={loading || (!isSelected && selectedIds.length >= 10)}
                  className="flex w-full items-center gap-3 rounded-2xl p-2.5 text-left transition-all duration-150 border border-transparent hover:bg-app-card/60 disabled:opacity-50"
                  onClick={() => toggleSelection(conversation.id)}
                >
                  {conversation.avatarUrl ? (
                    <img src={conversation.avatarUrl} alt={conversation.title || 'User'} className="w-10 h-10 rounded-full shrink-0 object-cover" />
                  ) : (
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent/20 to-accent/5 border border-accent/20 text-xs font-bold text-accent-soft">
                      {conversation.avatarInitials || '?'}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-app-text tracking-tight transition-colors">
                      {conversation.title}
                    </span>
                    <span className="block truncate text-xs text-app-muted mt-0.5">
                      {conversation.kind === 'direct' ? 'Direct message' : 'Hub'}
                    </span>
                  </span>
                  <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-colors ${isSelected ? 'bg-accent border-accent text-white' : 'border-app-border text-transparent'}`}>
                    <FiCheck className="w-3 h-3" strokeWidth={3} />
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="border-t border-app-border/50 p-4 shrink-0 flex items-center justify-between bg-app-surface">
          <span className="text-xs text-app-muted font-medium">
            {selectedIds.length} selected · max 10
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-app-muted hover:text-app-text transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => onForward(selectedIds)}
              disabled={loading || selectedIds.length === 0}
              className="px-6 py-2 text-sm font-semibold text-white bg-accent rounded-xl hover:bg-accent-soft disabled:opacity-50 disabled:hover:bg-accent transition-colors"
            >
              {loading ? 'Forwarding...' : 'Forward'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
