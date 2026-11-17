#!/usr/bin/env node
/**
 * Ensures packaged win32 build includes Windows toast shell assets.
 * Run after: npm run package:win
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const outDir = path.join(projectRoot, 'out');

function findWin32PackageDir() {
  if (!fs.existsSync(outDir)) {
    throw new Error('Missing out/ — run npm run package:win first.');
  }

  const entries = fs
    .readdirSync(outDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.toLowerCase().includes('win32'));

  for (const entry of entries) {
    const candidate = path.join(outDir, entry.name);
    const exe = ['FlexHubs Desktop.exe', 'flexhubs-desktop.exe'].find((name) =>
      fs.existsSync(path.join(candidate, name)),
    );
    if (exe) {
      return candidate;
    }
  }

  throw new Error(`No win32 package found under ${outDir}`);
}

function main() {
  const packageDir = findWin32PackageDir();
  const required = [
    path.join(packageDir, 'resources', 'assets', 'windows', 'set-lnk-aumid.ps1'),
    path.join(packageDir, 'resources', 'assets', 'app-icon.png'),
  ];

  const missing = required.filter((file) => !fs.existsSync(file));

  if (missing.length > 0) {
    console.error('[FlexHubs] Windows notification packaging check failed. Missing:');
    for (const file of missing) {
      console.error(' -', file);
    }
    process.exit(1);
  }

  console.log('[FlexHubs] Windows notification packaging check passed.');
  console.log('[FlexHubs] Package:', packageDir);
}

main();