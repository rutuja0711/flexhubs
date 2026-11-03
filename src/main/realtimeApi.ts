import { API_BASE_URL } from '../shared/api';
import type { ApiResult } from '../shared/api';
import { buildRealtimeClientConfig } from '../shared/supabaseEnv';
import {
  extractRealtimeAccessToken,
  extractRealtimeClientConfig,
  extractRealtimeToken,
  normalizePresencePayload,
  normalizeRealtimeStatus,
  type RealtimeClientConfig,
  type RealtimeStatusPayload,
} from '../shared/realtime';
import { normalizePresenceUserId } from '../shared/chat';
import { apiGet, apiPatch, apiPost } from './apiRequest';

function readMainSupabaseEnv(): Record<string, string | undefined> {
  return {
    VITE_SUPABASE_URL:
      typeof __FLEXHUBS_SUPABASE_URL__ !== 'undefined' ? __FLEXHUBS_SUPABASE_URL__ : process.env.VITE_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_URL:
      typeof __FLEXHUBS_SUPABASE_URL__ !== 'undefined'
        ? __FLEXHUBS_SUPABASE_URL__
        : process.env.NEXT_PUBLIC_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY:
      typeof __FLEXHUBS_SUPABASE_ANON_KEY__ !== 'undefined'
        ? __FLEXHUBS_SUPABASE_ANON_KEY__
        : process.env.VITE_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SUPABASE_ANON_KEY:
      typeof __FLEXHUBS_SUPABASE_ANON_KEY__ !== 'undefined'
        ? __FLEXHUBS_SUPABASE_ANON_KEY__
        : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    VITE_SUPABASE_PUBLISHABLE_KEY: process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  };
}

export async function fetchRealtimeStatus(token: string): Promise<ApiResult<RealtimeStatusPayload>> {
  const result = await apiGet<unknown>(
    `${API_BASE_URL}/realtime/status`,
    token,
    'Realtime Status API',
  );

  if (!result.ok) {
    return result;
  }

  return { ok: true, data: normalizeRealtimeStatus(result.data) };
}

export async function fetchRealtimeToken(token: string): Promise<ApiResult<string>> {
  const result = await apiGet<unknown>(
    `${API_BASE_URL}/realtime/token`,
    token,
    'Realtime Token API',
  );

  if (!result.ok) {
    return result;
  }

  const realtimeToken = extractRealtimeToken(result.data);

  if (!realtimeToken) {
    return {
      ok: false,
      error: 'Realtime token missing from response.',
    };
  }

  return { ok: true, data: realtimeToken };
}

export async function fetchRealtimeClientConfig(
  token: string,
): Promise<ApiResult<RealtimeClientConfig>> {
  const result = await apiGet<unknown>(
    `${API_BASE_URL}/realtime/token`,
    token,
    'Realtime Config API',
  );

  if (!result.ok) {
    return result;
  }

  const config = extractRealtimeClientConfig(result.data);

  if (config) {
    return { ok: true, data: config };
  }

  const accessToken = extractRealtimeAccessToken(result.data);

  if (!accessToken) {
    return {
      ok: false,
      error: 'Realtime config missing from response.',
    };
  }

  const envConfig = buildRealtimeClientConfig(accessToken, readMainSupabaseEnv());

  if (envConfig) {
    return { ok: true, data: envConfig };
  }

  return {
    ok: false,
    error:
      'Call signaling is not configured. Copy NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY from the web app .env into this project’s .env, then restart.',
  };
}

export async function setUserOnline(token: string): Promise<ApiResult<{ ok: true }>> {
  const result = await apiPatch<unknown>(
    `${API_BASE_URL}/users/status`,
    token,
    'User Status API',
    { status: 'ONLINE' },
  );

  if (!result.ok) {
    return result;
  }

  return { ok: true, data: { ok: true } };
}

export async function sendRealtimeHeartbeat(
  token: string,
  body?: { status?: string; timezone?: string },
): Promise<ApiResult<{ ok: true }>> {
  const timezone =
    body?.timezone?.trim() ||
    Intl.DateTimeFormat().resolvedOptions().timeZone ||
    'UTC';
  const status = body?.status?.trim() || 'ONLINE';

  const result = await apiPost<unknown>(
    `${API_BASE_URL}/realtime/heartbeat`,
    token,
    'Realtime Heartbeat API',
    { status, timezone },
  );

  if (!result.ok) {
    return result;
  }

  return { ok: true, data: { ok: true } };
}

export async function sendTypingIndicator(
  token: string,
  conversationId: string,
  isTyping: boolean,
): Promise<ApiResult<{ ok: true }>> {
  const bodyOptions: unknown[] = isTyping
    ? [
        { conversationId, isTyping: true, typing: true },
        { conversationId, isTyping: true },
        { conversationId, typing: true },
        { conversationId },
      ]
    : [
        { conversationId, isTyping: false, typing: false },
        { conversationId, isTyping: false },
        { conversationId, typing: false },
      ];

  let lastResult: ApiResult<unknown> = {
    ok: false,
    error: 'Typing indicator failed.',
  };

  for (const body of bodyOptions) {
    const result = await apiPost<unknown>(
      `${API_BASE_URL}/realtime/typing`,
      token,
      'Typing API',
      body,
    );

    if (result.ok) {
      return { ok: true, data: { ok: true } };
    }

    lastResult = result;

    if (result.status !== 400 || !result.error?.toLowerCase().includes('invalid input')) {
      return result;
    }
  }

  return lastResult;
}

const PRESENCE_CHUNK_SIZE = 50;

async function fetchPresenceChunk(
  token: string,
  userIds: string[],
): Promise<import('../shared/realtime').PresenceItem[]> {
  if (userIds.length === 0) {
    return [];
  }

  const commaQuery = encodeURIComponent(userIds.join(','));
  const commaResult = await apiGet<unknown>(
    `${API_BASE_URL}/realtime/presence?userIds=${commaQuery}`,
    token,
    'Realtime Presence API',
  );

  if (commaResult.ok) {
    const parsed = normalizePresencePayload(commaResult.data);

    if (parsed.length > 0) {
      return parsed;
    }
  }

  const repeatedQuery = userIds.map((id) => `userIds=${encodeURIComponent(id)}`).join('&');
  const repeatedResult = await apiGet<unknown>(
    `${API_BASE_URL}/realtime/presence?${repeatedQuery}`,
    token,
    'Realtime Presence API',
  );

  if (repeatedResult.ok) {
    const parsed = normalizePresencePayload(repeatedResult.data);

    if (parsed.length > 0) {
      return parsed;
    }
  }

  if (commaResult.ok) {
    return normalizePresencePayload(commaResult.data);
  }

  return [];
}

export async function fetchRealtimePresence(
  token: string,
  userIds: string[],
): Promise<ApiResult<import('../shared/realtime').PresenceItem[]>> {
  const ids = [...new Set(userIds.filter((id) => typeof id === 'string' && id.trim().length > 0))];

  if (ids.length === 0) {
    return { ok: true, data: [] };
  }

  const probeQuery = encodeURIComponent(ids.join(','));
  const probe = await apiGet<unknown>(
    `${API_BASE_URL}/realtime/presence?userIds=${probeQuery}`,
    token,
    'Realtime Presence API',
  );

  if (!probe.ok) {
    return probe;
  }

  const merged = new Map<string, import('../shared/realtime').PresenceItem>();

  for (let offset = 0; offset < ids.length; offset += PRESENCE_CHUNK_SIZE) {
    const chunk = ids.slice(offset, offset + PRESENCE_CHUNK_SIZE);
    const items = await fetchPresenceChunk(token, chunk);

    for (const item of items) {
      merged.set(normalizePresenceUserId(item.userId), item);
    }
  }

  if (merged.size === 0) {
    return { ok: true, data: normalizePresencePayload(probe.data) };
  }

  return { ok: true, data: [...merged.values()] };
}
