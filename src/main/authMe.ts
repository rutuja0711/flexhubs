import type { LoginResult, MeSuccess } from '../shared/auth';
import { ME_URL } from '../shared/auth';

export async function performGetMe(token: string): Promise<LoginResult> {
  try {
    const response = await fetch(ME_URL, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = (await response.json()) as MeSuccess & { error?: string };

    console.log('[Me API] status:', response.status);
    console.log('[Me API] response:', data);

    if (!response.ok) {
      return {
        ok: false,
        error: data.error ?? 'Session expired. Please sign in again.',
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
