import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { MessageContextMenuItem } from './messageContextMenuItems';

type MessageContextMenuProps = {
  items: MessageContextMenuItem[];
  position: { top: number; left: number };
  onClose: () => void;
};

const MENU_MIN_WIDTH = 220;

export function MessageContextMenu({ items, position, onClose }: MessageContextMenuProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [adjusted, setAdjusted] = useState(position);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) {
      return;
    }

    const rect = panel.getBoundingClientRect();
    const padding = 12;
    let top = position.top;
    let left = position.left;

    if (left + rect.width > window.innerWidth - padding) {
      left = window.innerWidth - rect.width - padding;
    }

    if (top + rect.height > window.innerHeight - padding) {
      top = position.top - rect.height - 4;
    }

    if (top < padding) {
      top = padding;
    }

    if (left < padding) {
      left = padding;
    }

    setAdjusted({ top, left });
  }, [items.length, position.left, position.top]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (panelRef.current?.contains(event.target as Node)) {
        return;
      }

      onClose();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setHighlightedIndex((current) => Math.min(current + 1, items.length - 1));
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setHighlightedIndex((current) => Math.max(current - 1, 0));
        return;
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        const item = items[highlightedIndex];

        if (item && !item.disabled) {
          item.onSelect();
          onClose();
        }
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [highlightedIndex, items, onClose]);

  if (items.length === 0) {
    return null;
  }

  return createPortal(
    <div
      ref={panelRef}
      className="fixed z-[10000] overflow-hidden rounded-2xl border border-app-border bg-app-surface/98 p-1.5 shadow-2xl backdrop-blur-xl dark:bg-app-elevated/95"
      style={{ top: adjusted.top, left: adjusted.left, minWidth: MENU_MIN_WIDTH }}
      role="menu"
    >
      {items.map((item, index) => {
        const showDivider = item.tone === 'danger' && items[index - 1]?.tone !== 'danger';

        return (
          <div key={item.id}>
            {showDivider ? <div className="my-1 h-px bg-app-border" /> : null}
            <button
              type="button"
              role="menuitem"
              disabled={item.disabled}
              className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                index === highlightedIndex ? 'bg-black/[0.06] dark:bg-white/[0.08]' : ''
              } ${
                item.tone === 'danger'
                  ? 'text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40'
                  : 'text-app-text hover:bg-black/[0.05] dark:hover:bg-white/[0.08]'
              }`}
              onMouseEnter={() => setHighlightedIndex(index)}
              onClick={() => {
                if (item.disabled) {
                  return;
                }

                item.onSelect();
                onClose();
              }}
            >
              {item.icon ? <span className="shrink-0 opacity-80">{item.icon}</span> : null}
              <span className="min-w-0 flex-1">{item.label}</span>
            </button>
          </div>
        );
      })}
    </div>,
    document.body,
  );
}