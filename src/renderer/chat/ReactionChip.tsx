import { useCallback, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { formatReactionAuthors, listReactionAuthors } from '../../shared/messages';
import type { MessageReaction } from '../../shared/messages';

type ReactionChipProps = {
  emoji: string;
  count: number;
  reactedByMe: boolean;
  reactions: MessageReaction[];
  currentUserId: string | null;
  showAuthors: boolean;
  onClick: () => void;
};

type TooltipPosition = {
  x: number;
  y: number;
};

export function ReactionChip({
  emoji,
  count,
  reactedByMe,
  reactions,
  currentUserId,
  showAuthors,
  onClick,
}: ReactionChipProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [tooltipPosition, setTooltipPosition] = useState<TooltipPosition | null>(null);
  const authors = showAuthors ? listReactionAuthors(reactions, emoji, currentUserId) : [];
  const authorLabel = authors.length > 0 ? formatReactionAuthors(reactions, emoji, currentUserId) : '';

  const openTooltip = useCallback(() => {
    if (authors.length === 0) {
      return;
    }

    const rect = buttonRef.current?.getBoundingClientRect();

    if (!rect) {
      return;
    }

    setTooltipPosition({
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
    });
  }, [authors.length]);

  const closeTooltip = useCallback(() => {
    setTooltipPosition(null);
  }, []);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={authorLabel ? `${emoji} reacted by ${authorLabel}` : `React with ${emoji}`}
        className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition-all duration-150 active:scale-95 shadow-sm ${
          reactedByMe
            ? 'border-accent/60 bg-accent/20 text-accent-soft font-semibold shadow-accent/20'
            : 'border-app-border/60 bg-app-surface/80 text-app-text/90 hover:border-app-border-strong hover:bg-app-chat-hover'
        }`}
        onClick={onClick}
        onMouseEnter={openTooltip}
        onMouseLeave={closeTooltip}
        onFocus={openTooltip}
        onBlur={closeTooltip}
      >
        {emoji} <span className="ml-1 text-[11px]">{count}</span>
      </button>

      {tooltipPosition && authors.length > 0
        ? createPortal(
            <div
              role="tooltip"
              className="pointer-events-none fixed z-[9999] min-w-[7rem] max-w-[12rem] -translate-x-1/2 -translate-y-full animate-[reaction-tooltip-in_90ms_ease-out]"
              style={{ left: tooltipPosition.x, top: tooltipPosition.y }}
            >
              <div className="rounded-2xl border border-app-border/80 bg-app-elevated/95 backdrop-blur-xl px-3 py-2 text-left shadow-2xl">
                <span className="mb-1.5 block text-base leading-none" aria-hidden="true">
                  {emoji}
                </span>
                <span className="flex flex-col gap-0.5">
                  {authors.map((name) => (
                    <span
                      key={name}
                      className={`truncate text-xs leading-snug ${
                        name === 'You' ? 'font-semibold text-accent-soft' : 'font-medium text-app-text'
                      }`}
                    >
                      {name}
                    </span>
                  ))}
                </span>
              </div>
              <span
                className="absolute left-1/2 top-full -mt-px -translate-x-1/2 border-[5px] border-transparent border-t-app-elevated"
                aria-hidden="true"
              />
              <span
                className="absolute left-1/2 top-full -translate-x-1/2 border-[6px] border-transparent border-t-app-border"
                aria-hidden="true"
              />
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
