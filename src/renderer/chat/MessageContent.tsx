import type { ReactNode } from 'react';
import type { MessageItem } from '../../shared/messages';
import {
  DELETED_MESSAGE_TEXT,
  formatMessagePreview,
  isCallLogMessage,
  isDeletedMessage,
  isDownloadableFileMedia,
  isPollMessage,
  isStickerMessage,
  isVideoMediaItem,
  isVoiceMediaAttachment,
  parseCallLogContent,
} from '../../shared/messages';
import { RemoteImage } from '../RemoteImage';
import { FileAttachmentCard } from './FileAttachmentCard';
import { VoiceNoteBubble } from './VoiceNoteBubble';
import { RemoteVideo } from '../RemoteVideo';
import { SendingProgressRing } from '../ui/SendingProgressRing';
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
  isSending?: boolean;
  sendProgress?: number | null;
  isOwn?: boolean;
};

function SendingMediaOverlay({ progress }: { progress?: number | null }) {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-2xl bg-black/30 backdrop-blur-[1px]">
      <SendingProgressRing progress={progress ?? null} showLabel />
    </div>
  );
}

function wrapWithSendOverlay(node: ReactNode, isSending: boolean, sendProgress?: number | null) {
  if (!isSending) {
    return node;
  }

  return (
    <div className="relative inline-block max-w-full">
      {node}
      <SendingMediaOverlay progress={sendProgress} />
    </div>
  );
}

function renderFormattedText(content: string): ReactNode {
  const parts = content.split(/((?:https?:\/\/[^\s]+)|(?:@[a-zA-Z0-9._-]+))/g);

  return parts.map((part, index) => {
    if (part.startsWith('http://') || part.startsWith('https://')) {
      return (
        <a
          key={`${part}-${index}`}
          href={part}
          className="text-accent hover:underline break-all cursor-pointer"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (window.electronAPI?.openExternalUrl) {
              void window.electronAPI.openExternalUrl(part);
            }
          }}
        >
          {part}
        </a>
      );
    }
    if (part.startsWith('@')) {
      return (
        <span key={`${part}-${index}`} className="font-semibold text-accent-soft">
          {part}
        </span>
      );
    }
    return part;
  });
}

function highlightContent(content: string, term: string): ReactNode {
  if (!term.trim()) {
    return renderFormattedText(content);
  }

  const index = content.toLowerCase().indexOf(term.toLowerCase());

  if (index < 0) {
    return renderFormattedText(content);
  }

  const before = content.slice(0, index);
  const match = content.slice(index, index + term.length);
  const after = content.slice(index + term.length);

  return (
    <>
      {renderFormattedText(before)}
      <mark className="rounded bg-accent/25 px-0.5 text-app-text">{match}</mark>
      {renderFormattedText(after)}
    </>
  );
}

function mediaLabel(kind: string): string {
  if (kind === 'sticker') return 'Sticker';
  if (kind === 'gif') return 'GIF';
  if (kind === 'image') return 'Image';
  if (kind === 'video') return 'Video';
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
  isSending = false,
  sendProgress = null,
  isOwn = false,
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
  let visibleText = media.some((item) => item.url === normalizedContent) ? '' : normalizedContent;
  if (
    visibleText &&
    media.some(
      (item) =>
        item.name &&
        item.name.trim().localeCompare(visibleText.trim(), undefined, { sensitivity: 'accent' }) === 0,
    )
  ) {
    visibleText = '';
  }

  const mediaFrameClass = 'w-full max-w-sm';
  const hasCaption = Boolean(visibleText);

  return (
    <div className="w-fit max-w-full space-y-2">
      {media.map((item) => {
        if (isVoiceMediaAttachment(item, message.messageType) && item.url) {
          return (
            <div key={item.url} className="max-w-full">
              <VoiceNoteBubble src={item.url} isOwn={isOwn} />
            </div>
          );
        }

        if (isDownloadableFileMedia(item) && !isVideoMediaItem(item)) {
          return (
            <div key={item.url}>
              <FileAttachmentCard
                url={item.url}
                name={item.name ?? 'File'}
                isSending={isSending}
                sendProgress={sendProgress}
                isOwn={isOwn}
              />
            </div>
          );
        }

        const isSticker = stickerMessage || item.kind === 'sticker';
        const isVideo = isVideoMediaItem(item);
        const isPreviewable = !isSticker && (isVideo || item.kind === 'image');
        const previewUrl = item.previewUrl ?? item.url;

        if (isSticker) {
          return wrapWithSendOverlay(
            <RemoteImage
              key={item.url}
              src={item.kind === 'gif' ? item.url : previewUrl}
              alt={item.name ?? 'Sticker'}
              loading="lazy"
              className={`max-h-40 w-full max-w-sm bg-transparent object-contain ${isSending ? 'min-h-[120px] min-w-[120px]' : ''}`}
            />,
            isSending,
            sendProgress,
          );
        }

        const mediaBody = (
          <div
            className={`overflow-hidden rounded-2xl ${isVideo ? 'ring-1 ring-black/10 dark:ring-white/10 shadow-sm' : ''} ${mediaFrameClass} ${isSending ? 'min-h-[160px] min-w-[160px] bg-black/5 dark:bg-white/5 flex items-center justify-center' : ''}`}
          >
            {isVideo ? (
              <div
                className="js-media-preview-item block w-full"
                data-media-url={item.url}
                data-media-name={item.name ?? ''}
                data-media-kind="video"
                onDoubleClick={() => {
                  if (isSending) {
                    return;
                  }

                  openMediaPreview({
                    url: item.url,
                    name: item.name ?? undefined,
                    kind: 'video',
                  });
                }}
              >
                <RemoteVideo
                  src={previewUrl}
                  controls={!isSending}
                  playsInline
                  muted={isSending}
                  preload="metadata"
                  className="block h-auto max-h-72 w-full rounded-2xl bg-app-chat-hover object-contain"
                />
              </div>
            ) : isPreviewable ? (
              <button
                type="button"
                disabled={isSending}
                className={`block w-full text-left transition-transform js-media-preview-item ${
                  isSending ? 'cursor-default' : 'cursor-zoom-in hover:scale-[1.01]'
                }`}
                data-media-url={item.url}
                data-media-name={item.name ?? ''}
                data-media-kind="image"
                onClick={() =>
                  openMediaPreview({
                    url: item.url,
                    name: item.name ?? undefined,
                    kind: 'image',
                  })
                }
              >
                <RemoteImage
                  src={item.kind === 'gif' ? item.url : previewUrl}
                  alt={item.name ?? mediaLabel(item.kind)}
                  loading="lazy"
                  className="max-h-72 w-full rounded-2xl bg-transparent object-contain"
                />
              </button>
            ) : (
              <RemoteImage
                src={item.kind === 'gif' ? item.url : previewUrl}
                alt={item.name ?? mediaLabel(item.kind)}
                loading="lazy"
                className="max-h-72 w-full rounded-2xl bg-transparent object-contain"
              />
            )}
          </div>
        );

        return (
          <div key={item.url}>
            {wrapWithSendOverlay(mediaBody, isSending, sendProgress)}
          </div>
        );
      })}

      {visibleText ? (
        compact ? (
          <span
            className={`block min-w-0 whitespace-pre-wrap break-words ${hasCaption && media.length > 0 ? 'max-w-sm' : ''}`}
          >
            {highlightContent(visibleText, highlightTerm)}
          </span>
        ) : (
          <p
            className={`min-w-0 whitespace-pre-wrap break-words ${hasCaption && media.length > 0 ? 'max-w-sm px-3.5 pt-2' : ''}`}
          >
            {highlightContent(visibleText, highlightTerm)}
          </p>
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
    media.find((item) => item.kind === 'image' || item.kind === 'video') ??
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
