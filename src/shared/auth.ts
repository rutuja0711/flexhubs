export type LoginCredentials = {
  email: string;
  password: string;
};

export type LoginSuccess = {
  token?: string;
  accessToken?: string;
  user?: unknown;
  [key: string]: unknown;
};

export type MeSuccess = {
  user?: unknown;
  [key: string]: unknown;
};

export type LoginResult =
  | { ok: true; data: LoginSuccess }
  | { ok: false; error: string; status?: number; field?: 'email' | 'password' };

export type RegisterAccountInput = {
  email: string;
  password: string;
  confirmPassword: string;
  username: string;
  inviteToken: string;
  name?: string;
};

export type IndividualRegisterInput = {
  email: string;
  username: string;
  password: string;
  confirmPassword: string;
  emailVerificationCode: string;
};

export function buildRegisterAccountBody(input: RegisterAccountInput): Record<string, string> {
  const body: Record<string, string> = {
    email: input.email.trim(),
    password: input.password,
    confirmPassword: input.confirmPassword,
    username: input.username.trim(),
    inviteToken: input.inviteToken.trim(),
  };

  const name = input.name?.trim();

  if (name) {
    body.name = name;
  }

  return body;
}

export function readInviteRegistrationEmail(payload: unknown): string {
  if (!payload || typeof payload !== 'object') {
    return '';
  }

  const record = payload as Record<string, unknown>;
  const invite = record.invite;

  if (!invite || typeof invite !== 'object') {
    return '';
  }

  const email = (invite as Record<string, unknown>).email;

  return typeof email === 'string' ? email.trim() : '';
}

import { readConfiguredApiBaseUrl } from './apiBaseUrl';

export const API_BASE_URL = readConfiguredApiBaseUrl();
export const LOGIN_URL = `${API_BASE_URL}/auth/login`;
export const ME_URL = `${API_BASE_URL}/auth/me`;
