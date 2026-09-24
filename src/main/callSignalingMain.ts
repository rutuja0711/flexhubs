import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';
import type { BrowserWindow } from 'electron';
import type { RealtimeClientConfig } from '../shared/realtime';

const DIRECT_EVENTS = [
  'call:invite',
  'call:accept',
  'call:reject',
  'call:declined',
  'call:cancel',
  'call:end',
  'call:meeting-join-response',
] as const;

const HUB_EVENTS = [
  'call:meeting-started',
  'call:meeting-ended',
  'call:meeting-join-request',
  'call:meeting-join-response',
] as const;

type ChannelMode = 'direct' | 'hub';

type ChannelEntry = {
  channel: RealtimeChannel;
  ready: Promise<void>;
  mode: ChannelMode;
};

let client: SupabaseClient | null = null;
let windowProvider: (() => BrowserWindow | null) | null = null;
const channels = new Map<string, ChannelEntry>();

export function setCallSignalingWindowProvider(provider: () => BrowserWindow | null): void {
  windowProvider = provider;
}

function emitBroadcast(channelName: string, event: string, payload: unknown): void {
  const window = windowProvider?.();

  if (!window || window.isDestroyed()) {
    return;
  }

  window.webContents.send('call-signaling:broadcast', { channelName, event, payload });
}

function waitForSubscribe(channel: RealtimeChannel, channelName: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`Call channel subscribe timeout (${channelName})`));
    }, 20_000);

    channel.subscribe((status, error) => {
      if (status === 'SUBSCRIBED') {
        clearTimeout(timeoutId);
        resolve();
        return;
      }

      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        clearTimeout(timeoutId);
        reject(new Error(error?.message ?? `Call channel ${status} (${channelName})`));
      }
    });
  });
}

function attachChannelListeners(channel: RealtimeChannel, channelName: string, mode: ChannelMode): void {
  const events = mode === 'hub' ? HUB_EVENTS : DIRECT_EVENTS;

  for (const event of events) {
    channel.on('broadcast', { event }, ({ payload }) => {
      emitBroadcast(channelName, event, payload);
    });
  }
}

async function ensureClient(config: RealtimeClientConfig): Promise<SupabaseClient> {
  if (client) {
    await client.realtime.setAuth(config.accessToken);
    return client;
  }

  const nextClient = createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  await nextClient.realtime.setAuth(config.accessToken);
  client = nextClient;
  return nextClient;
}

export async function initMainCallSignaling(config: RealtimeClientConfig): Promise<void> {
  await ensureClient(config);
}

export async function refreshMainCallSignalingAuth(config: RealtimeClientConfig): Promise<void> {
  await ensureClient(config);
}

export async function subscribeMainCallChannel(
  channelName: string,
  mode: ChannelMode,
): Promise<void> {
  const normalized = channelName.trim();

  if (!normalized) {
    throw new Error('Call channel name is required.');
  }

  const existing = channels.get(normalized);

  if (existing) {
    await existing.ready;
    return;
  }

  const activeClient = client;

  if (!activeClient) {
    throw new Error('Call signaling is not initialized.');
  }

  const channel = activeClient.channel(normalized, {
    config: {
      broadcast: {
        self: false,
        ack: true,
      },
    },
  });

  attachChannelListeners(channel, normalized, mode);

  const ready = waitForSubscribe(channel, normalized).catch((error) => {
    channels.delete(normalized);
    void activeClient.removeChannel(channel);
    throw error;
  });

  channels.set(normalized, { channel, ready, mode });
  await ready;
  console.log(`[CallSignalingMain] Subscribed to ${normalized}`);
}

export async function sendMainCallSignal(
  channelName: string,
  event: string,
  payload: unknown,
): Promise<void> {
  const normalized = channelName.trim();

  if (!normalized) {
    throw new Error('Call channel name is required.');
  }

  if (!client) {
    throw new Error('Call signaling is not initialized.');
  }

  let entry = channels.get(normalized);

  if (!entry) {
    const mode: ChannelMode = normalized.startsWith('call:hub:') ? 'hub' : 'direct';
    await subscribeMainCallChannel(normalized, mode);
    entry = channels.get(normalized);
  }

  if (!entry) {
    throw new Error(`Call channel unavailable (${normalized}).`);
  }

  await entry.ready;

  const result = await entry.channel.send({
    type: 'broadcast',
    event,
    payload,
  });

  if (result === 'error') {
    throw new Error(`Call signal broadcast failed (${event} on ${normalized})`);
  }

  console.log(`[CallSignalingMain] Sent ${event} on ${normalized}`);
}

export async function unsubscribeMainCallChannel(channelName: string): Promise<void> {
  const normalized = channelName.trim();
  const entry = channels.get(normalized);

  if (!entry || !client) {
    return;
  }

  channels.delete(normalized);
  await client.removeChannel(entry.channel);
}

export async function disconnectMainCallSignaling(): Promise<void> {
  if (!client) {
    return;
  }

  for (const channelName of [...channels.keys()]) {
    await unsubscribeMainCallChannel(channelName);
  }

  client = null;
}

export function isMainCallSignalingReady(): boolean {
  return client != null;
}
