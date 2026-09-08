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

    let data = {} as LoginSuccess & { error?: string };

    try {
      data = (await response.json()) as LoginSuccess & { error?: string };
    } catch {
      data = {} as LoginSuccess & { error?: string };
    }

    console.log('[Login API] status:', response.status);
    console.log('[Login API] response:', data);

    if (!response.ok) {
      const record = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
      const nestedErrors =
        record.errors && typeof record.errors === 'object'
          ? (record.errors as Record<string, unknown>)
          : null;
      const emailError =
        typeof nestedErrors?.email === 'string'
          ? nestedErrors.email
          : typeof record.email === 'string' && record.email.trim()
            ? record.email
            : null;
      const passwordError =
        typeof nestedErrors?.password === 'string'
          ? nestedErrors.password
          : typeof record.password === 'string' && record.password.trim()
            ? record.password
            : null;
      const generalError =
        (typeof record.error === 'string' && record.error) ||
        (typeof record.message === 'string' && record.message) ||
        (response.status === 502 || response.status === 503 || response.status === 504
          ? 'flexhubs.in is temporarily unavailable. Try again in a few minutes.'
          : 'Sign in failed. Please try again.');

      return {
        ok: false,
        error: emailError || passwordError || generalError,
        status: response.status,
        field: emailError ? 'email' : passwordError ? 'password' : undefined,
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
