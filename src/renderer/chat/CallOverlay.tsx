import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Track } from 'livekit-client';
import { FiX } from 'react-icons/fi';
import type { RemoteParticipant, Room } from 'livekit-client';
import type { CallSession } from '../callManager';
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
import { useCallDuration } from '../call/useCallDuration';
import { focusCallWindow, setCallWindowPresentation } from '../callWindowApi';

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
  pendingJoinRequests: import('../../shared/calls').MeetingJoinRequestItem[];
  awaitingJoinApproval: boolean;
  onAccept: () => void;
  onReject: () => void;
  onCancel: () => void;
  onEnd: () => void;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onToggleScreenShare: () => void;
  onJoinMeeting: () => void;
  onDismissMeetingBanner: () => void;
  onApproveJoinRequest: (requestId: string) => void;
  onDenyJoinRequest: (requestId: string) => void;
  onMuteParticipant: (participantIdentity: string, muted: boolean) => void;
  onRemoveParticipant: (participantIdentity: string) => void;
  onPanelLayoutChange?: (layout: CallPanelLayout) => void;
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
  pendingJoinRequests,
  awaitingJoinApproval,
  onAccept,
  onReject,
  onCancel,
  onEnd,
  onToggleMic,
  onToggleCamera,
  onToggleScreenShare,
  onJoinMeeting,
  onDismissMeetingBanner,
  onApproveJoinRequest,
  onDenyJoinRequest,
  onMuteParticipant,
  onRemoveParticipant,
  onPanelLayoutChange,
}: CallOverlayProps) {
  const [panelLayout, setPanelLayout] = useState<CallPanelLayout>('floating');

  const updatePanelLayout = (layout: CallPanelLayout) => {
    setPanelLayout(layout);
    onPanelLayoutChange?.(layout);
  };

  useEffect(() => {
    updatePanelLayout('floating');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset layout when call id changes
  }, [session.callId]);

  const callWindowActive =
    session.phase === 'incoming' ||
    session.phase === 'outgoing' ||
    session.phase === 'connecting' ||
    session.phase === 'active';

  const showRinging =
    session.phase === 'incoming' ||
    session.phase === 'outgoing' ||
    session.phase === 'connecting';

  const showActivePanel = session.phase === 'active';

  const isLive = session.phase === 'active';
  const durationLabel = useCallDuration(session.connectedAt, isLive);

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
    const mode = showRinging ? 'ringing' : panelLayout;
    setCallWindowPresentation(callWindowActive, callWindowActive ? mode : 'idle');

    if (session.phase === 'incoming' || session.phase === 'outgoing') {
      focusCallWindow();
    }
  }, [callWindowActive, panelLayout, session.phase, showRinging]);

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

  if (session.phase === 'idle' && session.meetingBanner) {
    const meeting = session.meetingBanner;

    return (
      <div className="pointer-events-none absolute inset-x-0 top-0 z-40 flex justify-center p-4">
        <div className="pointer-events-auto flex w-full max-w-xl items-center gap-3 rounded-2xl border border-app-border bg-app-elevated px-4 py-3 shadow-app">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-app-text">
              {meeting.startedBy.username} started a {meeting.video ? 'video' : 'voice'} meeting
            </p>
            <p className="truncate text-xs text-app-muted">{meeting.conversationTitle}</p>
          </div>
          <button
            type="button"
            className="rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-white hover:opacity-90"
            onClick={onJoinMeeting}
          >
            Join
          </button>
          <button
            type="button"
            aria-label="Dismiss meeting banner"
            className="rounded-lg p-2 text-app-muted hover:bg-app-chat-hover hover:text-app-text"
            onClick={onDismissMeetingBanner}
          >
            <FiX />
          </button>
        </div>
      </div>
    );
  }

  if (session.phase === 'idle') {
    return null;
  }

  if (showRinging) {
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

  if (!showActivePanel) {
    return null;
  }

  const panelContent = session.isGroup ? (
    <>
      <MeetingJoinRequestsBar
        requests={pendingJoinRequests}
        awaitingApproval={awaitingJoinApproval}
        canModerate={session.isInitiator}
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
          canModerate={session.isInitiator}
          embedded
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
      onLayoutChange={updatePanelLayout}
      pipMode={panelLayout === 'minimized'}
      onToggleMic={onToggleMic}
      onToggleCamera={onToggleCamera}
      onToggleScreenShare={onToggleScreenShare}
      onEnd={onEnd}
    >
      {panelContent}
    </CallFloatingPanel>
    </>,
    document.body,
  );
}
