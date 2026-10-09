import { createWriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { app, shell } from 'electron';

export type ReleaseDownloadProgress = {
  percent: number;
  transferred: number;
  total: number;
};

export async function downloadReleaseAsset(options: {
  feedBaseUrl: string;
  fileName: string;
  versionLabel: string;
  onProgress?: (progress: ReleaseDownloadProgress) => void;
}): Promise<{ ok: true; filePath: string } | { ok: false; error: string }> {
  const base = options.feedBaseUrl.replace(/\/$/, '');
  const url = `${base}/${options.fileName}`;
  const safeVersion = options.versionLabel.replace(/[^\d.A-Za-z-]+/g, '_');
  const downloadsDir = app.getPath('downloads');
  await mkdir(downloadsDir, { recursive: true });
  const filePath = path.join(downloadsDir, `FlexHubs-Desktop-${safeVersion}${path.extname(options.fileName)}`);

  try {
    const response = await fetch(url, { redirect: 'follow' });
    if (!response.ok) {
      return { ok: false, error: `Could not download installer (HTTP ${response.status}).` };
    }

    const totalHeader = response.headers.get('content-length');
    const total = totalHeader ? Number(totalHeader) : 0;
    let transferred = 0;

    if (!response.body) {
      return { ok: false, error: 'Download failed (empty response).' };
    }

    const nodeStream = Readable.fromWeb(response.body as import('stream/web').ReadableStream);
    const fileStream = createWriteStream(filePath);

    nodeStream.on('data', (chunk: Buffer) => {
      transferred += chunk.length;
      if (!options.onProgress) {
        return;
      }
      const percent = total > 0 ? Math.min(100, (transferred / total) * 100) : 0;
      options.onProgress({ percent, transferred, total });
    });

    await pipeline(nodeStream, fileStream);

    if (options.onProgress) {
      options.onProgress({ percent: 100, transferred, total: total || transferred });
    }

    return { ok: true, filePath };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Download failed.';
    return { ok: false, error: message };
  }
}

export async function revealInstaller(filePath: string): Promise<void> {
  await shell.openPath(filePath);
}
