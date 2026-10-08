import type { ApiResult } from '../shared/api';
import type { CallHistoryItem, CallLogOutcome, CallTokenResult } from '../shared/calls';
import { normalizeCallHistoryList } from '../shared/calls';
import type { RealtimeClientConfig } from '../shared/realtime';
import { readSupabasePublicConfig } from '../shared/supabaseEnv';
import { getStoredToken } from './authApi';

async function withToken<T>(
  action: (token: string) => Promise<ApiResult<T>>,
): Promise<ApiResult<T>> {
  const token = getStoredToken();

  if (!token) {
    return { ok: false, error: 'You are not signed in.' };
  }

  return action(token);
}

function readInjectedSupabaseConfig(): { url: string; key: string } {
  return {
    url: typeof __FLEXHUBS_SUPABASE_URL__ !== 'undefined' ? __FLEXHUBS_SUPABASE_URL__.trim() : '',
    key:
      typeof __FLEXHUBS_SUPABASE_ANON_KEY__ !== 'undefined'
        ? __FLEXHUBS_SUPABASE_ANON_KEY__.trim()
        : '',
  };
}

function readRendererSupabaseEnv(): Record<string, string | undefined> {
  const { url: injectedUrl, key: injectedKey } = readInjectedSupabaseConfig();

  return {
    VITE_SUPABASE_URL: injectedUrl || import.meta.env.VITE_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_URL: injectedUrl || import.meta.env.NEXT_PUBLIC_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: injectedKey || import.meta.env.VITE_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: injectedKey || import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    VITE_SUPABASE_PUBLISHABLE_KEY: injectedKey || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      injectedKey || import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  };
}

function mergeRealtimeClientConfig(
  config: RealtimeClientConfig | undefined,
  env: Record<string, string | undefined>,
): RealtimeClientConfig | null {
  const { supabaseUrl: envUrl, supabaseAnonKey: envKey } = readSupabasePublicConfig(env);
  const accessToken = config?.accessToken?.trim() ?? '';
  const supabaseUrl = config?.supabaseUrl?.trim() || envUrl;
  const supabaseAnonKey = config?.supabaseAnonKey?.trim() || envKey;

  if (!accessToken || !supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  return {
    accessToken,
    supabaseUrl,
    supabaseAnonKey,
  };
}

export function loadRealtimeConfig(): Promise<ApiResult<RealtimeClientConfig>> {
  return withToken(async (token) => {
    const env = readRendererSupabaseEnv();
    const apiResult = await window.electronAPI.getRealtimeConfig(token);

    if (apiResult.ok) {
      const merged = mergeRealtimeClientConfig(apiResult.data, env);

      if (merged) {
        return { ok: true, data: merged };
      }

      const direct = apiResult.data;
      if (direct?.accessToken && direct.supabaseUrl && direct.supabaseAnonKey) {
        return { ok: true, data: direct };
      }
    }

    const { supabaseUrl, supabaseAnonKey } = readSupabasePublicConfig(env);

    if (!supabaseUrl || !supabaseAnonKey) {
      const injected = readInjectedSupabaseConfig();

      if (!apiResult.ok && apiResult.error) {
        return apiResult;
      }

      return {
        ok: false,
        error:
          injected.url && injected.key
            ? 'Call signaling is not available right now. Please try again later.'
            : 'Call signaling is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env for local dev, or set the same values as GitHub Actions secrets when building the production DMG/Setup.exe.',
      };
    }

    const tokenResult = await window.electronAPI.getRealtimeAccessToken(token);

    if (!tokenResult.ok) {
      return tokenResult;
    }

    const envConfig = mergeRealtimeClientConfig(
      {
        accessToken: tokenResult.data,
        supabaseUrl,
        supabaseAnonKey,
      },
      env,
    );

    if (!envConfig) {
      return {
        ok: false,
        error: 'Calls are not available right now. Please try again later.',
      };
    }

    return { ok: true, data: envConfig };
  });
}

export function loadCallToken(payload: {
  conversationId?: string;
  roomName?: string;
  video: boolean;
}): Promise<ApiResult<CallTokenResult>> {
  return withToken((token) =>
    window.electronAPI.getCallToken(token, JSON.stringify(payload)),
  );
}

export function ensureCallMediaPermissions(
  requestCamera: boolean,
): Promise<ApiResult<{ ok: true }>> {
  return probeCallMediaAccess(requestCamera);
}

async function probeCallMediaAccess(requestCamera: boolean): Promise<ApiResult<{ ok: true }>> {
  if (!navigator.mediaDevices?.getUserMedia) {
    return { ok: false, error: 'This device does not support calls.' };
  }

  if (window.electronAPI?.ensureCallMediaPermissions) {
    const ipcResult = await window.electronAPI.ensureCallMediaPermissions(requestCamera);

    if (!ipcResult.ok) {
      return { ok: false, error: ipcResult.error };
    }
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: requestCamera,
    });
    stream.getTracks().forEach((track) => track.stop());
    return { ok: true, data: { ok: true } };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const normalized = message.toLowerCase();

    if (
      normalized.includes('notallowed') ||
      normalized.includes('permission denied') ||
      normalized.includes('permission-denied')
    ) {
      return {
        ok: false,
        error: 'Microphone access was denied. Allow access in Settings and try again.',
      };
    }

    return {
      ok: false,
      error: 'Could not access your microphone. Please try again.',
    };
  }
}

export function ensureScreenCapturePermission(): Promise<ApiResult<{ ok: true }>> {
  if (!window.electronAPI?.ensureScreenCapturePermission) {
    return Promise.resolve({ ok: true, data: { ok: true } });
  }

  return window.electronAPI.ensureScreenCapturePermission();
}

export async function describeScreenCaptureFailure(): Promise<string> {
  const result = await window.electronAPI?.describeScreenCaptureFailure?.();

  if (result?.ok && result.data) {
    return result.data;
  }

  return 'Could not share your screen. Allow screen recording for this app in System Settings, then fully quit and relaunch.';
}

export function logCall(payload: {
  conversationId: string;
  callId: string;
  video: boolean;
  outcome: CallLogOutcome;
  durationSec: number;
  initiatorId: string;
}): Promise<ApiResult<{ message?: unknown }>> {
  return withToken((token) => window.electronAPI.logCall(token, JSON.stringify(payload)));
}

export function notifyCallMeeting(payload: {
  callId: string;
  conversationId: string;
  roomName: string;
  conversationTitle: string;
  startedBy: { id: string; username: string; avatar: string | null };
  video: boolean;
  startedAt: string;
}): Promise<ApiResult<{ notified?: number }>> {
  return withToken((token) =>
    window.electronAPI.notifyCallMeeting(token, JSON.stringify(payload)),
  );
}

export function endCallMeeting(conversationId: string): Promise<ApiResult<{ ended?: boolean }>> {
  return withToken((token) => window.electronAPI.endCallMeeting(token, conversationId));
}

export function muteCallParticipant(
  conversationId: string,
  participantIdentity: string,
  muted: boolean,
): Promise<ApiResult<{ muted?: boolean }>> {
  return withToken((token) =>
    window.electronAPI.muteCallParticipant(token, conversationId, participantIdentity, muted),
  );
}

export function removeCallParticipant(
  conversationId: string,
  participantIdentity: string,
): Promise<ApiResult<{ removed?: boolean }>> {
  return withToken((token) =>
    window.electronAPI.removeCallParticipant(token, conversationId, participantIdentity),
  );
}

export function requestMeetingJoinCall(payload: {
  conversationId: string;
  callId?: string;
}): Promise<ApiResult<unknown>> {
  return withToken((token) =>
    window.electronAPI.requestMeetingJoin(token, JSON.stringify(payload)),
  );
}

export function listMeetingJoinRequests(
  conversationId: string,
): Promise<ApiResult<import('../shared/calls').MeetingJoinRequestItem[]>> {
  return withToken((token) => window.electronAPI.listMeetingJoinRequests(token, conversationId));
}

export function respondMeetingJoinRequestCall(payload: {
  conversationId: string;
  requestId: string;
  approved: boolean;
  callId?: string;
  participantIdentity?: string;
}): Promise<ApiResult<unknown>> {
  return withToken((token) =>
    window.electronAPI.respondMeetingJoinRequest(token, JSON.stringify(payload)),
  );
}

export function loadCallHistory(
  filter: 'all' | 'missed' = 'all',
): Promise<ApiResult<CallHistoryItem[]>> {
  return withToken(async (token) => {
    const result = await window.electronAPI.getCallHistory(token, filter);

    if (!result.ok) {
      return result;
    }

    return {
      ok: true,
      data: normalizeCallHistoryList(result.data),
    };
  });
}

export function declineCallMeetingInvite(payload: {
  conversationId: string;
  callId: string;
}): Promise<ApiResult<unknown>> {
  return withToken((token) =>
    window.electronAPI.declineCallMeetingInvite(token, JSON.stringify(payload)),
  );
}

export function loadDeclinedCallMeetingInvites(
  conversationId: string,
  callId: string,
): Promise<ApiResult<unknown>> {
  return withToken((token) =>
    window.electronAPI.getDeclinedCallMeetingInvites(token, conversationId, callId),
  );
}
