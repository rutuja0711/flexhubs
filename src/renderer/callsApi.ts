import type { ApiResult } from '../shared/api';
import type { CallLogOutcome, CallTokenResult } from '../shared/calls';
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

function readRendererSupabaseEnv(): Record<string, string | undefined> {
  const injectedUrl =
    typeof __FLEXHUBS_SUPABASE_URL__ !== 'undefined' ? __FLEXHUBS_SUPABASE_URL__.trim() : '';
  const injectedKey =
    typeof __FLEXHUBS_SUPABASE_ANON_KEY__ !== 'undefined' ? __FLEXHUBS_SUPABASE_ANON_KEY__.trim() : '';

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
    }

    const { supabaseUrl, supabaseAnonKey } = readSupabasePublicConfig(env);

    if (!supabaseUrl || !supabaseAnonKey) {
      return {
        ok: false,
        error:
          apiResult.ok === false
            ? apiResult.error
            : 'Calls are not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env, then restart.',
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
        error: 'Call signaling config is incomplete.',
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

async function readMediaAppName(): Promise<string> {
  try {
    return (await window.electronAPI?.getAppName?.()) ?? 'FlexHubs Desktop';
  } catch {
    return 'FlexHubs Desktop';
  }
}

async function probeCallMediaAccess(requestCamera: boolean): Promise<ApiResult<{ ok: true }>> {
  if (!navigator.mediaDevices?.getUserMedia) {
    return { ok: false, error: 'This device does not support microphone access for calls.' };
  }

  if (window.electronAPI?.ensureCallMediaPermissions) {
    await window.electronAPI.ensureCallMediaPermissions(requestCamera);
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false,
    });
    stream.getTracks().forEach((track) => track.stop());
    return { ok: true, data: { ok: true } };
  } catch (error) {
    const appName = await readMediaAppName();
    const message = error instanceof Error ? error.message : String(error);
    const normalized = message.toLowerCase();

    if (
      normalized.includes('notallowed') ||
      normalized.includes('permission denied') ||
      normalized.includes('permission-denied')
    ) {
      return {
        ok: false,
        error: `Microphone access was denied. Open System Settings → Privacy & Security → Microphone and enable ${appName}, then restart the app and try again.`,
      };
    }

    return {
      ok: false,
      error: message || 'Could not access your microphone.',
    };
  }
}

export function ensureScreenCapturePermission(): Promise<ApiResult<{ ok: true }>> {
  if (!window.electronAPI?.ensureScreenCapturePermission) {
    return Promise.resolve({ ok: true, data: { ok: true } });
  }

  return window.electronAPI.ensureScreenCapturePermission();
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
}): Promise<ApiResult<unknown>> {
  return withToken((token) =>
    window.electronAPI.respondMeetingJoinRequest(token, JSON.stringify(payload)),
  );
}
