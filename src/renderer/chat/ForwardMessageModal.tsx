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
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/60 p-4 backdrop-blur-md animate-fade-in">
      <div
        className="relative flex max-h-[70vh] w-full max-w-md flex-col overflow-hidden rounded-3xl border border-app-border/80 bg-app-surface/95 backdrop-blur-2xl shadow-2xl animate-pop-in origin-center"
        role="dialog"
        aria-labelledby="forward-title"
      >
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />

        <div className="border-b border-app-border/50 px-6 py-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 id="forward-title" className="text-base font-semibold text-app-text tracking-tight">
                Forward message
              </h3>
              <p className="mt-0.5 text-xs text-app-muted">Choose a conversation to forward to</p>
            </div>
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-xl text-app-muted transition-colors hover:bg-app-inset hover:text-app-text"
              onClick={onClose}
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>

        {error ? (
          <p className="border-b border-app-border/50 px-6 py-3 text-xs text-accent-soft font-medium" role="alert">
            {error}
          </p>
        ) : null}

        <div className="overflow-y-auto p-3 space-y-1">
          {targets.length === 0 ? (
            <p className="px-4 py-8 text-center text-xs text-app-muted">No other conversations available.</p>
          ) : (
            targets.map((conversation) => (
              <button
                key={conversation.id}
                type="button"
                disabled={loading}
                className="flex w-full items-center gap-3 rounded-2xl p-3 text-left transition-all duration-150 border border-transparent hover:border-app-border/60 hover:bg-app-card/60 hover:shadow-xs disabled:opacity-60 group"
                onClick={() => onForward(conversation.id)}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-accent/20 to-accent/5 border border-accent/20 text-xs font-bold text-accent-soft group-hover:scale-105 transition-transform">
                  {conversation.avatarInitials}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-app-text tracking-tight group-hover:text-accent-soft transition-colors">
                    {conversation.title}
                  </span>
                  {conversation.subtitle ? (
                    <span className="block truncate text-xs text-app-muted mt-0.5">
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
