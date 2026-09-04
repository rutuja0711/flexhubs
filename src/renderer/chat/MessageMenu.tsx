import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type MessageMenuProps = {
  isOwn: boolean;
  isPinned: boolean;
  align: 'left' | 'right';
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
  align,
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
    { label: 'Reply in thread', onClick: () => run(onReplyInThread) },
    ...(isOwn ? [{ label: 'Edit', onClick: () => run(onEdit) }] : []),
    { label: 'Forward', onClick: () => run(onForward) },
    { label: isPinned ? 'Unpin' : 'Pin', onClick: () => run(onPinToggle) },
    { label: 'Save', onClick: () => run(onSave) },
    { label: 'Unsave', onClick: () => run(onUnsave) },
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
      className="fixed z-[9999] overflow-hidden rounded-xl border border-app-border bg-app-surface py-1.5 shadow-2xl"
      style={{ top: menuPosition.top, left: menuPosition.left, width: MENU_WIDTH }}
      role="menu"
    >
      {items.map((item, index) => {
        const showDivider = item.tone === 'danger' && items[index - 1]?.tone !== 'danger';

        return (
          <div key={item.label}>
            {showDivider ? <div className="my-1 border-t border-app-border" /> : null}
            <button
              type="button"
              role="menuitem"
              className={`block w-full px-3.5 py-2 text-left text-sm transition-colors ${
                item.tone === 'danger'
                  ? 'text-accent-soft hover:bg-accent/10'
                  : 'text-app-text hover:bg-app-chat-hover'
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
        className={`flex h-6 w-6 items-center justify-center rounded text-app-muted transition-colors hover:bg-app-chat-hover hover:text-app-text ${
          open ? 'bg-app-chat-hover text-app-text' : ''
        }`}
        onClick={() => setOpen((current) => !current)}
      >
        ⋮
      </button>
      {menu ? createPortal(menu, document.body) : null}
    </>
  );
}
