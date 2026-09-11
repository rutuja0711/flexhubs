import { useEffect, useState } from 'react';
import { normalizeUploadUrl } from '../shared/profile';
import { getStoredToken } from './authApi';

type RemoteImageProps = {
  src: string | null | undefined;
  alt?: string;
  className?: string;
  loading?: 'eager' | 'lazy';
  onError?: () => void;
};

const resolvedSrcCache = new Map<string, string>();

function canUseDirectly(url: string): boolean {
  return url.startsWith('blob:') || url.startsWith('data:');
}

function isFlexHubsHostedAssetUrl(url: string): boolean {
  const normalized = normalizeUploadUrl(url.trim());
  return /^https:\/\/flexhubs\.in\//i.test(normalized);
}

function toDataUrl(mimeType: string, base64: string): string {
  return `data:${mimeType};base64,${base64}`;
}

async function resolveFlexHubsImageSrc(rawUrl: string): Promise<string> {
  const url = normalizeUploadUrl(rawUrl.trim());

  if (!url) {
    throw new Error('Missing image URL.');
  }

  const cached = resolvedSrcCache.get(url);
  if (cached) {
    return cached;
  }

  const token = getStoredToken();
  if (!token || !window.electronAPI?.fetchAuthenticatedMedia) {
    return url;
  }

  const result = await window.electronAPI.fetchAuthenticatedMedia(token, url);
  if (!result.ok) {
    return url;
  }

  const dataUrl = toDataUrl(result.data.mimeType, result.data.base64);
  resolvedSrcCache.set(url, dataUrl);
  return dataUrl;
}

export function RemoteImage({
  src,
  alt = '',
  className = '',
  loading = 'lazy',
  onError,
}: RemoteImageProps) {
  const [displaySrc, setDisplaySrc] = useState<string | null>(null);

  useEffect(() => {
    if (!src?.trim()) {
      setDisplaySrc(null);
      return;
    }

    const normalized = normalizeUploadUrl(src.trim());
    let cancelled = false;

    if (canUseDirectly(normalized) || !isFlexHubsHostedAssetUrl(normalized)) {
      setDisplaySrc(normalized);
      return;
    }

    setDisplaySrc(null);

    void resolveFlexHubsImageSrc(src).then((nextSrc) => {
      if (!cancelled) {
        setDisplaySrc(nextSrc);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [src]);

  if (!displaySrc) {
    return null;
  }

  return (
    <img
      src={displaySrc}
      alt={alt}
      loading={loading}
      className={className}
      onError={() => {
        onError?.();
      }}
    />
  );
}
