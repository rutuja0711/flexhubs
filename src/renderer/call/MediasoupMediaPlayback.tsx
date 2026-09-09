import { useEffect, useRef } from 'react';
import type { MediasoupRemotePeer } from './mediasoupAdapter';

type MediasoupMediaPlaybackProps = {
  localVideoStream: MediaStream | null;
  remotePeers: MediasoupRemotePeer[];
};

export function MediasoupMediaPlayback({
  localVideoStream,
  remotePeers,
}: MediasoupMediaPlaybackProps) {
  const audioContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = audioContainerRef.current;

    if (!container) {
      return;
    }

    container.replaceChildren();

    for (const peer of remotePeers) {
      const stream = peer.audioStream;

      if (!stream) {
        continue;
      }

      const element = document.createElement('audio');
      element.autoplay = true;
      element.setAttribute('playsinline', 'true');
      element.srcObject = stream;
      container.appendChild(element);
      void element.play().catch(() => undefined);
    }
  }, [remotePeers]);

  const primaryRemoteVideo = remotePeers.find((peer) => peer.videoStream)?.videoStream ?? null;
  const previewStream = primaryRemoteVideo ?? localVideoStream;

  if (!previewStream) {
    return <div ref={audioContainerRef} className="hidden" aria-hidden="true" />;
  }

  return (
    <>
      <div ref={audioContainerRef} className="hidden" aria-hidden="true" />
      <video
        autoPlay
        playsInline
        muted={previewStream === localVideoStream}
        className="absolute inset-0 h-full w-full object-cover"
        ref={(element) => {
          if (element && element.srcObject !== previewStream) {
            element.srcObject = previewStream;
            void element.play().catch(() => undefined);
          }
        }}
      />
    </>
  );
}
