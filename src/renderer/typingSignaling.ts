import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import type { RealtimeClientConfig, TypingUpdate } from '../shared/realtime';
import { buildConversationTypingChannel, extractTypingUpdate } from '../shared/realtime';
import { loadRealtimeConfig } from './callsApi';
import { getSupabaseBrowserClient } from './supabaseClient';

type TypingHandler = (update: TypingUpdate) => void;

let client: SupabaseClient | null = null;
let config: RealtimeClientConfig | null = null;
let handler: TypingHandler | null = null;
const channels = new Map<string, RealtimeChannel>();

function emitTyping(payload: unknown, conversationId: string, isTypingOverride?: boolean): void {
  if (!handler) {
    return;
  }

  const typing = extractTypingUpdate(payload, conversationId);

  if (!typing) {
    return;
  }

  handler({
    ...typing,
    isTyping: isTypingOverride ?? typing.isTyping,
  });
}

async function ensureClient(): Promise<SupabaseClient | null> {
  if (client && config) {
    return client;
  }

  const result = await loadRealtimeConfig();

  if (!result.ok) {
    console.warn('[Typing] signaling unavailable:', result.error);
    return null;
  }

  config = result.data;
  client = await getSupabaseBrowserClient(config);
  return client;
}

function attachTypingListeners(channel: RealtimeChannel, conversationId: string): void {
  const handle = (payload: unknown, isTyping?: boolean) => {
    emitTyping(payload, conversationId, isTyping);
  };

  for (const event of ['typing', 'typing:start', 'typing:started', 'user:typing']) {
    channel.on('broadcast', { event }, ({ payload }) => {
      handle(payload, true);
    });
  }

  for (const event of ['typing:stop', 'typing:stopped', 'typing:end', 'user:typing:stop']) {
    channel.on('broadcast', { event }, ({ payload }) => {
      handle(payload, false);
    });
  }
}

async function subscribeChannelName(
  supabase: SupabaseClient,
  channelName: string,
  conversationId: string,
): Promise<void> {
  const key = `${conversationId}::${channelName}`;

  if (channels.has(key)) {
    return;
  }

  const channel = supabase.channel(channelName, {
    config: { broadcast: { self: false, ack: false } },
  });

  attachTypingListeners(channel, conversationId);

  await new Promise<void>((resolve) => {
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        resolve();
      }
    });
  });

  channels.set(key, channel);
}

async function subscribeConversation(
  supabase: SupabaseClient,
  conversationId: string,
): Promise<void> {
  await subscribeChannelName(
    supabase,
    buildConversationTypingChannel(conversationId),
    conversationId,
  );
}

export function setTypingSignalingHandler(nextHandler: TypingHandler | null): void {
  handler = nextHandler;
}

export async function syncTypingSignalingSubscriptions(conversationIds: string[]): Promise<void> {
  const supabase = await ensureClient();

  if (!supabase) {
    return;
  }

  const desired = new Set(conversationIds.map((id) => id.trim()).filter(Boolean));

  for (const [key, channel] of [...channels.entries()]) {
    const conversationId = key.split('::')[0];

    if (!desired.has(conversationId)) {
      await supabase.removeChannel(channel);
      channels.delete(key);
    }
  }

  for (const conversationId of desired) {
    await subscribeConversation(supabase, conversationId);
  }
}

export async function broadcastTypingIndicator(
  conversationId: string,
  payload: { userId: string; username: string | null; isTyping: boolean },
): Promise<void> {
  const supabase = await ensureClient();

  if (!supabase) {
    return;
  }

  let channel: RealtimeChannel | null = null;

  for (const [key, existingChannel] of channels.entries()) {
    if (key.startsWith(`${conversationId}::`)) {
      channel = existingChannel;
      break;
    }
  }

  if (!channel) {
    const channelName = buildConversationTypingChannel(conversationId);
    await subscribeChannelName(supabase, channelName, conversationId);
    channel = channels.get(`${conversationId}::${channelName}`) ?? null;
  }

  if (!channel) {
    return;
  }

  await channel.send({
    type: 'broadcast',
    event: payload.isTyping ? 'typing' : 'typing:stop',
    payload: {
      userId: payload.userId,
      conversationId,
      isTyping: payload.isTyping,
      username: payload.username,
    },
  });
}

export async function stopTypingSignaling(): Promise<void> {
  if (client) {
    for (const channel of channels.values()) {
      await client.removeChannel(channel);
    }
  }

  channels.clear();
  handler = null;
  client = null;
  config = null;
}
