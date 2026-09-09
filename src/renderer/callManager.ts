import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ConnectionState,
  DisconnectReason,
  Room,
  RoomEvent,
  Track,
  type RemoteParticipant,
  type RemoteTrackPublication,
} from 'livekit-client';
import type { ConversationItem } from '../shared/chat';
import type {
  CallInvitePayload,
  CallLogOutcome,
  CallTokenResult,
  MeetingJoinRequestItem,
  MeetingJoinRequestPayload,
  MeetingJoinResponsePayload,
  MeetingStartedPayload,
} from '../shared/calls';
import { buildDirectCallRoomName, normalizeMeetingJoinRequestPayload } from '../shared/calls';
import { MediasoupCallSession, type MediasoupRemotePeer } from './call/mediasoupAdapter';
import {
  endCallMeeting,
  ensureCallMediaPermissions,
  ensureScreenCapturePermission,
  listMeetingJoinRequests,
  loadCallToken,
  loadRealtimeConfig,
  logCall,
  muteCallParticipant,
  notifyCallMeeting,
  removeCallParticipant,
  requestMeetingJoinCall,
  respondMeetingJoinRequestCall,
} from './callsApi';
import { focusCallWindow } from './callWindowApi';
import { logCallDebug } from './callDebug';
import { showGroupMeetingDesktopNotification, showIncomingCallDesktopNotification } from './desktopNotifications';
import {
  broadcastCallEvent,
  disconnectCallSignaling,
  disconnectUserCallChannel,
  getHubCallChannelName,
  getUserCallChannelName,
  initCallSignaling,
  isCallSignalingReady,
  isUserCallChannelSubscribed,
  refreshCallSignalingAuth,
  sendSignalWithRetries,
  syncHubCallChannels,
  subscribeUserCallChannel,
} from './callSignaling';
import { getUserDisplayName } from '../shared/user';

export type CallPhase = 'idle' | 'outgoing' | 'incoming' | 'connecting' | 'active' | 'ending';

export type CallSession = {
  phase: CallPhase;
  callId: string;
  conversationId: string;
  roomName: string;
  video: boolean;
  isGroup: boolean;
  isInitiator: boolean;
  peerUserId: string | null;
  peerLabel: string;
  peerAvatar: string | null;
  liveToken: CallTokenResult | null;
  connectedAt: number | null;
  meetingBanner: MeetingStartedPayload | null;
};

const INITIAL_SESSION: CallSession = {
  phase: 'idle',
  callId: '',
  conversationId: '',
  roomName: '',
  video: false,
  isGroup: false,
  isInitiator: false,
  peerUserId: null,
  peerLabel: '',
  peerAvatar: null,
  liveToken: null,
  connectedAt: null,
  meetingBanner: null,
};

type UseCallManagerOptions = {
  currentUserId: string | null;
  currentUserLabel: string;
  currentUserAvatar: string | null;
  hubConversationIds: string[];
  onCallLogged?: () => void;
  onError?: (message: string) => void;
};

const CALL_SIGNALING_REFRESH_MS = 50 * 60 * 1000;
const CALL_SIGNALING_HEALTH_MS = 30 * 1000;
const MEETING_JOIN_POLL_MS = 15 * 1000;
const OUTGOING_RING_MS = 90_000;
const INCOMING_RING_MS = 90_000;
const SIGNAL_REPEAT_MS = 1_000;

function createCallId(): string {
  return crypto.randomUUID();
}

function shouldUseMeetingJoinRequest(error: string, status?: number): boolean {
  const normalized = error.toLowerCase();

  return (
    status === 403 ||
    normalized.includes('join request') ||
    normalized.includes('removed') ||
    normalized.includes('not allowed') ||
    normalized.includes('denied') ||
    normalized.includes('rejoin')
  );
}

function formatCallApiError(error: string, status?: number): string {
  const normalized = error.toLowerCase();

  if (status === 502 || status === 503 || status === 504) {
    return 'flexhubs.in is temporarily unavailable. Wait a few minutes and try again — this is a server outage, not a desktop app issue.';
  }

  if (status === 0 || normalized.includes('unreachable') || normalized.includes('network')) {
    return 'Could not reach flexhubs.in. Check your internet connection and try again.';
  }

  if (
    normalized.includes('livekit') ||
    normalized.includes('mediasoup') ||
    normalized.includes('media server') ||
    normalized.includes('not configured')
  ) {
    return 'Calls are not enabled on flexhubs.in yet. Your backend team must configure the call media server on production (same as the web app). This is not fixed in the desktop app or .env.';
  }

  if (normalized.includes('failed to subscribe') || normalized.includes('signaling channel unavailable')) {
    return 'Call signaling could not connect. Confirm VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env match the web app, then fully restart the desktop app.';
  }

  return error;
}

function formatCallMediaError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? 'Unknown error');
  const normalized = message.toLowerCase();

  if (
    normalized.includes('notallowed') ||
    normalized.includes('permission denied') ||
    normalized.includes('permission-denied')
  ) {
    return 'Microphone or camera access was denied. Allow FlexHubs in System Settings → Privacy & Security, then try the call again.';
  }

  if (normalized.includes('notfound') || normalized.includes('devicesnotfound')) {
    return 'No microphone was found. Connect a mic or check your audio input device.';
  }

  if (normalized.includes('notreadable') || normalized.includes('track started')) {
    return 'Your microphone or camera is in use by another app. Close other apps using it and try again.';
  }

  return message;
}

export function useCallManager({
  currentUserId,
  currentUserLabel,
  currentUserAvatar,
  hubConversationIds,
  onCallLogged,
  onError,
}: UseCallManagerOptions) {
  const [session, setSession] = useState<CallSession>(INITIAL_SESSION);
  const [remoteParticipants, setRemoteParticipants] = useState<RemoteParticipant[]>([]);
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [screenShareEnabled, setScreenShareEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pendingJoinRequests, setPendingJoinRequests] = useState<MeetingJoinRequestItem[]>([]);
  const [awaitingJoinApproval, setAwaitingJoinApproval] = useState(false);
  const [mediasoupPeers, setMediasoupPeers] = useState<MediasoupRemotePeer[]>([]);
  const [mediasoupLocalVideo, setMediasoupLocalVideo] = useState<MediaStream | null>(null);

  const sessionRef = useRef(session);
  const roomRef = useRef<Room | null>(null);
  const mediasoupRef = useRef<MediasoupCallSession | null>(null);
  const removedFromMeetingRef = useRef(false);
  const pendingJoinConversationRef = useRef<ConversationItem | null>(null);
  const initiatorIdRef = useRef<string | null>(null);
  const ringTimeoutRef = useRef<number | null>(null);
  const inviteIntervalRef = useRef<number | null>(null);
  const acceptIntervalRef = useRef<number | null>(null);
  const incomingTimeoutRef = useRef<number | null>(null);
  const seenCallIdsRef = useRef<Set<string>>(new Set());
  const signalingErrorShownRef = useRef(false);
  const directHandlersRef = useRef<{
    onInvite: (payload: CallInvitePayload) => void;
    onAccept: (payload: { callId: string; conversationId: string; accepterId: string }) => void;
    onReject: (payload: { callId: string; conversationId: string }) => void;
    onCancel: (payload: { callId: string; conversationId: string }) => void;
    onEnd: (payload: { callId: string; conversationId: string }) => void;
  } | null>(null);
  const hubHandlersRef = useRef<{
    onMeetingStarted: (payload: MeetingStartedPayload) => void;
    onMeetingEnded: (payload: { callId: string; conversationId: string }) => void;
    onMeetingJoinRequest: (payload: MeetingJoinRequestPayload) => void;
    onMeetingJoinResponse: (payload: MeetingJoinResponsePayload) => void;
  } | null>(null);
  const reportErrorRef = useRef<(message: string) => void>(() => {});
  const hubConversationIdsRef = useRef(hubConversationIds);

  hubConversationIdsRef.current = hubConversationIds;

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const reportError = useCallback(
    (message: string) => {
      onError?.(message);
    },
    [onError],
  );

  reportErrorRef.current = reportError;

  const clearRingTimeout = useCallback(() => {
    if (ringTimeoutRef.current != null) {
      window.clearTimeout(ringTimeoutRef.current);
      ringTimeoutRef.current = null;
    }
  }, []);

  const clearCallSignalTimers = useCallback(() => {
    clearRingTimeout();

    if (inviteIntervalRef.current != null) {
      window.clearInterval(inviteIntervalRef.current);
      inviteIntervalRef.current = null;
    }

    if (acceptIntervalRef.current != null) {
      window.clearInterval(acceptIntervalRef.current);
      acceptIntervalRef.current = null;
    }

    if (incomingTimeoutRef.current != null) {
      window.clearTimeout(incomingTimeoutRef.current);
      incomingTimeoutRef.current = null;
    }
  }, [clearRingTimeout]);

  const isRemoteUserBusy = useCallback(
    (payload: CallInvitePayload, active: CallSession, phase: CallPhase): boolean => {
      if (active.callId === payload.callId) {
        return false;
      }

      if (!active.callId || phase === 'idle') {
        return false;
      }

      if (phase === 'connecting' || phase === 'active') {
        return true;
      }

      if (phase === 'incoming' || phase === 'outgoing') {
        return active.conversationId !== payload.conversationId;
      }

      return false;
    },
    [],
  );

  const disconnectRoom = useCallback(async () => {
    const mediasoupSession = mediasoupRef.current;
    mediasoupRef.current = null;
    setMediasoupPeers([]);
    setMediasoupLocalVideo(null);

    if (mediasoupSession) {
      await mediasoupSession.disconnect();
    }

    const room = roomRef.current;
    roomRef.current = null;

    if (!room) {
      setRemoteParticipants([]);
      return;
    }

    room.removeAllListeners();
    setRemoteParticipants([]);

    try {
      await Promise.race([
        room.disconnect(),
        new Promise<void>((resolve) => {
          window.setTimeout(resolve, 2500);
        }),
      ]);
    } catch {
      // Ignore disconnect errors so ending a call always clears the UI.
    }
  }, []);

  const snapshotCallContext = useCallback((): { session: CallSession; initiatorId: string } | null => {
    const active = sessionRef.current;
    const initiatorId = initiatorIdRef.current;

    if (!initiatorId || !active.conversationId || !active.callId) {
      return null;
    }

    return {
      session: { ...active },
      initiatorId,
    };
  }, []);

  const writeCallLogSnapshot = useCallback(
    async (
      context: { session: CallSession; initiatorId: string } | null,
      outcome: CallLogOutcome,
      durationSec: number,
    ) => {
      if (!context) {
        return;
      }

      const result = await logCall({
        conversationId: context.session.conversationId,
        callId: context.session.callId,
        video: context.session.video,
        outcome,
        durationSec,
        initiatorId: context.initiatorId,
      });

      if (!result.ok) {
        reportError(result.error);
      } else {
        onCallLogged?.();
      }
    },
    [onCallLogged, reportError],
  );

  const writeCallLog = useCallback(
    async (outcome: CallLogOutcome, durationSec: number) => {
      await writeCallLogSnapshot(snapshotCallContext(), outcome, durationSec);
    },
    [snapshotCallContext, writeCallLogSnapshot],
  );

  const resetSession = useCallback(() => {
    clearCallSignalTimers();
    initiatorIdRef.current = null;
    setMicEnabled(true);
    setCameraEnabled(false);
    setScreenShareEnabled(false);
    setBusy(false);
    setPendingJoinRequests([]);
    setAwaitingJoinApproval(false);
    pendingJoinConversationRef.current = null;
    setSession(INITIAL_SESSION);
    void disconnectRoom();
  }, [clearCallSignalTimers, disconnectRoom]);

  const connectLiveKit = useCallback(
    async (tokenResult: CallTokenResult, video: boolean) => {
      const permissionResult = await ensureCallMediaPermissions(false);

      if (!permissionResult.ok) {
        throw new Error(permissionResult.error);
      }

      setSession((current) => ({ ...current, phase: 'connecting', liveToken: tokenResult }));

      if (tokenResult.engine === 'mediasoup') {
        const session = await MediasoupCallSession.connect(tokenResult, video, {
          onConnected: () => {
            setSession((current) =>
              current.phase === 'connecting' || current.phase === 'outgoing' || current.phase === 'incoming'
                ? { ...current, phase: 'active', connectedAt: Date.now() }
                : current,
            );
            removedFromMeetingRef.current = false;
          },
          onPeersChanged: () => {
            const active = mediasoupRef.current;

            if (!active) {
              return;
            }

            setMediasoupPeers(active.getRemotePeers());
            setMediasoupLocalVideo(active.getLocalVideoStream());
          },
          onRoomEnded: () => {
            removedFromMeetingRef.current = true;
            logCallDebug('[Calls] Removed from mediasoup meeting');
          },
        });

        mediasoupRef.current = session;
        setMediasoupPeers(session.getRemotePeers());
        setMediasoupLocalVideo(session.getLocalVideoStream());
        return;
      }

      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
      });

      const syncRemoteParticipants = () => {
        setRemoteParticipants(Array.from(room.remoteParticipants.values()));
      };

      room.on(RoomEvent.ParticipantConnected, syncRemoteParticipants);
      room.on(RoomEvent.ParticipantDisconnected, syncRemoteParticipants);
      room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
        if (track.kind === Track.Kind.Audio) {
          logCallDebug('[Calls] Remote audio track subscribed', {
            participant: participant.identity,
            source: publication.source,
            muted: publication.isMuted,
          });
        }
        syncRemoteParticipants();
      });
      room.on(RoomEvent.TrackUnsubscribed, syncRemoteParticipants);
      room.on(RoomEvent.TrackPublished, syncRemoteParticipants);
      room.on(RoomEvent.TrackUnpublished, syncRemoteParticipants);
      room.on(RoomEvent.LocalTrackPublished, () => {
        const sharingScreen = Boolean(
          room.localParticipant.getTrackPublication(Track.Source.ScreenShare)?.track,
        );
        setScreenShareEnabled(sharingScreen);
        syncRemoteParticipants();
      });
      room.on(RoomEvent.LocalTrackUnpublished, (publication) => {
        if (publication.source === Track.Source.ScreenShare) {
          setScreenShareEnabled(false);
        }
        syncRemoteParticipants();
      });
      room.on(RoomEvent.ConnectionStateChanged, (state) => {
        if (state === ConnectionState.Connected) {
          setSession((current) =>
            current.phase === 'connecting' || current.phase === 'outgoing' || current.phase === 'incoming'
              ? { ...current, phase: 'active', connectedAt: Date.now() }
              : current,
          );
          removedFromMeetingRef.current = false;
        }
      });
      room.on(RoomEvent.Disconnected, (reason) => {
        if (
          reason === DisconnectReason.PARTICIPANT_REMOVED ||
          reason === DisconnectReason.ROOM_DELETED
        ) {
          removedFromMeetingRef.current = true;
          logCallDebug('[Calls] Removed from meeting', String(reason));
        }
      });

      roomRef.current = room;

      logCallDebug('[Calls] Connecting LiveKit', {
        url: tokenResult.url,
        roomName: tokenResult.roomName,
        video,
      });

      try {
        await room.connect(tokenResult.url, tokenResult.token);
      } catch (error) {
        logCallDebug('[Calls] LiveKit connect failed', error instanceof Error ? error.message : error);
        throw new Error(formatCallMediaError(error));
      }

      try {
        await room.localParticipant.setMicrophoneEnabled(true);
        setMicEnabled(true);
      } catch (error) {
        logCallDebug('[Calls] Microphone enable failed', error instanceof Error ? error.message : error);
        throw new Error(formatCallMediaError(error));
      }

      if (video) {
        const cameraPermission = await ensureCallMediaPermissions(true);

        if (!cameraPermission.ok) {
          logCallDebug('[Calls] Camera permission denied, continuing voice-only');
          setCameraEnabled(false);
        } else {
          try {
            await room.localParticipant.setCameraEnabled(true);
            setCameraEnabled(true);
          } catch (error) {
            logCallDebug('[Calls] Camera unavailable, continuing voice-only', error instanceof Error ? error.message : error);
            setCameraEnabled(false);
          }
        }
      } else {
        setCameraEnabled(false);
      }

      setScreenShareEnabled(false);
      syncRemoteParticipants();

      try {
        await room.startAudio();
        logCallDebug('[Calls] Remote audio started');
      } catch (error) {
        logCallDebug(
          '[Calls] startAudio failed',
          error instanceof Error ? error.message : error,
        );
      }
    },
    [],
  );

  const finalizeDirectCall = useCallback(
    async (outcome: CallLogOutcome) => {
      const active = sessionRef.current;

      if (active.isGroup) {
        resetSession();
        return;
      }

      const context = snapshotCallContext();
      const durationSec =
        active.connectedAt != null ? Math.max(0, Math.floor((Date.now() - active.connectedAt) / 1000)) : 0;
      const userId = currentUserId;
      const peerUserId = active.peerUserId;
      const callId = active.callId;
      const conversationId = active.conversationId;

      resetSession();

      if (callId && conversationId && userId && peerUserId) {
        void broadcastCallEvent(getUserCallChannelName(peerUserId), 'call:end', {
          callId,
          conversationId,
          endedBy: userId,
        }).catch(() => undefined);
      }

      void writeCallLogSnapshot(context, outcome, durationSec);
    },
    [currentUserId, resetSession, snapshotCallContext, writeCallLogSnapshot],
  );

  const handleIncomingInvite = useCallback(
    (payload: CallInvitePayload) => {
      if (currentUserId && payload.caller.id === currentUserId) {
        return;
      }

      if (seenCallIdsRef.current.has(payload.callId)) {
        return;
      }

      const active = sessionRef.current;
      const phase = active.phase;

      if (active.callId === payload.callId && (phase === 'incoming' || phase === 'connecting')) {
        return;
      }

      if (isRemoteUserBusy(payload, active, phase)) {
        void sendSignalWithRetries(getUserCallChannelName(payload.caller.id), 'call:reject', {
          callId: payload.callId,
          conversationId: payload.conversationId,
          reason: 'busy',
        }).catch(() => undefined);
        return;
      }

      if (phase === 'incoming' || phase === 'outgoing') {
        clearCallSignalTimers();
      } else if (phase !== 'idle') {
        void disconnectRoom();
        clearCallSignalTimers();
      }

      initiatorIdRef.current = payload.caller.id;
      setSession({
        phase: 'incoming',
        callId: payload.callId,
        conversationId: payload.conversationId,
        roomName: payload.roomName,
        video: payload.video,
        isGroup: false,
        isInitiator: false,
        peerUserId: payload.caller.id,
        peerLabel: payload.caller.username,
        peerAvatar: payload.caller.avatar,
        liveToken: null,
        connectedAt: null,
        meetingBanner: null,
      });

      void loadCallToken({
        conversationId: payload.conversationId,
        roomName: payload.roomName,
        video: payload.video,
      }).catch(() => undefined);

      void showIncomingCallDesktopNotification(payload.caller.username, payload.video, () => {
        focusCallWindow();
      });

      focusCallWindow();

      incomingTimeoutRef.current = window.setTimeout(() => {
        const current = sessionRef.current;

        if (current.callId !== payload.callId || current.phase !== 'incoming') {
          return;
        }

        void sendSignalWithRetries(getUserCallChannelName(payload.caller.id), 'call:reject', {
          callId: payload.callId,
          conversationId: payload.conversationId,
          reason: 'declined',
        }).catch(() => undefined);

        seenCallIdsRef.current.add(payload.callId);
        resetSession();
        void writeCallLogSnapshot(
          {
            session: { ...current },
            initiatorId: payload.caller.id,
          },
          'declined',
          0,
        );
      }, INCOMING_RING_MS);
    },
    [
      clearCallSignalTimers,
      currentUserId,
      disconnectRoom,
      isRemoteUserBusy,
      resetSession,
      writeCallLogSnapshot,
    ],
  );

  const ingestMeetingNotification = useCallback((payload: MeetingStartedPayload) => {
    setSession((current) => ({
      ...current,
      meetingBanner: payload,
    }));
  }, []);

  const notifyMeetingStarted = useCallback((payload: MeetingStartedPayload) => {
    ingestMeetingNotification(payload);

    void showGroupMeetingDesktopNotification(
      payload.startedBy.username,
      payload.conversationTitle,
      payload.video,
      () => {
        focusCallWindow();
      },
    );
    focusCallWindow();
  }, [ingestMeetingNotification]);

  const handleRemoteAccept = useCallback(
    async (payload: { callId: string; conversationId: string; accepterId: string }) => {
      const active = sessionRef.current;

      if (active.phase !== 'outgoing' || active.callId !== payload.callId) {
        return;
      }

      clearCallSignalTimers();

      if (!active.liveToken) {
        reportError('Missing LiveKit token for this call.');
        await finalizeDirectCall('cancelled');
        return;
      }

      try {
        await connectLiveKit(active.liveToken, active.video);
      } catch (error) {
        reportError(formatCallMediaError(error));
        await finalizeDirectCall('cancelled');
      }
    },
    [clearCallSignalTimers, connectLiveKit, finalizeDirectCall, reportError],
  );

  const handleRemoteReject = useCallback(
    async (payload: { callId: string; conversationId: string; reason?: 'declined' | 'busy' }) => {
      const active = sessionRef.current;

      if (active.phase !== 'outgoing' || active.callId !== payload.callId) {
        return;
      }

      if (seenCallIdsRef.current.has(payload.callId)) {
        return;
      }

      clearCallSignalTimers();
      seenCallIdsRef.current.add(payload.callId);
      const context = snapshotCallContext();
      resetSession();
      void writeCallLogSnapshot(context, 'declined', 0);

      if (payload.reason === 'busy') {
        reportError('User is busy.');
      }
    },
    [clearCallSignalTimers, reportError, resetSession, snapshotCallContext, writeCallLogSnapshot],
  );

  const handleRemoteCancel = useCallback(
    async (payload: { callId: string; conversationId: string }) => {
      const active = sessionRef.current;

      if (active.phase !== 'incoming' || active.callId !== payload.callId) {
        return;
      }

      if (seenCallIdsRef.current.has(payload.callId)) {
        return;
      }

      seenCallIdsRef.current.add(payload.callId);
      const context = snapshotCallContext();
      resetSession();
      void writeCallLogSnapshot(context, 'missed', 0);
    },
    [resetSession, snapshotCallContext, writeCallLogSnapshot],
  );

  const handleRemoteEnd = useCallback(
    async (payload: { callId: string; conversationId: string }) => {
      const active = sessionRef.current;

      if (active.callId !== payload.callId || active.phase === 'idle') {
        return;
      }

      const durationSec =
        active.connectedAt != null ? Math.max(0, Math.floor((Date.now() - active.connectedAt) / 1000)) : 0;
      const context = snapshotCallContext();

      if (active.phase === 'active' || active.phase === 'connecting') {
        void writeCallLogSnapshot(context, 'completed', durationSec);
      }

      resetSession();
    },
    [resetSession, snapshotCallContext, writeCallLogSnapshot],
  );

  const handleMeetingStarted = useCallback(
    (payload: MeetingStartedPayload) => {
      if (currentUserId && payload.startedBy.id === currentUserId) {
        return;
      }

      notifyMeetingStarted(payload);
    },
    [currentUserId, notifyMeetingStarted],
  );

  const handleMeetingEnded = useCallback(
    async (payload: { callId: string; conversationId: string }) => {
      const active = sessionRef.current;

      if (active.isGroup && active.callId === payload.callId) {
        const durationSec =
          active.connectedAt != null ? Math.max(0, Math.floor((Date.now() - active.connectedAt) / 1000)) : 0;
        const context = snapshotCallContext();
        resetSession();
        void writeCallLogSnapshot(context, 'completed', durationSec);
        return;
      }

      setSession((current) =>
        current.meetingBanner?.callId === payload.callId
          ? { ...current, meetingBanner: null }
          : current,
      );
    },
    [resetSession, snapshotCallContext, writeCallLogSnapshot],
  );

  const upsertJoinRequest = useCallback((payload: MeetingJoinRequestPayload) => {
    setPendingJoinRequests((current) => {
      if (current.some((item) => item.id === payload.requestId)) {
        return current;
      }

      return [
        ...current,
        {
          id: payload.requestId,
          conversationId: payload.conversationId,
          callId: payload.callId,
          requester: payload.requester,
          requestedAt: payload.requestedAt,
        },
      ];
    });
  }, []);

  const handleMeetingJoinRequest = useCallback(
    (payload: MeetingJoinRequestPayload) => {
      if (currentUserId && payload.requester.id === currentUserId) {
        return;
      }

      const active = sessionRef.current;
      const isActiveHost =
        active.isGroup &&
        active.conversationId === payload.conversationId &&
        (active.phase === 'active' || active.phase === 'connecting') &&
        active.isInitiator;

      if (!isActiveHost && active.meetingBanner?.conversationId !== payload.conversationId) {
        return;
      }

      upsertJoinRequest(payload);
    },
    [currentUserId, upsertJoinRequest],
  );

  const completeApprovedJoin = useCallback(
    async (conversation: ConversationItem, callId: string, video: boolean) => {
      const tokenResult = await loadCallToken({ conversationId: conversation.id, video });

      if (!tokenResult.ok) {
        throw new Error(formatCallApiError(tokenResult.error, tokenResult.status));
      }

      setSession({
        phase: 'connecting',
        callId,
        conversationId: conversation.id,
        roomName: tokenResult.data.roomName,
        video,
        isGroup: true,
        isInitiator: false,
        peerUserId: null,
        peerLabel: conversation.title,
        peerAvatar: conversation.avatarUrl,
        liveToken: tokenResult.data,
        connectedAt: null,
        meetingBanner: null,
      });

      await connectLiveKit(tokenResult.data, video);
      setAwaitingJoinApproval(false);
      pendingJoinConversationRef.current = null;
      removedFromMeetingRef.current = false;
    },
    [connectLiveKit],
  );

  const handleMeetingJoinResponse = useCallback(
    async (payload: MeetingJoinResponsePayload) => {
      if (!currentUserId || payload.requesterId !== currentUserId) {
        return;
      }

      setAwaitingJoinApproval(false);

      if (!payload.approved) {
        pendingJoinConversationRef.current = null;
        resetSession();
        reportError('The host denied your request to join the meeting.');
        return;
      }

      const conversation = pendingJoinConversationRef.current;

      if (!conversation) {
        return;
      }

      setBusy(true);

      try {
        await completeApprovedJoin(conversation, payload.callId, sessionRef.current.video);
      } catch (error) {
        reportError(error instanceof Error ? error.message : 'Unable to join the meeting.');
        resetSession();
      } finally {
        setBusy(false);
      }
    },
    [completeApprovedJoin, currentUserId, reportError, resetSession],
  );

  const submitMeetingJoinRequest = useCallback(
    async (conversation: ConversationItem, callId: string, video: boolean) => {
      if (!currentUserId) {
        return;
      }

      pendingJoinConversationRef.current = conversation;

      const apiResult = await requestMeetingJoinCall({
        conversationId: conversation.id,
        callId,
      });

      if (!apiResult.ok) {
        throw new Error(formatCallApiError(apiResult.error, apiResult.status));
      }

      const payload =
        normalizeMeetingJoinRequestPayload(apiResult.data) ?? {
          requestId: createCallId(),
          conversationId: conversation.id,
          callId,
          requester: {
            id: currentUserId,
            username: currentUserLabel,
            avatar: currentUserAvatar,
          },
          requestedAt: new Date().toISOString(),
        };

      await broadcastCallEvent(getHubCallChannelName(conversation.id), 'call:meeting-join-request', payload);

      setSession({
        phase: 'connecting',
        callId,
        conversationId: conversation.id,
        roomName: `hub-${conversation.id}`,
        video,
        isGroup: true,
        isInitiator: false,
        peerUserId: null,
        peerLabel: conversation.title,
        peerAvatar: conversation.avatarUrl,
        liveToken: null,
        connectedAt: null,
        meetingBanner: null,
      });
      setAwaitingJoinApproval(true);
    },
    [currentUserAvatar, currentUserId, currentUserLabel],
  );

  const respondToJoinRequest = useCallback(
    async (requestId: string, approved: boolean) => {
      const active = sessionRef.current;

      if (!currentUserId || !active.conversationId || !active.isGroup) {
        return;
      }

      const request = pendingJoinRequests.find((item) => item.id === requestId);

      setBusy(true);

      try {
        const result = await respondMeetingJoinRequestCall({
          conversationId: active.conversationId,
          requestId,
          approved,
        });

        if (!result.ok) {
          reportError(formatCallApiError(result.error, result.status));
          return;
        }

        const responsePayload: MeetingJoinResponsePayload = {
          requestId,
          conversationId: active.conversationId,
          callId: active.callId,
          requesterId: request?.requester.id ?? '',
          approved,
          respondedBy: {
            id: currentUserId,
            username: currentUserLabel,
            avatar: currentUserAvatar,
          },
          respondedAt: new Date().toISOString(),
        };

        await broadcastCallEvent(
          getHubCallChannelName(active.conversationId),
          'call:meeting-join-response',
          responsePayload,
        );

        setPendingJoinRequests((current) => current.filter((item) => item.id !== requestId));
      } catch (error) {
        reportError(error instanceof Error ? error.message : 'Could not respond to join request.');
      } finally {
        setBusy(false);
      }
    },
    [currentUserAvatar, currentUserId, currentUserLabel, pendingJoinRequests, reportError],
  );

  const muteRemoteParticipant = useCallback(
    async (participantIdentity: string, muted: boolean) => {
      const conversationId = sessionRef.current.conversationId;

      if (!conversationId || !sessionRef.current.isGroup) {
        return;
      }

      const result = await muteCallParticipant(conversationId, participantIdentity, muted);

      if (!result.ok) {
        reportError(formatCallApiError(result.error, result.status));
      }
    },
    [reportError],
  );

  const removeRemoteParticipant = useCallback(
    async (participantIdentity: string) => {
      const conversationId = sessionRef.current.conversationId;

      if (!conversationId || !sessionRef.current.isGroup) {
        return;
      }

      const result = await removeCallParticipant(conversationId, participantIdentity);

      if (!result.ok) {
        reportError(formatCallApiError(result.error, result.status));
        return;
      }

      logCallDebug('[Calls] Removed participant', participantIdentity);
    },
    [reportError],
  );

  const refreshMeetingJoinRequests = useCallback(async () => {
    const active = sessionRef.current;

    if (!active.isGroup || !active.isInitiator || !active.conversationId) {
      return;
    }

    if (active.phase !== 'active' && active.phase !== 'connecting') {
      return;
    }

    const result = await listMeetingJoinRequests(active.conversationId);

    if (result.ok) {
      setPendingJoinRequests(result.data);
    }
  }, []);

  directHandlersRef.current = {
    onInvite: handleIncomingInvite,
    onAccept: (payload) => {
      void handleRemoteAccept(payload);
    },
    onReject: (payload) => {
      void handleRemoteReject(payload);
    },
    onCancel: (payload) => {
      void handleRemoteCancel(payload);
    },
    onEnd: (payload) => {
      void handleRemoteEnd(payload);
    },
  };

  hubHandlersRef.current = {
    onMeetingStarted: handleMeetingStarted,
    onMeetingEnded: (payload) => {
      void handleMeetingEnded(payload);
    },
    onMeetingJoinRequest: handleMeetingJoinRequest,
    onMeetingJoinResponse: (payload) => {
      void handleMeetingJoinResponse(payload);
    },
  };

  useEffect(() => {
    if (!currentUserId) {
      return;
    }

    let cancelled = false;

    const subscribeDirectCallChannel = async () => {
      await subscribeUserCallChannel(currentUserId, {
        onInvite: (payload) => directHandlersRef.current?.onInvite(payload),
        onAccept: (payload) => directHandlersRef.current?.onAccept(payload),
        onReject: (payload) => directHandlersRef.current?.onReject(payload),
        onCancel: (payload) => directHandlersRef.current?.onCancel(payload),
        onEnd: (payload) => directHandlersRef.current?.onEnd(payload),
      });
    };

    const syncHubChannels = async () => {
      await syncHubCallChannels(hubConversationIdsRef.current, {
        onMeetingStarted: (payload) => hubHandlersRef.current?.onMeetingStarted(payload),
        onMeetingEnded: (payload) => hubHandlersRef.current?.onMeetingEnded(payload),
        onMeetingJoinRequest: (payload) => hubHandlersRef.current?.onMeetingJoinRequest(payload),
        onMeetingJoinResponse: (payload) => hubHandlersRef.current?.onMeetingJoinResponse(payload),
      });
    };

    const connectSignaling = async () => {
      const configResult = await loadRealtimeConfig();

      if (cancelled) {
        return;
      }

      if (!configResult.ok) {
        logCallDebug('[Calls] signaling unavailable', configResult.error);
        if (!signalingErrorShownRef.current) {
          signalingErrorShownRef.current = true;
          reportErrorRef.current(formatCallApiError(configResult.error, configResult.status));
        }
        return;
      }

      let lastError: unknown = null;

      for (let attempt = 0; attempt < 5 && !cancelled; attempt += 1) {
        try {
          await initCallSignaling(configResult.data);

          await subscribeDirectCallChannel();

          signalingErrorShownRef.current = false;
          logCallDebug(`[Calls] Listening for direct calls on call:user:${currentUserId}`);

          await syncHubChannels();
          logCallDebug(
            `[Calls] Listening for group meetings on ${hubConversationIdsRef.current.length} hub channel(s)`,
          );

          return;
        } catch (error) {
          lastError = error;
          disconnectUserCallChannel(currentUserId);

          if (attempt < 4 && !cancelled) {
            await new Promise((resolve) => window.setTimeout(resolve, 800 * (attempt + 1)));
          }
        }
      }

      logCallDebug(
        '[Calls] signaling subscribe failed',
        lastError instanceof Error ? lastError.message : lastError,
      );
      if (!signalingErrorShownRef.current) {
        signalingErrorShownRef.current = true;
        reportErrorRef.current(
          formatCallApiError(lastError instanceof Error ? lastError.message : 'Call signaling failed.'),
        );
      }
    };

    void connectSignaling();

    const healthTimer = window.setInterval(() => {
      void (async () => {
        if (cancelled || !currentUserId || !isCallSignalingReady()) {
          return;
        }

        try {
          if (!isUserCallChannelSubscribed()) {
            logCallDebug('[Calls] Reconnecting user call channel');
            await subscribeDirectCallChannel();
            logCallDebug(`[Calls] Listening for direct calls on call:user:${currentUserId}`);
          }

          await syncHubChannels();
        } catch (error) {
          logCallDebug(
            '[Calls] signaling health check failed',
            error instanceof Error ? error.message : error,
          );
        }
      })();
    }, CALL_SIGNALING_HEALTH_MS);

    const refreshTimer = window.setInterval(() => {
      void (async () => {
        const configResult = await loadRealtimeConfig();

        if (!configResult.ok || cancelled) {
          return;
        }

        try {
          await refreshCallSignalingAuth(configResult.data);
        } catch (error) {
          logCallDebug(
            '[Calls] signaling refresh failed',
            error instanceof Error ? error.message : error,
          );
        }
      })();
    }, CALL_SIGNALING_REFRESH_MS);

    return () => {
      cancelled = true;
      window.clearInterval(healthTimer);
      window.clearInterval(refreshTimer);
      void disconnectCallSignaling();
    };
  }, [currentUserId]);

  useEffect(() => {
    if (!currentUserId || !isCallSignalingReady()) {
      return;
    }

    void syncHubCallChannels(hubConversationIds, {
      onMeetingStarted: (payload) => hubHandlersRef.current?.onMeetingStarted(payload),
      onMeetingEnded: (payload) => hubHandlersRef.current?.onMeetingEnded(payload),
      onMeetingJoinRequest: (payload) => hubHandlersRef.current?.onMeetingJoinRequest(payload),
      onMeetingJoinResponse: (payload) => hubHandlersRef.current?.onMeetingJoinResponse(payload),
    }).catch((error) => {
      logCallDebug(
        '[Calls] Hub channel sync failed',
        error instanceof Error ? error.message : error,
      );
    });
  }, [currentUserId, hubConversationIds]);

  useEffect(() => {
    if (
      !session.isGroup ||
      !session.isInitiator ||
      (session.phase !== 'active' && session.phase !== 'connecting')
    ) {
      return;
    }

    void refreshMeetingJoinRequests();
    const timer = window.setInterval(() => {
      void refreshMeetingJoinRequests();
    }, MEETING_JOIN_POLL_MS);

    return () => {
      window.clearInterval(timer);
    };
  }, [
    refreshMeetingJoinRequests,
    session.conversationId,
    session.isGroup,
    session.isInitiator,
    session.phase,
  ]);

  const ensureCallSignalingReady = useCallback(async (): Promise<boolean> => {
    const configResult = await loadRealtimeConfig();

    if (!configResult.ok) {
      reportError(formatCallApiError(configResult.error, configResult.status));
      return false;
    }

    try {
      await initCallSignaling(configResult.data);

      if (currentUserId) {
        await subscribeUserCallChannel(currentUserId, {
          onInvite: (payload) => directHandlersRef.current?.onInvite?.(payload),
          onAccept: (payload) => directHandlersRef.current?.onAccept?.(payload),
          onReject: (payload) => directHandlersRef.current?.onReject?.(payload),
          onCancel: (payload) => directHandlersRef.current?.onCancel?.(payload),
          onEnd: (payload) => directHandlersRef.current?.onEnd?.(payload),
        });
      }

      return true;
    } catch (error) {
      reportError(error instanceof Error ? error.message : 'Call signaling is unavailable.');
      return false;
    }
  }, [currentUserId, reportError]);

  const startDirectCall = useCallback(
    async (conversation: ConversationItem, video: boolean) => {
      if (!currentUserId) {
        reportError('Sign in again to place a call.');
        return;
      }

      if (conversation.isSelf) {
        reportError('You cannot call yourself.');
        return;
      }

      if (!conversation.peerUserId) {
        reportError('Could not find who to call. Reopen this chat and try again.');
        return;
      }

      if (sessionRef.current.phase !== 'idle') {
        reportError('You are already in a call.');
        return;
      }

      setBusy(true);

      const signalingReady = await ensureCallSignalingReady();

      if (!signalingReady) {
        setBusy(false);
        return;
      }

      const callId = createCallId();
      initiatorIdRef.current = currentUserId;

      const tokenResult = await loadCallToken({
        conversationId: conversation.id,
        video,
      });

      if (!tokenResult.ok) {
        setBusy(false);
        reportError(formatCallApiError(tokenResult.error, tokenResult.status));
        return;
      }

      const roomName = tokenResult.data.roomName || buildDirectCallRoomName(conversation.id);

      setSession({
        phase: 'outgoing',
        callId,
        conversationId: conversation.id,
        roomName,
        video,
        isGroup: false,
        isInitiator: true,
        peerUserId: conversation.peerUserId,
        peerLabel: conversation.title,
        peerAvatar: conversation.avatarUrl,
        liveToken: tokenResult.data,
        connectedAt: null,
        meetingBanner: null,
      });

      const invitePayload = {
        callId,
        conversationId: conversation.id,
        roomName,
        caller: {
          id: currentUserId,
          username: currentUserLabel,
          avatar: currentUserAvatar,
        },
        video,
        sentAt: new Date().toISOString(),
      };

      let inviteDeliveryFailed = false;

      const sendInvite = () => {
        invitePayload.sentAt = new Date().toISOString();
        void sendSignalWithRetries(
          getUserCallChannelName(conversation.peerUserId!),
          'call:invite',
          invitePayload,
        )
          .then(() => {
            inviteDeliveryFailed = false;
            logCallDebug(
              `[Calls] Sent invite to call:user:${conversation.peerUserId}`,
              { callId, conversationId: conversation.id, roomName },
            );
          })
          .catch((error) => {
            inviteDeliveryFailed = true;
            const message = error instanceof Error ? error.message : 'Could not reach the other person.';
            logCallDebug(
              `[Calls] Invite send failed for call:user:${conversation.peerUserId}`,
              message,
            );
            reportError(
              'Call signaling failed — the other person may not get a ring. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env, then restart the app.',
            );
          });
      };

      clearCallSignalTimers();
      sendInvite();
      setBusy(false);
      inviteIntervalRef.current = window.setInterval(() => {
        const active = sessionRef.current;

        if (active.callId !== callId || active.phase !== 'outgoing') {
          clearCallSignalTimers();
          return;
        }

        if (!inviteDeliveryFailed) {
          sendInvite();
        }
      }, SIGNAL_REPEAT_MS);

      ringTimeoutRef.current = window.setTimeout(() => {
        void (async () => {
          const active = sessionRef.current;

          if (active.phase !== 'outgoing' || active.callId !== callId) {
            return;
          }

          seenCallIdsRef.current.add(callId);
          await sendSignalWithRetries(getUserCallChannelName(conversation.peerUserId!), 'call:cancel', {
            callId,
            conversationId: conversation.id,
          }).catch(() => undefined);

          const context = snapshotCallContext();
          resetSession();
          void writeCallLogSnapshot(context, 'missed', 0);
        })();
      }, OUTGOING_RING_MS);
    },
    [
      clearCallSignalTimers,
      currentUserAvatar,
      currentUserId,
      currentUserLabel,
      ensureCallSignalingReady,
      reportError,
      resetSession,
      snapshotCallContext,
      writeCallLogSnapshot,
    ],
  );

  const acceptIncomingCall = useCallback(async () => {
    const active = sessionRef.current;

    if (active.phase !== 'incoming' || !currentUserId || !active.peerUserId) {
      return;
    }

    setBusy(true);
    clearCallSignalTimers();

    const permissionResult = await ensureCallMediaPermissions(false);

    if (!permissionResult.ok) {
      setBusy(false);
      reportError(permissionResult.error);
      return;
    }

    const tokenResult = await loadCallToken({
      conversationId: active.conversationId,
      roomName: active.roomName,
      video: active.video,
    });

    if (!tokenResult.ok) {
      setBusy(false);
      reportError(formatCallApiError(tokenResult.error, tokenResult.status));
      return;
    }

    const acceptPayload = {
      callId: active.callId,
      conversationId: active.conversationId,
      roomName: active.roomName,
      video: active.video,
      accepterId: currentUserId,
    };

    const sendAccept = () => {
      void sendSignalWithRetries(
        getUserCallChannelName(active.peerUserId!),
        'call:accept',
        acceptPayload,
      ).catch(() => undefined);
    };

    sendAccept();
    acceptIntervalRef.current = window.setInterval(() => {
      const current = sessionRef.current;

      if (current.callId !== active.callId || current.phase === 'active' || current.phase === 'idle') {
        clearCallSignalTimers();
        return;
      }

      sendAccept();
    }, SIGNAL_REPEAT_MS);

    try {
      await connectLiveKit(tokenResult.data, active.video);
      clearCallSignalTimers();
    } catch (error) {
      clearCallSignalTimers();
      reportError(formatCallMediaError(error));
      await disconnectRoom();
      resetSession();
    } finally {
      setBusy(false);
    }
  }, [clearCallSignalTimers, connectLiveKit, currentUserId, disconnectRoom, reportError, resetSession]);

  const rejectIncomingCall = useCallback(async () => {
    const active = sessionRef.current;

    if (
      (active.phase !== 'incoming' && active.phase !== 'connecting') ||
      active.isGroup ||
      !active.peerUserId
    ) {
      return;
    }

    const context = snapshotCallContext();
    const { callId, conversationId, peerUserId } = active;

    seenCallIdsRef.current.add(callId);
    resetSession();

    void sendSignalWithRetries(getUserCallChannelName(peerUserId), 'call:reject', {
      callId,
      conversationId,
      reason: 'declined',
    }).catch(() => undefined);

    void writeCallLogSnapshot(context, 'declined', 0);
  }, [resetSession, snapshotCallContext, writeCallLogSnapshot]);

  const cancelOutgoingCall = useCallback(async () => {
    const active = sessionRef.current;

    if (
      (active.phase !== 'outgoing' && active.phase !== 'connecting') ||
      active.isGroup ||
      !active.peerUserId
    ) {
      return;
    }

    clearCallSignalTimers();

    const context = snapshotCallContext();
    const { callId, conversationId, peerUserId } = active;

    seenCallIdsRef.current.add(callId);
    resetSession();

    void sendSignalWithRetries(getUserCallChannelName(peerUserId), 'call:cancel', {
      callId,
      conversationId,
    }).catch(() => undefined);

    void writeCallLogSnapshot(context, 'cancelled', 0);
  }, [clearCallSignalTimers, resetSession, snapshotCallContext, writeCallLogSnapshot]);

  const endActiveCall = useCallback(async () => {
    const active = sessionRef.current;

    if (active.phase === 'outgoing') {
      await cancelOutgoingCall();
      return;
    }

    if (active.phase === 'incoming') {
      await rejectIncomingCall();
      return;
    }

    if (active.phase !== 'active' && active.phase !== 'connecting') {
      return;
    }

    const context = snapshotCallContext();
    const durationSec =
      active.connectedAt != null ? Math.max(0, Math.floor((Date.now() - active.connectedAt) / 1000)) : 0;
    const userId = currentUserId;
    const {
      callId,
      conversationId,
      peerUserId,
      isGroup,
      isInitiator,
    } = active;

    resetSession();

    if (isGroup) {
      if (isInitiator) {
        void endCallMeeting(conversationId).catch(() => undefined);
        void broadcastCallEvent(getHubCallChannelName(conversationId), 'call:meeting-ended', {
          callId,
          conversationId,
          endedBy: userId ?? '',
        }).catch(() => undefined);
      }

      void writeCallLogSnapshot(context, 'completed', durationSec);
      return;
    }

    if (callId && conversationId && userId && peerUserId) {
      void broadcastCallEvent(getUserCallChannelName(peerUserId), 'call:end', {
        callId,
        conversationId,
        endedBy: userId,
      }).catch(() => undefined);
    }

    void writeCallLogSnapshot(context, 'completed', durationSec);
  }, [
    cancelOutgoingCall,
    currentUserId,
    rejectIncomingCall,
    resetSession,
    snapshotCallContext,
    writeCallLogSnapshot,
  ]);

  const startGroupMeeting = useCallback(
    async (conversation: ConversationItem, video: boolean) => {
      if (!currentUserId) {
        reportError('Sign in again to start a meeting.');
        return;
      }

      if (conversation.kind !== 'hub') {
        reportError('Meetings can only be started from a hub channel.');
        return;
      }

      if (sessionRef.current.phase !== 'idle') {
        reportError('You are already in a call.');
        return;
      }

      setBusy(true);

      const signalingReady = await ensureCallSignalingReady();

      if (!signalingReady) {
        setBusy(false);
        return;
      }

      const callId = createCallId();
      initiatorIdRef.current = currentUserId;

      const tokenResult = await loadCallToken({ conversationId: conversation.id, video });

      if (!tokenResult.ok) {
        setBusy(false);
        reportError(formatCallApiError(tokenResult.error, tokenResult.status));
        return;
      }

      const startedAt = new Date().toISOString();
      const startedBy = {
        id: currentUserId,
        username: currentUserLabel,
        avatar: currentUserAvatar,
      };

      const notifyResult = await notifyCallMeeting({
        callId,
        conversationId: conversation.id,
        roomName: tokenResult.data.roomName,
        conversationTitle: conversation.title,
        startedBy,
        video,
        startedAt,
      });

      if (!notifyResult.ok) {
        setBusy(false);
        reportError(notifyResult.error);
        return;
      }

      try {
        await broadcastCallEvent(getHubCallChannelName(conversation.id), 'call:meeting-started', {
          callId,
          conversationId: conversation.id,
          roomName: tokenResult.data.roomName,
          conversationTitle: conversation.title,
          startedBy,
          video,
          startedAt,
        });
      } catch (error) {
        logCallDebug(
          '[Calls] Hub meeting broadcast failed',
          error instanceof Error ? error.message : error,
        );
      }

      setSession({
        phase: 'connecting',
        callId,
        conversationId: conversation.id,
        roomName: tokenResult.data.roomName,
        video,
        isGroup: true,
        isInitiator: true,
        peerUserId: null,
        peerLabel: conversation.title,
        peerAvatar: conversation.avatarUrl,
        liveToken: tokenResult.data,
        connectedAt: null,
        meetingBanner: null,
      });

      try {
        await connectLiveKit(tokenResult.data, video);
      } catch (error) {
        reportError(error instanceof Error ? error.message : 'Unable to start the meeting.');
        await resetSession();
      } finally {
        setBusy(false);
      }
    },
    [
      connectLiveKit,
      currentUserAvatar,
      currentUserId,
      currentUserLabel,
      ensureCallSignalingReady,
      reportError,
      resetSession,
    ],
  );

  const joinGroupMeeting = useCallback(
    async (conversation: ConversationItem, meeting?: MeetingStartedPayload | null) => {
      if (!currentUserId) {
        return;
      }

      if (sessionRef.current.phase !== 'idle' && sessionRef.current.phase !== 'connecting') {
        reportError('You are already in a call.');
        return;
      }

      setBusy(true);

      const callId = meeting?.callId ?? sessionRef.current.meetingBanner?.callId ?? createCallId();
      initiatorIdRef.current = meeting?.startedBy.id ?? sessionRef.current.meetingBanner?.startedBy.id ?? currentUserId;

      const video = meeting?.video ?? sessionRef.current.meetingBanner?.video ?? true;

      try {
        if (removedFromMeetingRef.current) {
          await submitMeetingJoinRequest(conversation, callId, video);
          return;
        }

        const tokenResult = await loadCallToken({ conversationId: conversation.id, video });

        if (!tokenResult.ok) {
          if (shouldUseMeetingJoinRequest(tokenResult.error, tokenResult.status)) {
            await submitMeetingJoinRequest(conversation, callId, video);
            return;
          }

          reportError(formatCallApiError(tokenResult.error, tokenResult.status));
          return;
        }

        setSession({
          phase: 'connecting',
          callId,
          conversationId: conversation.id,
          roomName: tokenResult.data.roomName,
          video,
          isGroup: true,
          isInitiator: false,
          peerUserId: null,
          peerLabel: conversation.title,
          peerAvatar: conversation.avatarUrl,
          liveToken: tokenResult.data,
          connectedAt: null,
          meetingBanner: null,
        });

        await connectLiveKit(tokenResult.data, video);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to join the meeting.';

        if (shouldUseMeetingJoinRequest(message)) {
          try {
            await submitMeetingJoinRequest(conversation, callId, video);
            return;
          } catch (joinError) {
            reportError(joinError instanceof Error ? joinError.message : message);
            await resetSession();
            return;
          }
        }

        reportError(message);
        await resetSession();
      } finally {
        setBusy(false);
      }
    },
    [connectLiveKit, currentUserId, reportError, resetSession, submitMeetingJoinRequest],
  );

  const dismissMeetingBanner = useCallback(() => {
    setSession((current) => ({ ...current, meetingBanner: null }));
  }, []);

  const toggleMic = useCallback(async () => {
    const next = !micEnabled;
    const mediasoupSession = mediasoupRef.current;

    if (mediasoupSession) {
      await mediasoupSession.setMicEnabled(next);
      setMicEnabled(next);
      return;
    }

    const room = roomRef.current;

    if (!room) {
      return;
    }

    await room.localParticipant.setMicrophoneEnabled(next);
    setMicEnabled(next);
  }, [micEnabled]);

  const toggleCamera = useCallback(async () => {
    const next = !cameraEnabled;
    const mediasoupSession = mediasoupRef.current;

    if (mediasoupSession) {
      await mediasoupSession.setCameraEnabled(next);
      setCameraEnabled(next);
      return;
    }

    const room = roomRef.current;

    if (!room) {
      return;
    }

    await room.localParticipant.setCameraEnabled(next);
    setCameraEnabled(next);
  }, [cameraEnabled]);

  const toggleScreenShare = useCallback(async () => {
    const room = roomRef.current;

    if (!room) {
      return;
    }

    const next = !screenShareEnabled;

    if (next) {
      const permissionResult = await ensureScreenCapturePermission();

      if (!permissionResult.ok) {
        reportError(permissionResult.error);
        return;
      }
    }

    try {
      await room.localParticipant.setScreenShareEnabled(next, {
        audio: true,
      });
      setScreenShareEnabled(next);
      logCallDebug(next ? '[Calls] Screen sharing started' : '[Calls] Screen sharing stopped');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to share your screen.';
      const normalized = message.toLowerCase();

      if (
        normalized.includes('not supported') ||
        normalized.includes('notallowed') ||
        normalized.includes('permission')
      ) {
        reportError(
          'Screen sharing was blocked. On macOS, enable Screen & System Audio Recording for the Electron binary shown in the terminal [ScreenShare] execPath line, then fully quit (Cmd+Q) and restart.',
        );
      } else {
        reportError(message);
      }

      logCallDebug('[Calls] Screen sharing failed', message);
    }
  }, [reportError, screenShareEnabled]);

  const localVideoTrack = roomRef.current?.localParticipant.getTrackPublication(Track.Source.Camera)?.videoTrack ?? null;

  return {
    session,
    busy,
    remoteParticipants,
    micEnabled,
    cameraEnabled,
    screenShareEnabled,
    pendingJoinRequests,
    awaitingJoinApproval,
    localVideoTrack,
    mediasoupPeers,
    mediasoupLocalVideo,
    room: roomRef.current,
    startDirectCall,
    acceptIncomingCall,
    rejectIncomingCall,
    cancelOutgoingCall,
    endActiveCall,
    startGroupMeeting,
    joinGroupMeeting,
    dismissMeetingBanner,
    ingestMeetingNotification,
    notifyMeetingStarted,
    respondToJoinRequest,
    muteRemoteParticipant,
    removeRemoteParticipant,
    toggleMic,
    toggleCamera,
    toggleScreenShare,
  };
}

export function readConversationCallTitle(conversation: ConversationItem | null): string {
  if (!conversation) {
    return '';
  }

  return getUserDisplayName({ username: conversation.title }) || conversation.title;
}
