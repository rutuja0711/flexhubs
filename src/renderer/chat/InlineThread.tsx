import { useState, useEffect } from 'react';
import type { MessageItem } from '../../shared/messages';
import { loadMessageThread } from '../chatApi';
import { MessageInput } from './MessageInput';
import { formatConversationTimestamp } from './format';

type InlineThreadProps = {
  conversationId: string;
  rootMessageId: string;
  onSendThreadMessage: (content: string, threadRootId: string) => Promise<string | null>;
};

export function InlineThread({ conversationId, rootMessageId, onSendThreadMessage }: InlineThreadProps) {
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [draftError, setDraftError] = useState('');

  useEffect(() => {
    let mounted = true;

    async function fetchThread() {
      setLoading(true);
      setError('');

      const response = await loadMessageThread(conversationId, rootMessageId);

      if (!mounted) return;
      setLoading(false);

      if (!response.ok) {
        setError(response.error);
        return;
      }

      setMessages(response.data);
    }

    void fetchThread();

    return () => {
      mounted = false;
    };
  }, [conversationId, rootMessageId]);

  const handleSend = async () => {
    if (!draft.trim() || isSending) return;

    setIsSending(true);
    setDraftError('');

    const err = await onSendThreadMessage(draft.trim(), rootMessageId);

    if (err) {
      setDraftError(err);
      setIsSending(false);
      return;
    }

    setDraft('');
    setIsSending(false);

    // Refresh thread
    const response = await loadMessageThread(conversationId, rootMessageId);
    if (response.ok) {
      setMessages(response.data);
    }
  };

  return (
    <div className="mt-2 ml-10 border-l-2 border-app-border pl-4 max-w-lg w-full">
      <h4 className="text-xs font-semibold text-app-muted mb-2">{messages.length} Replies</h4>
      
      {loading && <p className="text-xs text-app-muted py-2">Loading replies...</p>}
      {error && <p className="text-xs text-accent-soft py-2">{error}</p>}
      
      <div className="flex flex-col gap-3 mb-3">
        {messages.map((msg) => (
          <div key={msg.id} className="flex gap-2">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/10 text-[10px] font-bold text-accent-soft">
              {msg.senderInitials}
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-app-text">{msg.senderName}</span>
                <span className="text-[10px] text-app-muted">{formatConversationTimestamp(msg.createdAt)}</span>
              </div>
              <p className="text-sm text-app-text whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="relative border border-app-border rounded-xl bg-app-surface-input overflow-hidden">
        <MessageInput
          value={draft}
          disabled={loading}
          isSending={isSending}
          error={draftError}
          onChange={setDraft}
          onSend={handleSend}
        />
      </div>
    </div>
  );
}
