import { useEffect, useRef, useState } from 'react';
import { normalizeUploadUrl } from '../shared/profile';
import {
  isFlexHubsHostedAssetUrl,
  peekAuthenticatedMediaUrl,
  resolveAuthenticatedMediaUrl,
} from './authenticatedMedia';

type RemoteImageProps = {
  src: string | null | undefined;
  alt?: string;
  className?: string;
  wrapperClassName?: string;
  loading?: 'eager' | 'lazy';
  onError?: () => void;
};

function canUseDirectly(url: string): boolean {
  return url.startsWith('blob:') || url.startsWith('data:');
}

function resolveImmediateSrc(src: string | null | undefined): string | null {
  if (!src?.trim()) {
    return null;
  }

  const normalized = normalizeUploadUrl(src.trim());
  if (canUseDirectly(normalized) || !isFlexHubsHostedAssetUrl(normalized)) {
    return normalized;
  }

  return peekAuthenticatedMediaUrl(normalized);
}

export function RemoteImage({
  src,
  alt = '',
  className = '',
  loading = 'lazy',
  onError,
}: RemoteImageProps) {
  const hostRef = useRef<HTMLSpanElement>(null);
  const [shouldLoad, setShouldLoad] = useState(loading === 'eager');
  const [displaySrc, setDisplaySrc] = useState<string | null>(() => resolveImmediateSrc(src));
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (loading === 'eager') {
      setShouldLoad(true);
      return;
    }

    if (typeof IntersectionObserver === 'undefined') {
      setShouldLoad(true);
      return;
    }

    let observer: IntersectionObserver | null = null;
    const frameId = window.requestAnimationFrame(() => {
      const node = hostRef.current;
      if (!node) {
        setShouldLoad(true);
        return;
      }

      observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            setShouldLoad(true);
            observer?.disconnect();
          }
        },
        { root: null, rootMargin: '240px', threshold: 0.01 },
      );

      observer.observe(node);
    });

    return () => {
      window.cancelAnimationFrame(frameId);
      observer?.disconnect();
    };
  }, [loading, src]);

  useEffect(() => {
    setHasError(false);

    if (!shouldLoad || !src?.trim()) {
      if (!src?.trim()) {
        setDisplaySrc(null);
      }
      return;
    }

    const normalized = normalizeUploadUrl(src.trim());
    let cancelled = false;

    if (canUseDirectly(normalized) || !isFlexHubsHostedAssetUrl(normalized)) {
      setDisplaySrc(normalized);
      return;
    }

    const cached = peekAuthenticatedMediaUrl(normalized);
    if (cached) {
      setDisplaySrc(cached);
      return;
    }

    void resolveAuthenticatedMediaUrl(src)
      .then((nextSrc) => {
        if (!cancelled) {
          setDisplaySrc(nextSrc);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHasError(true);
          onError?.();
        }
      });

    return () => {
      cancelled = true;
    };
  }, [shouldLoad, src, onError]);

  if (hasError) {
    return null;
  }

  return (
    <span ref={hostRef} className="inline-flex shrink-0">
      {displaySrc ? (
        <img
          src={displaySrc}
          alt={alt}
          loading={loading}
          decoding="async"
          className={className}
          onError={() => {
            setHasError(true);
            onError?.();
          }}
        />
      ) : (
        <span className={className} aria-hidden={!alt} />
      )}
    </span>
  );
}
