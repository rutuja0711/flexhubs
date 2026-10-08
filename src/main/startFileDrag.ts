import fs from 'node:fs';
import path from 'node:path';
import { app, nativeImage, type WebContents } from 'electron';
import { fetchAuthenticatedMedia, isFlexHubsHostedAssetUrl } from './mediaApi';
import { normalizeUploadUrl } from '../shared/profile';

function sanitizeFileName(fileName: string): string {
  const base = fileName.trim().split(/[\\/]/).pop() ?? 'file';
  const cleaned = base.replace(/[^\w.\-()+\s]/g, '_').trim();
  return cleaned.slice(0, 180) || 'file';
}

async function loadFileBytes(
  token: string,
  rawUrl: string,
): Promise<{ ok: true; bytes: Buffer; mimeType: string } | { ok: false; error: string }> {
  const url = normalizeUploadUrl(rawUrl.trim());

  if (!url) {
    return { ok: false, error: 'File URL is missing.' };
  }

  if (url.startsWith('data:')) {
    try {
      const match = url.match(/^data:([^;,]+)?(?:;base64)?,(.*)$/i);
      if (!match) {
        return { ok: false, error: 'Invalid data URL.' };
      }

      const mimeType = match[1]?.trim() || 'application/octet-stream';
      const payload = match[2] ?? '';
      const bytes = url.includes(';base64')
        ? Buffer.from(payload, 'base64')
        : Buffer.from(decodeURIComponent(payload), 'utf8');
      return { ok: true, bytes, mimeType };
    } catch {
      return { ok: false, error: 'Unable to read file data.' };
    }
  }

  if (isFlexHubsHostedAssetUrl(url)) {
    const result = await fetchAuthenticatedMedia(token, url);
    if (!result.ok) {
      return { ok: false, error: result.error };
    }

    return {
      ok: true,
      bytes: Buffer.from(result.data.bytes),
      mimeType: result.data.mimeType,
    };
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      return { ok: false, error: `Failed to load file (${response.status}).` };
    }

    const arrayBuffer = await response.arrayBuffer();
    const mimeType =
      response.headers.get('content-type')?.split(';')[0]?.trim() || 'application/octet-stream';

    return { ok: true, bytes: Buffer.from(arrayBuffer), mimeType };
  } catch {
    return { ok: false, error: 'Failed to load file.' };
  }
}

/** Small neutral document tile — not the FlexHubs app logo (required non-empty on macOS). */
function smallFileDragIcon(): Electron.NativeImage {
  const width = 32;
  const height = 32;
  const buffer = Buffer.alloc(width * height * 4, 0);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const inPage = x >= 5 && x < 27 && y >= 3 && y < 29;
      if (!inPage) {
        continue;
      }

      const fold = x >= 20 && y >= 3 && y < 10;
      const idx = (y * width + x) * 4;
      buffer[idx] = fold ? 210 : 238;
      buffer[idx + 1] = fold ? 214 : 240;
      buffer[idx + 2] = fold ? 220 : 244;
      buffer[idx + 3] = 255;
    }
  }

  return nativeImage.createFromBuffer(buffer, { width, height });
}

const preparedDragPaths = new Map<string, string>();

function cacheKey(url: string, fileName: string): string {
  return `${normalizeUploadUrl(url.trim())}::${sanitizeFileName(fileName)}`;
}

export async function prepareFileDragFromUrl(
  token: string,
  rawUrl: string,
  fileName: string,
): Promise<{ ok: true; filePath: string } | { ok: false; error: string }> {
  const key = cacheKey(rawUrl, fileName);
  const existing = preparedDragPaths.get(key);
  if (existing && fs.existsSync(existing)) {
    return { ok: true, filePath: existing };
  }

  const loaded = await loadFileBytes(token, rawUrl);
  if (!loaded.ok) {
    return { ok: false, error: loaded.error };
  }

  const safeName = sanitizeFileName(fileName);
  const dragDir = path.join(app.getPath('temp'), 'flexhubs-drag');
  fs.mkdirSync(dragDir, { recursive: true });
  const filePath = path.join(dragDir, `${Date.now()}-${safeName}`);

  try {
    fs.writeFileSync(filePath, loaded.bytes);
    preparedDragPaths.set(key, filePath);
    return { ok: true, filePath };
  } catch {
    return { ok: false, error: 'Unable to prepare file for drag.' };
  }
}

export function startPreparedFileDrag(sender: WebContents, filePath: string): void {
  if (!filePath || !fs.existsSync(filePath)) {
    return;
  }

  sender.startDrag({
    file: filePath,
    icon: smallFileDragIcon(),
  });
}
