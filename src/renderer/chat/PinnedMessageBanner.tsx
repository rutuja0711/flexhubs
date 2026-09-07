import { FiX } from 'react-icons/fi';
import type { MessageItem } from '../../shared/messages';
import { formatMessagePreview } from '../../shared/messages';
import { PinIcon } from './ChatIcons';

type PinnedMessageBannerProps = {
  message: MessageItem;
  pinnedCount: number;
  onJump: () => void;
  onUnpin: () => void;
};

export function PinnedMessageBanner({
  message,
  pinnedCount,
  onJump,
  onUnpin,
}: PinnedMessageBannerProps) {
  const preview = formatMessagePreview(message) || 'Attachment';

  return (
    <div className="flex shrink-0 items-center gap-3 border-b border-app-border bg-app-surface px-4 py-2.5">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/10">
        <PinIcon size={16} className="text-accent" />
      </div>

      <button
        type="button"
        className="min-w-0 flex-1 text-left"
        onClick={onJump}
      >
        <p className="truncate text-sm font-semibold leading-tight text-accent">
          {message.senderName || 'Pinned message'}
        </p>
        <p className="truncate text-sm leading-tight text-app-text">{preview}</p>
      </button>

      {pinnedCount > 1 ? (
        <button
          type="button"
          className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-app-muted hover:bg-app-chat-hover hover:text-app-text"
          onClick={onJump}
        >
          {pinnedCount} pinned
        </button>
      ) : null}

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
