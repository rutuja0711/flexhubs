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

export async function sendRealtimeHeartbeat(token: string): Promise<ApiResult<{ ok: true }>> {
  const result = await apiPost<unknown>(
    `${API_BASE_URL}/realtime/heartbeat`,
    token,
    'Realtime Heartbeat API',
    {},
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

export async function fetchRealtimePresence(
  token: string,
  userIds: string[],
): Promise<ApiResult<import('../shared/realtime').PresenceItem[]>> {
  const ids = [...new Set(userIds.filter((id) => typeof id === 'string' && id.trim().length > 0))];

  if (ids.length === 0) {
    return { ok: true, data: [] };
  }

  const query = encodeURIComponent(ids.join(','));
  const result = await apiGet<unknown>(
    `${API_BASE_URL}/realtime/presence?userIds=${query}`,
    token,
    'Realtime Presence API',
  );

  if (!result.ok) {
    return result;
  }

  return { ok: true, data: normalizePresencePayload(result.data) };
}
