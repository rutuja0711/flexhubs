import { memo, useCallback, useRef, useState } from 'react';
import { FiMoreHorizontal } from 'react-icons/fi';
import type { ConversationItem } from '../../shared/chat';
import { formatConversationTimestamp } from './format';
import { Avatar, PinIcon, PresenceDot } from './ChatIcons';
import {
  ConversationContextMenu,
  type ConversationContextMenuActions,
} from './ConversationContextMenu';

type ConversationRowProps = {
  conversation: ConversationItem;
  typingPreview?: string;
  selected: boolean;
  onSelect: (id: string) => void;
  onPrefetch?: (id: string) => void;
  menuOpen?: boolean;
  onOpenMenu?: (position: { top: number; left: number }) => void;
  onCloseMenu?: () => void;
  menuBusy?: boolean;
};

export const ConversationRow = memo(function ConversationRow({
  conversation,
  typingPreview,
  selected,
  onSelect,
  onPrefetch,
  menuOpen = false,
  onOpenMenu,
  onCloseMenu,
  menuBusy = false,
  index = 0,
}: ConversationRowProps & { index?: number }) {
  const displayTitle = conversation.isSelf ? `${conversation.title} (Yourself)` : conversation.title;
  const rowRef = useRef<HTMLDivElement>(null);

  const openContextMenu = useCallback(
    (clientX: number, clientY: number) => {
      if (!onOpenMenu) {
        return;
      }

      const rect = rowRef.current?.getBoundingClientRect();
      onOpenMenu({
        top: rect ? rect.top + 6 : clientY,
        left: rect ? rect.left + 52 : clientX,
      });
    },
    [onOpenMenu],
  );

  return (
    <div
      ref={rowRef}
      className={`group relative flex w-full items-center gap-3 rounded-[16px] px-3 py-2.5 transition-all duration-200 animate-slide-in stagger-${(index % 5) + 1} opacity-0 ${
        selected
          ? 'bg-app-elevated border border-accent/25 shadow-sm'
          : 'border border-transparent hover:bg-app-chat-hover/70'
      }`}
      onMouseEnter={() => onPrefetch?.(conversation.id)}
      onContextMenu={(event) => {
        if (!onOpenMenu) {
          return;
        }

        event.preventDefault();
        openContextMenu(event.clientX, event.clientY);
      }}
    >
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-3 text-left focus:outline-none"
        onClick={() => onSelect(conversation.id)}
        onFocus={() => onPrefetch?.(conversation.id)}
      >
        <div className="relative shrink-0">
          <Avatar imageUrl={conversation.avatarUrl} initials={conversation.avatarInitials} />
          <PresenceDot status={conversation.status} />
          {conversation.unreadCount > 0 ? (
            <span
              className={`absolute -right-1 -top-1 z-10 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent px-1 text-[0.625rem] font-bold leading-none text-white shadow-sm shadow-accent/40 ring-2 ${
                selected ? 'ring-app-elevated' : 'ring-app-chat-sidebar'
              }`}
            >
              {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
            </span>
          ) : null}
        </div>

        <div className="min-w-0 flex-1">
          <span
            className={`block truncate text-sm tracking-tight ${
              selected || conversation.unreadCount > 0
                ? 'font-semibold text-app-text'
                : 'font-medium text-app-text/90'
            }`}
          >
            {displayTitle}
          </span>
          {typingPreview ? (
            <p className="flex min-w-0 items-center gap-1.5 truncate text-xs text-accent-soft mt-0.5">
              <span className="inline-flex shrink-0 items-end gap-0.5" aria-hidden="true">
                <span className="h-1 w-1 animate-bounce rounded-full bg-accent [animation-delay:-0.2s]" />
                <span className="h-1 w-1 animate-bounce rounded-full bg-accent [animation-delay:-0.1s]" />
                <span className="h-1 w-1 animate-bounce rounded-full bg-accent" />
              </span>
              <span className="truncate italic">{typingPreview}</span>
            </p>
          ) : conversation.isDraftPreview && conversation.draftPreview ? (
            <p className="truncate text-xs mt-0.5">
              <span className="text-accent-soft font-medium">Draft: </span>
              <span className="text-app-muted">{conversation.draftPreview}</span>
            </p>
          ) : conversation.subtitle ? (
            <p className="truncate text-xs text-app-muted mt-0.5">{conversation.subtitle}</p>
          ) : null}
        </div>
      </button>

      <div className="flex h-8 shrink-0 items-center justify-end gap-0.5 pl-1">
        {conversation.timestamp ? (
          <span
            className={`whitespace-nowrap text-[0.6875rem] font-medium text-app-muted ${
              onOpenMenu ? 'group-hover:hidden' : ''
            } ${menuOpen && onOpenMenu ? 'hidden' : ''}`}
          >
            {formatConversationTimestamp(conversation.timestamp)}
          </span>
        ) : null}
        {conversation.isPinned ? (
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center text-accent"
            aria-label="Pinned chat"
            title="Pinned chat"
          >
            <PinIcon size={13} />
          </span>
        ) : null}
        {onOpenMenu ? (
          <button
            type="button"
            aria-label="Chat options"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-app-muted transition-colors hover:bg-black/[0.06] hover:text-app-text dark:hover:bg-white/10 ${
              menuOpen ? '' : 'hidden group-hover:flex'
            }`}
            onClick={(event) => {
              event.stopPropagation();
              if (menuOpen) {
                onCloseMenu?.();
                return;
              }

              openContextMenu(event.clientX, event.clientY);
            }}
          >
            <FiMoreHorizontal className="h-[18px] w-[18px]" strokeWidth={1.75} />
          </button>
        ) : null}
      </div>

    </div>
  );
});

type ConversationListProps = {
  conversations: ConversationItem[];
  typingPreviews?: Record<string, string>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onPrefetch?: (id: string) => void;
  emptyMessage: string;
  menuActions?: ConversationContextMenuActions;
  menuBusy?: boolean;
  blockedUserIds?: ReadonlySet<string>;
  onPrepareContextMenu?: () => void;
};

export function ConversationList({
  conversations,
  typingPreviews = {},
  selectedId,
  onSelect,
  onPrefetch,
  emptyMessage,
  menuActions,
  menuBusy = false,
  blockedUserIds,
  onPrepareContextMenu,
}: ConversationListProps) {
  const [contextMenuConversationId, setContextMenuConversationId] = useState<string | null>(null);
  const [contextMenuPosition, setContextMenuPosition] = useState({ top: 0, left: 0 });

  const contextMenuConversation = conversations.find((item) => item.id === contextMenuConversationId) ?? null;

  const closeContextMenu = useCallback(() => {
    setContextMenuConversationId(null);
  }, []);

  const openContextMenuForConversation = useCallback(
    (conversationId: string, position: { top: number; left: number }) => {
      onPrepareContextMenu?.();
      setContextMenuConversationId(conversationId);
      setContextMenuPosition(position);
    },
    [onPrepareContextMenu],
  );

  if (conversations.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-sm text-app-muted" role="status">
        {emptyMessage}
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-0.5 px-2 pb-4">
        {conversations.map((conversation, index) => (
          <ConversationRow
            key={conversation.id}
            index={index}
            conversation={conversation}
            typingPreview={typingPreviews[conversation.id]}
            selected={selectedId === conversation.id}
            onSelect={onSelect}
            onPrefetch={onPrefetch}
            menuOpen={contextMenuConversationId === conversation.id}
            menuBusy={menuBusy}
            onCloseMenu={closeContextMenu}
            onOpenMenu={
              menuActions
                ? (position) => {
                    openContextMenuForConversation(conversation.id, position);
                  }
                : undefined
            }
          />
        ))}
      </div>

      {contextMenuConversation && menuActions ? (
        <ConversationContextMenu
          conversation={contextMenuConversation}
          position={contextMenuPosition}
          busy={menuBusy}
          isPeerBlocked={
            contextMenuConversation.peerUserId
              ? blockedUserIds?.has(contextMenuConversation.peerUserId) === true
              : false
          }
          onClose={closeContextMenu}
          {...menuActions}
        />
      ) : null}
    </>
  );
}
