import { useEffect, useRef, useState } from 'react';
import { normalizeUploadUrl } from '../shared/profile';
import {
  canStreamHostedMediaInDesktop,
  isFlexHubsHostedAssetUrl,
  peekAuthenticatedMediaUrl,
  resolveAuthenticatedMediaUrl,
  resolveStreamingMediaDisplayUrl,
} from './authenticatedMedia';
import { notifyMessageListVirtuosoLayoutSync } from './chat/messageListVirtuosoSync';

type RemoteVideoProps = {
  src: string | null | undefined;
  poster?: string | null;
  className?: string;
  wrapperClassName?: string;
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
  poster = null,
  className = '',
  wrapperClassName = '',
  controls = true,
  playsInline = true,
  muted = false,
  preload = 'metadata',
  loading = 'lazy',
}: RemoteVideoProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [shouldLoad, setShouldLoad] = useState(loading === 'eager');
  const [displaySrc, setDisplaySrc] = useState<string | null>(() =>
    resolveStreamingMediaDisplayUrl(src),
  );
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(false);
  }, [src, displaySrc]);

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
        { root: null, rootMargin: '320px', threshold: 0.01 },
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
      setDisplaySrc(null);
      setFailed(false);
      return;
    }

    const normalized = normalizeUploadUrl(src.trim());
    let cancelled = false;

    setFailed(false);

    if (canUseDirectly(normalized) || !isFlexHubsHostedAssetUrl(normalized)) {
      setDisplaySrc(normalized);
      return;
    }

    if (canStreamHostedMediaInDesktop()) {
      setDisplaySrc(normalized);
      return;
    }

    const cached = peekAuthenticatedMediaUrl(normalized);
    if (cached) {
      setDisplaySrc(cached);
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

  const posterSrc = poster?.trim() ? normalizeUploadUrl(poster.trim()) : null;
  const showPoster = Boolean(posterSrc) && !ready && !failed;

  if (failed) {
    return (
      <div
        ref={hostRef}
        className={`flex min-h-[160px] items-center justify-center bg-app-chat-hover px-4 text-center text-xs text-app-muted ${wrapperClassName}`}
      >
        Unable to load video
      </div>
    );
  }

  if (!displaySrc) {
    return (
      <div ref={hostRef} className={`relative overflow-hidden ${wrapperClassName}`}>
        {showPoster ? (
          <img src={posterSrc!} alt="" className={`${className} object-cover opacity-90`} />
        ) : (
          <div className={`min-h-[160px] animate-pulse bg-app-chat-hover ${className}`} aria-hidden />
        )}
      </div>
    );
  }

  if (!ready && displaySrc) {
    return (
      <div ref={hostRef} className={`relative ${wrapperClassName}`}>
        {posterSrc ? (
          <img
            src={posterSrc}
            alt=""
            className={`pointer-events-none absolute inset-0 h-full w-full object-contain bg-black ${className}`}
          />
        ) : null}
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
          aria-hidden
        >
          <span className="h-7 w-7 animate-spin rounded-full border-2 border-white/25 border-t-white/80" />
        </div>
        <video
          src={displaySrc}
          poster={posterSrc ?? undefined}
          className={`${className} opacity-0`}
          controls={false}
          playsInline={playsInline}
          muted={muted}
          preload={preload}
          onLoadedData={() => {
            setReady(true);
            notifyMessageListVirtuosoLayoutSync();
          }}
          onCanPlay={() => setReady(true)}
          onError={() => setFailed(true)}
        />
      </div>
    );
  }

  return (
    <div ref={hostRef} className={`relative ${wrapperClassName}`}>
      <video
        src={displaySrc}
        poster={posterSrc ?? undefined}
        className={className}
        controls={controls}
        playsInline={playsInline}
        muted={muted}
        preload={preload}
        onLoadedData={() => {
          setReady(true);
          notifyMessageListVirtuosoLayoutSync();
        }}
        onCanPlay={() => setReady(true)}
        onError={() => setFailed(true)}
      />
    </div>
  );
}
