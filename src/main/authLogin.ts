import type { LoginCredentials, LoginResult, LoginSuccess } from '../shared/auth';
import { LOGIN_URL } from '../shared/auth';

export async function performLogin(credentials: LoginCredentials): Promise<LoginResult> {
  try {
    const response = await fetch(LOGIN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    });

    const data = (await response.json()) as LoginSuccess & { error?: string };

    console.log('[Login API] status:', response.status);
    console.log('[Login API] response:', data);

    if (!response.ok) {
      return {
        ok: false,
        error: data.error ?? 'Sign in failed. Please try again.',
        status: response.status,
      };
    }

    return { ok: true, data };
  } catch (error) {
    console.error('[Login API] request failed:', error);
    return {
      ok: false,
      error: 'Unable to reach the server. Check your connection and try again.',
    };
  }
}
