import { app } from 'electron';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';

const execFile = promisify(execFileCb);

export type MacFeedMetadata = {
  version: string;
  zipFileName: string;
  sha512: string;
  size: number;
};

export type MacZipPrepareResult =
  | { ok: true; version: string; appBundlePath: string; stagingRoot: string }
  | { ok: false; error: string };

function parseMacFeedYaml(yaml: string): MacFeedMetadata | null {
  const versionMatch = yaml.match(/^version:\s*['"]?([^\s'"]+)['"]?\s*$/m);
  const version = versionMatch?.[1]?.trim();
  if (!version) {
    return null;
  }

  const shaMatch = yaml.match(/^sha512:\s*([A-Za-z0-9+/=]+)\s*$/m);
  const sha512 = shaMatch?.[1]?.trim();
  if (!sha512) {
    return null;
  }

  const sizeMatch = yaml.match(/^\s+size:\s*(\d+)\s*$/m);
  const size = sizeMatch ? Number(sizeMatch[1]) : 0;

  const fileBlocks = [...yaml.matchAll(/^\s+-\s*url:\s*(.+)\s*$/gm)];
  let zipFileName = 'FlexHubs-Desktop-mac.zip';

  for (const block of fileBlocks) {
    const candidate = block[1]?.trim();
    if (candidate && candidate.toLowerCase().endsWith('.zip')) {
      zipFileName = candidate;
      break;
    }
  }

  const pathMatch = yaml.match(/^path:\s*(.+)\s*$/m);
  if (pathMatch?.[1]?.trim().toLowerCase().endsWith('.zip')) {
    zipFileName = pathMatch[1].trim();
  }

  return { version, zipFileName, sha512, size };
}

export async function fetchMacFeedMetadata(feedBaseUrl: string): Promise<MacFeedMetadata | null> {
  const url = `${feedBaseUrl.replace(/\/$/, '')}/latest-mac.yml`;
  const response = await fetch(url, {
    redirect: 'follow',
    headers: { 'User-Agent': 'FlexHubs-Desktop-Updater' },
  });

  if (!response.ok) {
    return null;
  }

  const yaml = await response.text();
  return parseMacFeedYaml(yaml);
}

function sha512Base64File(filePath: string): string {
  const data = fs.readFileSync(filePath);
  return crypto.createHash('sha512').update(data).digest('base64');
}

async function downloadFile(
  url: string,
  destPath: string,
  onProgress?: (percent: number) => void,
): Promise<void> {
  const response = await fetch(url, {
    redirect: 'follow',
    headers: { 'User-Agent': 'FlexHubs-Desktop-Updater' },
  });

  if (!response.ok) {
    throw new Error(`Download failed (HTTP ${response.status}).`);
  }

  const total = Number(response.headers.get('content-length') || 0);
  const reader = response.body?.getReader();

  if (!reader) {
    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(destPath, buffer);
    onProgress?.(100);
    return;
  }

  const chunks: Buffer[] = [];
  let received = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    if (value) {
      const chunk = Buffer.from(value);
      chunks.push(chunk);
      received += chunk.length;
      if (total > 0) {
        onProgress?.(Math.min(100, Math.floor((received / total) * 100)));
      }
    }
  }

  fs.writeFileSync(destPath, Buffer.concat(chunks));
  onProgress?.(100);
}

function findAppBundle(root: string, depth = 0): string | null {
  if (depth > 4) {
    return null;
  }

  let entries: string[];

  try {
    entries = fs.readdirSync(root);
  } catch {
    return null;
  }

  for (const entry of entries) {
    const full = path.join(root, entry);
    let stat: fs.Stats;

    try {
      stat = fs.statSync(full);
    } catch {
      continue;
    }

    if (stat.isDirectory() && entry.endsWith('.app')) {
      return full;
    }

    if (stat.isDirectory() && !entry.startsWith('.')) {
      const nested = findAppBundle(full, depth + 1);
      if (nested) {
        return nested;
      }
    }
  }

  return null;
}

async function extractZip(zipPath: string, destDir: string): Promise<void> {
  fs.mkdirSync(destDir, { recursive: true });

  if (process.platform === 'darwin') {
    await execFile('ditto', ['-x', '-k', zipPath, destDir]);
    return;
  }

  await execFile('unzip', ['-o', zipPath, '-d', destDir]);
}

function macUpdateStagingRoot(): string {
  return path.join(app.getPath('userData'), 'mac-zip-update-staging');
}

export async function prepareMacZipUpdate(
  feedBaseUrl: string,
  onProgress?: (percent: number) => void,
): Promise<MacZipPrepareResult> {
  const meta = await fetchMacFeedMetadata(feedBaseUrl);
  if (!meta) {
    return { ok: false, error: 'Could not read the macOS update feed.' };
  }

  const zipUrl = `${feedBaseUrl.replace(/\/$/, '')}/${meta.zipFileName}`;
  const staging = macUpdateStagingRoot();

  try {
    fs.rmSync(staging, { recursive: true, force: true });
  } catch {
    // ignore
  }

  fs.mkdirSync(staging, { recursive: true });

  const zipPath = path.join(staging, meta.zipFileName);
  const extractDir = path.join(staging, 'extracted');

  try {
    onProgress?.(0);
    await downloadFile(zipUrl, zipPath, onProgress);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Download failed.';
    return { ok: false, error: message };
  }

  const hash = sha512Base64File(zipPath);
  if (hash !== meta.sha512) {
    try {
      fs.rmSync(staging, { recursive: true, force: true });
    } catch {
      // ignore
    }
    return {
      ok: false,
      error: 'The downloaded update did not match the release checksum. Try Retry or Download full installer (DMG).',
    };
  }

  try {
    await extractZip(zipPath, extractDir);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not unpack the update.';
    return { ok: false, error: message };
  }

  const appBundlePath = findAppBundle(extractDir);
  if (!appBundlePath) {
    return { ok: false, error: 'Update archive did not contain an app bundle.' };
  }

  return {
    ok: true,
    version: meta.version,
    appBundlePath,
    stagingRoot: staging,
  };
}

export function defaultMacApplicationsPath(productName: string): string {
  return path.join('/Applications', `${productName}.app`);
}

/** Quit FlexHubs and replace /Applications bundle via a short-lived shell helper (unsigned-safe). */
export function launchMacZipInstallHelper(appBundlePath: string): void {
  const targetApp = defaultMacApplicationsPath(app.getName());
  const scriptPath = path.join(app.getPath('userData'), 'apply-mac-zip-update.sh');

  const script = `#!/bin/bash
set -e
sleep 2
SRC=${JSON.stringify(appBundlePath)}
TARGET=${JSON.stringify(targetApp)}
if [ ! -d "$SRC" ]; then
  exit 1
fi
mkdir -p "/Applications"
rm -rf "$TARGET"
ditto "$SRC" "$TARGET"
xattr -cr "$TARGET" 2>/dev/null || true
open "$TARGET"
`;

  fs.writeFileSync(scriptPath, script, { mode: 0o755 });

  const child = spawn('/bin/bash', [scriptPath], {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();

  setTimeout(() => {
    app.quit();
  }, 400);
}

export function cleanupMacZipStaging(): void {
  try {
    fs.rmSync(macUpdateStagingRoot(), { recursive: true, force: true });
  } catch {
    // ignore
  }
}
