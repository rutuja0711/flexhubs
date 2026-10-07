import { useEffect, useRef, useState } from 'react';
import { normalizeUploadUrl } from '../shared/profile';
import {
  isFlexHubsHostedAssetUrl,
  peekAuthenticatedMediaUrl,
  resolveAuthenticatedMediaUrl,
} from './authenticatedMedia';

type RemoteVideoProps = {
  src: string | null | undefined;
  className?: string;
  controls?: boolean;
  playsInline?: boolean;
  muted?: boolean;
  preload?: 'none' | 'metadata' | 'auto';
  loading?: 'eager' | 'lazy';
};

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
  loading = 'lazy',
}: RemoteVideoProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [shouldLoad, setShouldLoad] = useState(loading === 'eager');
  const [displaySrc, setDisplaySrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (loading === 'eager') {
      setShouldLoad(true);
      return;
    }

    const node = hostRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      setShouldLoad(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { root: null, rootMargin: '120px', threshold: 0.01 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [loading, src]);

  useEffect(() => {
    if (!shouldLoad || !src?.trim()) {
      setDisplaySrc(null);
      setFailed(false);
      return;
    }

    const normalized = normalizeUploadUrl(src.trim());
    let cancelled = false;

    setFailed(false);

    if (canUseDirectly(normalized)) {
      setDisplaySrc(normalized);
      return;
    }

    const cached = peekAuthenticatedMediaUrl(normalized);
    if (cached) {
      setDisplaySrc(cached);
      return;
    }

    if (!isFlexHubsHostedAssetUrl(normalized)) {
      setDisplaySrc(normalized);
      return;
    }

    setDisplaySrc(null);

    void resolveAuthenticatedMediaUrl(normalized)
      .then((objectUrl) => {
        if (!cancelled) {
          setDisplaySrc(objectUrl);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true);
          setDisplaySrc(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [shouldLoad, src]);

  if (failed || !displaySrc) {
    return <div ref={hostRef} className={className} aria-hidden />;
  }

  return (
    <div ref={hostRef}>
      <video
        src={displaySrc}
        className={className}
        controls={controls}
        playsInline={playsInline}
        muted={muted}
        preload={preload}
      />
    </div>
  );
}
