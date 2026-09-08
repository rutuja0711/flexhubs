import type { ReactNode } from 'react';
import type { MessageItem } from '../../shared/messages';
import { DELETED_MESSAGE_TEXT, isCallLogMessage, isDeletedMessage, isPollMessage, parseCallLogContent } from '../../shared/messages';
import { PollMessage } from './PollMessage';
import { CallMessage } from './CallMessage';

type MessageContentProps = {
  message: Pick<MessageItem, 'content' | 'media' | 'messageType' | 'deletedForEveryone' | 'poll'>;
  highlightTerm?: string;
  onVotePoll?: (optionId: string) => void;
  pollDisabled?: boolean;
  compact?: boolean;
  currentUserId?: string | null;
};

function renderMentionText(content: string): ReactNode {
  const parts = content.split(/(@[a-zA-Z0-9._-]+)/g);

  return parts.map((part, index) =>
    part.startsWith('@') ? (
      <span key={`${part}-${index}`} className="font-semibold text-accent-soft">
        {part}
      </span>
    ) : (
      part
    ),
  );
}

function highlightContent(content: string, term: string): ReactNode {
  if (!term.trim()) {
    return renderMentionText(content);
  }

  const index = content.toLowerCase().indexOf(term.toLowerCase());

  if (index < 0) {
    return renderMentionText(content);
  }

  const before = content.slice(0, index);
  const match = content.slice(index, index + term.length);
  const after = content.slice(index + term.length);

  return (
    <>
      {renderMentionText(before)}
      <mark className="rounded bg-accent/25 px-0.5 text-app-text">{match}</mark>
      {renderMentionText(after)}
    </>
  );
}

function mediaLabel(kind: string): string {
  if (kind === 'sticker') return 'Sticker';
  if (kind === 'gif') return 'GIF';
  if (kind === 'image') return 'Image';
  return 'Attachment';
}

export function MessageContent({
  message,
  highlightTerm = '',
  onVotePoll,
  pollDisabled = false,
  compact = false,
  currentUserId = null,
}: MessageContentProps) {
  if (isDeletedMessage(message)) {
    if (compact) {
      return (
        <span className="whitespace-pre-wrap break-words italic opacity-80">{DELETED_MESSAGE_TEXT}</span>
      );
    }

    return (
      <p className="whitespace-pre-wrap break-words italic opacity-80">{DELETED_MESSAGE_TEXT}</p>
    );
  }

  if (isPollMessage(message)) {
    if (message.poll) {
      return (
        <PollMessage poll={message.poll} disabled={pollDisabled} onVote={onVotePoll} />
      );
    }

    return (
      <div className="min-w-[220px] space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-app-muted">Poll</p>
        <p className="text-sm font-semibold text-inherit">
          {message.content.trim() && message.content.trim() !== 'select one option'
            ? message.content
            : 'Poll'}
        </p>
        <p className="text-xs text-app-muted">Reload the chat to see poll options.</p>
      </div>
    );
  }

  if (isCallLogMessage(message)) {
    const callLog = parseCallLogContent(message.content);

    if (callLog) {
      return <CallMessage callLog={callLog} currentUserId={currentUserId} compact={compact} />;
    }
  }

  const media = message.media ?? [];
  const normalizedContent =
    message.content.trim() === 'sticker' ? '' : message.content.trim();
  const visibleText = media.some((item) => item.url === normalizedContent) ? '' : normalizedContent;

  return (
    <div className="space-y-2">
      {media.map((item) => (
        <div key={item.url} className="overflow-hidden rounded-xl">
          <img
            src={item.kind === 'gif' ? item.url : item.previewUrl ?? item.url}
            alt={item.name ?? mediaLabel(item.kind)}
            loading="lazy"
            className={`max-h-72 max-w-full bg-transparent object-contain ${
              item.kind === 'sticker' ? 'max-h-40' : 'rounded-xl'
            }`}
            onError={(event) => {
              const target = event.currentTarget;
              if (item.previewUrl && target.src !== item.url) {
                target.src = item.url;
              }
            }}
          />
        </div>
      ))}

      {visibleText ? (
        compact ? (
          <span className="whitespace-pre-wrap break-words">
            {highlightContent(visibleText, highlightTerm)}
          </span>
        ) : (
          <p className="whitespace-pre-wrap break-words">{highlightContent(visibleText, highlightTerm)}</p>
        )
      ) : null}
    </div>
  );
}

export function MessageReplyPreview({
  message,
  className = '',
}: {
  message: Pick<MessageItem, 'content' | 'media' | 'messageType' | 'deletedForEveryone' | 'poll'>;
  className?: string;
}) {
  if (isDeletedMessage(message)) {
    return (
      <span className={`truncate italic text-app-muted ${className}`}>{DELETED_MESSAGE_TEXT}</span>
    );
  }

  if (message.poll && isPollMessage(message)) {
    return (
      <span className={`truncate italic text-app-muted ${className}`}>
        Poll: {message.poll.question}
      </span>
    );
  }

  const media = message.media ?? [];
  const primaryMedia =
    media.find((item) => item.kind === 'gif' || item.kind === 'sticker') ??
    media.find((item) => item.kind === 'image') ??
    media[0];
  const normalizedContent = message.content.trim() === 'sticker' ? '' : message.content.trim();
  const visibleText = media.some((item) => item.url === normalizedContent) ? '' : normalizedContent;

  if (!primaryMedia && !visibleText) {
    return <span className={`truncate italic text-app-muted ${className}`}>Message</span>;
  }

  return (
    <div className={`flex min-w-0 items-center gap-2 ${className}`}>
      {primaryMedia ? (
        <img
          src={
            primaryMedia.kind === 'gif'
              ? primaryMedia.url
              : primaryMedia.previewUrl ?? primaryMedia.url
          }
          alt={primaryMedia.name ?? mediaLabel(primaryMedia.kind)}
          loading="lazy"
          className="h-10 w-10 shrink-0 rounded-md bg-app-chat-hover object-contain"
          onError={(event) => {
            const target = event.currentTarget;
            if (primaryMedia.previewUrl && target.src !== primaryMedia.url) {
              target.src = primaryMedia.url;
            }
          }}
        />
      ) : null}
      {visibleText ? (
        <span className="min-w-0 truncate text-app-text">{visibleText}</span>
      ) : primaryMedia ? (
        <span className="truncate italic text-app-muted">{mediaLabel(primaryMedia.kind)}</span>
      ) : null}
    </div>
  );
}

export function MessagePreviewText({
  message,
}: {
  message: Pick<MessageItem, 'content' | 'media' | 'messageType' | 'deletedForEveryone' | 'poll'>;
}) {
  return <MessageReplyPreview message={message} />;
}
