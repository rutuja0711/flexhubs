import { useEffect, useState } from 'react';
import { FiX } from 'react-icons/fi';
import type { MessageItem } from '../../shared/messages';
import { registerThreadReplyMessages } from '../../shared/messages';
import { loadMessageThread } from '../chatApi';
import {
  appendThreadReply,
  getThreadReplies,
  mergeThreadReplies,
  subscribeThreadReplies,
} from '../threadRepliesStore';
import { MessageContent } from './MessageContent';
import { MessageInput } from './MessageInput';
import { formatConversationTimestamp } from './format';
import { Avatar } from './ChatIcons';

type ThreadSidebarProps = {
  conversationId: string;
  rootMessage: MessageItem;
  currentUserId: string | null;
  onClose: () => void;
  onSendThreadMessage: (
    content: string,
    threadRootId: string,
  ) => Promise<{ ok: true; message: MessageItem } | { ok: false; error: string }>;
  onSendMedia?: (item: any, kind: 'gif' | 'sticker', replyToId?: string, threadRootId?: string) => void;
  onSendFile?: (file: File, caption?: string, replyToId?: string, threadRootId?: string) => void;
  onUnauthorized?: (status?: number) => boolean;
  onOpenFlexAi?: () => void;
  onThreadReplySent?: (threadRootId: string) => void;
  onThreadMessagesRegistered?: () => void;
};

export function ThreadSidebar({
  conversationId,
  rootMessage,
  currentUserId,
  onClose,
  onSendThreadMessage,
  onSendMedia,
  onSendFile,
  onUnauthorized,
  onOpenFlexAi,
  onThreadReplySent,
  onThreadMessagesRegistered,
}: ThreadSidebarProps) {
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [draftError, setDraftError] = useState('');

  const applyThreadMessages = (fetched: MessageItem[]) => {
    registerThreadReplyMessages(fetched, rootMessage.id);
    const merged = mergeThreadReplies(conversationId, rootMessage.id, fetched);
    setMessages(merged);
    onThreadMessagesRegistered?.();
  };

  const refreshThread = async () => {
    const response = await loadMessageThread(conversationId, rootMessage.id);

    if (!response.ok) {
      setError(response.error);
      return false;
    }

    applyThreadMessages(response.data);
    return true;
  };

  useEffect(() => {
    let mounted = true;
    const cached = getThreadReplies(conversationId, rootMessage.id);

    if (cached.length > 0) {
      setMessages(cached);
      setLoading(false);
    }

    async function fetchThread() {
      setLoading(true);
      setError('');

      const response = await loadMessageThread(conversationId, rootMessage.id);

      if (!mounted) return;
      setLoading(false);

      if (!response.ok) {
        setError(response.error);
        return;
      }

      applyThreadMessages(response.data);
    }

    void fetchThread();

    const unsubscribe = subscribeThreadReplies((key) => {
      if (key !== `${conversationId}:${rootMessage.id}` || !mounted) {
        return;
      }

      setMessages(getThreadReplies(conversationId, rootMessage.id));
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [conversationId, rootMessage.id]);

  const handleSend = async () => {
    if (!draft.trim() || isSending) return;

    setIsSending(true);
    setDraftError('');

    const result = await onSendThreadMessage(draft.trim(), rootMessage.id);

    if (!result.ok) {
      setDraftError(result.error);
      setIsSending(false);
      return;
    }

    setDraft('');
    setIsSending(false);
    onThreadReplySent?.(rootMessage.id);
    setMessages(appendThreadReply(conversationId, rootMessage.id, result.message));
    window.setTimeout(() => {
      void refreshThread();
    }, 400);
  };

  const scheduleThreadRefresh = () => {
    onThreadReplySent?.(rootMessage.id);
    window.setTimeout(() => {
      void refreshThread();
    }, 500);
  };

  return (
    <div className="relative z-40 flex w-80 shrink-0 flex-col border-l border-app-border bg-app-surface-input shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.1)]">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-app-border px-4">
        <div>
          <h2 className="text-base font-semibold text-app-text">Thread</h2>
          <p className="text-xs text-app-muted">{messages.length} {messages.length === 1 ? 'reply' : 'replies'}</p>
        </div>
        <button
          type="button"
          aria-label="Close thread panel"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-app-muted transition-colors hover:bg-app-chat-hover hover:text-app-text"
          onClick={onClose}
        >
          <FiX className="text-lg" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {/* Root message */}
        <div className="flex gap-3">
          {!rootMessage.isOwn ? (
            <Avatar imageUrl={null} initials={rootMessage.senderInitials} size="sm" />
          ) : null}
          <div className="flex min-w-0 flex-col items-start max-w-full">
            <p className="mb-1 text-xs font-medium text-app-muted">{rootMessage.senderName}</p>
            <div className="inline-block w-fit max-w-full rounded-2xl bg-app-message-out text-app-message-out-text px-2.5 py-1.5 text-sm leading-snug">
              <MessageContent message={rootMessage} currentUserId={currentUserId} />
              <div className="mt-1 flex justify-end">
                <span className="text-[10px] text-app-message-out-text/75">{formatConversationTimestamp(rootMessage.createdAt)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 py-1" role="separator">
          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.08em] text-app-muted">
            {messages.length} {messages.length === 1 ? 'REPLY' : 'REPLIES'}
          </span>
          <div className="h-px flex-1 bg-app-border" />
        </div>

        {loading && <p className="text-xs text-app-muted py-2 text-center">Loading replies...</p>}
        {error && <p className="text-xs text-accent-soft py-2 text-center">{error}</p>}

        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-3 ${msg.isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
            {!msg.isOwn ? (
              <Avatar imageUrl={null} initials={msg.senderInitials} size="sm" />
            ) : null}
            <div className={`flex min-w-0 flex-col max-w-full ${msg.isOwn ? 'items-end' : 'items-start'}`}>
              {!msg.isOwn ? (
                <p className="mb-1 text-xs font-medium text-app-muted">{msg.senderName}</p>
              ) : null}
              <div className={`inline-block w-fit max-w-full rounded-2xl px-2.5 py-1.5 text-sm leading-snug ${
                msg.isOwn
                  ? 'bg-app-message-out text-app-message-out-text'
                  : 'bg-app-message-in text-app-text'
              }`}>
                <MessageContent message={msg} currentUserId={currentUserId} />
                <div className="mt-1 flex justify-end">
                  <span className={`text-[10px] ${msg.isOwn ? 'text-app-message-out-text/75' : 'text-app-muted'}`}>
                    {formatConversationTimestamp(msg.createdAt)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 border-t border-app-border bg-app-surface-input">
        <div className="mb-2 text-xs text-app-muted">
          Replying to {rootMessage.senderName}
        </div>
        <MessageInput
          compact
          value={draft}
          disabled={loading}
          isSending={isSending}
          error={draftError}
          onChange={setDraft}
          onSend={handleSend}
          conversationId={conversationId}
          onSendMedia={
            onSendMedia
              ? (item, kind) => {
                  onSendMedia(item, kind, undefined, rootMessage.id);
                  scheduleThreadRefresh();
                }
              : undefined
          }
          onSendFile={
            onSendFile
              ? (file, caption) => {
                  onSendFile(file, caption, undefined, rootMessage.id);
                  scheduleThreadRefresh();
                }
              : undefined
          }
          onUnauthorized={onUnauthorized}
          onOpenFlexAi={onOpenFlexAi}
        />
      </div>
    </div>
  );
}
