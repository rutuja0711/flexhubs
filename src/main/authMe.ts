import type { LoginResult, MeSuccess } from '../shared/auth';
import { ME_URL } from '../shared/auth';

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

    console.log('[Me API] status:', response.status);
    console.log('[Me API] response:', data);

    if (!response.ok) {
      return {
        ok: false,
        error: readErrorMessage(data, response.status),
        status: response.status,
      };
    }

    return { ok: true, data };
  } catch (error) {
    console.error('[Me API] request failed:', error);
    return {
      ok: false,
      error: 'Unable to reach the server. Check your connection and try again.',
    };
  }
}
