import { useEffect, useRef, useState } from 'react';
import { normalizeUploadUrl } from '../shared/profile';
import {
  isFlexHubsHostedAssetUrl,
  peekAuthenticatedMediaUrl,
  resolveAuthenticatedMediaUrl,
} from './authenticatedMedia';
import { notifyMessageListVirtuosoLayoutSync } from './chat/messageListVirtuosoSync';

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
  const logicalSrcRef = useRef<string | null>(null);
  const onErrorRef = useRef(onError);
  const [shouldLoad, setShouldLoad] = useState(loading === 'eager');
  const [displaySrc, setDisplaySrc] = useState<string | null>(() => resolveImmediateSrc(src));
  const [hasError, setHasError] = useState(false);
  const displaySrcRef = useRef(displaySrc);
  const hasErrorRef = useRef(hasError);

  onErrorRef.current = onError;
  displaySrcRef.current = displaySrc;
  hasErrorRef.current = hasError;

  const commitDisplaySrc = (next: string | null) => {
    if (displaySrcRef.current !== next) {
      displaySrcRef.current = next;
      setDisplaySrc(next);
    }
  };

  const commitHasError = (next: boolean) => {
    if (hasErrorRef.current !== next) {
      hasErrorRef.current = next;
      setHasError(next);
    }
  };

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
    if (!shouldLoad || !src?.trim()) {
      if (!src?.trim()) {
        logicalSrcRef.current = null;
        commitDisplaySrc(null);
        commitHasError(false);
      }
      return;
    }

    const normalized = normalizeUploadUrl(src.trim());
    const logicalKey = normalized;
    let cancelled = false;

    if (canUseDirectly(normalized) || !isFlexHubsHostedAssetUrl(normalized)) {
      logicalSrcRef.current = logicalKey;
      commitHasError(false);
      commitDisplaySrc(normalized);
      return;
    }

    const cached = peekAuthenticatedMediaUrl(normalized);
    if (cached) {
      logicalSrcRef.current = logicalKey;
      commitHasError(false);
      commitDisplaySrc(cached);
      return;
    }

    if (logicalSrcRef.current !== logicalKey) {
      commitDisplaySrc(null);
    }
    logicalSrcRef.current = logicalKey;
    commitHasError(false);

    void resolveAuthenticatedMediaUrl(src)
      .then((nextSrc) => {
        if (!cancelled && nextSrc !== normalized) {
          commitDisplaySrc(nextSrc);
        } else if (!cancelled) {
          commitHasError(true);
          onErrorRef.current?.();
        }
      })
      .catch(() => {
        if (!cancelled) {
          commitHasError(true);
          onErrorRef.current?.();
        }
      });

    return () => {
      cancelled = true;
    };
  }, [shouldLoad, src]);

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
          onLoad={() => {
            notifyMessageListVirtuosoLayoutSync();
          }}
          onError={() => {
            commitHasError(true);
            onErrorRef.current?.();
          }}
        />
      ) : (
        <span className={className} aria-hidden={!alt} />
      )}
    </span>
  );
}
