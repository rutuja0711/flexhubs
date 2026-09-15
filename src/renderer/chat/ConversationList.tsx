import { memo } from 'react';
import type { ConversationItem } from '../../shared/chat';
import { formatConversationTimestamp } from './format';
import { Avatar, PinIcon, PresenceDot } from './ChatIcons';

type ConversationRowProps = {
  conversation: ConversationItem;
  typingPreview?: string;
  selected: boolean;
  onSelect: (id: string) => void;
  onPrefetch?: (id: string) => void;
  onTogglePin?: (conversationId: string, isPinned: boolean) => void;
  pinBusy?: boolean;
};

export const ConversationRow = memo(function ConversationRow({
  conversation,
  typingPreview,
  selected,
  onSelect,
  onPrefetch,
  onTogglePin,
  pinBusy = false,
  index = 0,
}: ConversationRowProps & { index?: number }) {
  const displayTitle = conversation.isSelf ? `${conversation.title} (Yourself)` : conversation.title;

  return (
    <div
      className={`group relative flex w-full items-center gap-3 rounded-[16px] px-3 py-2.5 transition-all duration-200 animate-slide-in stagger-${(index % 5) + 1} opacity-0 ${
        selected
          ? 'bg-app-elevated border border-accent/25 shadow-sm'
          : 'border border-transparent hover:bg-app-chat-hover/70'
      }`}
      onMouseEnter={() => onPrefetch?.(conversation.id)}
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
        </div>

        <div className="min-w-0 flex-1">
          <span className={`block truncate text-sm tracking-tight ${selected ? 'font-semibold text-app-text' : 'font-medium text-app-text/90'}`}>
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

      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <div className="flex items-center gap-1">
          {conversation.isPinned ? (
            <button
              type="button"
              aria-label="Unpin chat"
              aria-pressed={true}
              disabled={pinBusy}
              className={`flex shrink-0 items-center justify-center p-0.5 transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                selected ? 'text-accent hover:text-accent-hover' : 'text-accent hover:text-accent-hover'
              }`}
              onClick={(event) => {
                event.stopPropagation();
                onTogglePin?.(conversation.id, conversation.isPinned);
              }}
            >
              <PinIcon size={13} />
            </button>
          ) : onTogglePin ? (
            <button
              type="button"
              aria-label="Pin chat"
              aria-pressed={false}
              disabled={pinBusy}
              className="hidden shrink-0 items-center justify-center p-0.5 text-app-muted transition-colors group-hover:flex hover:text-accent disabled:cursor-not-allowed disabled:opacity-50"
              onClick={(event) => {
                event.stopPropagation();
                onTogglePin(conversation.id, conversation.isPinned);
              }}
            >
              <PinIcon size={13} />
            </button>
          ) : null}
          {conversation.timestamp ? (
            <span
              className={`whitespace-nowrap text-[0.6875rem] font-medium text-app-muted ${
                conversation.isPinned ? '' : 'group-hover:hidden'
              }`}
            >
              {formatConversationTimestamp(conversation.timestamp)}
            </span>
          ) : null}
        </div>
        {conversation.unreadCount > 0 ? (
          <span className="rounded-full bg-accent px-1.5 py-0.5 text-[0.625rem] font-bold text-white shadow-sm shadow-accent/40">
            {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
          </span>
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
  onTogglePin?: (conversationId: string, isPinned: boolean) => void;
  pinningConversationId?: string | null;
  emptyMessage: string;
};

export function ConversationList({
  conversations,
  typingPreviews = {},
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
      {conversations.map((conversation, index) => (
        <ConversationRow
          key={conversation.id}
          index={index}
          conversation={conversation}
          typingPreview={typingPreviews[conversation.id]}
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
