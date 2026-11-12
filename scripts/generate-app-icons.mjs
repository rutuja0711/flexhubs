#!/usr/bin/env node
/**
 * Build platform icons from the single source asset: assets/logo-symbol.png
 * (transparent FlexHubs mark). Run after updating the PNG: npm run generate:icons
 */
import { execFileSync, execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const sourcePng = path.join(projectRoot, 'assets', 'logo-symbol.png');
const icnsOut = path.join(projectRoot, 'assets', 'logo-symbol.icns');
const icoOut = path.join(projectRoot, 'assets', 'logo-symbol.ico');
const publicDir = path.join(projectRoot, 'src', 'renderer', 'public');

function assertSource() {
  if (!fs.existsSync(sourcePng)) {
    throw new Error(`Missing source logo: ${sourcePng}`);
  }
}

function generateIcnsDarwin() {
  const iconsetDir = path.join(projectRoot, 'assets', 'logo-symbol.iconset');
  const iconSizes = [
    [16, '16x16'],
    [32, '16x16@2x'],
    [32, '32x32'],
    [64, '32x32@2x'],
    [128, '128x128'],
    [256, '128x128@2x'],
    [256, '256x256'],
    [512, '256x256@2x'],
    [512, '512x512'],
    [1024, '512x512@2x'],
  ];

  fs.rmSync(iconsetDir, { recursive: true, force: true });
  fs.mkdirSync(iconsetDir, { recursive: true });

  for (const [size, name] of iconSizes) {
    execSync(
      `sips -z ${size} ${size} "${sourcePng}" --out "${path.join(iconsetDir, `icon_${name}.png`)}"`,
      { stdio: 'inherit' },
    );
  }

  execSync(`iconutil -c icns "${iconsetDir}" -o "${icnsOut}"`, { stdio: 'inherit' });
  fs.rmSync(iconsetDir, { recursive: true, force: true });
}

function generateIcoWithPython() {
  const scriptPath = path.join(projectRoot, 'scripts', 'generate-ico.py');
  execFileSync('python3', [scriptPath], { stdio: 'inherit', cwd: projectRoot });
}

function syncRendererPublicAssets() {
  fs.mkdirSync(publicDir, { recursive: true });
  const copies = [
    ['logo-symbol.png', 'logo-symbol.png'],
    ['logo-symbol.png', 'icon.png'],
    ['logo-symbol.png', 'icon-256.png'],
    ['logo-symbol.png', 'favicon-32.png'],
    ['logo-symbol.png', 'favicon-16.png'],
  ];

  for (const [fromName, toName] of copies) {
    fs.copyFileSync(path.join(projectRoot, 'assets', fromName), path.join(publicDir, toName));
  }
}

function main() {
  assertSource();

  console.log('[FlexHubs] Generating icons from', sourcePng);

  if (process.platform === 'darwin') {
    try {
      generateIcnsDarwin();
    } catch (error) {
      console.warn('[FlexHubs] iconutil failed — if icons already exist, continuing.', error);
      if (!fs.existsSync(icnsOut)) {
        throw error;
      }
    }
  } else {
    console.warn('[FlexHubs] Skipping .icns generation (requires macOS iconutil).');
  }

  generateIcoWithPython();

  // Legacy filenames still referenced by some tooling — keep in sync with source PNG.
  fs.copyFileSync(sourcePng, path.join(projectRoot, 'assets', 'icon.png'));
  if (fs.existsSync(icnsOut)) {
    fs.copyFileSync(icnsOut, path.join(projectRoot, 'assets', 'icon.icns'));
  }
  if (fs.existsSync(icoOut)) {
    fs.copyFileSync(icoOut, path.join(projectRoot, 'assets', 'icon.ico'));
  }

  syncRendererPublicAssets();
  console.log('[FlexHubs] Icon generation complete.');
}

main();
