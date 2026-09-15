import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { FiDownload, FiExternalLink, FiRotateCw, FiX, FiZoomIn, FiZoomOut } from 'react-icons/fi';
import { normalizeUploadUrl } from '../../shared/profile';
import { getStoredToken } from '../authApi';
import { RemoteImage } from '../RemoteImage';

export type MediaPreviewItem = {
  url: string;
  name?: string;
  kind: 'image' | 'video';
};

let openPreviewHandler: ((item: MediaPreviewItem) => void) | null = null;

export function openMediaPreview(item: MediaPreviewItem): void {
  openPreviewHandler?.(item);
}

function isFlexHubsHostedUrl(url: string): boolean {
  return /^https:\/\/flexhubs\.in\//i.test(normalizeUploadUrl(url.trim()));
}

async function fetchMediaBlob(url: string): Promise<Blob> {
  const normalized = normalizeUploadUrl(url.trim());

  if (isFlexHubsHostedUrl(normalized)) {
    const token = getStoredToken();
    if (!token || !window.electronAPI?.fetchAuthenticatedMedia) {
      throw new Error('Unable to download this file.');
    }

    const result = await window.electronAPI.fetchAuthenticatedMedia(token, normalized);
    if (!result.ok) {
      throw new Error(result.error);
    }

    const binary = atob(result.data.base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }

    return new Blob([bytes], { type: result.data.mimeType || 'application/octet-stream' });
  }

  const response = await fetch(normalized);
  if (!response.ok) {
    throw new Error('Unable to download this file.');
  }

  return response.blob();
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
}: {
  item: MediaPreviewItem;
  onClose: () => void;
}) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [resolvedVideoUrl, setResolvedVideoUrl] = useState<string | null>(
    item.kind === 'video' && !isFlexHubsHostedUrl(item.url) ? item.url : null,
  );

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
    if (item.kind !== 'video' || !isFlexHubsHostedUrl(item.url)) {
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
  }, [onClose]);

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

      <div className="min-h-0 flex-1 overflow-auto bg-[#0b0b0c] px-6 py-6">
        <div className="flex min-h-full min-w-full items-center justify-center">
          {item.kind === 'video' ? (
            resolvedVideoUrl ? (
              <video
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
  const [item, setItem] = useState<MediaPreviewItem | null>(null);

  useEffect(() => {
    openPreviewHandler = setItem;
    return () => {
      openPreviewHandler = null;
    };
  }, []);

  if (!item) {
    return null;
  }

  return <MediaPreviewModal item={item} onClose={() => setItem(null)} />;
}
