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

export type LoginResult =
  | { ok: true; data: LoginSuccess }
  | { ok: false; error: string; status?: number };

export const LOGIN_URL = 'https://flexhubs.in/api/auth/login';
