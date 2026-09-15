import { useMemo, useRef } from 'react';
import type { LocalParticipant, RemoteParticipant, Room } from 'livekit-client';
import { Track } from 'livekit-client';
import {
  FiMic,
  FiMicOff,
  FiMonitor,
  FiPhoneOff,
  FiVideo,
  FiVideoOff,
} from 'react-icons/fi';
import type { CallSession } from '../callManager';
import { DraggableVideoPreview } from './DraggableVideoPreview';
import { ParticipantTile } from './ParticipantTile';

type MeetingRoomViewProps = {
  session: CallSession;
  room: Room | null;
  remoteParticipants: RemoteParticipant[];
  micEnabled: boolean;
  cameraEnabled: boolean;
  screenShareEnabled: boolean;
  canModerate?: boolean;
  endMeetingForAll?: boolean;
  embedded?: boolean;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onToggleScreenShare: () => void;
  onMuteParticipant?: (participantIdentity: string, muted: boolean) => void;
  onRemoveParticipant?: (participantIdentity: string) => void;
  onEnd: () => void;
};

function readParticipantLabel(participant: LocalParticipant | RemoteParticipant): string {
  return participant.name?.trim() || participant.identity || 'Participant';
}

function findScreenShareTarget(
  room: Room | null,
  remoteParticipants: RemoteParticipant[],
): { participant: LocalParticipant | RemoteParticipant; isLocal: boolean } | null {
  if (!room) {
    return null;
  }

  if (room.localParticipant.getTrackPublication(Track.Source.ScreenShare)?.track) {
    return { participant: room.localParticipant, isLocal: true };
  }

  const remote = remoteParticipants.find((participant) =>
    Boolean(participant.getTrackPublication(Track.Source.ScreenShare)?.track),
  );

  if (!remote) {
    return null;
  }

  return { participant: remote, isLocal: false };
}

function isParticipantMuted(participant: LocalParticipant | RemoteParticipant): boolean {
  const micPublication = participant.getTrackPublication(Track.Source.Microphone);
  return micPublication?.isMuted ?? true;
}

export function MeetingRoomView({
  session,
  room,
  remoteParticipants,
  micEnabled,
  cameraEnabled,
  screenShareEnabled,
  canModerate = false,
  endMeetingForAll = false,
  embedded = false,
  onToggleMic,
  onToggleCamera,
  onToggleScreenShare,
  onMuteParticipant,
  onRemoveParticipant,
  onEnd,
}: MeetingRoomViewProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);

  const screenShareTarget = useMemo(
    () => findScreenShareTarget(room, remoteParticipants),
    [remoteParticipants, room],
  );

  const spotlightLabel = screenShareTarget
    ? screenShareTarget.isLocal
      ? 'Your screen'
      : readParticipantLabel(screenShareTarget.participant)
    : null;

  const filmstripParticipants = useMemo(() => {
    const items: Array<LocalParticipant | RemoteParticipant> = [...remoteParticipants];

    if (room && !items.some((participant) => participant.identity === room.localParticipant.identity)) {
      items.unshift(room.localParticipant);
    }

    if (screenShareTarget) {
      return items.filter((participant) => participant.identity !== screenShareTarget.participant.identity);
    }

    return items;
  }, [remoteParticipants, room, screenShareTarget]);

  const gridParticipants = remoteParticipants;

  return (
    <div className={`flex flex-col bg-[#090a0d] text-white ${embedded ? 'h-full' : 'fixed inset-0 z-[120]'}`}>
      {!embedded ? (
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold">{session.peerLabel || 'Meeting'}</p>
          <p className="text-sm text-white/60">
            {session.phase === 'connecting'
              ? 'Connecting...'
              : session.isGroup
                ? `${remoteParticipants.length + 1} participants`
                : 'Connected'}
          </p>
        </div>
      </div>
      ) : null}

      <div ref={stageRef} className="relative min-h-0 flex-1 overflow-hidden p-4">
        {screenShareTarget ? (
          <div className="flex h-full flex-col gap-4">
            <ParticipantTile
              participant={screenShareTarget.participant}
              label={spotlightLabel ?? 'Screen share'}
              large
              isLocal={screenShareTarget.isLocal}
              showScreenShare
            />
            {filmstripParticipants.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
                {filmstripParticipants.map((participant) => (
                  <ParticipantTile
                    key={participant.identity}
                    participant={participant}
                    label={
                      room && participant.identity === room.localParticipant.identity
                        ? 'You'
                        : readParticipantLabel(participant)
                    }
                    isLocal={room?.localParticipant.identity === participant.identity}
                    mirrored={room?.localParticipant.identity === participant.identity}
                  />
                ))}
              </div>
            ) : null}
          </div>
        ) : gridParticipants.length > 0 ? (
          <div
            className={`grid h-full gap-4 ${
              gridParticipants.length === 1
                ? 'grid-cols-1'
                : gridParticipants.length === 2
                  ? 'grid-cols-1 md:grid-cols-2'
                  : gridParticipants.length <= 4
                    ? 'grid-cols-2'
                    : 'grid-cols-2 md:grid-cols-3 xl:grid-cols-4'
            }`}
          >
            {gridParticipants.map((participant) => (
              <div key={participant.identity} className="relative">
                <ParticipantTile
                  participant={participant}
                  label={readParticipantLabel(participant)}
                  large={gridParticipants.length === 1}
                />
                {canModerate && onMuteParticipant && onRemoveParticipant ? (
                  <div className="absolute right-2 top-2 flex gap-1">
                    <button
                      type="button"
                      className="rounded-md bg-black/60 px-2 py-1 text-[10px] font-semibold text-white hover:bg-black/80"
                      onClick={() =>
                        onMuteParticipant(participant.identity, !isParticipantMuted(participant))
                      }
                    >
                      {isParticipantMuted(participant) ? 'Unmute' : 'Mute'}
                    </button>
                    <button
                      type="button"
                      className="rounded-md bg-red-500/90 px-2 py-1 text-[10px] font-semibold text-white hover:bg-red-500"
                      onClick={() => onRemoveParticipant(participant.identity)}
                    >
                      Remove
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.03]">
            <p className="text-sm text-white/60">Waiting for others to join...</p>
          </div>
        )}

        {room && cameraEnabled ? (
          <DraggableVideoPreview containerRef={stageRef}>
            <ParticipantTile
              participant={room.localParticipant}
              label="You"
              isLocal
              mirrored
              showScreenShare={false}
            />
          </DraggableVideoPreview>
        ) : null}
      </div>

      {!embedded ? (
      <div className="flex flex-wrap items-center justify-center gap-3 border-t border-white/10 px-6 py-5">
        <button
          type="button"
          aria-label={micEnabled ? 'Mute microphone' : 'Unmute microphone'}
          className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
          onClick={onToggleMic}
        >
          {micEnabled ? <FiMic /> : <FiMicOff />}
        </button>
        <button
          type="button"
          aria-label={cameraEnabled ? 'Turn camera off' : 'Turn camera on'}
          className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
          onClick={onToggleCamera}
        >
          {cameraEnabled ? <FiVideo /> : <FiVideoOff />}
        </button>
        <button
          type="button"
          aria-label={screenShareEnabled ? 'Stop screen sharing' : 'Share screen'}
          className={`inline-flex h-12 w-12 items-center justify-center rounded-full ${
            screenShareEnabled ? 'bg-accent text-white' : 'bg-white/10 hover:bg-white/20'
          }`}
          onClick={onToggleScreenShare}
        >
          <FiMonitor />
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-full bg-red-500 px-5 py-3 text-sm font-semibold text-white hover:opacity-90"
          onClick={onEnd}
        >
          <FiPhoneOff /> {endMeetingForAll ? 'End meeting' : 'Leave'}
        </button>
      </div>
      ) : null}
    </div>
  );
}
