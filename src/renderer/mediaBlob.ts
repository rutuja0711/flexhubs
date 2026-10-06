import { normalizeUploadUrl } from '../shared/profile';
import { getStoredToken } from './authApi';

export function isFlexHubsHostedMediaUrl(url: string): boolean {
  return /^https:\/\/flexhubs\.in\//i.test(normalizeUploadUrl(url.trim()));
}

async function fetchHostedMediaBlob(
  normalized: string,
  onProgress?: (loaded: number, total: number | null) => void,
): Promise<Blob> {
  const token = getStoredToken();
  if (!token || !window.electronAPI?.fetchAuthenticatedMedia) {
    throw new Error('Unable to load this file.');
  }

  onProgress?.(0, null);

  const result = await window.electronAPI.fetchAuthenticatedMedia(token, normalized);
  if (!result.ok) {
    throw new Error(result.error);
  }

  const binary = atob(result.data.base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  const blob = new Blob([bytes], { type: result.data.mimeType || 'application/octet-stream' });
  onProgress?.(blob.size, blob.size);
  return blob;
}

async function fetchPublicMediaBlob(
  normalized: string,
  onProgress?: (loaded: number, total: number | null) => void,
): Promise<Blob> {
  const response = await fetch(normalized);
  if (!response.ok) {
    throw new Error('Unable to load this file.');
  }

  const totalHeader = response.headers.get('Content-Length');
  const total = totalHeader ? Number(totalHeader) : null;
  const mimeType = response.headers.get('Content-Type') || 'application/octet-stream';

  if (!response.body) {
    const blob = await response.blob();
    onProgress?.(blob.size, blob.size);
    return blob;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    chunks.push(value);
    loaded += value.length;
    onProgress?.(loaded, total && Number.isFinite(total) ? total : null);
  }

  const blob = new Blob(chunks, { type: mimeType });
  onProgress?.(blob.size, blob.size);
  return blob;
}

export async function fetchMediaBlob(url: string): Promise<Blob> {
  return fetchMediaBlobWithProgress(url);
}

export async function fetchMediaBlobWithProgress(
  url: string,
  onProgress?: (loaded: number, total: number | null) => void,
): Promise<Blob> {
  const normalized = normalizeUploadUrl(url.trim());

  if (isFlexHubsHostedMediaUrl(normalized)) {
    return fetchHostedMediaBlob(normalized, onProgress);
  }

  return fetchPublicMediaBlob(normalized, onProgress);
}
