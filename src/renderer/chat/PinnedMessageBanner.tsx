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
    <div className="flex shrink-0 items-center gap-1.5 border-b border-app-border bg-app-chat-bg px-3 py-2">
      {hasMultiple ? (
        <button
          type="button"
          aria-label="Previous pinned message"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-app-muted transition-colors hover:bg-app-chat-hover hover:text-app-text"
          onClick={onPrev}
        >
          <FiChevronLeft className="text-xl" />
        </button>
      ) : null}

      <button
        type="button"
        title="Jump to pinned message"
        className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl bg-app-surface px-3 py-2 text-left shadow-sm ring-1 ring-app-border/70 transition-colors hover:bg-app-chat-hover"
        onClick={onJump}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/10">
          <PinIcon size={16} className="text-accent" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="flex min-w-0 items-baseline gap-2">
            <span className="truncate text-sm font-semibold leading-tight text-accent">
              {message.senderName || 'Pinned message'}
            </span>
            {hasMultiple ? (
              <span className="shrink-0 text-xs font-medium text-app-muted">{positionLabel}</span>
            ) : (
              <span className="shrink-0 text-xs font-medium text-app-muted">Pinned</span>
            )}
          </p>
          <p className="truncate text-sm leading-tight text-app-text">{preview}</p>
        </div>
      </button>

      {hasMultiple ? (
        <button
          type="button"
          aria-label="Next pinned message"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-app-muted transition-colors hover:bg-app-chat-hover hover:text-app-text"
          onClick={onNext}
        >
          <FiChevronRight className="text-xl" />
        </button>
      ) : null}

      <button
        type="button"
        aria-label="View all pinned messages"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-app-muted transition-colors hover:bg-app-chat-hover hover:text-app-text"
        onClick={onOpenAll}
      >
        <FiChevronDown className="text-lg" />
      </button>

      <button
        type="button"
        aria-label="Unpin message"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-app-muted transition-colors hover:bg-app-chat-hover hover:text-app-text"
        onClick={onUnpin}
      >
        <FiX className="text-lg" />
      </button>
    </div>
  );
}
