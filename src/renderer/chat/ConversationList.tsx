import type { ConversationItem } from '../../shared/chat';
import { formatConversationTimestamp } from './format';
import { Avatar, PinIcon, PresenceDot } from './ChatIcons';

type ConversationRowProps = {
  conversation: ConversationItem;
  selected: boolean;
  onSelect: (id: string) => void;
};

export function ConversationRow({ conversation, selected, onSelect }: ConversationRowProps) {
  const displayTitle = conversation.isSelf ? `${conversation.title} (Yourself)` : conversation.title;

  return (
    <button
      type="button"
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
        selected
          ? 'border border-accent bg-app-chat-active'
          : 'border border-transparent hover:bg-app-chat-hover'
      }`}
      onClick={() => onSelect(conversation.id)}
    >
      <div className="relative shrink-0">
        <Avatar imageUrl={conversation.avatarUrl} initials={conversation.avatarInitials} />
        <PresenceDot status={conversation.status} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-[0.9375rem] font-medium text-app-text">{displayTitle}</span>
          {conversation.isPinned ? (
            <span className="text-accent-soft" aria-label="Pinned">
              <PinIcon />
            </span>
          ) : null}
        </div>
        {conversation.subtitle ? (
          <p className="truncate text-sm text-app-muted">{conversation.subtitle}</p>
        ) : null}
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1">
        {conversation.timestamp ? (
          <span className="text-xs text-app-muted">
            {formatConversationTimestamp(conversation.timestamp)}
          </span>
        ) : null}
        {conversation.unreadCount > 0 ? (
          <span className="rounded-full bg-accent px-2 py-0.5 text-[0.6875rem] font-semibold text-white">
            {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
          </span>
        ) : null}
      </div>
    </button>
  );
}

type ConversationListProps = {
  conversations: ConversationItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  emptyMessage: string;
};

export function ConversationList({
  conversations,
  selectedId,
  onSelect,
  emptyMessage,
}: ConversationListProps) {
  if (conversations.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-sm text-muted" role="status">
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
        />
      ))}
    </div>
  );
}
