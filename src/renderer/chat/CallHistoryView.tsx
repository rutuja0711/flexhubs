import { FiPhone, FiPhoneOff } from 'react-icons/fi';
import type { CallHistoryItem } from '../../shared/calls';
import {
  formatCallHistorySubtitle,
  formatCallHistoryTitle,
} from '../../shared/calls';
import { formatConversationTimestamp } from './format';

type CallHistoryFilter = 'all' | 'missed';

type CallHistoryViewProps = {
  items: CallHistoryItem[];
  loading: boolean;
  error: string;
  filter: CallHistoryFilter;
  currentUserId: string | null;
  onFilterChange: (filter: CallHistoryFilter) => void;
  onRetry: () => void;
  onSelect: (item: CallHistoryItem) => void;
};

const FILTERS: CallHistoryFilter[] = ['all', 'missed'];

function CallHistoryIcon({ outcome }: { outcome: CallHistoryItem['outcome'] }) {
  const Icon = outcome === 'completed' ? FiPhone : FiPhoneOff;
  const isMissed = outcome !== 'completed';

  return (
    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border transition-colors ${
      isMissed
        ? 'border-red-500/30 bg-red-500/10 text-red-400'
        : 'border-accent/30 bg-accent/10 text-accent-soft'
    }`}>
      <Icon className="text-base" aria-hidden="true" />
    </span>
  );
}

export function CallHistoryView({
  items,
  loading,
  error,
  filter,
  currentUserId,
  onFilterChange,
  onRetry,
  onSelect,
}: CallHistoryViewProps) {
  return (
    <div className="flex h-full flex-col bg-app-chat-bg">
      <header className="border-b border-app-border/50 px-8 py-6 bg-app-surface/50 backdrop-blur-sm">
        <h1 className="text-2xl font-bold text-app-text tracking-tight">Call History</h1>
        <p className="mt-1 text-xs text-app-muted">Review incoming, outgoing, and missed calls.</p>
      </header>

      <div className="flex flex-wrap gap-2 border-b border-app-border/50 px-8 py-3.5 bg-app-surface/30">
        {FILTERS.map((entry) => (
          <button
            key={entry}
            type="button"
            className={`rounded-xl px-3.5 py-1.5 text-xs font-medium capitalize transition-all duration-150 ${
              filter === entry
                ? 'border border-accent/40 bg-accent/15 text-accent-soft font-semibold shadow-xs'
                : 'border border-app-border/60 bg-app-card/40 text-app-muted hover:border-app-border hover:text-app-text hover:bg-app-card'
            }`}
            onClick={() => onFilterChange(entry)}
          >
            {entry}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-8 py-5">
        {loading ? <p className="py-4 text-sm text-app-muted">Loading call history...</p> : null}
        {!loading && error ? (
          <div className="rounded-2xl border border-app-border/70 bg-app-card/60 p-6 text-center max-w-xl mx-auto" role="alert">
            <p className="mb-3 text-sm text-accent-soft">{error}</p>
            <button
              type="button"
              className="rounded-xl border border-app-border bg-app-surface px-4 py-2 text-xs font-semibold text-app-text hover:bg-app-chat-hover transition-colors"
              onClick={onRetry}
            >
              Try again
            </button>
          </div>
        ) : null}
        {!loading && !error ? (
          <div className="mx-auto w-full max-w-3xl flex flex-col gap-2.5">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                disabled={!item.conversationId}
                className="flex w-full items-center gap-4 rounded-2xl border border-app-border/60 bg-app-card/50 p-3.5 text-left transition-all duration-150 hover:bg-app-card hover:border-app-border hover:shadow-xs disabled:cursor-default"
                onClick={() => onSelect(item)}
              >
                <CallHistoryIcon outcome={item.outcome} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-app-text tracking-tight">
                    {formatCallHistoryTitle(item)}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-app-muted">
                    {formatCallHistorySubtitle(item, currentUserId)}
                  </p>
                </div>
                {item.createdAt ? (
                  <span className="shrink-0 text-[11px] text-app-muted">
                    {formatConversationTimestamp(item.createdAt)}
                  </span>
                ) : null}
              </button>
            ))}
            {items.length === 0 ? (
              <p className="py-12 text-center text-sm text-app-muted">
                {filter === 'missed' ? 'No missed calls yet.' : 'No calls yet.'}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
