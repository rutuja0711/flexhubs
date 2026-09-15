import type { LoginCredentials, LoginResult } from '../shared/auth';

export type { LoginCredentials, LoginResult, LoginSuccess } from '../shared/auth';

export async function login(credentials: LoginCredentials): Promise<LoginResult> {
  if (!window.electronAPI?.login) {
    return {
      ok: false,
      error: 'Desktop API is not available.',
    };
  }

  return window.electronAPI.login(credentials);
}

export function getStoredToken(): string | null {
  return localStorage.getItem('authToken');
}

export function storeAuth(data: import('../shared/auth').LoginSuccess): void {
  const token =
    typeof data.token === 'string'
      ? data.token
      : typeof data.accessToken === 'string'
        ? data.accessToken
        : null;

  if (token) {
    localStorage.setItem('authToken', token);
  }

  localStorage.setItem('authUser', JSON.stringify(data.user ?? data));
}

export function clearAuth(): void {
  localStorage.removeItem('authToken');
  localStorage.removeItem('authUser');
}

export function logout(): void {
  clearAuth();
}

export async function performLogout(): Promise<void> {
  if (getStoredToken()) {
    try {
      const { stopRealtime } = await import('./realtimeApi');
      await stopRealtime();
    } catch {
      // Best-effort cleanup before clearing the session.
    }

    try {
      const { saveUserStatus } = await import('./chatApi');
      await saveUserStatus('OFFLINE');
    } catch {
      // Ignore offline status failures during logout.
    }

    try {
      const { clearPushSubscriptionOnLogout } = await import('./pushNotifications');
      await clearPushSubscriptionOnLogout();
    } catch {
      // Push may be unavailable in the desktop shell.
    }
  }

  clearAuth();
}

export function getStoredUser(): unknown | null {
  const raw = localStorage.getItem('authUser');

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

export async function getCurrentUser(): Promise<LoginResult> {
  const token = getStoredToken();

  if (!token) {
    return {
      ok: false,
      error: 'No saved session.',
      status: 401,
    };
  }

  if (!window.electronAPI?.getCurrentUser) {
    return {
      ok: false,
      error: 'Desktop API is not available.',
    };
  }

  const result = await window.electronAPI.getCurrentUser(token);

  if (!result.ok && result.status === 401) {
    clearAuth();
  }

  if (result.ok) {
    storeAuth({
      token,
      user: result.data.user ?? result.data,
    });
  }

  return result;
}
