import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FiSmile } from 'react-icons/fi';
import {
  QUICK_REACTIONS,
  REACTION_EMOJI_CATEGORIES,
  extractSingleEmoji,
} from '../../shared/reactionEmojis';

type ReactionPickerProps = {
  align: 'left' | 'right';
  onSelect: (emoji: string) => void;
};

const PICKER_WIDTH = 320;
const PICKER_MAX_HEIGHT = 360;

export function ReactionPicker({ align, onSelect }: ReactionPickerProps) {
  const [open, setOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState(0);
  const [customEmoji, setCustomEmoji] = useState('');
  const [pickerPosition, setPickerPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const customInputRef = useRef<HTMLInputElement>(null);

  const selectEmoji = (emoji: string) => {
    setOpen(false);
    setCustomEmoji('');
    onSelect(emoji);
  };

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) {
      return;
    }

    const rect = buttonRef.current.getBoundingClientRect();
    const estimatedHeight = PICKER_MAX_HEIGHT;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < estimatedHeight && rect.top > estimatedHeight;

    let left = align === 'right' ? rect.right - PICKER_WIDTH : rect.left;
    left = Math.max(12, Math.min(left, window.innerWidth - PICKER_WIDTH - 12));

    const top = openUp ? rect.top - estimatedHeight - 6 : rect.bottom + 6;

    setPickerPosition({ top, left });
  }, [open, align]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;

      if (buttonRef.current?.contains(target) || panelRef.current?.contains(target)) {
        return;
      }

      setOpen(false);
      setCustomEmoji('');
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        setCustomEmoji('');
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const handleCustomEmojiChange = (value: string) => {
    setCustomEmoji(value);

    const emoji = extractSingleEmoji(value);

    if (emoji) {
      selectEmoji(emoji);
    }
  };

  const panel = open ? (
    <div
      ref={panelRef}
      className="fixed z-[9999] flex flex-col overflow-hidden rounded-2xl border border-app-border/80 bg-app-elevated/95 backdrop-blur-xl shadow-2xl animate-pop-in"
      style={{
        top: pickerPosition.top,
        left: pickerPosition.left,
        width: PICKER_WIDTH,
        maxHeight: PICKER_MAX_HEIGHT,
      }}
      role="dialog"
      aria-label="Choose a reaction"
    >
      <div className="border-b border-app-border/40 px-3 py-2">
        <div className="flex flex-wrap gap-1">
          {QUICK_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              aria-label={`React with ${emoji}`}
              className="flex h-8 w-8 items-center justify-center rounded-xl text-xl transition-transform hover:scale-110 active:scale-95 hover:bg-app-chat-hover"
              onClick={() => selectEmoji(emoji)}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-app-border/40 px-2 py-1.5">
        {REACTION_EMOJI_CATEGORIES.map((category, index) => (
          <button
            key={category.label}
            type="button"
            className={`shrink-0 rounded-lg px-2.5 py-1 text-xs font-semibold tracking-tight transition-colors ${
              activeCategory === index
                ? 'bg-accent/20 text-accent-soft'
                : 'text-app-muted hover:bg-app-chat-hover hover:text-app-text'
            }`}
            onClick={() => setActiveCategory(index)}
          >
            {category.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        <div className="grid grid-cols-8 gap-0.5">
          {REACTION_EMOJI_CATEGORIES[activeCategory]?.emojis.map((emoji) => (
            <button
              key={`${activeCategory}-${emoji}`}
              type="button"
              aria-label={`React with ${emoji}`}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-xl transition-transform hover:scale-110 active:scale-95 hover:bg-app-chat-hover"
              onClick={() => selectEmoji(emoji)}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      <div className="border-t border-app-border/40 px-3 py-2">
        <input
          ref={customInputRef}
          type="text"
          value={customEmoji}
          placeholder="Paste any emoji"
          aria-label="Paste any emoji"
          className="w-full rounded-xl border border-app-border/60 bg-app-surface-input px-3 py-1.5 text-xs text-app-text outline-none transition-all placeholder:text-app-muted focus:border-accent focus:ring-1 focus:ring-accent/30"
          onChange={(event) => handleCustomEmojiChange(event.target.value)}
          onFocus={() => customInputRef.current?.select()}
        />
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label="Add reaction"
        aria-expanded={open}
        aria-haspopup="dialog"
        className={`flex h-7 w-7 items-center justify-center rounded-lg transition-all duration-150 ${
          open
            ? 'bg-accent/15 text-accent dark:text-accent-soft shadow-sm'
            : 'text-app-muted hover:text-app-text hover:bg-black/[0.06] dark:hover:bg-white/[0.1] active:scale-95'
        }`}
        onClick={() => setOpen((current) => !current)}
      >
        <FiSmile className="text-sm" />
      </button>
      {panel ? createPortal(panel, document.body) : null}
    </>
  );
}
