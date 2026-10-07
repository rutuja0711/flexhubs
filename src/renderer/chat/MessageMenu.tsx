import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  FiBookmark,
  FiCornerUpLeft,
  FiDownload,
  FiEdit2,
  FiMessageSquare,
  FiMoreHorizontal,
  FiShare2,
  FiTrash2,
} from 'react-icons/fi';
import { PinIcon } from './ChatIcons';
import type { ReactNode } from 'react';

type MessageMenuProps = {
  isOwn: boolean;
  isPinned: boolean;
  isSaved: boolean;
  isDeleted?: boolean;
  isSending?: boolean;
  hasDownloadableMedia?: boolean;
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
  onDownload?: () => void;
};

type MenuItem = {
  label: string;
  onClick: () => void;
  tone?: 'default' | 'danger';
  icon: ReactNode;
};

const MENU_WIDTH = 212;

export function MessageMenu({
  isOwn,
  isPinned,
  isSaved,
  isDeleted = false,
  isSending = false,
  hasDownloadableMedia = false,
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
  onDownload,
}: MessageMenuProps) {
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const run = (action: () => void) => {
    setOpen(false);
    action();
  };

  const iconClass = 'h-4 w-4 shrink-0 opacity-80';

  const items: MenuItem[] = isDeleted
    ? [
        {
          label: 'Delete for me',
          onClick: () => run(onDeleteForMe),
          tone: 'danger',
          icon: <FiTrash2 className={iconClass} aria-hidden />,
        },
      ]
    : isSending
      ? ([
          ...(hasDownloadableMedia && onDownload
            ? [
                {
                  label: 'Download',
                  onClick: () => run(onDownload),
                  icon: <FiDownload className={iconClass} aria-hidden />,
                },
              ]
            : []),
          {
            label: 'Delete for me',
            onClick: () => run(onDeleteForMe),
            tone: 'danger',
            icon: <FiTrash2 className={iconClass} aria-hidden />,
          },
          ...(isOwn
            ? [
                {
                  label: 'Delete for everyone',
                  onClick: () => run(onDeleteForEveryone),
                  tone: 'danger' as const,
                  icon: <FiTrash2 className={iconClass} aria-hidden />,
                },
              ]
            : []),
        ] as MenuItem[])
    : ([
        {
          label: 'Reply',
          onClick: () => run(onReply),
          icon: <FiCornerUpLeft className={iconClass} aria-hidden />,
        },
        ...(showReplyInThread
          ? [
              {
                label: 'Reply in thread',
                onClick: () => run(onReplyInThread),
                icon: <FiMessageSquare className={iconClass} aria-hidden />,
              },
            ]
          : []),
        ...(isOwn
          ? [
              {
                label: 'Edit',
                onClick: () => run(onEdit),
                icon: <FiEdit2 className={iconClass} aria-hidden />,
              },
            ]
          : []),
        {
          label: 'Forward',
          onClick: () => run(onForward),
          icon: <FiShare2 className={iconClass} aria-hidden />,
        },
        {
          label: isPinned ? 'Unpin' : 'Pin',
          onClick: () => run(onPinToggle),
          icon: <PinIcon size={14} className={iconClass} />,
        },
        ...(isSaved
          ? [
              {
                label: 'Unsave',
                onClick: () => run(onUnsave),
                icon: <FiBookmark className={`${iconClass} fill-current`} aria-hidden />,
              },
            ]
          : [
              {
                label: 'Save',
                onClick: () => run(onSave),
                icon: <FiBookmark className={iconClass} aria-hidden />,
              },
            ]),
        {
          label: 'Delete for me',
          onClick: () => run(onDeleteForMe),
          tone: 'danger',
          icon: <FiTrash2 className={iconClass} aria-hidden />,
        },
        ...(isOwn
          ? [
              {
                label: 'Delete for everyone',
                onClick: () => run(onDeleteForEveryone),
                tone: 'danger',
                icon: <FiTrash2 className={iconClass} aria-hidden />,
              },
            ]
          : []),
      ] as MenuItem[]);

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
      className="fixed z-[9999] overflow-hidden rounded-2xl border border-app-border bg-app-surface/98 dark:bg-app-elevated/95 backdrop-blur-xl p-1.5 shadow-2xl animate-pop-in"
      style={{ top: menuPosition.top, left: menuPosition.left, width: MENU_WIDTH }}
      role="menu"
    >
      {items.map((item, index) => {
        const showDivider = item.tone === 'danger' && items[index - 1]?.tone !== 'danger';

        return (
          <div key={item.label}>
            {showDivider ? <div className="my-1 h-px bg-app-border" /> : null}
            <button
              type="button"
              role="menuitem"
              className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-medium transition-colors duration-150 ${
                item.tone === 'danger'
                  ? 'text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-700 dark:hover:text-rose-300'
                  : 'text-app-text hover:bg-black/[0.05] dark:hover:bg-white/[0.08] hover:text-accent dark:hover:text-accent-soft'
              }`}
              onClick={item.onClick}
            >
              {item.icon}
              <span className="min-w-0 flex-1">{item.label}</span>
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
