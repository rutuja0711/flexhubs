import { FiChevronDown, FiChevronLeft, FiChevronRight, FiX } from 'react-icons/fi';
import type { MessageItem } from '../../shared/messages';
import { formatMessagePreview } from '../../shared/messages';
import { PinIcon } from './ChatIcons';

type PinnedMessageBannerProps = {
  message: MessageItem;
  pinnedCount: number;
  pinnedIndex: number;
  onJump: () => void;
  onPrev: () => void;
  onNext: () => void;
  onOpenAll: () => void;
  onUnpin: () => void;
};

export function PinnedMessageBanner({
  message,
  pinnedCount,
  pinnedIndex,
  onJump,
  onPrev,
  onNext,
  onOpenAll,
  onUnpin,
}: PinnedMessageBannerProps) {
  const preview = formatMessagePreview(message) || 'Attachment';
  const hasMultiple = pinnedCount > 1;
  const positionLabel = `${pinnedIndex + 1} of ${pinnedCount} pinned`;

  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-app-border/40 bg-app-chat-panel/60 backdrop-blur-sm px-4 py-2">
      {hasMultiple ? (
        <button
          type="button"
          aria-label="Previous pinned message"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-app-muted transition-colors hover:bg-app-chat-hover hover:text-app-text"
          onClick={onPrev}
        >
          <FiChevronLeft className="text-base" />
        </button>
      ) : null}

      <button
        type="button"
        title="Jump to pinned message"
        className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-app-border/60 bg-app-surface/90 px-3 py-1.5 text-left shadow-sm transition-all hover:bg-app-chat-hover hover:border-app-border-strong/60"
        onClick={onJump}
      >
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent">
          <PinIcon size={14} className="text-accent" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="flex min-w-0 items-baseline gap-2">
            <span className="truncate text-xs font-semibold leading-tight text-accent-soft">
              {message.senderName || 'Pinned message'}
            </span>
            {hasMultiple ? (
              <span className="shrink-0 text-[10px] font-medium text-app-muted">{positionLabel}</span>
            ) : (
              <span className="shrink-0 text-[10px] font-medium text-app-muted">Pinned</span>
            )}
          </p>
          <p className="truncate text-xs leading-tight text-app-text/90 mt-0.5">{preview}</p>
        </div>
      </button>

      {hasMultiple ? (
        <button
          type="button"
          aria-label="Next pinned message"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-app-muted transition-colors hover:bg-app-chat-hover hover:text-app-text"
          onClick={onNext}
        >
          <FiChevronRight className="text-base" />
        </button>
      ) : null}

      <button
        type="button"
        aria-label="View all pinned messages"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-app-muted transition-colors hover:bg-app-chat-hover hover:text-app-text"
        onClick={onOpenAll}
      >
        <FiChevronDown className="text-base" />
      </button>

      <button
        type="button"
        aria-label="Unpin message"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-app-muted transition-colors hover:bg-app-chat-hover hover:text-app-text"
        onClick={onUnpin}
      >
        <FiX className="text-base" />
      </button>
    </div>
  );
}
