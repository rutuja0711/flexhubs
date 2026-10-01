import { normalizeUploadUrl } from '../shared/profile';
import { getStoredToken } from './authApi';

export function isFlexHubsHostedMediaUrl(url: string): boolean {
  return /^https:\/\/flexhubs\.in\//i.test(normalizeUploadUrl(url.trim()));
}

export async function fetchMediaBlob(url: string): Promise<Blob> {
  const normalized = normalizeUploadUrl(url.trim());

  if (isFlexHubsHostedMediaUrl(normalized)) {
    const token = getStoredToken();
    if (!token || !window.electronAPI?.fetchAuthenticatedMedia) {
      throw new Error('Unable to load this file.');
    }

    const result = await window.electronAPI.fetchAuthenticatedMedia(token, normalized);
    if (!result.ok) {
      throw new Error(result.error);
    }

    const binary = atob(result.data.base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }

    return new Blob([bytes], { type: result.data.mimeType || 'application/octet-stream' });
  }

  const response = await fetch(normalized);
  if (!response.ok) {
    throw new Error('Unable to load this file.');
  }

  return response.blob();
}
