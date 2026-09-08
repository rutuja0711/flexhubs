import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
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
  normalizeCallInvitePayload,
  normalizeMeetingJoinRequestPayload,
  normalizeMeetingJoinResponsePayload,
} from '../shared/calls';
import type { RealtimeClientConfig } from '../shared/realtime';
import { logCallDebug } from './callDebug';
import { getSupabaseBrowserClient } from './supabaseClient';

export type DirectCallHandlers = {
  onInvite?: (payload: CallInvitePayload) => void;
  onAccept?: (payload: CallAcceptPayload) => void;
  onReject?: (payload: CallRejectPayload) => void;
  onCancel?: (payload: CallCancelPayload) => void;
  onEnd?: (payload: CallEndPayload) => void;
};

export type HubCallHandlers = {
  onMeetingStarted?: (payload: MeetingStartedPayload) => void;
  onMeetingEnded?: (payload: MeetingEndedPayload) => void;
  onMeetingJoinRequest?: (payload: MeetingJoinRequestPayload) => void;
  onMeetingJoinResponse?: (payload: MeetingJoinResponsePayload) => void;
};

type ChannelEntry = {
  channel: RealtimeChannel;
  ready: Promise<RealtimeChannel>;
  handlers: DirectCallHandlers | HubCallHandlers;
  mode: 'direct' | 'hub';
  listening: boolean;
};

const CALL_EVENTS = {
  invite: 'call:invite',
  accept: 'call:accept',
  reject: 'call:reject',
  cancel: 'call:cancel',
  end: 'call:end',
} as const;

const HUB_EVENTS = {
  started: 'call:meeting-started',
  ended: 'call:meeting-ended',
  joinRequest: 'call:meeting-join-request',
  joinResponse: 'call:meeting-join-response',
} as const;

let client: SupabaseClient | null = null;
let config: RealtimeClientConfig | null = null;
let userCallChannelSubscribed = false;
const channels = new Map<string, ChannelEntry>();
const channelReady = new Map<string, Promise<RealtimeChannel>>();

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

function buildChannelConfig() {
  return {
    broadcast: { self: false },
  } as const;
}

async function ensureClient(nextConfig: RealtimeClientConfig): Promise<SupabaseClient> {
  config = nextConfig;
  client = await getSupabaseBrowserClient(nextConfig);
  return client;
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

function removeChannelEntry(channelName: string): void {
  const entry = channels.get(channelName);

  if (!entry) {
    return;
  }

  channels.delete(channelName);
  channelReady.delete(channelName);

  if (client) {
    void client.removeChannel(entry.channel);
    return;
  }

  void entry.channel.unsubscribe();
}

function attachDirectHandlers(channel: RealtimeChannel, channelName: string): void {
  channel
    .on('broadcast', { event: CALL_EVENTS.invite }, ({ payload }) => {
      const parsed = normalizeCallInvitePayload(payload);

      if (parsed) {
        logCallDebug('[Calls] Received invite from', parsed.caller.username);
        readDirectHandlers(channelName)?.onInvite?.(parsed);
        return;
      }

      logCallDebug('[Calls] Ignored invite payload', payload);
    })
    .on('broadcast', { event: CALL_EVENTS.accept }, ({ payload }) => {
      const parsed = asPayload<CallAcceptPayload>(payload);
      if (parsed) readDirectHandlers(channelName)?.onAccept?.(parsed);
    })
    .on('broadcast', { event: CALL_EVENTS.reject }, ({ payload }) => {
      const parsed = asPayload<CallRejectPayload>(payload);
      if (parsed) readDirectHandlers(channelName)?.onReject?.(parsed);
    })
    .on('broadcast', { event: CALL_EVENTS.cancel }, ({ payload }) => {
      const parsed = asPayload<CallCancelPayload>(payload);
      if (parsed) readDirectHandlers(channelName)?.onCancel?.(parsed);
    })
    .on('broadcast', { event: CALL_EVENTS.end }, ({ payload }) => {
      const parsed = asPayload<CallEndPayload>(payload);
      if (parsed) readDirectHandlers(channelName)?.onEnd?.(parsed);
    });
}

function attachHubHandlers(channel: RealtimeChannel, channelName: string): void {
  channel
    .on('broadcast', { event: HUB_EVENTS.started }, ({ payload }) => {
      const parsed = asPayload<MeetingStartedPayload>(payload);

      if (parsed) {
        logCallDebug('[Calls] Group meeting started', parsed.conversationTitle);
        readHubHandlers(channelName)?.onMeetingStarted?.(parsed);
      }
    })
    .on('broadcast', { event: HUB_EVENTS.ended }, ({ payload }) => {
      const parsed = asPayload<MeetingEndedPayload>(payload);
      if (parsed) readHubHandlers(channelName)?.onMeetingEnded?.(parsed);
    })
    .on('broadcast', { event: HUB_EVENTS.joinRequest }, ({ payload }) => {
      const parsed = normalizeMeetingJoinRequestPayload(payload);

      if (parsed) {
        logCallDebug('[Calls] Meeting join request', parsed.requester.username);
        readHubHandlers(channelName)?.onMeetingJoinRequest?.(parsed);
      }
    })
    .on('broadcast', { event: HUB_EVENTS.joinResponse }, ({ payload }) => {
      const parsed = normalizeMeetingJoinResponsePayload(payload);

      if (parsed) {
        logCallDebug('[Calls] Meeting join response', parsed.approved ? 'approved' : 'denied');
        readHubHandlers(channelName)?.onMeetingJoinResponse?.(parsed);
      }
    });
}

async function waitForChannelSubscribe(
  channel: RealtimeChannel,
  channelName: string,
  onUnhealthy?: () => void,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    let settled = false;

    const timeoutId = window.setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error('Call channel subscribe timeout'));
      }
    }, 20_000);

    channel.subscribe((status, error) => {
      logCallDebug(`[Calls] ${channelName} status ${status}`, error?.message ?? '');

      if (!settled && status === 'SUBSCRIBED') {
        settled = true;
        window.clearTimeout(timeoutId);
        resolve();
        return;
      }

      if (
        !settled &&
        (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED')
      ) {
        settled = true;
        window.clearTimeout(timeoutId);
        reject(new Error(error?.message ?? `Call channel ${status} (${channelName})`));
        return;
      }

      if (
        settled &&
        (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED')
      ) {
        onUnhealthy?.();
      }
    });
  });
}

async function getCallChannel(
  supabase: SupabaseClient,
  channelName: string,
  attachHandlers?: (channel: RealtimeChannel) => void,
  mode: 'direct' | 'hub' = 'direct',
  handlers: DirectCallHandlers | HubCallHandlers = {},
  onUnhealthy?: () => void,
): Promise<RealtimeChannel> {
  const existing = channels.get(channelName);

  if (existing) {
    existing.handlers = handlers;

    if (attachHandlers && !existing.listening) {
      attachHandlers(existing.channel);
      existing.listening = true;
    }

    return existing.ready;
  }

  const pending = channelReady.get(channelName);

  if (pending) {
    const channel = await pending;
    const entry = channels.get(channelName);

    if (entry) {
      entry.handlers = handlers;

      if (attachHandlers && !entry.listening) {
        attachHandlers(entry.channel);
        entry.listening = true;
      }
    }

    return channel;
  }

  const channel = supabase.channel(channelName, {
    config: buildChannelConfig(),
  });

  if (attachHandlers) {
    attachHandlers(channel);
  }

  const subscribed = waitForChannelSubscribe(channel, channelName, onUnhealthy)
    .then(() => {
      logCallDebug(`[Calls] Subscribed to ${channelName}`);
      return channel;
    })
    .catch((error) => {
      removeChannelEntry(channelName);
      throw error;
    });

  channels.set(channelName, {
    channel,
    ready: subscribed,
    handlers,
    mode,
    listening: Boolean(attachHandlers),
  });

  channelReady.set(channelName, subscribed);

  try {
    return await subscribed;
  } finally {
    channelReady.delete(channelName);
  }
}

export async function initCallSignaling(nextConfig: RealtimeClientConfig): Promise<void> {
  await ensureClient(nextConfig);
}

export async function refreshCallSignalingAuth(nextConfig: RealtimeClientConfig): Promise<void> {
  await ensureClient(nextConfig);
}

export async function subscribeUserCallChannel(
  userId: string,
  handlers: DirectCallHandlers,
): Promise<void> {
  if (!client || !config) {
    throw new Error('Call signaling is not initialized.');
  }

  userCallChannelSubscribed = false;

  const channelName = buildUserCallChannel(userId);

  await getCallChannel(
    client,
    channelName,
    (channel) => attachDirectHandlers(channel, channelName),
    'direct',
    handlers,
    () => {
      userCallChannelSubscribed = false;
      removeChannelEntry(channelName);
      logCallDebug('[Calls] User call channel dropped', channelName);
    },
  );

  userCallChannelSubscribed = true;
}

export async function subscribeHubCallChannel(
  conversationId: string,
  handlers: HubCallHandlers,
): Promise<void> {
  if (!client || !config) {
    throw new Error('Call signaling is not initialized.');
  }

  const channelName = buildHubCallChannel(conversationId);

  await getCallChannel(
    client,
    channelName,
    (channel) => attachHubHandlers(channel, channelName),
    'hub',
    handlers,
  );
}

export async function syncHubCallChannels(
  conversationIds: string[],
  handlers: HubCallHandlers,
): Promise<void> {
  if (!client || !config) {
    throw new Error('Call signaling is not initialized.');
  }

  const desired = new Set(conversationIds.map((id) => id.trim()).filter(Boolean));

  for (const [channelName, entry] of [...channels.entries()]) {
    if (entry.mode !== 'hub') {
      continue;
    }

    const conversationId = channelName.replace(/^call:hub:/, '');

    if (!desired.has(conversationId)) {
      removeChannelEntry(channelName);
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
  if (!client || !config) {
    throw new Error('Call signaling is not initialized.');
  }

  let lastError: unknown = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const channel = await getCallChannel(client, channelName);
      const result = await channel.send({
        type: 'broadcast',
        event,
        payload,
      });

      if (result === 'error') {
        throw new Error('Call signal broadcast failed');
      }

      return;
    } catch (error) {
      lastError = error;
      removeChannelEntry(channelName);

      if (attempt < retries) {
        await sleep(250 * (attempt + 1));
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Could not deliver call signal');
}

export async function broadcastCallEvent(
  channelName: string,
  event: string,
  payload: unknown,
): Promise<void> {
  await sendSignalWithRetries(channelName, event, payload, 0);
}

export async function disconnectCallSignaling(): Promise<void> {
  for (const channelName of [...channels.keys()]) {
    removeChannelEntry(channelName);
  }

  userCallChannelSubscribed = false;
  client = null;
  config = null;
}

export function disconnectUserCallChannel(userId: string): void {
  removeChannelEntry(buildUserCallChannel(userId));
  userCallChannelSubscribed = false;
}

export function getUserCallChannelName(userId: string): string {
  return buildUserCallChannel(userId);
}

export function getHubCallChannelName(conversationId: string): string {
  return buildHubCallChannel(conversationId);
}

export function isCallSignalingReady(): boolean {
  return client != null && config != null;
}

export function isUserCallChannelSubscribed(): boolean {
  return userCallChannelSubscribed;
}
