import type { LoginCredentials, LoginResult, LoginSuccess } from '../shared/auth';

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

function readTokenFromAuthPayload(data: LoginSuccess | null | undefined): string | null {
  if (!data || typeof data !== 'object') {
    return null;
  }

  const record = data as Record<string, unknown>;
  const direct =
    (typeof record.token === 'string' && record.token) ||
    (typeof record.accessToken === 'string' && record.accessToken) ||
    (typeof record.access_token === 'string' && record.access_token);

  if (direct) {
    return direct.trim();
  }

  const nested = record.data;

  if (nested && typeof nested === 'object') {
    const inner = nested as Record<string, unknown>;
    const nestedToken =
      (typeof inner.token === 'string' && inner.token) ||
      (typeof inner.accessToken === 'string' && inner.accessToken) ||
      (typeof inner.access_token === 'string' && inner.access_token);

    if (nestedToken) {
      return nestedToken.trim();
    }
  }

  return null;
}

function persistAuthSessionToDisk(token: string, user: unknown): void {
  void window.electronAPI?.writeAuthSession?.({ token, user });
}

export function getStoredToken(): string | null {
  return localStorage.getItem('authToken');
}

export function storeAuth(data: LoginSuccess): void {
  const token = readTokenFromAuthPayload(data);

  if (token) {
    localStorage.setItem('authToken', token);
  }

  const user = data.user ?? data;
  localStorage.setItem('authUser', JSON.stringify(user));

  if (token) {
    persistAuthSessionToDisk(token, user);
  }
}

export function clearAuth(): void {
  localStorage.removeItem('authToken');
  localStorage.removeItem('authUser');
  void window.electronAPI?.clearAuthSession?.();
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

  try {
    const { ensureMainWindowVisible } = await import('./callWindowApi');
    ensureMainWindowVisible();
  } catch {
    // Desktop shell may be unavailable in tests.
  }
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

/** Restore session from main-process disk store when renderer localStorage is empty. */
export async function hydrateAuthSessionFromDisk(): Promise<void> {
  if (getStoredToken()) {
    return;
  }

  const session = await window.electronAPI?.readAuthSession?.();

  if (!session?.token?.trim()) {
    return;
  }

  localStorage.setItem('authToken', session.token.trim());

  if (session.user != null) {
    localStorage.setItem('authUser', JSON.stringify(session.user));
  }
}

export async function getCurrentUser(): Promise<LoginResult> {
  await hydrateAuthSessionFromDisk();

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
