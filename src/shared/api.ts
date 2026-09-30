export type ApiResult<T> =
  | { ok: true; data: T; status?: number }
  | { ok: false; error: string; status?: number; code?: string };

export { API_BASE_URL } from './auth';
