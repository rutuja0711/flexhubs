import type { ApiResult } from '../shared/api';
import type { LoginCredentials, LoginResult, LoginSuccess, RegisterAccountInput } from '../shared/auth';
import { API_BASE_URL, buildRegisterAccountBody } from '../shared/auth';
import { performLogin } from './authLogin';
import { performGetMe } from './authMe';

async function postPublic<T>(url: string, label: string, body: unknown): Promise<ApiResult<T>> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = (await response.json()) as T & { error?: string };

    console.log(`[${label}] status:`, response.status);

    if (!response.ok) {
      return {
        ok: false,
        error: data.error ?? 'Request failed. Please try again.',
        status: response.status,
      };
    }

    return { ok: true, data };
  } catch (error) {
    console.error(`[${label}] request failed:`, error);
    return { ok: false, error: 'Unable to reach the server. Check your connection and try again.' };
  }
}

export { performLogin, performGetMe };

export async function performRegister(payload: RegisterAccountInput): Promise<LoginResult> {
  return postPublic<LoginSuccess>(
    `${API_BASE_URL}/auth/register`,
    'Register API',
    buildRegisterAccountBody(payload),
  );
}

export async function performRegisterWorkspace(payload: Record<string, unknown>): Promise<LoginResult> {
  return postPublic<LoginSuccess>(
    `${API_BASE_URL}/auth/register/workspace`,
    'Register Workspace API',
    payload,
  );
}

export async function fetchInviteRegistrationDetails(
  inviteToken: string,
): Promise<ApiResult<unknown>> {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/invite/${encodeURIComponent(inviteToken)}`);
    const data = (await response.json()) as unknown & { error?: string };

    if (!response.ok) {
      return {
        ok: false,
        error:
          data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
            ? data.error
            : 'Invite not found.',
        status: response.status,
      };
    }

    return { ok: true, data };
  } catch {
    return { ok: false, error: 'Unable to reach the server.' };
  }
}

export async function performForgotPassword(
  email: string,
): Promise<ApiResult<{ message?: string; delivered?: boolean }>> {
  return postPublic<{ message?: string; delivered?: boolean }>(
    `${API_BASE_URL}/auth/forgot-password`,
    'Forgot Password API',
    { email },
  );
}

export async function performVerifyResetCode(payload: {
  email: string;
  code: string;
}): Promise<ApiResult<{ message?: string }>> {
  return postPublic<{ message?: string }>(
    `${API_BASE_URL}/auth/verify-reset-code`,
    'Verify Reset Code API',
    payload,
  );
}

export async function performResetPassword(payload: {
  email: string;
  code: string;
  password: string;
  confirmPassword: string;
}): Promise<ApiResult<{ message?: string }>> {
  return postPublic<{ message?: string }>(
    `${API_BASE_URL}/auth/reset-password`,
    'Reset Password API',
    payload,
  );
}

export type AuthCredentials = LoginCredentials;
