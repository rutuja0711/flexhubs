import { normalizeUploadUrl } from '../shared/profile';
import {
  fetchAuthenticatedMediaBlob,
  isFlexHubsHostedAssetUrl,
} from './authenticatedMedia';

export { isFlexHubsHostedAssetUrl, isFlexHubsHostedAssetUrl as isFlexHubsHostedMediaUrl };

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

  if (isFlexHubsHostedAssetUrl(normalized)) {
    onProgress?.(0, null);
    const blob = await fetchAuthenticatedMediaBlob(normalized);
    onProgress?.(blob.size, blob.size);
    return blob;
  }

  return fetchPublicMediaBlob(normalized, onProgress);
}
