import { FiRefreshCw } from 'react-icons/fi';
import { EnhanceSparkleIcon } from './ChatIcons';

type QuickReplySuggestionsProps = {
  suggestions: string[];
  onSelect: (text: string) => void;
  className?: string;
  /** full: own row above composer; inline: sits beside typing indicator */
  layout?: 'full' | 'inline';
  onAiReply?: () => void;
  aiReplyLoading?: boolean;
};

export function QuickReplySuggestions({
  suggestions,
  onSelect,
  className = '',
  layout = 'full',
  onAiReply,
  aiReplyLoading = false,
}: QuickReplySuggestionsProps) {
  if (suggestions.length === 0 && !onAiReply) {
    return null;
  }

  return (
    <div
      className={`flex flex-wrap items-center justify-end gap-2 ${
        layout === 'inline' ? 'w-auto max-w-[min(100%,520px)] shrink-0' : 'w-full'
      } ${className}`}
      role="group"
      aria-label="Suggested replies"
    >
      {suggestions.map((suggestion) => (
        <button
          key={suggestion}
          type="button"
          onClick={() => onSelect(suggestion)}
          className="rounded-full border border-accent/35 bg-transparent px-3.5 py-1.5 text-[13px] font-medium text-accent transition-colors hover:border-accent/55 hover:bg-accent/10 dark:border-accent-soft/40 dark:text-accent-soft dark:hover:bg-accent/15"
        >
          {suggestion}
        </button>
      ))}
      {onAiReply ? (
        <button
          type="button"
          title="Reply with AI"
          aria-label="Reply with AI"
          disabled={aiReplyLoading}
          onClick={onAiReply}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-accent/35 bg-transparent text-accent transition-colors hover:border-accent/55 hover:bg-accent/10 disabled:cursor-wait disabled:opacity-70 dark:border-accent-soft/40 dark:text-accent-soft dark:hover:bg-accent/15"
        >
          {aiReplyLoading ? (
            <FiRefreshCw className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <EnhanceSparkleIcon className="h-4 w-4" />
          )}
        </button>
      ) : null}
    </div>
  );
}