import type { ApiResult } from '../shared/api';
import { extractUploadUrl, normalizeUploadUrl } from '../shared/profile';
import { clearAuth, getStoredToken } from './authApi';

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;

      if (typeof result !== 'string') {
        reject(new Error('Unable to read file.'));
        return;
      }

      resolve(result.includes(',') ? result.split(',')[1] : result);
    };
    reader.onerror = () => reject(new Error('Unable to read file.'));
    reader.readAsDataURL(file);
  });
}

export async function uploadFileToApi(file: File): Promise<ApiResult<{ url: string }>> {
  const token = getStoredToken();

  if (!token) {
    return {
      ok: false,
      error: 'No saved session.',
      status: 401,
    };
  }

  if (!window.electronAPI?.uploadProfileImage) {
    return {
      ok: false,
      error: 'Upload is unavailable in this environment.',
    };
  }

  try {
    const base64Data = await readFileAsBase64(file);
    const result = await window.electronAPI.uploadProfileImage(
      token,
      file.name,
      file.type || 'application/octet-stream',
      base64Data,
    );

    if (!result.ok) {
      if (result.status === 401) {
        clearAuth();
      }

      return result;
    }

    const url = extractUploadUrl(result.data) ?? result.data.url;

    if (!url) {
      return {
        ok: false,
        error: 'Upload succeeded but no file URL was returned.',
      };
    }

    return {
      ok: true,
      data: { url: normalizeUploadUrl(url) },
    };
  } catch {
    return {
      ok: false,
      error: 'Unable to read the selected file.',
    };
  }
}
