import type { ApiResult } from '../shared/api';
import { normalizeUploadUrl } from '../shared/profile';

export function isFlexHubsHostedAssetUrl(url: string): boolean {
  const normalized = normalizeUploadUrl(url.trim());

  if (!normalized) {
    return false;
  }

  return /^https:\/\/flexhubs\.in\//i.test(normalized);
}

export async function fetchAuthenticatedMedia(
  token: string,
  rawUrl: string,
): Promise<ApiResult<{ mimeType: string; bytes: Uint8Array }>> {
  const url = normalizeUploadUrl(rawUrl.trim());

  if (!url) {
    return { ok: false, error: 'Media URL is missing.' };
  }

  if (!isFlexHubsHostedAssetUrl(url)) {
    return { ok: false, error: 'Media URL is not hosted on flexhubs.in.' };
  }

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      return {
        ok: false,
        error: `Failed to load media (${response.status}).`,
        status: response.status,
      };
    }

    const arrayBuffer = await response.arrayBuffer();
    const mimeType = response.headers.get('content-type')?.split(';')[0]?.trim() || 'application/octet-stream';

    return {
      ok: true,
      data: {
        mimeType,
        bytes: new Uint8Array(arrayBuffer),
      },
    };
  } catch {
    return {
      ok: false,
      error: 'Failed to load media.',
      status: 0,
    };
  }
}
