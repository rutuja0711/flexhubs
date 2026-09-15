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
import {
  buildDirectCallRoomName,
  isMeetingModerator,
  normalizeMeetingJoinRequestPayload,
} from '../shared/calls';
import { MediasoupCallSession, type MediasoupRemotePeer } from './call/mediasoupAdapter';
import {
  declineCallMeetingInvite,
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
  broadcastDirectCallSignalBurst,
  disconnectCallSignaling,
  disconnectUserCallChannel,
  ensureDirectCallPeerChannel,
  getHubCallChannelName,
  getUserCallChannelName,
  initCallSignaling,
  isCallSignalingReady,
  isUserCallChannelSubscribed,
  refreshCallSignalingAuth,
  releaseDirectCallPeerChannel,
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
  canModerateMeeting: boolean;
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
  canModerateMeeting: false,
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
const MEETING_JOIN_POLL_MS = 4 * 1000;
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

function formatCallApiError(_error: string, status?: number): string {
  if (status === 401 || status === 403) {
    return 'Could not start this call. Please sign in again and try.';
  }

  if (status === 0) {
    return 'Could not connect. Check your internet and try again.';
  }

  if (status != null && status >= 500) {
    return 'Calls are temporarily unavailable. Please try again later.';
  }

  return 'Could not start this call. Please try again.';
}

function formatCallMediaError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? '');
  const normalized = message.toLowerCase();

  if (
    normalized.includes('notallowed') ||
    normalized.includes('permission denied') ||
    normalized.includes('permission-denied') ||
    normalized.includes('permission')
  ) {
    return 'Microphone or camera access was denied. Allow access in Settings and try again.';
  }

  if (normalized.includes('notfound') || normalized.includes('devicesnotfound')) {
    return 'No microphone was found. Connect one and try again.';
  }

  if (normalized.includes('notreadable') || normalized.includes('track started')) {
    return 'Your mic or camera is in use by another app. Close it and try again.';
  }

  return 'Could not connect the call. Please try again.';
}

function formatCallPermissionError(error: string): string {
  return formatCallMediaError(new Error(error));
}

function formatCallSignalingError(): string {
  return 'Could not connect call notifications. Please try again later.';
}

function readCanModerateMeeting(token: CallTokenResult | null, isInitiator: boolean): boolean {
  return isInitiator || token?.canModerateMeeting === true;
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
  const [callNotice, setCallNotice] = useState('');

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
  const activePeerUserIdRef = useRef<string | null>(null);
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
        logCallDebug('[Calls] Call log failed', result.error);
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

  const releaseDirectCallPeer = useCallback(() => {
    const peerUserId = activePeerUserIdRef.current;
    activePeerUserIdRef.current = null;

    if (currentUserId && peerUserId) {
      releaseDirectCallPeerChannel(currentUserId, peerUserId);
    }
  }, [currentUserId]);

  const bindDirectCallPeerChannel = useCallback(
    (peerUserId: string) => {
      if (!currentUserId || !peerUserId.trim() || peerUserId === currentUserId) {
        return;
      }

      activePeerUserIdRef.current = peerUserId;

      void ensureDirectCallPeerChannel(currentUserId, peerUserId, {
        onInvite: (payload) => directHandlersRef.current?.onInvite?.(payload),
        onAccept: (payload) => directHandlersRef.current?.onAccept?.(payload),
        onReject: (payload) => directHandlersRef.current?.onReject?.(payload),
        onCancel: (payload) => directHandlersRef.current?.onCancel?.(payload),
        onEnd: (payload) => directHandlersRef.current?.onEnd?.(payload),
      }).catch((error) => {
        logCallDebug(
          '[Calls] Peer channel subscribe failed',
          error instanceof Error ? error.message : error,
        );
      });
    },
    [currentUserId],
  );

  const resetSession = useCallback(() => {
    clearCallSignalTimers();
    releaseDirectCallPeer();
    initiatorIdRef.current = null;
    setMicEnabled(true);
    setCameraEnabled(false);
    setScreenShareEnabled(false);
    setBusy(false);
    setCallNotice('');
    setPendingJoinRequests([]);
    setAwaitingJoinApproval(false);
    pendingJoinConversationRef.current = null;
    setSession(INITIAL_SESSION);
    void disconnectRoom();
  }, [clearCallSignalTimers, disconnectRoom, releaseDirectCallPeer]);

  const armIncomingCallTimeout = useCallback(
    (payload: Pick<CallInvitePayload, 'callId' | 'conversationId' | 'caller'>) => {
      if (incomingTimeoutRef.current != null) {
        window.clearTimeout(incomingTimeoutRef.current);
      }

      incomingTimeoutRef.current = window.setTimeout(() => {
        const current = sessionRef.current;

        if (current.callId !== payload.callId || current.phase !== 'incoming') {
          return;
        }

        void (async () => {
          const rejectPayload = {
            callId: payload.callId,
            conversationId: payload.conversationId,
            reason: 'declined' as const,
          };
          const channelNames = currentUserId
            ? [getUserCallChannelName(payload.caller.id), getUserCallChannelName(currentUserId)]
            : [getUserCallChannelName(payload.caller.id)];

          try {
            await broadcastDirectCallSignalBurst(channelNames, 'call:reject', rejectPayload, 3);
            await broadcastDirectCallSignalBurst(channelNames, 'call:declined', rejectPayload, 2);
          } catch {
            // Timeout decline still ends the local session.
          }
        })();

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
    [currentUserId, resetSession, writeCallLogSnapshot],
  );

  const connectLiveKit = useCallback(
    async (tokenResult: CallTokenResult, video: boolean) => {
      const permissionResult = await ensureCallMediaPermissions(video);

      if (!permissionResult.ok) {
        throw new Error(permissionResult.error);
      }

      setSession((current) => ({
        ...current,
        phase: 'connecting',
        liveToken: tokenResult,
        canModerateMeeting: readCanModerateMeeting(tokenResult, current.isInitiator),
      }));

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
            const active = sessionRef.current;
            const durationSec =
              active.connectedAt != null
                ? Math.max(0, Math.floor((Date.now() - active.connectedAt) / 1000))
                : 0;
            const context = snapshotCallContext();
            resetSession();
            reportErrorRef.current('You were removed from the meeting.');
            void writeCallLogSnapshot(context, 'completed', durationSec);
          },
        });

        mediasoupRef.current = session;
        setMediasoupPeers(session.getRemotePeers());
        setMediasoupLocalVideo(session.getLocalVideoStream());
        setCameraEnabled(Boolean(session.getLocalVideoStream()));
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
          const active = sessionRef.current;
          const durationSec =
            active.connectedAt != null
              ? Math.max(0, Math.floor((Date.now() - active.connectedAt) / 1000))
              : 0;
          const context = snapshotCallContext();
          resetSession();
          reportErrorRef.current(
            reason === DisconnectReason.ROOM_DELETED
              ? 'The meeting ended.'
              : 'You were removed from the meeting.',
          );
          void writeCallLogSnapshot(context, 'completed', durationSec);
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
        const rejectPayload = {
          callId: payload.callId,
          conversationId: payload.conversationId,
          reason: 'busy' as const,
        };
        const channelNames = currentUserId
          ? [getUserCallChannelName(payload.caller.id), getUserCallChannelName(currentUserId)]
          : [getUserCallChannelName(payload.caller.id)];

        void broadcastDirectCallSignalBurst(channelNames, 'call:reject', rejectPayload, 3).catch(
          () => undefined,
        );
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
        canModerateMeeting: false,
        peerUserId: payload.caller.id,
        peerLabel: payload.caller.username,
        peerAvatar: payload.caller.avatar,
        liveToken: null,
        connectedAt: null,
        meetingBanner: null,
      });

      void loadCallToken({
        conversationId: payload.conversationId,
        video: payload.video,
      }).then((tokenResult) => {
        if (!tokenResult.ok) {
          return;
        }

        setSession((current) =>
          current.callId === payload.callId && current.phase === 'incoming'
            ? { ...current, liveToken: tokenResult.data }
            : current,
        );
      });

      void showIncomingCallDesktopNotification(
        payload.caller.username,
        payload.video,
        payload.callId,
        () => {
          focusCallWindow();
        },
      );

      bindDirectCallPeerChannel(payload.caller.id);
      armIncomingCallTimeout(payload);
    },
    [
      armIncomingCallTimeout,
      bindDirectCallPeerChannel,
      clearCallSignalTimers,
      currentUserId,
      disconnectRoom,
      isRemoteUserBusy,
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

      let liveToken = active.liveToken;

      if (!liveToken) {
        const tokenResult = await loadCallToken({
          conversationId: active.conversationId,
          video: active.video,
        });

        if (!tokenResult.ok) {
          reportError(formatCallApiError(tokenResult.error, tokenResult.status));
          await finalizeDirectCall('cancelled');
          return;
        }

        liveToken = tokenResult.data;
        setSession((current) =>
          current.callId === active.callId ? { ...current, liveToken: tokenResult.data } : current,
        );
      }

      try {
        await connectLiveKit(liveToken, active.video);
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

      if (
        active.isGroup ||
        active.callId !== payload.callId ||
        (active.conversationId &&
          payload.conversationId &&
          active.conversationId !== payload.conversationId) ||
        (active.phase !== 'outgoing' && active.phase !== 'connecting')
      ) {
        return;
      }

      if (seenCallIdsRef.current.has(payload.callId)) {
        return;
      }

      logCallDebug('[Calls] Remote reject handled', payload.callId);
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

      if (
        active.isGroup ||
        active.callId !== payload.callId ||
        (active.conversationId &&
          payload.conversationId &&
          active.conversationId !== payload.conversationId) ||
        (active.phase !== 'incoming' && active.phase !== 'connecting')
      ) {
        return;
      }

      if (seenCallIdsRef.current.has(payload.callId)) {
        return;
      }

      logCallDebug('[Calls] Remote cancel handled', payload.callId);
      clearCallSignalTimers();
      seenCallIdsRef.current.add(payload.callId);
      const context = snapshotCallContext();
      resetSession();
      void writeCallLogSnapshot(context, 'missed', 0);
    },
    [clearCallSignalTimers, resetSession, snapshotCallContext, writeCallLogSnapshot],
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
      const isActiveModerator =
        active.isGroup &&
        active.conversationId === payload.conversationId &&
        (active.phase === 'active' || active.phase === 'connecting') &&
        isMeetingModerator(active);

      if (!isActiveModerator) {
        return;
      }

      upsertJoinRequest(payload);

      void listMeetingJoinRequests(payload.conversationId).then((result) => {
        if (result.ok) {
          setPendingJoinRequests(result.data);
        }
      });
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
        canModerateMeeting: tokenResult.data.canModerateMeeting === true,
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
        reportError('Could not join the meeting. Please try again.');
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
        canModerateMeeting: false,
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

      if (!currentUserId || !active.conversationId || !active.isGroup || !isMeetingModerator(active)) {
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
        reportError('Could not respond to the join request. Please try again.');
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

    if (!active.isGroup || !active.conversationId || !isMeetingModerator(active)) {
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
        reportErrorRef.current(formatCallSignalingError());
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
      !isMeetingModerator(session) ||
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
    session.canModerateMeeting,
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
      reportError(formatCallSignalingError());
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

      const liveToken = tokenResult.ok ? tokenResult.data : null;

      if (!tokenResult.ok) {
        reportError(formatCallApiError(tokenResult.error, tokenResult.status));
      }

      const roomName =
        liveToken?.roomName || buildDirectCallRoomName(conversation.id);

      setSession({
        phase: 'outgoing',
        callId,
        conversationId: conversation.id,
        roomName,
        video,
        isGroup: false,
        isInitiator: true,
        canModerateMeeting: false,
        peerUserId: conversation.peerUserId,
        peerLabel: conversation.title,
        peerAvatar: conversation.avatarUrl,
        liveToken,
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
            reportError(formatCallSignalingError());
          });
      };

      bindDirectCallPeerChannel(conversation.peerUserId!);
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
      bindDirectCallPeerChannel,
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
    setCallNotice('');
    clearCallSignalTimers();

    const permissionResult = await ensureCallMediaPermissions(active.video);

    if (!permissionResult.ok) {
      setBusy(false);
      setCallNotice(formatCallPermissionError(permissionResult.error));
      armIncomingCallTimeout({
        callId: active.callId,
        conversationId: active.conversationId,
        caller: {
          id: active.peerUserId,
          username: active.peerLabel,
          avatar: active.peerAvatar,
        },
      });
      return;
    }

    let liveToken = active.liveToken;

    if (!liveToken) {
      const tokenResult = await loadCallToken({
        conversationId: active.conversationId,
        video: active.video,
      });

      if (!tokenResult.ok) {
        setBusy(false);
        setCallNotice(formatCallApiError(tokenResult.error, tokenResult.status));
        armIncomingCallTimeout({
          callId: active.callId,
          conversationId: active.conversationId,
          caller: {
            id: active.peerUserId,
            username: active.peerLabel,
            avatar: active.peerAvatar,
          },
        });
        return;
      }

      liveToken = tokenResult.data;
      setSession((current) =>
        current.callId === active.callId ? { ...current, liveToken: tokenResult.data } : current,
      );
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
      await connectLiveKit(liveToken, active.video);
      clearCallSignalTimers();
      setCallNotice('');
    } catch (error) {
      clearCallSignalTimers();
      const message = formatCallMediaError(error);
      setCallNotice(message);
      reportError(message);
      await disconnectRoom();
      setSession((current) =>
        current.callId === active.callId
          ? {
              ...current,
              phase: 'incoming',
              liveToken,
              connectedAt: null,
            }
          : current,
      );
      armIncomingCallTimeout({
        callId: active.callId,
        conversationId: active.conversationId,
        caller: {
          id: active.peerUserId,
          username: active.peerLabel,
          avatar: active.peerAvatar,
        },
      });
    } finally {
      setBusy(false);
    }
  }, [
    armIncomingCallTimeout,
    clearCallSignalTimers,
    connectLiveKit,
    currentUserId,
    disconnectRoom,
    reportError,
  ]);

  const deliverDirectCallEndSignal = useCallback(
    async (peerUserId: string, event: 'call:reject' | 'call:cancel', payload: unknown) => {
      const ready = await ensureCallSignalingReady();

      if (!ready) {
        throw new Error(formatCallSignalingError());
      }

      if (!currentUserId) {
        throw new Error('Sign in again to manage calls.');
      }

      const channelNames = [
        getUserCallChannelName(peerUserId),
        getUserCallChannelName(currentUserId),
      ];

      await broadcastDirectCallSignalBurst(channelNames, event, payload, 4);

      if (event === 'call:reject') {
        try {
          await broadcastDirectCallSignalBurst(channelNames, 'call:declined', payload, 2);
        } catch {
          // Primary reject already sent.
        }
      }
    },
    [currentUserId, ensureCallSignalingReady],
  );

  const rejectIncomingCall = useCallback(async () => {
    const active = sessionRef.current;

    if (
      (active.phase !== 'incoming' && active.phase !== 'connecting') ||
      active.isGroup ||
      !active.peerUserId
    ) {
      return;
    }

    clearCallSignalTimers();

    const context = snapshotCallContext();
    const { callId, conversationId, peerUserId } = active;

    seenCallIdsRef.current.add(callId);
    void writeCallLogSnapshot(context, 'declined', 0);
    resetSession();

    try {
      await deliverDirectCallEndSignal(peerUserId, 'call:reject', {
        callId,
        conversationId,
        reason: 'declined',
      });
    } catch (error) {
      logCallDebug(
        '[Calls] Reject signal failed',
        error instanceof Error ? error.message : error,
      );
      reportError(formatCallSignalingError());
    }
  }, [
    clearCallSignalTimers,
    deliverDirectCallEndSignal,
    reportError,
    resetSession,
    snapshotCallContext,
    writeCallLogSnapshot,
  ]);

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
    void writeCallLogSnapshot(context, 'cancelled', 0);
    resetSession();

    try {
      await deliverDirectCallEndSignal(peerUserId, 'call:cancel', {
        callId,
        conversationId,
      });
    } catch (error) {
      logCallDebug(
        '[Calls] Cancel signal failed',
        error instanceof Error ? error.message : error,
      );
      reportError(formatCallSignalingError());
    }
  }, [
    clearCallSignalTimers,
    deliverDirectCallEndSignal,
    reportError,
    resetSession,
    snapshotCallContext,
    writeCallLogSnapshot,
  ]);

  const endActiveCall = useCallback(async () => {
    const active = sessionRef.current;

    if (active.phase === 'outgoing' || (active.phase === 'connecting' && active.isInitiator)) {
      await cancelOutgoingCall();
      return;
    }

    if (active.phase === 'incoming' || (active.phase === 'connecting' && !active.isInitiator)) {
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
    } = active;
    const shouldEndMeetingForAll = isGroup && isMeetingModerator(active);

    resetSession();

    if (isGroup) {
      if (shouldEndMeetingForAll) {
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
        reportError(formatCallApiError(notifyResult.error, notifyResult.status));
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
        canModerateMeeting: readCanModerateMeeting(tokenResult.data, true),
        peerUserId: null,
        peerLabel: conversation.title,
        peerAvatar: conversation.avatarUrl,
        liveToken: tokenResult.data,
        connectedAt: null,
        meetingBanner: null,
      });

      try {
        await connectLiveKit(tokenResult.data, video);
        void refreshMeetingJoinRequests();
      } catch (error) {
        reportError('Could not start the meeting. Please try again.');
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
      refreshMeetingJoinRequests,
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
          canModerateMeeting: tokenResult.data.canModerateMeeting === true,
          peerUserId: null,
          peerLabel: conversation.title,
          peerAvatar: conversation.avatarUrl,
          liveToken: tokenResult.data,
          connectedAt: null,
          meetingBanner: null,
        });

        await connectLiveKit(tokenResult.data, video);
        if (tokenResult.data.canModerateMeeting) {
          void refreshMeetingJoinRequests();
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to join the meeting.';

        if (shouldUseMeetingJoinRequest(message)) {
          try {
            await submitMeetingJoinRequest(conversation, callId, video);
            return;
          } catch {
            reportError('Could not join the meeting. Please try again.');
            await resetSession();
            return;
          }
        }

        reportError('Could not join the meeting. Please try again.');
        await resetSession();
      } finally {
        setBusy(false);
      }
    },
    [connectLiveKit, currentUserId, refreshMeetingJoinRequests, reportError, resetSession, submitMeetingJoinRequest],
  );

  const dismissMeetingBanner = useCallback(() => {
    const banner = sessionRef.current.meetingBanner;

    setSession((current) => ({ ...current, meetingBanner: null }));

    if (banner?.conversationId && banner.callId) {
      void declineCallMeetingInvite({
        conversationId: banner.conversationId,
        callId: banner.callId,
      }).catch((error) => {
        logCallDebug(
          '[Calls] Meeting invite decline failed',
          error instanceof Error ? error.message : error,
        );
      });
    }
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
      try {
        await mediasoupSession.setCameraEnabled(next);
        setCameraEnabled(next);
        setMediasoupLocalVideo(mediasoupSession.getLocalVideoStream());
      } catch (error) {
        reportError(formatCallMediaError(error));
      }
      return;
    }

    const room = roomRef.current;

    if (!room) {
      return;
    }

    await room.localParticipant.setCameraEnabled(next);
    setCameraEnabled(next);
  }, [cameraEnabled, reportError]);

  const toggleScreenShare = useCallback(async () => {
    const mediasoupSession = mediasoupRef.current;
    const room = roomRef.current;
    const next = !screenShareEnabled;

    if (next) {
      const permissionResult = await ensureScreenCapturePermission();

      if (!permissionResult.ok) {
        reportError('Screen sharing is not allowed. Check Settings and try again.');
        return;
      }
    }

    try {
      if (mediasoupSession) {
        await mediasoupSession.setScreenShareEnabled(next);
        setScreenShareEnabled(mediasoupSession.isScreenShareEnabled());
        setMediasoupLocalVideo(
          mediasoupSession.getScreenShareStream() ?? mediasoupSession.getLocalVideoStream(),
        );
        logCallDebug(next ? '[Calls] Mediasoup screen sharing started' : '[Calls] Mediasoup screen sharing stopped');
        return;
      }

      if (!room) {
        reportError('Screen sharing is not available for this call yet.');
        return;
      }

      await room.localParticipant.setScreenShareEnabled(next, {
        audio: true,
      });
      setScreenShareEnabled(next);
      logCallDebug(next ? '[Calls] Screen sharing started' : '[Calls] Screen sharing stopped');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to share your screen.';
      reportError('Could not share your screen. Please try again.');
      logCallDebug('[Calls] Screen sharing failed', message);
    }
  }, [reportError, screenShareEnabled]);

  const localVideoTrack = roomRef.current?.localParticipant.getTrackPublication(Track.Source.Camera)?.videoTrack ?? null;

  return {
    session,
    busy,
    callNotice,
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
