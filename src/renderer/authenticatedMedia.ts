import { normalizeUploadUrl } from '../shared/profile';
import { getStoredToken } from './authApi';

export function isFlexHubsHostedAssetUrl(url: string): boolean {
  const normalized = normalizeUploadUrl(url.trim());
  return /^https:\/\/flexhubs\.in\//i.test(normalized);
}

const MAX_CACHE_ENTRIES = 200;
const MAX_CONCURRENT_FETCHES = 6;

/** Object URLs for hosted flexhubs.in assets (shared across images & video). */
const objectUrlCache = new Map<string, string>();
const inflight = new Map<string, Promise<string>>();

let activeFetches = 0;
const waitQueue: Array<() => void> = [];

function runQueuedFetches(): void {
  while (activeFetches < MAX_CONCURRENT_FETCHES && waitQueue.length > 0) {
    activeFetches += 1;
    const next = waitQueue.shift();
    next?.();
  }
}

function enqueueFetch<T>(task: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    waitQueue.push(() => {
      void task()
        .then(resolve, reject)
        .finally(() => {
          activeFetches -= 1;
          runQueuedFetches();
        });
    });
    runQueuedFetches();
  });
}

function rememberObjectUrl(normalized: string, objectUrl: string): string {
  const existing = objectUrlCache.get(normalized);
  if (existing) {
    if (existing !== objectUrl && objectUrl.startsWith('blob:')) {
      URL.revokeObjectURL(objectUrl);
    }
    return existing;
  }

  objectUrlCache.set(normalized, objectUrl);

  while (objectUrlCache.size > MAX_CACHE_ENTRIES) {
    const oldest = objectUrlCache.keys().next().value;
    if (!oldest) {
      break;
    }

    const evicted = objectUrlCache.get(oldest);
    objectUrlCache.delete(oldest);
    if (evicted?.startsWith('blob:')) {
      URL.revokeObjectURL(evicted);
    }
  }

  return objectUrl;
}

function coerceMediaBytes(value: unknown): Uint8Array | null {
  if (value instanceof Uint8Array) {
    return value;
  }

  if (ArrayBuffer.isView(value)) {
    const view = value as ArrayBufferView;
    return new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (record.type === 'Buffer' && Array.isArray(record.data)) {
      return Uint8Array.from(record.data as number[]);
    }

    if (typeof record.base64 === 'string' && record.base64.length > 0) {
      const binary = atob(record.base64);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
      }
      return bytes;
    }
  }

  return null;
}

function bytesToBlob(bytes: Uint8Array, mimeType: string): Blob {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Blob([copy], { type: mimeType || 'application/octet-stream' });
}

async function fetchHostedObjectUrl(normalized: string): Promise<string> {
  const token = getStoredToken();
  if (!token || !window.electronAPI?.fetchAuthenticatedMedia) {
    return normalized;
  }

  const result = await window.electronAPI.fetchAuthenticatedMedia(token, normalized);
  if (!result.ok) {
    return normalized;
  }

  const payload = result.data as { bytes?: unknown; base64?: string; mimeType: string };
  const bytes =
    coerceMediaBytes(payload.bytes) ??
    (typeof payload.base64 === 'string' ? coerceMediaBytes({ base64: payload.base64 }) : null);
  if (!bytes) {
    return normalized;
  }

  const blob = bytesToBlob(bytes, result.data.mimeType);
  const objectUrl = URL.createObjectURL(blob);
  return rememberObjectUrl(normalized, objectUrl);
}

/**
 * Resolves a flexhubs.in URL to a displayable src (direct URL or cached blob URL).
 * Deduplicates in-flight requests and limits parallel fetches.
 */
export function resolveAuthenticatedMediaUrl(rawUrl: string): Promise<string> {
  const normalized = normalizeUploadUrl(rawUrl.trim());
  if (!normalized) {
    return Promise.reject(new Error('Missing media URL.'));
  }

  if (
    normalized.startsWith('blob:') ||
    normalized.startsWith('data:') ||
    !isFlexHubsHostedAssetUrl(normalized)
  ) {
    return Promise.resolve(normalized);
  }

  const cached = objectUrlCache.get(normalized);
  if (cached) {
    return Promise.resolve(cached);
  }

  const pending = inflight.get(normalized);
  if (pending) {
    return pending;
  }

  const promise = enqueueFetch(() =>
    fetchHostedObjectUrl(normalized).finally(() => {
      inflight.delete(normalized);
    }),
  );

  inflight.set(normalized, promise);
  return promise;
}

export function peekAuthenticatedMediaUrl(rawUrl: string | null | undefined): string | null {
  if (!rawUrl?.trim()) {
    return null;
  }

  const normalized = normalizeUploadUrl(rawUrl.trim());
  if (
    normalized.startsWith('blob:') ||
    normalized.startsWith('data:') ||
    !isFlexHubsHostedAssetUrl(normalized)
  ) {
    return normalized;
  }

  return objectUrlCache.get(normalized) ?? null;
}

export async function fetchAuthenticatedMediaBlob(rawUrl: string): Promise<Blob> {
  const normalized = normalizeUploadUrl(rawUrl.trim());

  if (!isFlexHubsHostedAssetUrl(normalized)) {
    const response = await fetch(normalized);
    if (!response.ok) {
      throw new Error('Unable to load this file.');
    }
    return response.blob();
  }

  const objectUrl = await resolveAuthenticatedMediaUrl(normalized);
  const response = await fetch(objectUrl);
  return response.blob();
}
