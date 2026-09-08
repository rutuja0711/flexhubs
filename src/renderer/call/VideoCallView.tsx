import { useMemo, useRef } from 'react';
import type { LocalParticipant, RemoteParticipant, Room } from 'livekit-client';
import { Track } from 'livekit-client';
import type { CallSession } from '../callManager';
import { ParticipantTile } from './ParticipantTile';

type VideoCallViewProps = {
  session: CallSession;
  room: Room | null;
  remoteParticipants: RemoteParticipant[];
  cameraEnabled: boolean;
  statusLabel: string;
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

export function VideoCallView({
  session,
  room,
  remoteParticipants,
  cameraEnabled,
  statusLabel,
}: VideoCallViewProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);

  const screenShareTarget = useMemo(
    () => findScreenShareTarget(room, remoteParticipants),
    [remoteParticipants, room],
  );

  const primaryRemote = remoteParticipants[0] ?? null;
  const title = session.peerLabel || 'Video call';
  const initial = title.slice(0, 1).toUpperCase() || '?';

  return (
    <div ref={stageRef} className="relative flex h-full min-h-[280px] flex-col bg-[#0b0c10]">
      <div className="border-b border-white/10 px-4 py-3">
        <p className="truncate text-sm font-semibold text-white">{title}</p>
        <p className="text-xs text-white/55">{statusLabel}</p>
      </div>

      <div className="relative min-h-0 flex-1 p-3">
        {screenShareTarget ? (
          <ParticipantTile
            participant={screenShareTarget.participant}
            label={screenShareTarget.isLocal ? 'Your screen' : readParticipantLabel(screenShareTarget.participant)}
            large
            isLocal={screenShareTarget.isLocal}
            showScreenShare
          />
        ) : primaryRemote ? (
          <ParticipantTile
            participant={primaryRemote}
            label={readParticipantLabel(primaryRemote)}
            large
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-4 rounded-2xl bg-gradient-to-b from-[#17181d] to-[#101114]">
            {session.peerAvatar ? (
              <img
                src={session.peerAvatar}
                alt=""
                className="h-24 w-24 rounded-full border-2 border-white/10 object-cover"
              />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-accent/20 text-3xl font-semibold text-white">
                {initial}
              </div>
            )}
            <p className="text-sm text-white/60">Waiting for video...</p>
          </div>
        )}

        {room && cameraEnabled ? (
          <div className="absolute bottom-5 right-5 w-28 overflow-hidden rounded-xl border border-white/15 shadow-[0_12px_40px_rgba(0,0,0,0.45)] sm:w-32">
            <ParticipantTile
              participant={room.localParticipant}
              label="You"
              isLocal
              mirrored
              showScreenShare={false}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
