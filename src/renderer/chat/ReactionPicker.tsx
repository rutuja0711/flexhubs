import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FiPlus, FiSearch, FiSmile } from 'react-icons/fi';
import { searchCatalogEmojis } from '../../shared/emojiSearch';
import {
  QUICK_REACTIONS,
  REACTION_EMOJI_CATEGORIES,
  extractSingleEmoji,
} from '../../shared/reactionEmojis';
import { EmojiGlyph } from './EmojiGlyph';

type ReactionPickerProps = {
  align: 'left' | 'right';
  onSelect: (emoji: string) => void;
};

const PICKER_WIDTH = 320;
const PICKER_MAX_HEIGHT = 400;

export function ReactionPicker({ align, onSelect }: ReactionPickerProps) {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [activeCategory, setActiveCategory] = useState(0);
  const [customEmoji, setCustomEmoji] = useState('');
  const [query, setQuery] = useState('');
  const [pickerPosition, setPickerPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectEmoji = (emoji: string) => {
    setOpen(false);
    setCustomEmoji('');
    setQuery('');
    onSelect(emoji);
  };

  const emojiGridEmojis = useMemo(() => {
    const trimmed = query.trim();

    if (!trimmed) {
      return REACTION_EMOJI_CATEGORIES[activeCategory]?.emojis ?? [];
    }

    const keywordMatches = searchCatalogEmojis(trimmed);
    if (keywordMatches.length > 0) {
      return keywordMatches;
    }

    const lowered = trimmed.toLowerCase();
    const matchingCategories = REACTION_EMOJI_CATEGORIES.filter((category) =>
      category.label.toLowerCase().includes(lowered),
    );

    return [...new Set(matchingCategories.flatMap((category) => category.emojis))];
  }, [activeCategory, query]);

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

    setQuery('');
    setCustomEmoji('');
    const focusTimer = window.setTimeout(() => searchInputRef.current?.focus(), 50);

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;

      if (buttonRef.current?.contains(target) || panelRef.current?.contains(target)) {
        return;
      }

      setOpen(false);
      setCustomEmoji('');
      setQuery('');
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        setCustomEmoji('');
        setQuery('');
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
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
      className="fixed z-[9999] flex flex-col overflow-hidden rounded-2xl border border-app-border/70 bg-app-elevated shadow-2xl animate-pop-in"
      style={{
        top: pickerPosition.top,
        left: pickerPosition.left,
        width: PICKER_WIDTH,
        maxHeight: PICKER_MAX_HEIGHT,
      }}
      role="dialog"
      aria-label="Choose a reaction"
    >
      <div className="shrink-0 px-3 pt-2.5 pb-2">
        <div className="relative">
          <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-app-muted" />
          <input
            ref={searchInputRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value.slice(0, 100))}
            onMouseDown={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
            placeholder="Search emojis (e.g. heart, pizza)"
            autoComplete="off"
            spellCheck={false}
            aria-label="Search emojis"
            className="w-full rounded-xl border border-app-border/60 bg-app-surface-input py-2 pl-9 pr-3 text-xs text-app-text outline-none transition-all placeholder:text-app-muted focus:border-accent focus:ring-1 focus:ring-accent/30"
          />
        </div>
      </div>

      {!query.trim() ? (
        <div className="shrink-0 flex gap-1 overflow-x-auto border-b border-app-border/40 px-2 py-1.5 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
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
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {emojiGridEmojis.length === 0 ? (
          <p className="py-4 text-center text-xs text-app-muted">
            {query.trim()
              ? 'No emojis match that search. Try heart, smile, dog, or pizza.'
              : 'No emojis in this category.'}
          </p>
        ) : (
          <div className="grid grid-cols-8 gap-0.5">
            {emojiGridEmojis.map((emoji, index) => (
              <button
                key={`${query}-${activeCategory}-${emoji}-${index}`}
                type="button"
                aria-label={`React with ${emoji}`}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[22px] leading-none transition-transform hover:scale-110 active:scale-95 hover:bg-app-chat-hover"
                onClick={() => selectEmoji(emoji)}
              >
                <EmojiGlyph emoji={emoji} />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-app-border/40 px-3 py-2">
        <input
          type="text"
          value={customEmoji}
          placeholder="Paste any emoji"
          aria-label="Paste any emoji"
          className="w-full rounded-xl border border-app-border/60 bg-app-surface-input px-3 py-1.5 text-xs text-app-text outline-none transition-all placeholder:text-app-muted focus:border-accent focus:ring-1 focus:ring-accent/30"
          onChange={(event) => handleCustomEmojiChange(event.target.value)}
        />
      </div>
    </div>
  ) : null;

  return (
    <div
      className="relative flex items-center"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-label="Add reaction"
        aria-expanded={open}
        aria-haspopup="dialog"
        className={`flex h-7 w-7 items-center justify-center rounded-lg transition-all duration-150 ${
          open || hovered
            ? 'bg-accent/15 text-accent dark:text-accent-soft shadow-sm'
            : 'text-app-muted hover:text-app-text hover:bg-black/[0.06] dark:hover:bg-white/[0.1] active:scale-95'
        }`}
      >
        <FiSmile className="text-sm" />
      </button>

      {hovered && !open ? (
        <div className={`absolute bottom-full pb-2 ${align === 'right' ? 'right-0' : 'left-0'} z-[9999]`}>
          <div className="flex items-center gap-0.5 rounded-2xl border border-app-border/80 bg-app-elevated px-1.5 py-1 shadow-2xl animate-pop-in">
            {QUICK_REACTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                aria-label={`React with ${emoji}`}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-[22px] leading-none transition-transform hover:scale-110 active:scale-95 hover:bg-app-chat-hover"
                onClick={() => {
                  setHovered(false);
                  onSelect(emoji);
                }}
              >
                <EmojiGlyph emoji={emoji} />
              </button>
            ))}
            <div className="mx-1 h-4 w-px bg-app-border/50" />
            <button
              type="button"
              aria-label="More reactions"
              className="flex h-8 w-8 items-center justify-center rounded-xl text-app-muted hover:text-app-text hover:bg-app-chat-hover transition-colors active:scale-95"
              onClick={(e) => {
                e.stopPropagation();
                setHovered(false);
                setOpen(true);
              }}
            >
              <FiPlus className="text-lg" />
            </button>
          </div>
        </div>
      ) : null}

      {panel ? createPortal(panel, document.body) : null}
    </div>
  );
}