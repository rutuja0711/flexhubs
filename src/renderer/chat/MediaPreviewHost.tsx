import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { FiDownload, FiExternalLink, FiRotateCw, FiX, FiZoomIn, FiZoomOut, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { normalizeUploadUrl } from '../../shared/profile';
import { RemoteImage } from '../RemoteImage';
import { fetchMediaBlob, isFlexHubsHostedMediaUrl } from '../mediaBlob';

export type MediaPreviewItem = {
  url: string;
  name?: string;
  kind: 'image' | 'video';
};

let openPreviewHandler: ((playlist: MediaPreviewItem[], index: number) => void) | null = null;

export function openMediaPreview(item: MediaPreviewItem): void {
  const elements = document.querySelectorAll('.js-media-preview-item');
  const playlist: MediaPreviewItem[] = [];
  
  elements.forEach((el) => {
    const url = el.getAttribute('data-media-url');
    if (!url) return;
    playlist.push({
      url,
      name: el.getAttribute('data-media-name') || undefined,
      kind: el.getAttribute('data-media-kind') === 'video' ? 'video' : 'image',
    });
  });

  let index = playlist.findIndex((p) => p.url === item.url);
  if (index === -1) {
    playlist.push(item);
    index = playlist.length - 1;
  }

  openPreviewHandler?.(playlist, index);
}

function triggerDownload(blob: Blob, fileName: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = fileName;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}

function MediaPreviewModal({
  item,
  onClose,
  onNext,
  onPrev,
}: {
  item: MediaPreviewItem;
  onClose: () => void;
  onNext?: () => void;
  onPrev?: () => void;
}) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [resolvedVideoUrl, setResolvedVideoUrl] = useState<string | null>(null);

  useEffect(() => {
    setZoom(1);
    setRotation(0);
    setError('');
    setResolvedVideoUrl(item.kind === 'video' && !isFlexHubsHostedMediaUrl(item.url) ? item.url : null);
  }, [item.url, item.kind]);

  const fileName = item.name?.trim() || (item.kind === 'video' ? 'video.mp4' : 'image.png');
  const label = item.kind === 'video' ? 'Video preview' : 'Image preview';

  const handleSave = useCallback(async () => {
    setBusy(true);
    setError('');

    try {
      const blob = await fetchMediaBlob(item.url);
      triggerDownload(blob, fileName);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save file.');
    } finally {
      setBusy(false);
    }
  }, [fileName, item.url]);

  const handleOpen = useCallback(async () => {
    setBusy(true);
    setError('');

    try {
      const normalized = normalizeUploadUrl(item.url.trim());

      if (window.electronAPI?.openExternalUrl) {
        const result = await window.electronAPI.openExternalUrl(normalized);
        if (!result.ok) {
          throw new Error(result.error);
        }
        return;
      }

      window.open(normalized, '_blank', 'noopener,noreferrer');
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : 'Unable to open file.');
    } finally {
      setBusy(false);
    }
  }, [item.url]);

  useEffect(() => {
    if (item.kind !== 'video' || !isFlexHubsHostedMediaUrl(item.url)) {
      return;
    }

    let cancelled = false;
    let objectUrl = '';

    void fetchMediaBlob(item.url)
      .then((blob) => {
        if (cancelled) {
          return;
        }

        objectUrl = URL.createObjectURL(blob);
        setResolvedVideoUrl(objectUrl);
      })
      .catch((videoError) => {
        if (!cancelled) {
          setError(videoError instanceof Error ? videoError.message : 'Unable to load video.');
        }
      });

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [item.kind, item.url]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }

      if (event.key === 'ArrowRight' && onNext) {
        onNext();
      }

      if (event.key === 'ArrowLeft' && onPrev) {
        onPrev();
      }

      if (event.key === '+' || event.key === '=') {
        event.preventDefault();
        setZoom((current) => Math.min(current + 0.25, 4));
      }

      if (event.key === '-') {
        event.preventDefault();
        setZoom((current) => Math.max(current - 0.25, 0.25));
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose, onNext, onPrev]);

  return createPortal(
    <div className="fixed inset-0 z-[300] flex flex-col bg-[#0b0b0c] text-white">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-white/10 bg-[#0b0b0c] px-5 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            aria-label="Close preview"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-white/60 transition-colors hover:bg-white/10 hover:text-white"
            onClick={onClose}
          >
            <FiX className="text-lg" />
          </button>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white">{fileName}</p>
            <p className="text-xs text-white/55">{label}</p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {item.kind === 'image' ? (
            <>
              <button
                type="button"
                aria-label="Zoom out"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                onClick={() => setZoom((current) => Math.max(current - 0.25, 0.25))}
              >
                <FiZoomOut className="text-base" />
              </button>
              <span className="min-w-[3rem] text-center text-sm text-white/60">
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                aria-label="Zoom in"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                onClick={() => setZoom((current) => Math.min(current + 0.25, 4))}
              >
                <FiZoomIn className="text-base" />
              </button>
              <button
                type="button"
                aria-label="Rotate"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                onClick={() => setRotation((current) => (current + 90) % 360)}
              >
                <FiRotateCw className="text-base" />
              </button>
            </>
          ) : null}
          <button
            type="button"
            disabled={busy}
            className="flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-sm text-white transition-colors hover:bg-white/10 disabled:opacity-50"
            onClick={() => void handleOpen()}
          >
            <FiExternalLink className="text-base" />
            Open
          </button>
          <button
            type="button"
            disabled={busy}
            className="flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
            onClick={() => void handleSave()}
          >
            <FiDownload className="text-base" />
            Save
          </button>
        </div>
      </header>

      <div className="relative min-h-0 flex-1 bg-[#0b0b0c] flex items-center justify-center overflow-hidden">
        <button
          type="button"
          disabled={!onPrev}
          className="absolute left-6 z-10 flex h-14 w-14 items-center justify-center rounded-full bg-black/40 text-white/70 transition-all hover:bg-black/70 hover:text-white disabled:opacity-30 disabled:pointer-events-none"
          onClick={onPrev}
          aria-label="Previous image"
        >
          <FiChevronLeft className="text-3xl" />
        </button>

        <div className="flex h-full w-full items-center justify-center overflow-auto px-16 py-6">
          {item.kind === 'video' ? (
            resolvedVideoUrl ? (
              <video
                key={item.url}
                src={resolvedVideoUrl}
                controls
                autoPlay
                className="max-h-full max-w-full rounded-xl bg-black shadow-2xl"
              />
            ) : (
              <p className="text-sm text-white/55">Loading video...</p>
            )
          ) : (
            <div
              key={item.url}
              className="origin-center transition-transform duration-150"
              style={{ transform: `scale(${zoom}) rotate(${rotation}deg)` }}
            >
              <RemoteImage
                src={item.url}
                alt={fileName}
                loading="eager"
                className="max-h-[85vh] max-w-[90vw] bg-transparent object-contain"
              />
            </div>
          )}
        </div>

        <button
          type="button"
          disabled={!onNext}
          className="absolute right-6 z-10 flex h-14 w-14 items-center justify-center rounded-full bg-black/40 text-white/70 transition-all hover:bg-black/70 hover:text-white disabled:opacity-30 disabled:pointer-events-none"
          onClick={onNext}
          aria-label="Next image"
        >
          <FiChevronRight className="text-3xl" />
        </button>
      </div>

      <footer className="shrink-0 border-t border-white/10 bg-[#0b0b0c] px-5 py-2 text-center text-xs text-white/50">
        Esc to close{item.kind === 'image' ? ' · Scroll to pan · + / - to zoom' : ''}
        {error ? <span className="ml-3 text-accent-soft">{error}</span> : null}
      </footer>
    </div>,
    document.body,
  );
}

export function MediaPreviewHost() {
  const [playlist, setPlaylist] = useState<MediaPreviewItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);

  useEffect(() => {
    openPreviewHandler = (newPlaylist, index) => {
      setPlaylist(newPlaylist);
      setCurrentIndex(index);
    };
    return () => {
      openPreviewHandler = null;
    };
  }, []);

  if (currentIndex === -1 || !playlist[currentIndex]) {
    return null;
  }

  const handleNext = () => {
    setCurrentIndex((current) => (current + 1) % playlist.length);
  };

  const handlePrev = () => {
    setCurrentIndex((current) => (current - 1 + playlist.length) % playlist.length);
  };

  return (
    <MediaPreviewModal
      key={playlist[currentIndex].url}
      item={playlist[currentIndex]}
      onClose={() => setCurrentIndex(-1)}
      onNext={playlist.length > 1 ? handleNext : undefined}
      onPrev={playlist.length > 1 ? handlePrev : undefined}
    />
  );
}
