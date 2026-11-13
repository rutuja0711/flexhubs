import { useEffect, useState } from 'react';
import { FiPlay } from 'react-icons/fi';
import { RemoteImage } from '../RemoteImage';
import { RemoteVideo } from '../RemoteVideo';
import { isLikelyImagePreviewUrl } from './mediaPreviewUrl';
import { SendingProgressRing } from '../ui/SendingProgressRing';
import { beginChatFileDrag, warmChatFileDragPath } from './startChatFileDrag';
import { openMediaPreview } from './MediaPreviewHost';
import { useAttachmentTransfer } from './useAttachmentTransfer';
import {
  formatUploadStatusLine,
  sanitizeProgressPercent,
} from './attachmentProgressUtil';

const MEDIA_BUBBLE_MAX = 'max-w-[min(330px,78vw)]';
const VIDEO_BUBBLE_MAX = 'max-w-[min(272px,62vw)]';

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

function formatVideoDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return '0:00';
  }

  const total = Math.floor(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function useVideoDuration(url: string, enabled: boolean): number | null {
  const [duration, setDuration] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled || !url) {
      setDuration(null);
      return;
    }

    const video = document.createElement('video');
    video.preload = 'metadata';
    const onMeta = () => setDuration(video.duration);
    video.addEventListener('loadedmetadata', onMeta);
    video.src = url;

    return () => {
      video.removeEventListener('loadedmetadata', onMeta);
      video.src = '';
    };
  }, [enabled, url]);

  return duration;
}

export function MediaMessagePreview({
  url,
  previewUrl,
  name,
  kind,
  isSending = false,
  sendProgress = null,
  canDrag: canDragProp,
}: MediaMessagePreviewProps) {
  const [imageError, setImageError] = useState(false);
  const [videoPosterError, setVideoPosterError] = useState(false);
  const transfer = useAttachmentTransfer({ url, name, isSending, sendProgress });
  const { showSendProgress, ringProgress, ringIndeterminate } = transfer;

  const canDrag = canDragProp ?? canDragChatMedia(url, isSending);
  const isVideo = kind === 'video';
  const duration = useVideoDuration(url, isVideo);
  const videoThumb = previewUrl?.trim() || null;
  const videoPosterImage =
    videoThumb && isLikelyImagePreviewUrl(videoThumb) && !videoPosterError ? videoThumb : null;

  useEffect(() => {
    setVideoPosterError(false);
  }, [url, videoThumb]);
  const showBusyOverlay = showSendProgress || isSending;

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

  if (isVideo) {
    return (
      <div className={`relative w-fit ${VIDEO_BUBBLE_MAX}`}>
        <button
          type="button"
          disabled={isSending}
          draggable={canDrag}
          onDragStart={(event) => beginChatFileDrag(event, url, name, { disabled: isSending })}
          onClick={openPreview}
          className={`relative block w-full overflow-hidden rounded-lg bg-black text-left ${
            isSending ? 'cursor-default' : canDrag ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
          }`}
        >
          <div
            className="js-media-preview-item relative aspect-[4/5] max-h-[min(58vw,288px)] w-[min(272px,62vw)] min-w-[168px]"
            data-media-url={url}
            data-media-name={name}
            data-media-kind="video"
          >
            {videoPosterImage ? (
              <img
                src={videoPosterImage}
                alt=""
                className="h-full w-full object-cover"
                loading="lazy"
                onError={() => setVideoPosterError(true)}
              />
            ) : (
              <RemoteVideo
                src={url}
                poster={null}
                controls={false}
                muted
                playsInline
                preload="metadata"
                loading="lazy"
                className="h-full w-full object-cover"
              />
            )}

            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/5" />

            {!isSending ? (
              <span className="pointer-events-none absolute left-1/2 top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-[2px]">
                <FiPlay className="ml-0.5 h-6 w-6" fill="currentColor" />
              </span>
            ) : null}

            {!isSending && duration != null ? (
              <span className="pointer-events-none absolute bottom-1.5 left-1.5 text-[11px] font-medium text-white/95 drop-shadow-sm">
                {formatVideoDuration(duration)}
              </span>
            ) : null}

            {showBusyOverlay ? (
              <div className="absolute inset-0 flex items-center justify-center bg-black/45">
                <SendingProgressRing
                  progress={ringIndeterminate ? null : ringProgress}
                  showLabel={showSendProgress}
                />
              </div>
            ) : null}
          </div>
        </button>
      </div>
    );
  }

  return (
    <div className={`relative w-fit ${MEDIA_BUBBLE_MAX}`}>
      <button
        type="button"
        disabled={isSending}
        draggable={canDrag}
        className={`block overflow-hidden rounded-xl text-left ${
          isSending ? 'cursor-default' : canDrag ? 'cursor-grab active:cursor-grabbing' : 'cursor-zoom-in'
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
            <div className="flex h-40 w-56 items-center justify-center bg-app-inset/50 text-xs text-app-muted">
              Could not load preview
            </div>
          ) : (
            <RemoteImage
              src={kind === 'gif' ? url : previewUrl}
              alt={name}
              loading="lazy"
              onError={() => setImageError(true)}
              className="block max-h-[min(72vw,360px)] w-auto max-w-[min(330px,78vw)] min-w-[120px] object-cover"
            />
          )}
        </div>
      </button>
      {showBusyOverlay ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl bg-black/30">
          <SendingProgressRing
            progress={ringIndeterminate ? null : ringProgress}
            showLabel={showSendProgress}
          />
        </div>
      ) : showSendProgress ? (
        <div className="pointer-events-none absolute inset-x-3 bottom-3 rounded-md bg-black/50 px-2 py-1 text-center text-[10px] text-white">
          {formatUploadStatusLine(sanitizeProgressPercent(sendProgress))}
        </div>
      ) : null}
    </div>
  );
}
