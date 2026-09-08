import { useEffect, useRef } from 'react';
import {
  Room,
  RoomEvent,
  Track,
  type RemoteParticipant,
  type RemoteTrack,
  type RemoteTrackPublication,
} from 'livekit-client';

type RemoteAudioPlaybackProps = {
  room: Room | null;
};

function attachRemoteAudioTrack(
  track: RemoteTrack,
  container: HTMLDivElement,
): HTMLMediaElement | null {
  if (track.kind !== Track.Kind.Audio) {
    return null;
  }

  const element = track.attach();
  element.autoplay = true;
  element.setAttribute('playsinline', 'true');

  if (element.parentElement !== container) {
    container.appendChild(element);
  }

  void element.play().catch(() => undefined);

  return element;
}

function detachRemoteAudioTrack(track: RemoteTrack): void {
  track.detach().forEach((element) => element.remove());
}

export function RemoteAudioPlayback({ room }: RemoteAudioPlaybackProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!room) {
      return;
    }

    const container = containerRef.current;

    if (!container) {
      return;
    }

    const attachExisting = (participant: RemoteParticipant) => {
      for (const publication of participant.trackPublications.values()) {
        const track = publication.track;

        if (track && publication.kind === Track.Kind.Audio) {
          attachRemoteAudioTrack(track, container);
        }
      }
    };

    const onTrackSubscribed = (
      track: RemoteTrack,
      _publication: RemoteTrackPublication,
      participant: RemoteParticipant,
    ) => {
      if (track.kind === Track.Kind.Audio) {
        attachRemoteAudioTrack(track, container);
      }

      void participant;
    };

    const onTrackUnsubscribed = (track: RemoteTrack) => {
      detachRemoteAudioTrack(track);
    };

    for (const participant of room.remoteParticipants.values()) {
      attachExisting(participant);
    }

    room.on(RoomEvent.TrackSubscribed, onTrackSubscribed);
    room.on(RoomEvent.TrackUnsubscribed, onTrackUnsubscribed);
    room.on(RoomEvent.ParticipantConnected, attachExisting);

    void room.startAudio().catch(() => undefined);

    return () => {
      room.off(RoomEvent.TrackSubscribed, onTrackSubscribed);
      room.off(RoomEvent.TrackUnsubscribed, onTrackUnsubscribed);
      room.off(RoomEvent.ParticipantConnected, attachExisting);

      for (const participant of room.remoteParticipants.values()) {
        for (const publication of participant.trackPublications.values()) {
          const track = publication.track;

          if (track && publication.kind === Track.Kind.Audio) {
            detachRemoteAudioTrack(track);
          }
        }
      }
    };
  }, [room]);

  return <div ref={containerRef} className="hidden" aria-hidden="true" />;
}
