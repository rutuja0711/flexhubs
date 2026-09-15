import type { ReactNode } from 'react';
import { FiFile } from 'react-icons/fi';
import type { MessageItem } from '../../shared/messages';
import {
  DELETED_MESSAGE_TEXT,
  formatMessagePreview,
  isCallLogMessage,
  isDeletedMessage,
  isPollMessage,
  isStickerMessage,
  parseCallLogContent,
} from '../../shared/messages';
import { RemoteImage } from '../RemoteImage';
import { openMediaPreview } from './MediaPreviewHost';
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
  if (kind === 'file') return 'File';
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
  const stickerMessage = isStickerMessage(message);
  const normalizedContent =
    message.content.trim() === 'sticker' ? '' : message.content.trim();
  const visibleText = media.some((item) => item.url === normalizedContent) ? '' : normalizedContent;

  return (
    <div className="space-y-2">
      {media.map((item) => {
        if (item.kind === 'file') {
          return (
            <a
              key={item.url}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              download={item.name ?? undefined}
              className="flex max-w-sm items-center gap-3 rounded-2xl border border-app-border/60 bg-app-surface/90 backdrop-blur-sm px-3.5 py-2.5 text-inherit shadow-sm transition-all hover:bg-app-chat-hover hover:border-app-border-strong/60"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent-soft shadow-inner shadow-accent/20">
                <FiFile className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold tracking-tight">{item.name ?? 'File'}</span>
                <span className="text-[11px] font-medium text-app-muted">Tap to download</span>
              </span>
            </a>
          );
        }

        const isSticker = stickerMessage || item.kind === 'sticker';
        const isVideo =
          item.kind === 'video' ||
          item.name?.toLowerCase().endsWith('.mp4') ||
          item.url?.toLowerCase().endsWith('.mp4');
        const isPreviewable = !isSticker && (isVideo || item.kind === 'image');
        const previewUrl = item.previewUrl ?? item.url;

        if (isSticker) {
          return (
            <RemoteImage
              key={item.url}
              src={item.kind === 'gif' ? item.url : previewUrl}
              alt={item.name ?? 'Sticker'}
              loading="lazy"
              className="max-h-40 max-w-full bg-transparent object-contain"
            />
          );
        }

        return (
          <div key={item.url} className="overflow-hidden rounded-2xl ring-1 ring-black/10 dark:ring-white/10 shadow-sm">
            {isPreviewable ? (
              <button
                type="button"
                className="block max-w-full cursor-zoom-in text-left transition-transform hover:scale-[1.01]"
                onClick={() =>
                  openMediaPreview({
                    url: item.url,
                    name: item.name,
                    kind: isVideo ? 'video' : 'image',
                  })
                }
              >
                {isVideo ? (
                  <video
                    src={previewUrl}
                    muted
                    playsInline
                    preload="metadata"
                    className="pointer-events-none max-h-72 max-w-full rounded-2xl bg-app-chat-hover object-contain"
                  />
                ) : (
                  <RemoteImage
                    src={item.kind === 'gif' ? item.url : previewUrl}
                    alt={item.name ?? mediaLabel(item.kind)}
                    loading="lazy"
                    className="max-h-72 max-w-full rounded-2xl bg-transparent object-contain"
                  />
                )}
              </button>
            ) : (
              <RemoteImage
                src={item.kind === 'gif' ? item.url : previewUrl}
                alt={item.name ?? mediaLabel(item.kind)}
                loading="lazy"
                className="max-h-72 max-w-full rounded-2xl bg-transparent object-contain"
              />
            )}
          </div>
        );
      })}

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
  currentUserId = null,
}: {
  message: Pick<MessageItem, 'content' | 'media' | 'messageType' | 'deletedForEveryone' | 'poll'>;
  className?: string;
  currentUserId?: string | null;
}) {
  if (isDeletedMessage(message)) {
    return (
      <span className={`truncate italic text-app-muted ${className}`}>{DELETED_MESSAGE_TEXT}</span>
    );
  }

  if (isCallLogMessage(message)) {
    return (
      <span className={`truncate text-app-text ${className}`}>
        {formatMessagePreview(message, currentUserId)}
      </span>
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
    media.find((item) => item.kind === 'file') ??
    media[0];
  const normalizedContent = message.content.trim() === 'sticker' ? '' : message.content.trim();
  const visibleText = media.some((item) => item.url === normalizedContent) ? '' : normalizedContent;

  if (!primaryMedia && !visibleText) {
    return <span className={`truncate italic text-app-muted ${className}`}>Message</span>;
  }

  return (
    <div className={`flex min-w-0 items-center gap-2 ${className}`}>
      {primaryMedia?.kind === 'file' ? (
        <span className={`truncate text-app-text ${className}`}>
          {primaryMedia.name ?? 'File'}
        </span>
      ) : primaryMedia ? (
        <RemoteImage
          src={
            primaryMedia.kind === 'gif'
              ? primaryMedia.url
              : primaryMedia.previewUrl ?? primaryMedia.url
          }
          alt={primaryMedia.name ?? mediaLabel(primaryMedia.kind)}
          loading="lazy"
          className={`h-10 w-10 shrink-0 object-contain ${
            primaryMedia.kind === 'sticker' ? 'bg-transparent' : 'rounded-md bg-app-chat-hover'
          }`}
        />
      ) : null}
      {visibleText ? (
        <span className="min-w-0 truncate text-app-text">{visibleText}</span>
      ) : primaryMedia && primaryMedia.kind !== 'file' ? (
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
