import { useEffect, useState } from 'react';
import { normalizeUploadUrl } from '../shared/profile';
import { fetchMediaBlob, isFlexHubsHostedMediaUrl } from './mediaBlob';

type RemoteVideoProps = {
  src: string | null | undefined;
  className?: string;
  controls?: boolean;
  playsInline?: boolean;
  muted?: boolean;
  preload?: 'none' | 'metadata' | 'auto';
};

const resolvedSrcCache = new Map<string, string>();

function canUseDirectly(url: string): boolean {
  return url.startsWith('blob:') || url.startsWith('data:');
}

export function RemoteVideo({
  src,
  className = '',
  controls = true,
  playsInline = true,
  muted = false,
  preload = 'metadata',
}: RemoteVideoProps) {
  const [displaySrc, setDisplaySrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!src?.trim()) {
      setDisplaySrc(null);
      setFailed(false);
      return;
    }

    const normalized = normalizeUploadUrl(src.trim());
    let objectUrl = '';
    let cancelled = false;

    setFailed(false);

    if (canUseDirectly(normalized)) {
      setDisplaySrc(normalized);
      return;
    }

    const cached = resolvedSrcCache.get(normalized);
    if (cached) {
      setDisplaySrc(cached);
      return;
    }

    if (!isFlexHubsHostedMediaUrl(normalized)) {
      setDisplaySrc(normalized);
      return;
    }

    setDisplaySrc(null);

    void fetchMediaBlob(normalized)
      .then((blob) => {
        if (cancelled) {
          return;
        }

        objectUrl = URL.createObjectURL(blob);
        resolvedSrcCache.set(normalized, objectUrl);
        setDisplaySrc(objectUrl);
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true);
          setDisplaySrc(null);
        }
      });

    return () => {
      cancelled = true;
      if (objectUrl && !resolvedSrcCache.has(normalized)) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [src]);

  if (failed) {
    return (
      <div
        className={`flex min-h-[120px] min-w-[200px] items-center justify-center rounded-2xl bg-app-chat-hover px-4 text-center text-xs text-app-muted ${className}`}
      >
        Unable to load video preview.
      </div>
    );
  }

  if (!displaySrc) {
    return (
      <div
        className={`min-h-[160px] min-w-[220px] animate-pulse rounded-2xl bg-app-chat-hover ${className}`}
        aria-hidden="true"
      />
    );
  }

  return (
    <video
      src={displaySrc}
      controls={controls}
      playsInline={playsInline}
      muted={muted}
      preload={preload}
      className={className}
    />
  );
}
