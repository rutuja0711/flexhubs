import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { isAppInBackground, subscribeAppFocus } from '../appFocus';
import { createPortal } from 'react-dom';
import { Track } from 'livekit-client';
import { FiX } from 'react-icons/fi';
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
  const appInBackground = useSyncExternalStore(subscribeAppFocus, isAppInBackground, () => false);
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

  const suppressIncomingRingUi =
    appInBackground &&
    !session.isInitiator &&
    (session.phase === 'incoming' || session.phase === 'connecting');

  const showRingingUi = showRinging && !suppressIncomingRingUi;

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
    if (session.phase === 'idle' || session.phase === 'ending') {
      setCallWindowPresentation(false, 'idle');
      return;
    }

    if (suppressIncomingRingUi) {
      setCallWindowPresentation(false, 'idle');
      return;
    }

    const mode = showRinging ? 'ringing' : panelLayout;
    setCallWindowPresentation(callWindowActive, callWindowActive ? mode : 'idle');

    if (session.phase === 'outgoing' || (session.phase === 'incoming' && !appInBackground)) {
      focusCallWindow();
    }
  }, [
    appInBackground,
    callWindowActive,
    panelLayout,
    session.phase,
    showRinging,
    suppressIncomingRingUi,
  ]);

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

    return createPortal(
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[200] flex justify-center px-3 pb-2 pt-[max(0.75rem,env(safe-area-inset-top,0px))] sm:px-4 sm:pb-3 sm:pt-[max(1rem,env(safe-area-inset-top,0px))]">
        <div className="pointer-events-auto flex w-full max-w-xl items-center gap-2 rounded-2xl border border-app-border bg-app-elevated px-3 py-2.5 shadow-app sm:gap-3 sm:px-4 sm:py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-app-text">
              {meeting.startedBy.username} started a {meeting.video ? 'video' : 'voice'} meeting
            </p>
            <p className="truncate text-xs text-app-muted">{meeting.conversationTitle}</p>
          </div>
          <button
            type="button"
            className="shrink-0 rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-white hover:opacity-90"
            onClick={onJoinMeeting}
          >
            Join
          </button>
          <button
            type="button"
            aria-label="Dismiss meeting banner"
            className="shrink-0 rounded-lg p-2 text-app-muted hover:bg-app-chat-hover hover:text-app-text"
            onClick={onDismissMeetingBanner}
          >
            <FiX />
          </button>
        </div>
      </div>,
      document.body,
    );
  }

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

  if (!showActivePanel) {
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
