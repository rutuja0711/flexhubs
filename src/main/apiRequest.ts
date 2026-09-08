import type { ApiResult } from '../shared/api';

type JsonRecord = Record<string, unknown> & { error?: string };

const NETWORK_COOLDOWN_MS = 20_000;
const inflightGets = new Map<string, Promise<ApiResult<unknown>>>();

let unreachableUntil = 0;
let loggedUnreachable = false;

function unavailableResult<T>(): ApiResult<T> {
  return {
    ok: false,
    error: 'Unable to reach the server. Check your connection and try again.',
    status: 0,
  };
}

function isNetworkFailure(error: unknown): boolean {
  const cause =
    error instanceof Error && 'cause' in error && error.cause instanceof Error
      ? `${error.cause.name} ${error.cause.message}`
      : '';
  const text = `${error instanceof Error ? error.message : String(error)} ${cause}`;
  return /fetch failed|Connect Timeout|UND_ERR_CONNECT|ECONNREFUSED|ENOTFOUND|ETIMEDOUT/i.test(text);
}

function markUnreachable(): void {
  unreachableUntil = Date.now() + NETWORK_COOLDOWN_MS;

  if (!loggedUnreachable) {
    loggedUnreachable = true;
    console.warn(`[API] Server unreachable. Pausing requests for ${NETWORK_COOLDOWN_MS / 1000}s.`);
  }
}

function clearUnreachable(): void {
  unreachableUntil = 0;
  loggedUnreachable = false;
}

function isCoolingDown(): boolean {
  return Date.now() < unreachableUntil;
}

export function getUnreachableRemainingMs(): number {
  return Math.max(0, unreachableUntil - Date.now());
}

function handleFetchError<T>(label: string, error: unknown): ApiResult<T> {
  if (isNetworkFailure(error)) {
    markUnreachable();
    return unavailableResult();
  }

  console.error(`[${label}] request failed:`, error);
  return unavailableResult();
}

async function parseResponse<T>(response: Response, label: string): Promise<ApiResult<T>> {
  let data = {} as T & JsonRecord;

  try {
    data = (await response.json()) as T & JsonRecord;
  } catch {
    data = {} as T & JsonRecord;
  }

  console.log(`[${label}] status:`, response.status);
  console.log(`[${label}] response:`, data);

  if (!response.ok) {
    const fallbackError =
      response.status === 502 || response.status === 503 || response.status === 504
        ? 'flexhubs.in is temporarily unavailable. Try again in a few minutes.'
        : 'Request failed. Please try again.';

    return {
      ok: false,
      error: data.error ?? fallbackError,
      status: response.status,
    };
  }

  clearUnreachable();
  return { ok: true, data };
}

async function runGet<T>(url: string, token: string, label: string): Promise<ApiResult<T>> {
  if (isCoolingDown()) {
    return unavailableResult();
  }

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

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
  if (isCoolingDown()) {
    return unavailableResult();
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

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
  if (isCoolingDown()) {
    return unavailableResult();
  }

  try {
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

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
  if (isCoolingDown()) {
    return unavailableResult();
  }

  try {
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

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
  if (isCoolingDown()) {
    return unavailableResult();
  }

  try {
    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

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
  if (isCoolingDown()) {
    return unavailableResult();
  }

  try {
    const buffer = Buffer.from(base64Data, 'base64');
    const file = new File([new Uint8Array(buffer)], fileName, {
      type: mimeType || 'application/octet-stream',
    });
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    return parseResponse<T>(response, label);
  } catch (error) {
    return handleFetchError(label, error);
  }
}
