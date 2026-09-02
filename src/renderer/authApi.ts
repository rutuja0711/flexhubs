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
