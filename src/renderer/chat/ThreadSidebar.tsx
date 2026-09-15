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
    <div className="relative z-40 flex w-[340px] shrink-0 flex-col border-l border-app-border/70 bg-app-surface/95 backdrop-blur-xl shadow-2xl">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-app-border/50 px-5">
        <div>
          <h2 className="text-sm font-semibold text-app-text tracking-tight">Thread Replies</h2>
          <p className="text-[11px] text-app-muted">{messages.length} {messages.length === 1 ? 'reply' : 'replies'}</p>
        </div>
        <button
          type="button"
          aria-label="Close thread panel"
          className="flex h-8 w-8 items-center justify-center rounded-xl text-app-muted transition-colors hover:bg-app-inset hover:text-app-text"
          onClick={onClose}
        >
          <FiX className="text-base" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {/* Root message card */}
        <div className="rounded-2xl border border-app-border/70 bg-app-card/70 p-3.5 shadow-sm">
          <div className="flex items-center gap-2.5 mb-2">
            <Avatar imageUrl={null} initials={rootMessage.senderInitials} size="sm" />
            <div>
              <p className="text-xs font-semibold text-app-text">{rootMessage.senderName}</p>
              <p className="text-[10px] text-app-muted">{formatConversationTimestamp(rootMessage.createdAt)}</p>
            </div>
          </div>
          <div className="text-sm text-app-text leading-relaxed">
            <MessageContent message={rootMessage} currentUserId={currentUserId} />
          </div>
        </div>

        <div className="flex items-center gap-3 py-1" role="separator">
          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.08em] text-app-muted">
            {messages.length} {messages.length === 1 ? 'REPLY' : 'REPLIES'}
          </span>
          <div className="h-px flex-1 bg-app-border/60" />
        </div>

        {loading && <p className="text-xs text-app-muted py-2 text-center">Loading replies...</p>}
        {error && <p className="text-xs text-accent-soft py-2 text-center">{error}</p>}

        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-2.5 ${msg.isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
            {!msg.isOwn ? (
              <Avatar imageUrl={null} initials={msg.senderInitials} size="sm" />
            ) : null}
            <div className={`flex min-w-0 flex-col max-w-[85%] ${msg.isOwn ? 'items-end' : 'items-start'}`}>
              {!msg.isOwn ? (
                <p className="mb-1 text-[11px] font-medium text-app-muted">{msg.senderName}</p>
              ) : null}
              <div className={`inline-block w-fit max-w-full rounded-2xl px-3 py-2 text-sm leading-relaxed shadow-sm ${
                msg.isOwn
                  ? 'bg-gradient-to-r from-accent to-[#632a38] text-white'
                  : 'border border-app-border/70 bg-app-card/85 text-app-text'
              }`}>
                <MessageContent message={msg} currentUserId={currentUserId} />
                <div className="mt-1 flex justify-end">
                  <span className={`text-[10px] ${msg.isOwn ? 'text-white/70' : 'text-app-muted'}`}>
                    {formatConversationTimestamp(msg.createdAt)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="p-3.5 border-t border-app-border/50 bg-app-surface/60 backdrop-blur-md">
        <div className="mb-2 px-1 text-[11px] text-app-muted flex items-center gap-1.5">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent" />
          <span>Replying to <span className="text-app-text font-medium">{rootMessage.senderName}</span></span>
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
