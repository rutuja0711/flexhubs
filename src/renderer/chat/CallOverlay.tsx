import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { isAppInBackground, subscribeAppFocus } from '../appFocus';
import { createPortal } from 'react-dom';
import { Track } from 'livekit-client';
import type { RemoteParticipant, Room } from 'livekit-client';
import type { CallSession } from '../callManager';
import { isMeetingModerator } from '../../shared/calls';
import { CallFloatingPanel, type CallPanelLayout } from '../call/CallFloatingPanel';
import { MediasoupMediaPlayback } from '../call/MediasoupMediaPlayback';
import type { MediasoupRemotePeer } from '../call/mediasoupAdapter';
import { RemoteAudioPlayback } from '../call/RemoteAudioPlayback';
import { CallRingingView } from '../call/CallRingingView';
import { MeetingJoinRequestsBar } from '../call/MeetingJoinRequestsBar';
import { MeetingRoomView } from '../call/MeetingRoomView';
import { VideoCallView } from '../call/VideoCallView';
import { VoiceCallView } from '../call/VoiceCallView';
import { startIncomingCallRing, startOutgoingCallRing, stopCallRing } from '../call/callRingtone';
import { ScreenSharePicker } from '../call/ScreenSharePicker';
import { useCallDuration } from '../call/useCallDuration';
import { focusCallWindow, setCallWindowPresentation } from '../callWindowApi';
import type { ScreenCaptureSource } from '../../shared/screenShare';

type CallOverlayProps = {
  session: CallSession;
  busy: boolean;
  callNotice?: string;
  room: Room | null;
  remoteParticipants: RemoteParticipant[];
  mediasoupPeers?: MediasoupRemotePeer[];
  mediasoupLocalVideo?: MediaStream | null;
  micEnabled: boolean;
  cameraEnabled: boolean;
  screenShareEnabled: boolean;
  screenSharePickerOpen: boolean;
  onCloseScreenSharePicker: () => void;
  onShareScreenSource: (source: ScreenCaptureSource) => void;
  pendingJoinRequests: import('../../shared/calls').MeetingJoinRequestItem[];
  awaitingJoinApproval: boolean;
  onAccept: () => void;
  onReject: () => void;
  onCancel: () => void;
  onEnd: () => void;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onToggleScreenShare: () => void;
  onApproveJoinRequest: (requestId: string) => void;
  onDenyJoinRequest: (requestId: string) => void;
  onMuteParticipant: (participantIdentity: string, muted: boolean) => void;
  onRemoveParticipant: (participantIdentity: string) => void;
  panelLayout: CallPanelLayout;
  onPanelLayoutChange: (layout: CallPanelLayout) => void;
};

function remoteHasVideo(participants: RemoteParticipant[]): boolean {
  return participants.some((participant) =>
    Boolean(participant.getTrackPublication(Track.Source.Camera)?.track),
  );
}

export function CallOverlay({
  session,
  busy,
  callNotice = '',
  room,
  remoteParticipants,
  mediasoupPeers = [],
  mediasoupLocalVideo = null,
  micEnabled,
  cameraEnabled,
  screenShareEnabled,
  screenSharePickerOpen,
  onCloseScreenSharePicker,
  onShareScreenSource,
  pendingJoinRequests,
  awaitingJoinApproval,
  onAccept,
  onReject,
  onCancel,
  onEnd,
  onToggleMic,
  onToggleCamera,
  onToggleScreenShare,
  onApproveJoinRequest,
  onDenyJoinRequest,
  onMuteParticipant,
  onRemoveParticipant,
  panelLayout,
  onPanelLayoutChange,
}: CallOverlayProps) {
  const appInBackground = useSyncExternalStore(subscribeAppFocus, isAppInBackground, () => false);

  const updatePanelLayout = useCallback(
    (layout: CallPanelLayout) => {
      onPanelLayoutChange(layout);

      if (session.phase === 'active' || session.phase === 'connecting') {
        setCallWindowPresentation(true, layout);
      }
    },
    [onPanelLayoutChange, session.phase],
  );

  const callWindowActive =
    session.phase === 'incoming' ||
    session.phase === 'outgoing' ||
    session.phase === 'connecting' ||
    session.phase === 'active';

  const suppressIncomingRingUi =
    appInBackground &&
    !session.isInitiator &&
    session.phase === 'incoming';

  const showRingingUi =
    session.phase === 'incoming' || session.phase === 'outgoing';

  const showInCallPanel = session.phase === 'active';
  const showConnectingUi = session.phase === 'connecting';

  const isLive = session.phase === 'active';
  const durationLabel = useCallDuration(session.connectedAt, isLive);
  const showCameraControls = session.video;
  const showScreenShareControls = session.video;

  const usesMediasoup = session.liveToken?.engine === 'mediasoup';

  const showVideoLayout = useMemo(() => {
    if (session.isGroup) {
      return true;
    }

    return (
      session.video ||
      cameraEnabled ||
      screenShareEnabled ||
      remoteHasVideo(remoteParticipants) ||
      Boolean(mediasoupLocalVideo) ||
      mediasoupPeers.some((peer) => peer.videoStream)
    );
  }, [
    cameraEnabled,
    mediasoupLocalVideo,
    mediasoupPeers,
    remoteParticipants,
    screenShareEnabled,
    session.isGroup,
    session.video,
  ]);

  const statusLabel =
    session.phase === 'connecting'
      ? 'Connecting...'
      : session.isGroup
        ? `${(usesMediasoup ? mediasoupPeers.length : remoteParticipants.length) + 1} in meeting`
        : isLive
          ? 'Connected'
          : 'In call';

  useEffect(() => {
    if (session.phase === 'idle' || session.phase === 'ending') {
      setCallWindowPresentation(false, 'idle');
      return;
    }

    if (suppressIncomingRingUi) {
      setCallWindowPresentation(false, 'idle');
      return;
    }

    const mode = showRingingUi ? 'ringing' : panelLayout;
    setCallWindowPresentation(callWindowActive, callWindowActive ? mode : 'idle');

    if (session.phase === 'incoming' && !appInBackground) {
      focusCallWindow();
    }
  }, [callWindowActive, panelLayout, session.phase, showRingingUi, suppressIncomingRingUi]);

  useEffect(() => {
    return () => {
      setCallWindowPresentation(false, 'idle');
    };
  }, []);

  useEffect(() => {
    if (session.phase === 'incoming') {
      startIncomingCallRing();
      return () => stopCallRing();
    }

    if (session.phase === 'outgoing') {
      startOutgoingCallRing();
      return () => stopCallRing();
    }

    stopCallRing();
    return undefined;
  }, [session.phase]);

  if (session.phase === 'idle') {
    return null;
  }

  if (showRingingUi) {
    return createPortal(
      <>
        {usesMediasoup ? (
          <MediasoupMediaPlayback
            localVideoStream={mediasoupLocalVideo}
            remotePeers={mediasoupPeers}
          />
        ) : room ? (
          <RemoteAudioPlayback room={room} />
        ) : null}
        <CallRingingView
          session={session}
          busy={busy}
          notice={callNotice}
          onAccept={onAccept}
          onReject={onReject}
          onCancel={onCancel}
        />
      </>,
      document.body,
    );
  }

  if (showConnectingUi) {
    return createPortal(
      <>
        {usesMediasoup ? (
          <MediasoupMediaPlayback
            localVideoStream={mediasoupLocalVideo}
            remotePeers={mediasoupPeers}
          />
        ) : room ? (
          <RemoteAudioPlayback room={room} />
        ) : null}
        <CallRingingView
          session={session}
          busy={busy}
          notice={callNotice || 'Connecting...'}
          onAccept={onAccept}
          onReject={onReject}
          onCancel={onCancel}
        />
      </>,
      document.body,
    );
  }

  if (!showInCallPanel) {
    return null;
  }

  const canModerate = isMeetingModerator(session);

  const panelContent = session.isGroup ? (
    <>
      <MeetingJoinRequestsBar
        requests={pendingJoinRequests}
        awaitingApproval={awaitingJoinApproval}
        canModerate={canModerate}
        busy={busy}
        onApprove={onApproveJoinRequest}
        onDeny={onDenyJoinRequest}
      />
      {usesMediasoup ? (
        showVideoLayout ? (
          <div className="relative flex h-full min-h-[280px] flex-col bg-[#0b0c10]">
            <div className="border-b border-white/10 px-4 py-3">
              <p className="truncate text-sm font-semibold text-white">
                {session.peerLabel || 'Meeting'}
              </p>
              <p className="text-xs text-white/55">{statusLabel}</p>
            </div>
            {canModerate && mediasoupPeers.length > 0 ? (
              <div className="border-b border-white/10 px-4 py-2">
                <div className="flex flex-wrap gap-2">
                  {mediasoupPeers.map((peer) => (
                    <div
                      key={peer.id}
                      className="flex items-center gap-2 rounded-lg bg-white/5 px-2 py-1 text-xs text-white"
                    >
                      <span className="max-w-[120px] truncate">{peer.label || peer.id}</span>
                      <button
                        type="button"
                        className="rounded bg-white/10 px-2 py-0.5 hover:bg-white/20"
                        onClick={() => onMuteParticipant(peer.id, true)}
                      >
                        Mute
                      </button>
                      <button
                        type="button"
                        className="rounded bg-red-500/90 px-2 py-0.5 hover:bg-red-500"
                        onClick={() => onRemoveParticipant(peer.id)}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="relative min-h-0 flex-1">
              <MediasoupMediaPlayback
                localVideoStream={mediasoupLocalVideo}
                remotePeers={mediasoupPeers}
              />
            </div>
          </div>
        ) : (
          <VoiceCallView
            session={session}
            durationLabel={durationLabel}
            micEnabled={micEnabled}
            statusLabel={statusLabel}
          />
        )
      ) : (
        <MeetingRoomView
          session={session}
          room={room}
          remoteParticipants={remoteParticipants}
          micEnabled={micEnabled}
          cameraEnabled={cameraEnabled}
          screenShareEnabled={screenShareEnabled}
          canModerate={canModerate}
          embedded
          endMeetingForAll={canModerate}
          onToggleMic={onToggleMic}
          onToggleCamera={onToggleCamera}
          onToggleScreenShare={onToggleScreenShare}
          onMuteParticipant={onMuteParticipant}
          onRemoveParticipant={onRemoveParticipant}
          onEnd={onEnd}
        />
      )}
    </>
  ) : showVideoLayout && usesMediasoup ? (
    <div className="relative flex h-full min-h-[280px] flex-col bg-[#0b0c10]">
      <div className="border-b border-white/10 px-4 py-3">
        <p className="truncate text-sm font-semibold text-white">{session.peerLabel || 'Call'}</p>
        <p className="text-xs text-white/55">{statusLabel}</p>
      </div>
      <div className="relative min-h-0 flex-1">
        <MediasoupMediaPlayback
          localVideoStream={mediasoupLocalVideo}
          remotePeers={mediasoupPeers}
        />
      </div>
    </div>
  ) : showVideoLayout ? (
    <VideoCallView
      session={session}
      room={room}
      remoteParticipants={remoteParticipants}
      cameraEnabled={cameraEnabled}
      statusLabel={statusLabel}
    />
  ) : (
    <VoiceCallView
      session={session}
      durationLabel={durationLabel}
      micEnabled={micEnabled}
      statusLabel={statusLabel}
    />
  );

  return createPortal(
    <>
      {usesMediasoup ? (
        <MediasoupMediaPlayback
          localVideoStream={mediasoupLocalVideo}
          remotePeers={mediasoupPeers}
        />
      ) : (
        <RemoteAudioPlayback room={room} />
      )}
      <CallFloatingPanel
      session={session}
      layout={panelLayout}
      durationLabel={durationLabel}
      statusLabel={statusLabel}
      micEnabled={micEnabled}
      cameraEnabled={cameraEnabled}
      screenShareEnabled={screenShareEnabled}
      showVideoControls={showVideoLayout}
      showCamera={showCameraControls}
      showScreenShare={showScreenShareControls}
      onLayoutChange={updatePanelLayout}
      onToggleMic={onToggleMic}
      onToggleCamera={onToggleCamera}
      onToggleScreenShare={onToggleScreenShare}
      onEnd={onEnd}
    >
      {panelContent}
    </CallFloatingPanel>
      <ScreenSharePicker
        open={screenSharePickerOpen}
        onClose={onCloseScreenSharePicker}
        onShare={onShareScreenSource}
      />
    </>,
    document.body,
  );
}
