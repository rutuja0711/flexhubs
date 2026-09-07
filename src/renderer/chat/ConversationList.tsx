import { memo } from 'react';
import type { ConversationItem } from '../../shared/chat';
import { formatConversationTimestamp } from './format';
import { Avatar, PinIcon, PresenceDot } from './ChatIcons';

type ConversationRowProps = {
  conversation: ConversationItem;
  selected: boolean;
  onSelect: (id: string) => void;
  onPrefetch?: (id: string) => void;
  onTogglePin?: (conversationId: string, isPinned: boolean) => void;
  pinBusy?: boolean;
};

export const ConversationRow = memo(function ConversationRow({
  conversation,
  selected,
  onSelect,
  onPrefetch,
  onTogglePin,
  pinBusy = false,
}: ConversationRowProps) {
  const displayTitle = conversation.isSelf ? `${conversation.title} (Yourself)` : conversation.title;

  return (
    <div
      className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 transition-[background-color] duration-150 hover:bg-app-chat-hover"
      onMouseEnter={() => onPrefetch?.(conversation.id)}
    >
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
        onClick={() => onSelect(conversation.id)}
        onFocus={() => onPrefetch?.(conversation.id)}
      >
        <div className="relative shrink-0">
          <Avatar imageUrl={conversation.avatarUrl} initials={conversation.avatarInitials} />
          <PresenceDot status={conversation.status} />
        </div>

        <div className="min-w-0 flex-1">
          <span className="block truncate text-[0.9375rem] font-medium text-app-text">{displayTitle}</span>
          {conversation.isDraftPreview && conversation.draftPreview ? (
            <p className="truncate text-sm">
              <span className="text-accent-soft">Draft: </span>
              <span className="text-app-muted">{conversation.draftPreview}</span>
            </p>
          ) : conversation.subtitle ? (
            <p className="truncate text-sm text-app-muted">{conversation.subtitle}</p>
          ) : null}
        </div>
      </button>

      <div className="flex shrink-0 flex-col items-end gap-1">
        <div className="flex items-center gap-1">
          {conversation.isPinned ? (
            <button
              type="button"
              aria-label="Unpin chat"
              aria-pressed={true}
              disabled={pinBusy}
              className={`flex shrink-0 items-center justify-center transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                selected ? 'text-app-muted hover:text-app-text' : 'text-accent hover:text-accent-hover'
              }`}
              onClick={(event) => {
                event.stopPropagation();
                onTogglePin?.(conversation.id, conversation.isPinned);
              }}
            >
              <PinIcon />
            </button>
          ) : onTogglePin ? (
            <button
              type="button"
              aria-label="Pin chat"
              aria-pressed={false}
              disabled={pinBusy}
              className="hidden shrink-0 items-center justify-center text-app-muted transition-colors group-hover:flex hover:text-accent disabled:cursor-not-allowed disabled:opacity-50"
              onClick={(event) => {
                event.stopPropagation();
                onTogglePin(conversation.id, conversation.isPinned);
              }}
            >
              <PinIcon />
            </button>
          ) : null}
          {conversation.timestamp ? (
            <span
              className={`whitespace-nowrap text-xs text-app-muted ${
                conversation.isPinned ? '' : 'group-hover:hidden'
              }`}
            >
              {formatConversationTimestamp(conversation.timestamp)}
            </span>
          ) : null}
        </div>
        {conversation.unreadCount > 0 ? (
          <span className="rounded-full bg-accent px-2 py-0.5 text-[0.6875rem] font-semibold text-white">
            {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
          </span>
        ) : null}
      </div>
    </div>
  );
});

type ConversationListProps = {
  conversations: ConversationItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onPrefetch?: (id: string) => void;
  onTogglePin?: (conversationId: string, isPinned: boolean) => void;
  pinningConversationId?: string | null;
  emptyMessage: string;
};

export function ConversationList({
  conversations,
  selectedId,
  onSelect,
  onPrefetch,
  onTogglePin,
  pinningConversationId = null,
  emptyMessage,
}: ConversationListProps) {
  if (conversations.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-sm text-app-muted" role="status">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5 px-2 pb-4">
      {conversations.map((conversation) => (
        <ConversationRow
          key={conversation.id}
          conversation={conversation}
          selected={selectedId === conversation.id}
          onSelect={onSelect}
          onPrefetch={onPrefetch}
          onTogglePin={onTogglePin}
          pinBusy={pinningConversationId === conversation.id}
        />
      ))}
    </div>
  );
}
