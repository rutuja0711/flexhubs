import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { ConversationItem } from '../../shared/chat';
import { FiBell, FiBellOff, FiMail, FiMapPin, FiSlash, FiTrash2 } from 'react-icons/fi';

export type ConversationContextMenuActions = {
  onMarkUnread: (conversation: ConversationItem) => void;
  onTogglePin: (conversation: ConversationItem) => void;
  onToggleMute: (conversation: ConversationItem) => void;
  onClearHistory: (conversation: ConversationItem) => void;
  onBlockUser: (conversation: ConversationItem) => void;
  onUnblockUser: (conversation: ConversationItem) => void;
};

type ConversationContextMenuProps = {
  conversation: ConversationItem;
  position: { top: number; left: number };
  busy?: boolean;
  onClose: () => void;
} & ConversationContextMenuActions;

function MenuItem({
  icon,
  label,
  danger = false,
  disabled = false,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        danger
          ? 'text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/35'
          : 'text-app-text hover:bg-black/[0.05] dark:hover:bg-white/[0.08]'
      }`}
      onClick={onClick}
    >
      <span className={`flex h-5 w-5 shrink-0 items-center justify-center ${danger ? '' : 'text-app-muted'}`}>
        {icon}
      </span>
      <span>{label}</span>
    </button>
  );
}

export function ConversationContextMenu({
  conversation,
  position,
  busy = false,
  onClose,
  onMarkUnread,
  onTogglePin,
  onToggleMute,
  onClearHistory,
  onBlockUser,
  onUnblockUser,
  isPeerBlocked = false,
}: ConversationContextMenuProps & { isPeerBlocked?: boolean }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const muted = conversation.notificationsSnoozed === true;
  const canManageBlock =
    conversation.kind === 'direct' &&
    !conversation.isSelf &&
    Boolean(conversation.peerUserId);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  useEffect(() => {
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
      top = window.innerHeight - rect.height - padding;
    }

    if (top < padding) {
      top = padding;
    }

    if (left < padding) {
      left = padding;
    }

    panel.style.top = `${top}px`;
    panel.style.left = `${left}px`;
  }, [position.left, position.top]);

  const content = (
    <div
      ref={panelRef}
      className="fixed z-[200] w-[min(280px,calc(100vw-24px))] rounded-2xl border border-app-border bg-app-surface/98 p-1.5 shadow-2xl shadow-black/25 backdrop-blur-xl dark:bg-app-elevated/98 animate-pop-in origin-top-left"
      style={{ top: position.top, left: position.left }}
      role="menu"
      aria-label="Chat options"
    >
      <MenuItem
        icon={<FiMail className="h-[17px] w-[17px]" strokeWidth={1.75} />}
        label="Mark as unread"
        disabled={busy}
        onClick={() => {
          onClose();
          onMarkUnread(conversation);
        }}
      />
      <MenuItem
        icon={<FiMapPin className="h-[17px] w-[17px]" strokeWidth={1.75} />}
        label={conversation.isPinned ? 'Unpin chat' : 'Pin chat'}
        disabled={busy}
        onClick={() => {
          onClose();
          onTogglePin(conversation);
        }}
      />
      <MenuItem
        icon={
          muted ? (
            <FiBell className="h-[17px] w-[17px]" strokeWidth={1.75} />
          ) : (
            <FiBellOff className="h-[17px] w-[17px]" strokeWidth={1.75} />
          )
        }
        label={muted ? 'Unmute notifications' : 'Mute notifications'}
        disabled={busy}
        onClick={() => {
          onClose();
          onToggleMute(conversation);
        }}
      />
      <MenuItem
        icon={<FiTrash2 className="h-[17px] w-[17px]" strokeWidth={1.75} />}
        label="Clear chat history"
        danger
        disabled={busy}
        onClick={() => {
          onClose();
          onClearHistory(conversation);
        }}
      />
      {canManageBlock ? (
        isPeerBlocked ? (
          <MenuItem
            icon={<FiSlash className="h-[17px] w-[17px]" strokeWidth={1.75} />}
            label="Unblock user"
            disabled={busy}
            onClick={() => {
              onClose();
              onUnblockUser(conversation);
            }}
          />
        ) : (
          <MenuItem
            icon={<FiSlash className="h-[17px] w-[17px]" strokeWidth={1.75} />}
            label="Block user"
            danger
            disabled={busy}
            onClick={() => {
              onClose();
              onBlockUser(conversation);
            }}
          />
        )
      ) : null}
    </div>
  );

  return createPortal(content, document.body);
}
