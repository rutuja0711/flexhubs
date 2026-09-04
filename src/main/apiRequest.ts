import type { ApiResult } from '../shared/api';

type JsonRecord = Record<string, unknown> & { error?: string };

export async function apiGet<T>(url: string, token: string, label: string): Promise<ApiResult<T>> {
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = (await response.json()) as T & JsonRecord;

    console.log(`[${label}] status:`, response.status);
    console.log(`[${label}] response:`, data);

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
    return {
      ok: false,
      error: 'Unable to reach the server. Check your connection and try again.',
    };
  }
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
    return {
      ok: false,
      error: data.error ?? 'Request failed. Please try again.',
      status: response.status,
    };
  }

  return { ok: true, data };
}

export async function apiPost<T>(
  url: string,
  token: string,
  label: string,
  body?: unknown,
): Promise<ApiResult<T>> {
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
    console.error(`[${label}] request failed:`, error);
    return {
      ok: false,
      error: 'Unable to reach the server. Check your connection and try again.',
    };
  }
}

export async function apiDelete<T>(
  url: string,
  token: string,
  label: string,
): Promise<ApiResult<T>> {
  try {
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    return parseResponse<T>(response, label);
  } catch (error) {
    console.error(`[${label}] request failed:`, error);
    return {
      ok: false,
      error: 'Unable to reach the server. Check your connection and try again.',
    };
  }
}

export async function apiPut<T>(
  url: string,
  token: string,
  label: string,
  body?: unknown,
): Promise<ApiResult<T>> {
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
    console.error(`[${label}] request failed:`, error);
    return {
      ok: false,
      error: 'Unable to reach the server. Check your connection and try again.',
    };
  }
}

export async function apiPatch<T>(
  url: string,
  token: string,
  label: string,
  body?: unknown,
): Promise<ApiResult<T>> {
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
    console.error(`[${label}] request failed:`, error);
    return {
      ok: false,
      error: 'Unable to reach the server. Check your connection and try again.',
    };
  }
}
