import { useEffect, useState } from 'react';
import { RemoteImage } from '../RemoteImage';
import { DefaultProfileBanner } from './DefaultProfileBanner';

type ProfileCoverImageProps = {
  bannerUrl?: string | null;
  /** Local blob preview shown until `bannerUrl` finishes loading. */
  placeholderUrl?: string | null;
  className?: string;
  roundedTop?: boolean;
  alt?: string;
  onPrimaryLoaded?: () => void;
};

export function ProfileCoverImage({
  bannerUrl,
  placeholderUrl,
  className = '',
  roundedTop = true,
  alt = '',
  onPrimaryLoaded,
}: ProfileCoverImageProps) {
  const [primaryReady, setPrimaryReady] = useState(false);
  const [primaryFailed, setPrimaryFailed] = useState(false);
  const [placeholderReady, setPlaceholderReady] = useState(false);
  const [useDirectPrimary, setUseDirectPrimary] = useState(false);

  const primaryUrl = bannerUrl?.trim() || null;
  const holdUrl = placeholderUrl?.trim() || null;
  const showRemotePrimary = Boolean(primaryUrl) && !primaryFailed && !useDirectPrimary;
  const showDirectPrimary = Boolean(primaryUrl) && !primaryFailed && useDirectPrimary;
  const showPlaceholder = Boolean(holdUrl) && (!primaryReady || primaryFailed);

  useEffect(() => {
    setPrimaryReady(false);
    setPrimaryFailed(false);
    setUseDirectPrimary(false);
  }, [primaryUrl]);

  useEffect(() => {
    setPlaceholderReady(false);
  }, [holdUrl]);

  useEffect(() => {
    if (primaryReady && primaryUrl && !primaryFailed) {
      onPrimaryLoaded?.();
    }
  }, [onPrimaryLoaded, primaryFailed, primaryReady, primaryUrl]);

  if ((!primaryUrl && !holdUrl) || (primaryFailed && !holdUrl)) {
    return <DefaultProfileBanner className={className} roundedTop={roundedTop} />;
  }

  const overlayVisible =
    ((showRemotePrimary || showDirectPrimary) && primaryReady) || (showPlaceholder && placeholderReady);

  return (
    <div
      className={`relative h-full w-full overflow-hidden ${roundedTop ? 'rounded-t-2xl' : ''} ${className}`.trim()}
    >
      <DefaultProfileBanner className="pointer-events-none absolute inset-0 h-full w-full" roundedTop={false} />
      {showPlaceholder ? (
        <img
          src={holdUrl!}
          alt=""
          aria-hidden
          className={`absolute inset-0 z-[2] h-full w-full object-cover transition-opacity duration-300 ${
            primaryReady ? 'opacity-0' : placeholderReady ? 'opacity-100' : 'opacity-0'
          }`}
          onLoad={() => setPlaceholderReady(true)}
        />
      ) : null}
      {showRemotePrimary ? (
        <RemoteImage
          src={primaryUrl}
          alt={alt}
          wrapperClassName="absolute inset-0 z-[1] block h-full w-full"
          className={`h-full w-full object-cover transition-opacity duration-300 ${primaryReady ? 'opacity-100' : 'opacity-0'}`}
          loading="eager"
          onError={() => setUseDirectPrimary(true)}
          onLoad={() => setPrimaryReady(true)}
        />
      ) : null}
      {showDirectPrimary ? (
        <img
          src={primaryUrl!}
          alt={alt}
          className={`absolute inset-0 z-[1] h-full w-full object-cover transition-opacity duration-300 ${primaryReady ? 'opacity-100' : 'opacity-0'}`}
          onError={() => setPrimaryFailed(true)}
          onLoad={() => setPrimaryReady(true)}
        />
      ) : null}
      {overlayVisible ? (
        <div className="pointer-events-none absolute inset-0 z-[3] bg-gradient-to-t from-black/40 via-black/5 to-transparent" />
      ) : null}
    </div>
  );
}