import { app } from 'electron';
import type { LoginResult, MeSuccess } from '../shared/auth';
import { ME_URL } from '../shared/auth';

const logMeApi = !app.isPackaged && process.env.FLEXHUBS_LOG_API === '1';

function readErrorMessage(data: unknown, status: number): string {
  if (data && typeof data === 'object' && 'error' in data && typeof data.error === 'string') {
    return data.error;
  }

  if (status === 502 || status === 503 || status === 504) {
    return 'flexhubs.in is temporarily unavailable. Try again in a few minutes.';
  }

  return 'Session expired. Please sign in again.';
}

export async function performGetMe(token: string): Promise<LoginResult> {
  try {
    const response = await fetch(ME_URL, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    let data = {} as MeSuccess & { error?: string };

    try {
      data = (await response.json()) as MeSuccess & { error?: string };
    } catch {
      data = {} as MeSuccess & { error?: string };
    }

    if (!response.ok) {
      if (logMeApi) {
        console.warn('[Me API] status:', response.status, data.error ?? data);
      }
      return {
        ok: false,
        error: readErrorMessage(data, response.status),
        status: response.status,
      };
    }

    return { ok: true, data };
  } catch (error) {
    if (logMeApi) {
      console.error('[Me API] request failed:', error);
    }
    return {
      ok: false,
      error: 'Unable to reach the server. Check your connection and try again.',
    };
  }
}
