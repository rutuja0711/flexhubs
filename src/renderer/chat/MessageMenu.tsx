import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FiMoreHorizontal } from 'react-icons/fi';

type MessageMenuProps = {
  isOwn: boolean;
  isPinned: boolean;
  isSaved: boolean;
  align: 'left' | 'right';
  showReplyInThread?: boolean;
  onReply: () => void;
  onReplyInThread: () => void;
  onEdit: () => void;
  onDeleteForMe: () => void;
  onDeleteForEveryone: () => void;
  onForward: () => void;
  onPinToggle: () => void;
  onSave: () => void;
  onUnsave: () => void;
};

type MenuItem = {
  label: string;
  onClick: () => void;
  tone?: 'default' | 'danger';
};

const MENU_WIDTH = 212;

export function MessageMenu({
  isOwn,
  isPinned,
  isSaved,
  align,
  showReplyInThread = false,
  onReply,
  onReplyInThread,
  onEdit,
  onDeleteForMe,
  onDeleteForEveryone,
  onForward,
  onPinToggle,
  onSave,
  onUnsave,
}: MessageMenuProps) {
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const run = (action: () => void) => {
    setOpen(false);
    action();
  };

  const items: MenuItem[] = [
    { label: 'Reply', onClick: () => run(onReply) },
    ...(showReplyInThread
      ? [{ label: 'Reply in thread', onClick: () => run(onReplyInThread) }]
      : []),
    ...(isOwn ? [{ label: 'Edit', onClick: () => run(onEdit) }] : []),
    { label: 'Forward', onClick: () => run(onForward) },
    { label: isPinned ? 'Unpin' : 'Pin', onClick: () => run(onPinToggle) },
    ...(isSaved
      ? [{ label: 'Unsave', onClick: () => run(onUnsave) }]
      : [{ label: 'Save', onClick: () => run(onSave) }]),
    { label: 'Delete for me', onClick: () => run(onDeleteForMe), tone: 'danger' },
    ...(isOwn
      ? [{ label: 'Delete for everyone', onClick: () => run(onDeleteForEveryone), tone: 'danger' }]
      : []),
  ];

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) {
      return;
    }

    const rect = buttonRef.current.getBoundingClientRect();
    const estimatedHeight = items.length * 40 + 16;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < estimatedHeight && rect.top > estimatedHeight;

    let left = align === 'right' ? rect.right - MENU_WIDTH : rect.left;
    left = Math.max(12, Math.min(left, window.innerWidth - MENU_WIDTH - 12));

    const top = openUp ? rect.top - estimatedHeight - 6 : rect.bottom + 6;

    setMenuPosition({ top, left });
  }, [open, align, items.length]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;

      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }

      setOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const menu = open ? (
    <div
      ref={menuRef}
      className="fixed z-[9999] overflow-hidden rounded-2xl border border-app-border/80 bg-app-surface/98 dark:bg-app-elevated/95 backdrop-blur-xl p-1.5 shadow-2xl animate-pop-in"
      style={{ top: menuPosition.top, left: menuPosition.left, width: MENU_WIDTH }}
      role="menu"
    >
      {items.map((item, index) => {
        const showDivider = item.tone === 'danger' && items[index - 1]?.tone !== 'danger';

        return (
          <div key={item.label}>
            {showDivider ? <div className="my-1 border-t border-app-border/40" /> : null}
            <button
              type="button"
              role="menuitem"
              className={`flex w-full items-center rounded-xl px-3 py-2 text-left text-xs font-medium transition-colors duration-150 ${
                item.tone === 'danger'
                  ? 'text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-700 dark:hover:text-rose-300'
                  : 'text-app-text hover:bg-black/[0.05] dark:hover:bg-white/[0.08] hover:text-accent dark:hover:text-accent-soft'
              }`}
              onClick={item.onClick}
            >
              {item.label}
            </button>
          </div>
        );
      })}
    </div>
  ) : null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label="Message actions"
        aria-expanded={open}
        aria-haspopup="menu"
        className={`flex h-7 w-7 items-center justify-center rounded-lg transition-all duration-150 ${
          open
            ? 'bg-accent/15 text-accent dark:text-accent-soft shadow-sm'
            : 'text-app-muted hover:text-app-text hover:bg-black/[0.06] dark:hover:bg-white/[0.1] active:scale-95'
        }`}
        onClick={() => setOpen((current) => !current)}
      >
        <FiMoreHorizontal className="text-sm" />
      </button>
      {menu ? createPortal(menu, document.body) : null}
    </>
  );
}
