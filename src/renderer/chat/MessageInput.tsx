import { useState } from 'react';
import { validateMessageDraft } from '../../shared/messages';

import type { MessageItem } from '../../shared/messages';

type MessageInputProps = {
  value: string;
  disabled: boolean;
  isSending: boolean;
  error: string;
  replyingToMessage?: MessageItem | null;
  onCancelReply?: () => void;
  onChange: (value: string) => void;
  onSend: () => void;
};

export function MessageInput({
  value,
  disabled,
  isSending,
  error,
  replyingToMessage,
  onCancelReply,
  onChange,
  onSend,
}: MessageInputProps) {
  const [draftError, setDraftError] = useState('');

  const handleChange = (nextValue: string) => {
    const validation = validateMessageDraft(nextValue);

    if (!validation.ok) {
      setDraftError(validation.error);
      return;
    }

    setDraftError('');
    onChange(nextValue);
  };

  const displayError = draftError || error;

  return (
    <div className="border-t border-app-border px-4 py-4">
      {displayError ? (
        <p className="mb-2 text-xs text-accent-soft" role="alert">
          {displayError}
        </p>
      ) : null}
      
      {replyingToMessage ? (
        <div className="mb-2 flex flex-col rounded-t-[8px] border-l-4 border-l-accent bg-app-surface-input px-3 py-2 text-sm text-app-muted">
          <div className="flex items-center justify-between mb-1">
            <span className="font-semibold text-accent-soft">Replying to {replyingToMessage.senderId}</span>
            {onCancelReply && (
              <button 
                type="button" 
                onClick={onCancelReply} 
                className="text-app-muted hover:text-app-text"
                aria-label="Cancel reply"
              >
                ✕
              </button>
            )}
          </div>
          <div className="truncate text-app-text">{replyingToMessage.content}</div>
        </div>
      ) : null}
      
      <div className={`flex items-end gap-3 rounded-[12px] border border-app-border bg-app-surface-input px-4 py-3 ${replyingToMessage ? 'rounded-t-none border-t-0' : ''}`}>
        <textarea
          value={value}
          rows={1}
          disabled={disabled || isSending}
          placeholder="Type a message"
          aria-invalid={Boolean(displayError)}
          className="max-h-32 min-h-[24px] flex-1 resize-none bg-transparent text-sm text-app-text outline-none placeholder:text-app-placeholder disabled:opacity-60"
          onChange={(event) => handleChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();

              if (!disabled && !isSending && value.trim()) {
                onSend();
              }
            }
          }}
        />
        <button
          type="button"
          disabled={disabled || isSending || !value.trim()}
          aria-label="Send message"
          className="rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
          onClick={onSend}
        >
          {isSending ? 'Sending...' : 'Send'}
        </button>
      </div>
    </div>
  );
}
