import { useState } from 'react';
import { FiDownload, FiMaximize2, FiRefreshCw } from 'react-icons/fi';
import { RemoteImage } from '../RemoteImage';
import { RemoteVideo } from '../RemoteVideo';
import { SendingProgressRing } from '../ui/SendingProgressRing';
import { formatFileSize } from './FileAttachmentCard';
import { beginChatFileDrag, warmChatFileDragPath } from './startChatFileDrag';
import { openMediaPreview } from './MediaPreviewHost';
import { useAttachmentTransfer } from './useAttachmentTransfer';

type MediaMessagePreviewProps = {
  url: string;
  previewUrl: string;
  name: string;
  kind: 'image' | 'video' | 'gif';
  isSending?: boolean;
  sendProgress?: number | null;
  isOwn?: boolean;
  canDrag?: boolean;
};

function canDragChatMedia(url: string | undefined, isSending: boolean): boolean {
  if (!url || isSending || url.startsWith('blob:')) {
    return false;
  }

  return Boolean(window.electronAPI?.startChatFileDragFromPath);
}

function MediaAttachmentFooter({
  name,
  metaLine,
  isSending,
  downloaded,
  downloadError,
  showDownloadProgress,
  ringProgress,
  onDownload,
  onExpand,
  expandLabel,
}: {
  name: string;
  metaLine: string;
  isSending: boolean;
  downloaded: boolean;
  downloadError: boolean;
  showDownloadProgress: boolean;
  ringProgress: number | null;
  onDownload: () => void;
  onExpand?: () => void;
  expandLabel?: string;
}) {
  return (
    <div className="flex items-center gap-2 border-t border-app-border/50 bg-app-surface/95 px-3 py-2 dark:bg-app-elevated/95">
      <div className="min-w-0 flex-1">
        {name ? <p className="truncate text-[12px] font-medium leading-snug text-app-text">{name}</p> : null}
        {metaLine ? <p className="truncate text-[10px] text-app-muted">{metaLine}</p> : null}
      </div>
      {!isSending && onExpand ? (
        <button
          type="button"
          aria-label={expandLabel ?? 'Open larger preview'}
          title={expandLabel ?? 'Open larger preview'}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-app-border/70 bg-app-inset/60 text-app-text transition-colors hover:border-accent/35 hover:bg-accent/10 hover:text-accent"
          onClick={(event) => {
            event.stopPropagation();
            onExpand();
          }}
        >
          <FiMaximize2 className="h-4 w-4" strokeWidth={2} />
        </button>
      ) : null}
      {!isSending && (showDownloadProgress || downloadError || !downloaded) ? (
        <button
          type="button"
          aria-label={
            downloadError ? 'Retry download' : downloaded ? 'Download again' : 'Download file'
          }
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-app-border/70 bg-app-inset/60 text-app-text transition-colors hover:border-accent/35 hover:bg-accent/10 hover:text-accent"
          onClick={(event) => {
            event.stopPropagation();
            onDownload();
          }}
        >
          {showDownloadProgress ? (
            <SendingProgressRing progress={ringProgress} size={28} showLabel={typeof ringProgress === 'number'} />
          ) : downloadError ? (
            <FiRefreshCw className="h-3.5 w-3.5" strokeWidth={2} />
          ) : (
            <FiDownload className="h-3.5 w-3.5" strokeWidth={2} />
          )}
        </button>
      ) : null}
    </div>
  );
}

export function MediaMessagePreview({
  url,
  previewUrl,
  name,
  kind,
  isSending = false,
  sendProgress = null,
  isOwn: _isOwn = false,
  canDrag: canDragProp,
}: MediaMessagePreviewProps) {
  const [imageError, setImageError] = useState(false);
  const transfer = useAttachmentTransfer({ url, name, isSending, sendProgress });
  const {
    knownSizeBytes,
    downloadError,
    downloaded,
    showSendProgress,
    showDownloadProgress,
    ringProgress,
    progressBarWidth,
    handleDownload,
  } = transfer;

  const canDrag = canDragProp ?? canDragChatMedia(url, isSending);
  const isVideo = kind === 'video';
  const sizeLabel = knownSizeBytes ? formatFileSize(knownSizeBytes) : null;

  const frameClass =
    'relative w-full max-w-sm overflow-hidden rounded-2xl border border-app-border/70 bg-app-inset/20 shadow-sm ring-1 ring-black/[0.04] dark:border-accent/10 dark:ring-white/[0.06]';

  const openPreview = () => {
    if (isSending) {
      return;
    }

    openMediaPreview({
      url,
      name,
      kind: isVideo ? 'video' : 'image',
    });
  };

  const metaLine = [
    isVideo ? 'Video' : kind === 'gif' ? 'GIF' : 'Photo',
    showSendProgress ? 'Uploading…' : showDownloadProgress ? 'Downloading…' : downloaded ? 'Downloaded' : sizeLabel,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className={`${frameClass} group/media`}>
      {isVideo ? (
        <>
          <div
            className="js-media-preview-item relative bg-black"
            data-media-url={url}
            data-media-name={name}
            data-media-kind="video"
          >
            <RemoteVideo
              src={url}
              poster={previewUrl !== url ? previewUrl : null}
              controls={!isSending}
              playsInline
              muted={isSending}
              preload="metadata"
              loading="eager"
              className="block max-h-72 min-h-[140px] w-full bg-black object-contain"
            />
            {!isSending ? (
              <button
                type="button"
                aria-label="Open video in full view"
                title="Open full view"
                className="absolute right-2 top-2 z-20 flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-black/55 text-white backdrop-blur-sm transition-colors hover:bg-black/75"
                onClick={(event) => {
                  event.stopPropagation();
                  openPreview();
                }}
              >
                <FiMaximize2 className="h-4 w-4" strokeWidth={2} />
              </button>
            ) : null}
            {(showSendProgress || isSending) && (
              <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-black/40">
                <SendingProgressRing progress={sendProgress ?? null} showLabel />
              </div>
            )}
          </div>
          <MediaAttachmentFooter
            name={name}
            metaLine={metaLine}
            isSending={isSending}
            downloaded={downloaded}
            downloadError={downloadError}
            showDownloadProgress={showDownloadProgress}
            ringProgress={ringProgress}
            onDownload={() => void handleDownload()}
            onExpand={openPreview}
            expandLabel="Open video in full view"
          />
          {showDownloadProgress && typeof progressBarWidth === 'number' ? (
            <div className="h-[2px] bg-app-border/40">
              <div className="h-full bg-accent transition-[width] duration-200" style={{ width: `${progressBarWidth}%` }} />
            </div>
          ) : null}
        </>
      ) : (
        <>
          <button
            type="button"
            disabled={isSending}
            draggable={canDrag}
            className={`block w-full text-left ${
              isSending
                ? 'cursor-default'
                : canDrag
                  ? 'cursor-grab active:cursor-grabbing'
                  : 'cursor-zoom-in'
            }`}
            title={canDrag ? 'Drag to Desktop, Finder, or another app' : undefined}
            onMouseEnter={() => {
              void warmChatFileDragPath(url, name);
            }}
            onDragStart={(event) => beginChatFileDrag(event, url, name, { disabled: isSending })}
            onClick={openPreview}
          >
            <div
              className="js-media-preview-item"
              data-media-url={url}
              data-media-name={name}
              data-media-kind={kind === 'gif' ? 'gif' : 'image'}
            >
              {imageError ? (
                <div className="flex min-h-[160px] items-center justify-center bg-app-chat-hover px-4 text-center text-xs text-app-muted">
                  Could not load preview
                </div>
              ) : (
                <RemoteImage
                  src={kind === 'gif' ? url : previewUrl}
                  alt={name}
                  loading="lazy"
                  onError={() => setImageError(true)}
                  className="max-h-72 w-full object-contain"
                />
              )}
            </div>
          </button>
          {(showSendProgress || isSending) && (
            <div className="pointer-events-none absolute inset-0 bottom-[52px] flex items-center justify-center bg-black/25">
              <SendingProgressRing progress={sendProgress ?? null} showLabel />
            </div>
          )}
          <MediaAttachmentFooter
            name={name}
            metaLine={metaLine}
            isSending={isSending}
            downloaded={downloaded}
            downloadError={downloadError}
            showDownloadProgress={showDownloadProgress}
            ringProgress={ringProgress}
            onDownload={() => void handleDownload()}
            onExpand={openPreview}
          />
          {showDownloadProgress && typeof progressBarWidth === 'number' ? (
            <div className="h-[2px] bg-app-border/40">
              <div className="h-full bg-accent transition-[width] duration-200" style={{ width: `${progressBarWidth}%` }} />
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
