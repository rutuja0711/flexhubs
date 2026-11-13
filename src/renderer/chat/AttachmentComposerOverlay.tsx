import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { FiPlus, FiSend, FiSmile, FiX } from 'react-icons/fi';
import { AttachmentFileIcon } from './AttachmentFileIcon';
import { formatFileSize } from './FileAttachmentCard';
import { openMediaPreview } from './MediaPreviewHost';
import {
  pendingAttachmentTypeLabel,
  type PendingAttachment,
} from './pendingAttachments';

type OverlayBounds = {
  top: number;
  left: number;
  width: number;
  height: number;
};

export type AttachmentComposerOverlayProps = {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  attachments: PendingAttachment[];
  selectedIndex: number;
  onSelectIndex: (index: number) => void;
  onRemove: (index: number) => void;
  onClose: () => void;
  onAddMore: () => void;
  caption: string;
  onCaptionChange: (value: string) => void;
  onSend: () => void;
  onOpenEmoji: () => void;
  sendDisabled: boolean;
  isSending: boolean;
  replyBanner?: string | null;
};

function formatVideoDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return '0:00';
  }

  const total = Math.floor(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function useOverlayBounds(
  open: boolean,
  anchorRef: RefObject<HTMLElement | null>,
): OverlayBounds | null {
  const [bounds, setBounds] = useState<OverlayBounds | null>(null);

  const measure = useCallback(() => {
    const el = anchorRef.current;
    if (!el) {
      setBounds({
        top: 0,
        left: 0,
        width: window.innerWidth,
        height: window.innerHeight,
      });
      return;
    }

    const rect = el.getBoundingClientRect();
    setBounds({
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
    });
  }, [anchorRef]);

  useLayoutEffect(() => {
    if (!open) {
      setBounds(null);
      return;
    }

    measure();

    const el = anchorRef.current;
    if (!el) {
      return;
    }

    const observer = new ResizeObserver(measure);
    observer.observe(el);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [anchorRef, measure, open]);

  return bounds;
}

function VideoDurationBadge({ url }: { url: string }) {
  const [duration, setDuration] = useState<number | null>(null);

  useEffect(() => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    const onMeta = () => setDuration(video.duration);
    video.addEventListener('loadedmetadata', onMeta);
    video.src = url;

    return () => {
      video.removeEventListener('loadedmetadata', onMeta);
      video.src = '';
    };
  }, [url]);

  if (duration === null) {
    return null;
  }

  return (
    <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 py-0.5 text-[9px] font-medium text-white">
      {formatVideoDuration(duration)}
    </span>
  );
}

function FilePreviewUnavailable({ attachment }: { attachment: PendingAttachment }) {
  const typeLabel = pendingAttachmentTypeLabel(attachment);
  const extension = attachment.file.name.includes('.')
    ? attachment.file.name.split('.').pop()?.toUpperCase()
    : typeLabel;

  return (
    <div
      className="flex max-w-md flex-col items-center gap-4 rounded-2xl border border-app-border/70 bg-app-card/90 px-8 py-10 text-center shadow-lg"
      role="status"
    >
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-app-inset text-accent">
        <AttachmentFileIcon category={attachment.category} className="h-10 w-10" />
      </div>
      <div className="min-w-0 space-y-2">
        <p className="text-sm font-semibold text-app-text">No preview available</p>
        <p className="text-xs text-app-muted">You can still send this file.</p>
        <p className="break-all text-sm font-medium text-app-text">{attachment.file.name}</p>
        <p className="text-xs text-app-muted">
          {extension} · {formatFileSize(attachment.file.size)}
        </p>
      </div>
    </div>
  );
}

function MainPreview({ attachment }: { attachment: PendingAttachment }) {
  const [mediaPreviewFailed, setMediaPreviewFailed] = useState(false);
  const [pdfLoaded, setPdfLoaded] = useState(false);
  const [pdfFailed, setPdfFailed] = useState(false);

  useEffect(() => {
    setMediaPreviewFailed(false);
    setPdfLoaded(false);
    setPdfFailed(false);
  }, [attachment.id]);

  useEffect(() => {
    if (!attachment.isPdf || !attachment.previewUrl) {
      return;
    }

    const timer = window.setTimeout(() => {
      if (!pdfLoaded) {
        setPdfFailed(true);
      }
    }, 2500);

    return () => window.clearTimeout(timer);
  }, [attachment.id, attachment.isPdf, attachment.previewUrl, pdfLoaded]);

  if (mediaPreviewFailed) {
    return <FilePreviewUnavailable attachment={attachment} />;
  }

  if (attachment.isImage && attachment.previewUrl) {
    return (
      <button
        type="button"
        className="flex h-full w-full max-h-full max-w-full items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
        aria-label={`View ${attachment.file.name}`}
        onClick={() => {
          openMediaPreview({
            url: attachment.previewUrl,
            name: attachment.file.name,
            kind: 'image',
          });
        }}
      >
        <img
          src={attachment.previewUrl}
          alt={attachment.file.name}
          className="max-h-[min(52vh,520px)] max-w-full object-contain"
          draggable={false}
          onError={() => setMediaPreviewFailed(true)}
        />
      </button>
    );
  }

  if (attachment.isVideo && attachment.previewUrl) {
    return (
      <div className="flex h-full w-full max-w-full flex-col items-center justify-center">
        <video
          key={attachment.id}
          src={attachment.previewUrl}
          controls
          playsInline
          preload="metadata"
          className="max-h-[min(52vh,520px)] max-w-full rounded-xl bg-black/40"
          onError={() => setMediaPreviewFailed(true)}
        />
        <button
          type="button"
          className="mt-2 text-xs font-medium text-accent-soft hover:underline"
          onClick={() => {
            openMediaPreview({
              url: attachment.previewUrl,
              name: attachment.file.name,
              kind: 'video',
            });
          }}
        >
          Open in viewer
        </button>
      </div>
    );
  }

  if (attachment.isPdf && attachment.previewUrl && !pdfFailed) {
    return (
      <iframe
        title={attachment.file.name}
        src={attachment.previewUrl}
        className="h-[min(52vh,520px)] w-full max-w-3xl rounded-xl border border-app-border/60 bg-app-card"
        onLoad={() => setPdfLoaded(true)}
        onError={() => setPdfFailed(true)}
      />
    );
  }

  if (attachment.isImage || attachment.isVideo) {
    return <FilePreviewUnavailable attachment={attachment} />;
  }

  return <FilePreviewUnavailable attachment={attachment} />;
}

function AttachmentThumbnail({
  attachment,
  selected,
  onSelect,
  onRemove,
}: {
  attachment: PendingAttachment;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="group relative shrink-0">
      <button
        type="button"
        onClick={onSelect}
        className={`relative h-14 w-14 overflow-hidden rounded-lg border-2 transition-colors ${
          selected ? 'border-accent shadow-md shadow-accent/25' : 'border-transparent hover:border-app-border'
        }`}
        aria-label={`Select ${attachment.file.name}`}
        aria-pressed={selected}
      >
        {attachment.isImage && attachment.previewUrl ? (
          <img src={attachment.previewUrl} alt="" className="h-full w-full object-cover" />
        ) : attachment.isVideo && attachment.previewUrl ? (
          <>
            <video src={attachment.previewUrl} muted className="h-full w-full object-cover" preload="metadata" />
            <VideoDurationBadge url={attachment.previewUrl} />
          </>
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center bg-app-inset px-1 text-app-muted">
            <AttachmentFileIcon category={attachment.category} className="h-5 w-5" />
          </div>
        )}
      </button>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onRemove();
        }}
        className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-app-border bg-app-elevated text-app-text shadow-sm"
        aria-label={`Remove ${attachment.file.name}`}
      >
        <FiX />
      </button>
    </div>
  );
}

export function AttachmentComposerOverlay({
  open,
  anchorRef,
  attachments,
  selectedIndex,
  onSelectIndex,
  onRemove,
  onClose,
  onAddMore,
  caption,
  onCaptionChange,
  onSend,
  onOpenEmoji,
  sendDisabled,
  isSending,
  replyBanner,
}: AttachmentComposerOverlayProps) {
  const bounds = useOverlayBounds(open, anchorRef);
  const captionRef = useRef<HTMLTextAreaElement>(null);
  const selected = attachments[selectedIndex] ?? attachments[0] ?? null;

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, open]);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => captionRef.current?.focus());
    }
  }, [open, selectedIndex]);

  if (!open || !bounds || attachments.length === 0 || !selected) {
    return null;
  }

  return createPortal(
    <div
      className="fixed z-[120] flex flex-col bg-app-chat-bg/98 text-app-text backdrop-blur-md"
      style={{
        top: bounds.top,
        left: bounds.left,
        width: bounds.width,
        height: bounds.height,
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Attachment preview"
    >
      <div className="flex shrink-0 items-center gap-3 border-b border-app-border/80 px-4 py-3">
        <button
          type="button"
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-xl text-app-muted transition-colors hover:bg-app-chat-hover hover:text-app-text"
          aria-label="Cancel attachments"
        >
          <FiX className="text-lg" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-app-text">
            {attachments.length === 1 ? '1 attachment' : `${attachments.length} attachments`}
          </p>
          {replyBanner ? <p className="truncate text-xs text-app-muted">{replyBanner}</p> : null}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden px-4 py-6">
        <MainPreview attachment={selected} />
      </div>

      <div className="shrink-0 border-t border-app-border/80 bg-app-surface/95 px-4 pb-4 pt-3 backdrop-blur-md">
        <div className="mb-3 flex items-center gap-2 overflow-x-auto pb-1">
          {attachments.map((attachment, index) => (
            <AttachmentThumbnail
              key={attachment.id}
              attachment={attachment}
              selected={index === selectedIndex}
              onSelect={() => onSelectIndex(index)}
              onRemove={() => onRemove(index)}
            />
          ))}
          <button
            type="button"
            onClick={onAddMore}
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-dashed border-app-border text-app-muted transition-colors hover:border-accent/50 hover:text-accent-soft"
            aria-label="Add more attachments"
          >
            <FiPlus className="text-xl" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex min-h-[44px] min-w-0 flex-1 items-center gap-2 rounded-3xl border border-app-border/80 bg-app-card/90 px-3 py-1.5">
            <textarea
              ref={captionRef}
              value={caption}
              rows={1}
              disabled={isSending}
              placeholder="Type a message"
              className="max-h-24 min-h-[28px] min-w-0 flex-1 resize-none bg-transparent py-1 text-sm leading-snug text-app-text outline-none placeholder:text-app-placeholder"
              onChange={(event) => onCaptionChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  if (!sendDisabled) {
                    onSend();
                  }
                }
              }}
            />
            <button
              type="button"
              disabled={isSending}
              onClick={onOpenEmoji}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-app-muted hover:bg-app-chat-hover hover:text-app-text disabled:opacity-40"
              aria-label="Insert emoji"
            >
              <FiSmile className="text-lg" />
            </button>
          </div>
          <button
            type="button"
            disabled={sendDisabled}
            onClick={onSend}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-white shadow-lg shadow-accent/30 transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
            aria-label={isSending ? 'Sending' : 'Send attachments'}
          >
            <FiSend className="text-base" />
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
