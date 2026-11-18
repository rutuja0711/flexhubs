import type { ReactNode } from 'react';

type EmojiGlyphProps = {
  emoji: string;
  className?: string;
  ariaHidden?: boolean;
};

/** Renders emoji with shared cross-platform color font (Noto / Apple fallback). */
export function EmojiGlyph({ emoji, className = '', ariaHidden }: EmojiGlyphProps): ReactNode {
  return (
    <span className={`emoji-glyph ${className}`.trim()} aria-hidden={ariaHidden}>
      {emoji}
    </span>
  );
}