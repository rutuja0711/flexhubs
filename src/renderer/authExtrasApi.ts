import type { LoginResult, RegisterAccountInput } from '../shared/auth';
import type { ApiResult } from '../shared/api';

function unavailable<T>(): ApiResult<T> {
  return { ok: false, error: 'Desktop API is not available.' };
}

export async function registerAccount(payload: RegisterAccountInput): Promise<LoginResult> {
  if (!window.electronAPI?.registerAccount) {
    return unavailable();
  }

  return window.electronAPI.registerAccount(JSON.stringify(payload));
}

export async function registerWorkspaceAccount(payload: Record<string, unknown>): Promise<LoginResult> {
  if (!window.electronAPI?.registerWorkspaceAccount) {
    return unavailable();
  }

  return window.electronAPI.registerWorkspaceAccount(JSON.stringify(payload));
}

export async function loadInviteDetails(inviteToken: string): Promise<ApiResult<unknown>> {
  if (!window.electronAPI?.getInviteRegistrationDetails) {
    return unavailable();
  }

  return window.electronAPI.getInviteRegistrationDetails(inviteToken);
}

export async function requestPasswordReset(
  email: string,
): Promise<ApiResult<{ message?: string; delivered?: boolean }>> {
  if (!window.electronAPI?.forgotPassword) {
    return unavailable();
  }

  return window.electronAPI.forgotPassword(email);
}

export async function verifyPasswordResetCode(payload: {
  email: string;
  code: string;
}): Promise<ApiResult<{ message?: string }>> {
  if (!window.electronAPI?.verifyResetCode) {
    return unavailable();
  }

  return window.electronAPI.verifyResetCode(JSON.stringify(payload));
}

export async function resetAccountPassword(payload: {
  email: string;
  code: string;
  password: string;
  confirmPassword: string;
}): Promise<ApiResult<{ message?: string }>> {
  if (!window.electronAPI?.resetPassword) {
    return unavailable();
  }

  return window.electronAPI.resetPassword(JSON.stringify(payload));
}
