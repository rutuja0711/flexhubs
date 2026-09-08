import { useEffect, useRef } from 'react';
import type { LocalParticipant, RemoteParticipant, VideoTrack } from 'livekit-client';
import { Track } from 'livekit-client';
import { FiMic, FiMicOff, FiMonitor } from 'react-icons/fi';

type ParticipantTileProps = {
  participant: LocalParticipant | RemoteParticipant;
  label: string;
  mirrored?: boolean;
  large?: boolean;
  isLocal?: boolean;
  showScreenShare?: boolean;
};

function readVideoTrack(
  participant: LocalParticipant | RemoteParticipant,
  source: Track.Source,
): VideoTrack | null {
  const publication = participant.getTrackPublication(source);
  return publication?.videoTrack ?? null;
}

function isMuted(participant: LocalParticipant | RemoteParticipant): boolean {
  const micPublication = participant.getTrackPublication(Track.Source.Microphone);
  return micPublication?.isMuted ?? true;
}

export function ParticipantTile({
  participant,
  label,
  mirrored = false,
  large = false,
  isLocal = false,
  showScreenShare = true,
}: ParticipantTileProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const screenTrack = showScreenShare ? readVideoTrack(participant, Track.Source.ScreenShare) : null;
  const cameraTrack = readVideoTrack(participant, Track.Source.Camera);
  const track = screenTrack ?? cameraTrack;
  const muted = isMuted(participant);

  useEffect(() => {
    const element = videoRef.current;

    if (!element || !track) {
      return;
    }

    track.attach(element);

    return () => {
      track.detach(element);
    };
  }, [track]);

  const initials = label.trim().slice(0, 1).toUpperCase() || '?';

  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-[#101114] ${
        large ? 'min-h-[320px] h-full w-full' : 'aspect-video w-full min-h-[160px]'
      }`}
    >
      {track ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal || mirrored}
          className={`h-full w-full object-cover ${mirrored && !screenTrack ? 'scale-x-[-1]' : ''}`}
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-gradient-to-b from-[#17181d] to-[#0d0e12]">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-accent/20 text-3xl font-semibold text-accent-soft">
            {initials}
          </div>
          <p className="text-sm text-app-muted">{label}</p>
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/75 to-transparent px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-white">
            {isLocal ? 'You' : label}
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-white/90">
          {screenTrack ? <FiMonitor aria-label="Sharing screen" /> : null}
          {muted ? <FiMicOff aria-label="Muted" /> : <FiMic aria-label="Unmuted" />}
        </div>
      </div>
    </div>
  );
}
