import { app } from 'electron';
import type { ApiResult } from '../shared/api';

/** Verbose API logs in dev only when FLEXHUBS_LOG_API=1 (background polls otherwise flood the terminal). */
const logApiTraffic = !app.isPackaged && process.env.FLEXHUBS_LOG_API === '1';

const API_REQUEST_TIMEOUT_MS = 45_000;

type JsonRecord = Record<string, unknown> & { error?: string };

const inflightGets = new Map<string, Promise<ApiResult<unknown>>>();

let consecutiveNetworkFailures = 0;
let loggedUnreachable = false;

function unavailableResult<T>(): ApiResult<T> {
  return {
    ok: false,
    error: 'Unable to reach the server. Check your connection and try again.',
    status: 0,
  };
}

function requestFailedResult<T>(message: string): ApiResult<T> {
  return {
    ok: false,
    error: message,
    status: 0,
  };
}

function isNetworkFailure(error: unknown): boolean {
  if (error instanceof Error && error.name === 'AbortError') {
    const causeMessage =
      error.cause instanceof Error ? error.cause.message : String(error.cause ?? '');
    const text = `${error.message} ${causeMessage}`;
    return /timed out|timeout|connect/i.test(text);
  }

  const cause =
    error instanceof Error && 'cause' in error && error.cause instanceof Error
      ? `${error.cause.name} ${error.cause.message}`
      : '';
  const text = `${error instanceof Error ? error.message : String(error)} ${cause}`;
  return /fetch failed|Connect Timeout|UND_ERR_CONNECT|ECONNREFUSED|ECONNRESET|ENOTFOUND|ETIMEDOUT|EAI_AGAIN|socket hang up|network|certificate|TLS/i.test(
    text,
  );
}

function noteNetworkFailure(): void {
  consecutiveNetworkFailures += 1;

  if (!loggedUnreachable && consecutiveNetworkFailures >= 3) {
    loggedUnreachable = true;
    console.warn(
      `[API] Multiple connection failures (${consecutiveNetworkFailures}). Check network or flexhubs.in status.`,
    );
  }
}

function clearNetworkFailureStreak(): void {
  consecutiveNetworkFailures = 0;
  loggedUnreachable = false;
}

/** Used by realtime reconnect backoff hints only (does not block HTTP). */
export function getUnreachableRemainingMs(): number {
  if (consecutiveNetworkFailures < 3) {
    return 0;
  }

  return Math.min(5_000, consecutiveNetworkFailures * 1_000);
}

async function fetchWithTimeout(url: string, init: RequestInit, label: string): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort(new Error(`Request timed out after ${API_REQUEST_TIMEOUT_MS}ms`));
  }, API_REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`[${label}] Request timed out`, { cause: error });
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function handleFetchError<T>(label: string, error: unknown): ApiResult<T> {
  if (isNetworkFailure(error)) {
    noteNetworkFailure();
    if (logApiTraffic || !app.isPackaged) {
      console.warn(`[${label}] network error:`, error);
    }
    return unavailableResult();
  }

  console.error(`[${label}] request failed:`, error);
  const detail = error instanceof Error ? error.message.trim() : '';
  if (detail) {
    return requestFailedResult(`Request failed. ${detail}`);
  }

  return requestFailedResult('Request failed. Please try again.');
}

async function parseResponse<T>(response: Response, label: string): Promise<ApiResult<T>> {
  let data = {} as T & JsonRecord;

  try {
    data = (await response.json()) as T & JsonRecord;
  } catch {
    data = {} as T & JsonRecord;
  }

  if (logApiTraffic) {
    console.log(`[${label}] status:`, response.status);
    console.log(`[${label}] response:`, data);
  }

  if (!response.ok) {
    if (!logApiTraffic) {
      console.warn(`[${label}] HTTP ${response.status}:`, data.error ?? 'Request failed');
    }
    const fallbackError =
      response.status === 502 || response.status === 503 || response.status === 504
        ? 'flexhubs.in is temporarily unavailable. Try again in a few minutes.'
        : 'Request failed. Please try again.';

    const errorCode = typeof data.code === 'string' ? data.code : undefined;

    const message = typeof data.message === 'string' ? data.message : undefined;

    return {
      ok: false,
      error: data.error ?? message ?? fallbackError,
      status: response.status,
      code: errorCode,
    };
  }

  clearNetworkFailureStreak();
  return { ok: true, data };
}

async function runGet<T>(url: string, token: string, label: string): Promise<ApiResult<T>> {
  try {
    const response = await fetchWithTimeout(
      url,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      label,
    );

    return parseResponse<T>(response, label);
  } catch (error) {
    return handleFetchError(label, error);
  }
}

export async function apiGet<T>(url: string, token: string, label: string): Promise<ApiResult<T>> {
  const key = `GET ${url}`;
  const existing = inflightGets.get(key);

  if (existing) {
    return existing as Promise<ApiResult<T>>;
  }

  const request = runGet<T>(url, token, label).finally(() => {
    inflightGets.delete(key);
  });

  inflightGets.set(key, request as Promise<ApiResult<unknown>>);
  return request;
}

export async function apiPost<T>(
  url: string,
  token: string,
  label: string,
  body?: unknown,
): Promise<ApiResult<T>> {
  try {
    const response = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      },
      label,
    );

    return parseResponse<T>(response, label);
  } catch (error) {
    return handleFetchError(label, error);
  }
}

export async function apiDelete<T>(
  url: string,
  token: string,
  label: string,
): Promise<ApiResult<T>> {
  try {
    const response = await fetchWithTimeout(
      url,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      label,
    );

    return parseResponse<T>(response, label);
  } catch (error) {
    return handleFetchError(label, error);
  }
}

export async function apiPut<T>(
  url: string,
  token: string,
  label: string,
  body?: unknown,
): Promise<ApiResult<T>> {
  try {
    const response = await fetchWithTimeout(
      url,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      },
      label,
    );

    return parseResponse<T>(response, label);
  } catch (error) {
    return handleFetchError(label, error);
  }
}

export async function apiPatch<T>(
  url: string,
  token: string,
  label: string,
  body?: unknown,
): Promise<ApiResult<T>> {
  try {
    const response = await fetchWithTimeout(
      url,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      },
      label,
    );

    return parseResponse<T>(response, label);
  } catch (error) {
    return handleFetchError(label, error);
  }
}

export async function apiPostForm<T>(
  url: string,
  token: string,
  label: string,
  fileName: string,
  mimeType: string,
  base64Data: string,
): Promise<ApiResult<T>> {
  try {
    const buffer = Buffer.from(base64Data, 'base64');
    const file = new File([new Uint8Array(buffer)], fileName, {
      type: mimeType || 'application/octet-stream',
    });
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      },
      label,
    );

    return parseResponse<T>(response, label);
  } catch (error) {
    return handleFetchError(label, error);
  }
}