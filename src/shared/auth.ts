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
  | { ok: false; error: string; status?: number };

export const API_BASE_URL = 'https://flexhubs.in/api';
export const LOGIN_URL = `${API_BASE_URL}/auth/login`;
export const ME_URL = `${API_BASE_URL}/auth/me`;
