import type {
  CallAcceptPayload,
  CallCancelPayload,
  CallEndPayload,
  CallInvitePayload,
  CallRejectPayload,
  MeetingEndedPayload,
  MeetingJoinRequestPayload,
  MeetingJoinResponsePayload,
  MeetingStartedPayload,
} from '../shared/calls';
import {
  buildHubCallChannel,
  buildUserCallChannel,
  normalizeCallAcceptPayload,
  normalizeCallCancelPayload,
  normalizeCallInvitePayload,
  normalizeCallRejectPayload,
  normalizeMeetingJoinRequestPayload,
  normalizeMeetingJoinResponsePayload,
} from '../shared/calls';
import type { RealtimeClientConfig } from '../shared/realtime';
import { logCallDebug } from './callDebug';

export type DirectCallHandlers = {
  onInvite?: (payload: CallInvitePayload) => void;
  onAccept?: (payload: CallAcceptPayload) => void;
  onReject?: (payload: CallRejectPayload) => void;
  onCancel?: (payload: CallCancelPayload) => void;
  onEnd?: (payload: CallEndPayload) => void;
  onMeetingJoinResponse?: (payload: MeetingJoinResponsePayload) => void;
};

export type HubCallHandlers = {
  onMeetingStarted?: (payload: MeetingStartedPayload) => void;
  onMeetingEnded?: (payload: MeetingEndedPayload) => void;
  onMeetingJoinRequest?: (payload: MeetingJoinRequestPayload) => void;
  onMeetingJoinResponse?: (payload: MeetingJoinResponsePayload) => void;
};

type ChannelEntry = {
  handlers: DirectCallHandlers | HubCallHandlers;
  mode: 'direct' | 'hub';
};

const CALL_EVENTS = {
  invite: 'call:invite',
  accept: 'call:accept',
  reject: 'call:reject',
  declined: 'call:declined',
  cancel: 'call:cancel',
  end: 'call:end',
} as const;

const HUB_EVENTS = {
  started: 'call:meeting-started',
  ended: 'call:meeting-ended',
  joinRequest: 'call:meeting-join-request',
  joinResponse: 'call:meeting-join-response',
} as const;

let config: RealtimeClientConfig | null = null;
let userCallChannelSubscribed = false;
const channels = new Map<string, ChannelEntry>();
let ipcListenerAttached = false;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function asPayload<T>(value: unknown): T | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  return value as T;
}

function readDirectHandlers(channelName: string): DirectCallHandlers | null {
  const entry = channels.get(channelName);

  if (!entry || entry.mode !== 'direct') {
    return null;
  }

  return entry.handlers as DirectCallHandlers;
}

function readHubHandlers(channelName: string): HubCallHandlers | null {
  const entry = channels.get(channelName);

  if (!entry || entry.mode !== 'hub') {
    return null;
  }

  return entry.handlers as HubCallHandlers;
}

function dispatchDirectEvent(channelName: string, event: string, payload: unknown): void {
  switch (event) {
    case CALL_EVENTS.invite: {
      const parsed = normalizeCallInvitePayload(payload);

      if (parsed) {
        logCallDebug('[Calls] Received invite from', parsed.caller.username);
        readDirectHandlers(channelName)?.onInvite?.(parsed);
        return;
      }

      logCallDebug('[Calls] Ignored invite payload', payload);
      return;
    }
    case CALL_EVENTS.accept: {
      const parsed = normalizeCallAcceptPayload(payload);

      if (parsed) {
        logCallDebug('[Calls] Received accept', parsed.callId);
        readDirectHandlers(channelName)?.onAccept?.(parsed);
        return;
      }

      logCallDebug('[Calls] Ignored accept payload', payload);
      return;
    }
    case CALL_EVENTS.reject:
    case CALL_EVENTS.declined: {
      const parsed = normalizeCallRejectPayload(payload);

      if (parsed) {
        logCallDebug(`[Calls] Received ${event}`, parsed.callId);
        readDirectHandlers(channelName)?.onReject?.(parsed);
        return;
      }

      logCallDebug(`[Calls] Ignored ${event} payload`, payload);
      return;
    }
    case CALL_EVENTS.cancel: {
      const parsed = normalizeCallCancelPayload(payload);

      if (parsed) {
        logCallDebug('[Calls] Received cancel', parsed.callId);
        readDirectHandlers(channelName)?.onCancel?.(parsed);
        return;
      }

      logCallDebug('[Calls] Ignored cancel payload', payload);
      return;
    }
    case CALL_EVENTS.end: {
      const parsed = asPayload<CallEndPayload>(payload);

      if (parsed) {
        readDirectHandlers(channelName)?.onEnd?.(parsed);
      }

      return;
    }
    case HUB_EVENTS.joinResponse: {
      const parsed = normalizeMeetingJoinResponsePayload(payload);

      if (parsed) {
        logCallDebug('[Calls] Meeting join response (user channel)', parsed.approved ? 'approved' : 'denied');
        readDirectHandlers(channelName)?.onMeetingJoinResponse?.(parsed);
      }

      return;
    }
    default:
      return;
  }
}

function dispatchHubEvent(channelName: string, event: string, payload: unknown): void {
  switch (event) {
    case HUB_EVENTS.started: {
      const parsed = asPayload<MeetingStartedPayload>(payload);

      if (parsed) {
        logCallDebug('[Calls] Group meeting started', parsed.conversationTitle);
        readHubHandlers(channelName)?.onMeetingStarted?.(parsed);
      }

      return;
    }
    case HUB_EVENTS.ended: {
      const parsed = asPayload<MeetingEndedPayload>(payload);

      if (parsed) {
        readHubHandlers(channelName)?.onMeetingEnded?.(parsed);
      }

      return;
    }
    case HUB_EVENTS.joinRequest: {
      const parsed = normalizeMeetingJoinRequestPayload(payload);

      if (parsed) {
        logCallDebug('[Calls] Meeting join request', parsed.requester.username);
        readHubHandlers(channelName)?.onMeetingJoinRequest?.(parsed);
      }

      return;
    }
    case HUB_EVENTS.joinResponse: {
      const parsed = normalizeMeetingJoinResponsePayload(payload);

      if (parsed) {
        logCallDebug('[Calls] Meeting join response', parsed.approved ? 'approved' : 'denied');
        readHubHandlers(channelName)?.onMeetingJoinResponse?.(parsed);
      }

      return;
    }
    default:
      return;
  }
}

function dispatchIncomingEvent(channelName: string, event: string, payload: unknown): void {
  const entry = channels.get(channelName);

  if (!entry) {
    return;
  }

  if (entry.mode === 'hub') {
    dispatchHubEvent(channelName, event, payload);
    return;
  }

  dispatchDirectEvent(channelName, event, payload);
}

function ensureIpcListener(): void {
  if (ipcListenerAttached || !window.electronAPI?.onCallSignalingBroadcast) {
    return;
  }

  ipcListenerAttached = true;

  window.electronAPI.onCallSignalingBroadcast(({ channelName, event, payload }) => {
    dispatchIncomingEvent(channelName, event, payload);
  });
}

async function subscribeChannel(
  channelName: string,
  mode: 'direct' | 'hub',
  handlers: DirectCallHandlers | HubCallHandlers,
): Promise<void> {
  if (!window.electronAPI?.subscribeCallSignalingChannel) {
    throw new Error('Call signaling is unavailable in this environment.');
  }

  channels.set(channelName, { handlers, mode });

  const result = await window.electronAPI.subscribeCallSignalingChannel(channelName, mode);

  if (!result.ok) {
    channels.delete(channelName);
    throw new Error(result.error);
  }

  logCallDebug(`[Calls] Subscribed to ${channelName}`);
}

async function unsubscribeChannel(channelName: string): Promise<void> {
  channels.delete(channelName);

  if (!window.electronAPI?.unsubscribeCallSignalingChannel) {
    return;
  }

  await window.electronAPI.unsubscribeCallSignalingChannel(channelName);
}

export async function initCallSignaling(nextConfig: RealtimeClientConfig): Promise<void> {
  ensureIpcListener();

  if (!window.electronAPI?.initCallSignaling) {
    throw new Error('Call signaling is unavailable in this environment.');
  }

  const result = await window.electronAPI.initCallSignaling(nextConfig);

  if (!result.ok) {
    throw new Error(result.error);
  }

  config = nextConfig;
}

export async function refreshCallSignalingAuth(nextConfig: RealtimeClientConfig): Promise<void> {
  if (!window.electronAPI?.refreshCallSignalingAuth) {
    throw new Error('Call signaling is unavailable in this environment.');
  }

  const result = await window.electronAPI.refreshCallSignalingAuth(nextConfig);

  if (!result.ok) {
    throw new Error(result.error);
  }

  config = nextConfig;
}

export async function ensureDirectCallPeerChannel(
  ownUserId: string,
  peerUserId: string,
  handlers: DirectCallHandlers,
): Promise<void> {
  if (!config) {
    throw new Error('Call signaling is not initialized.');
  }

  const normalizedPeerUserId = peerUserId.trim();
  const normalizedOwnUserId = ownUserId.trim();

  if (!normalizedPeerUserId || normalizedPeerUserId === normalizedOwnUserId) {
    return;
  }

  const channelName = buildUserCallChannel(normalizedPeerUserId);
  const existing = channels.get(channelName);

  if (existing) {
    existing.handlers = handlers;
    return;
  }

  await subscribeChannel(channelName, 'direct', handlers);
}

export function releaseDirectCallPeerChannel(ownUserId: string, peerUserId: string | null | undefined): void {
  const normalizedPeerUserId = peerUserId?.trim();

  if (!normalizedPeerUserId || normalizedPeerUserId === ownUserId.trim()) {
    return;
  }

  void unsubscribeChannel(buildUserCallChannel(normalizedPeerUserId));
}

export async function subscribeUserCallChannel(
  userId: string,
  handlers: DirectCallHandlers,
): Promise<void> {
  if (!config) {
    throw new Error('Call signaling is not initialized.');
  }

  userCallChannelSubscribed = false;

  const channelName = buildUserCallChannel(userId);

  await subscribeChannel(channelName, 'direct', handlers);
  userCallChannelSubscribed = true;
}

export async function subscribeHubCallChannel(
  conversationId: string,
  handlers: HubCallHandlers,
): Promise<void> {
  if (!config) {
    throw new Error('Call signaling is not initialized.');
  }

  const channelName = buildHubCallChannel(conversationId);
  const existing = channels.get(channelName);

  if (existing) {
    existing.handlers = handlers;
    return;
  }

  await subscribeChannel(channelName, 'hub', handlers);
}

export async function syncHubCallChannels(
  conversationIds: string[],
  handlers: HubCallHandlers,
): Promise<void> {
  if (!config) {
    throw new Error('Call signaling is not initialized.');
  }

  const desired = new Set(conversationIds.map((id) => id.trim()).filter(Boolean));

  for (const [channelName, entry] of [...channels.entries()]) {
    if (entry.mode !== 'hub') {
      continue;
    }

    const conversationId = channelName.replace(/^call:hub:/, '');

    if (!desired.has(conversationId)) {
      void unsubscribeChannel(channelName);
    }
  }

  for (const conversationId of desired) {
    try {
      await subscribeHubCallChannel(conversationId, handlers);
    } catch (error) {
      logCallDebug(
        `[Calls] Hub channel subscribe failed (${conversationId})`,
        error instanceof Error ? error.message : error,
      );
    }
  }
}

export async function sendSignalWithRetries(
  channelName: string,
  event: string,
  payload: unknown,
  retries = 2,
): Promise<void> {
  if (!config || !window.electronAPI?.sendCallSignaling) {
    throw new Error('Call signaling is not initialized.');
  }

  let lastError: unknown = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const result = await window.electronAPI.sendCallSignaling(channelName, event, payload);

    if (result.ok) {
      logCallDebug(`[Calls] Sent ${event} on ${channelName}`);
      return;
    }

    lastError = new Error(result.error);

    if (attempt < retries) {
      await sleep(250 * (attempt + 1));
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Could not deliver call signal');
}

export async function broadcastDirectCallSignalBurst(
  channelNames: string[],
  event: string,
  payload: unknown,
  bursts = 4,
): Promise<void> {
  const uniqueChannels = [...new Set(channelNames.map((name) => name.trim()).filter(Boolean))];

  if (uniqueChannels.length === 0) {
    throw new Error('No call channels available for signaling.');
  }

  let successCount = 0;
  let lastError: unknown = null;

  for (let burst = 0; burst < bursts; burst += 1) {
    for (const channelName of uniqueChannels) {
      try {
        await sendSignalWithRetries(channelName, event, payload, 1);
        successCount += 1;
      } catch (error) {
        lastError = error;
      }
    }

    if (burst < bursts - 1) {
      await sleep(300);
    }
  }

  if (successCount === 0 && lastError) {
    throw lastError instanceof Error ? lastError : new Error('Could not deliver call signal');
  }
}

export async function broadcastCallEvent(
  channelName: string,
  event: string,
  payload: unknown,
): Promise<void> {
  await sendSignalWithRetries(channelName, event, payload, 0);
}

export async function disconnectCallSignaling(): Promise<void> {
  channels.clear();
  userCallChannelSubscribed = false;
  config = null;

  if (window.electronAPI?.disconnectCallSignaling) {
    await window.electronAPI.disconnectCallSignaling();
  }
}

export function disconnectUserCallChannel(userId: string): void {
  void unsubscribeChannel(buildUserCallChannel(userId));
  userCallChannelSubscribed = false;
}

export function getUserCallChannelName(userId: string): string {
  return buildUserCallChannel(userId);
}

export function getHubCallChannelName(conversationId: string): string {
  return buildHubCallChannel(conversationId);
}

export function isCallSignalingReady(): boolean {
  return config != null;
}

export function isUserCallChannelSubscribed(): boolean {
  return userCallChannelSubscribed;
}
