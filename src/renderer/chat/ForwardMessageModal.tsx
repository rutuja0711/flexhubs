import type { ConversationItem } from '../../shared/chat';

type ForwardMessageModalProps = {
  open: boolean;
  conversations: ConversationItem[];
  currentConversationId: string;
  loading?: boolean;
  error?: string;
  onClose: () => void;
  onForward: (targetConversationId: string) => void;
};

export function ForwardMessageModal({
  open,
  conversations,
  currentConversationId,
  loading = false,
  error = '',
  onClose,
  onForward,
}: ForwardMessageModalProps) {
  if (!open) {
    return null;
  }

  const targets = conversations.filter(
    (conversation) =>
      conversation.id !== currentConversationId &&
      conversation.title.toLowerCase() !== 'saved messages',
  );

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/55 p-4 backdrop-blur-[1px]">
      <div
        className="flex max-h-[70vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-app-border bg-app-surface shadow-2xl"
        role="dialog"
        aria-labelledby="forward-title"
      >
        <div className="border-b border-app-border px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 id="forward-title" className="text-base font-semibold text-app-text">
                Forward message
              </h3>
              <p className="mt-1 text-sm text-app-muted">Choose a conversation</p>
            </div>
            <button
              type="button"
              className="rounded-lg px-2 py-1 text-sm text-app-muted transition-colors hover:bg-app-chat-hover hover:text-app-text"
              onClick={onClose}
            >
              ✕
            </button>
          </div>
        </div>

        {error ? (
          <p className="border-b border-app-border px-5 py-3 text-sm text-accent-soft" role="alert">
            {error}
          </p>
        ) : null}

        <div className="overflow-y-auto p-2">
          {targets.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-app-muted">No other conversations available.</p>
          ) : (
            targets.map((conversation) => (
              <button
                key={conversation.id}
                type="button"
                disabled={loading}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-app-chat-hover disabled:opacity-60"
                onClick={() => onForward(conversation.id)}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-app-chat-hover text-xs font-semibold text-app-text">
                  {conversation.avatarInitials}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-app-text">
                    {conversation.title}
                  </span>
                  {conversation.subtitle ? (
                    <span className="block truncate text-xs text-app-muted">
                      {conversation.subtitle}
                    </span>
                  ) : null}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
