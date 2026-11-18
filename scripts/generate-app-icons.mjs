#!/usr/bin/env node
/**
 * Build platform icons from assets/app-icon.png.
 * Master: assets/desktop-icon-master.jpg (official). Fallback: compose-app-icon.py + logo-symbol.png.
 *
 * Run: npm run generate:icons
 */
import { execFileSync, execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const symbolPng = path.join(projectRoot, 'assets', 'logo-symbol.png');
const desktopMasterPng = path.join(projectRoot, 'assets', 'desktopicon.png');
const desktopMasterJpg = path.join(projectRoot, 'assets', 'desktop-icon-master.jpg');
const sourcePng = path.join(projectRoot, 'assets', 'app-icon.png');
const icnsOut = path.join(projectRoot, 'assets', 'icon.icns');
const icoOut = path.join(projectRoot, 'assets', 'icon.ico');
const flatPngOut = path.join(projectRoot, 'assets', 'icon.png');
const publicDir = path.join(projectRoot, 'src', 'renderer', 'public');
const iconVenvDir = path.join(projectRoot, '.venv-icons');

function venvPythonPath(venvDir) {
  return process.platform === 'win32'
    ? path.join(venvDir, 'Scripts', 'python.exe')
    : path.join(venvDir, 'bin', 'python3');
}

function venvPipPath(venvDir) {
  return process.platform === 'win32'
    ? path.join(venvDir, 'Scripts', 'pip.exe')
    : path.join(venvDir, 'bin', 'pip');
}

function pythonCanImportPillow(pythonBin) {
  try {
    execFileSync(pythonBin, ['-c', 'import PIL'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/** Prefer project venv to avoid PEP 668 (externally-managed) system Python on macOS CI/Homebrew. */
function resolveIcoPython() {
  const fromEnv = process.env.FLEXHUBS_ICON_PYTHON?.trim();
  if (fromEnv && pythonCanImportPillow(fromEnv)) {
    return fromEnv;
  }

  const venvPython = venvPythonPath(iconVenvDir);
  if (fs.existsSync(venvPython) && pythonCanImportPillow(venvPython)) {
    return venvPython;
  }

  if (pythonCanImportPillow('python3')) {
    return 'python3';
  }

  console.log('[FlexHubs] Pillow not found — creating local .venv-icons for ICO generation.');
  execFileSync('python3', ['-m', 'venv', iconVenvDir], { stdio: 'inherit', cwd: projectRoot });
  const pip = venvPipPath(iconVenvDir);
  execFileSync(pip, ['install', 'pillow'], { stdio: 'inherit', cwd: projectRoot });

  if (!pythonCanImportPillow(venvPython)) {
    throw new Error('Failed to install Pillow in .venv-icons');
  }

  return venvPython;
}

function assertSymbol() {
  if (!fs.existsSync(symbolPng)) {
    throw new Error(`Missing logo symbol: ${symbolPng}`);
  }
}

function importDesktopMasterPng(pythonBin) {
  const scriptPath = path.join(projectRoot, 'scripts', 'import-desktop-icon.py');
  execFileSync(pythonBin, [scriptPath], { stdio: 'inherit', cwd: projectRoot });

  if (!fs.existsSync(sourcePng)) {
    throw new Error(`Missing imported app icon: ${sourcePng}`);
  }
}

function composeMasterPng(pythonBin) {
  const scriptPath = path.join(projectRoot, 'scripts', 'compose-app-icon.py');
  execFileSync(pythonBin, [scriptPath], { stdio: 'inherit', cwd: projectRoot });

  if (!fs.existsSync(sourcePng)) {
    throw new Error(`Missing composed app icon: ${sourcePng}`);
  }
}

function prepareMasterPng(pythonBin) {
  if (fs.existsSync(desktopMasterPng) || fs.existsSync(desktopMasterJpg)) {
    const master = fs.existsSync(desktopMasterPng) ? desktopMasterPng : desktopMasterJpg;
    console.log('[FlexHubs] Importing official desktop icon from', master);
    importDesktopMasterPng(pythonBin);
    return;
  }

  assertSymbol();
  console.log('[FlexHubs] Composing master app icon from', symbolPng);
  composeMasterPng(pythonBin);
}

function generateIcnsDarwin() {
  const iconsetDir = path.join(projectRoot, 'assets', 'icon.iconset');
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

function generateIcoWithPython(pythonBin) {
  const scriptPath = path.join(projectRoot, 'scripts', 'generate-ico.py');
  execFileSync(pythonBin, [scriptPath], { stdio: 'inherit', cwd: projectRoot });
}

function syncRendererPublicAssets() {
  fs.mkdirSync(publicDir, { recursive: true });
  const copies = [
    ['logo-symbol.png', 'logo-symbol.png'],
    [sourcePng, 'icon.png'],
    [sourcePng, 'icon-256.png'],
    [sourcePng, 'icon-512.png'],
  ];

  for (const [from, toName] of copies) {
    const fromPath = typeof from === 'string' && from.includes(path.sep) ? from : path.join(projectRoot, 'assets', from);
    fs.copyFileSync(fromPath, path.join(publicDir, toName));
  }

  for (const size of [32, 16]) {
    execSync(
      `sips -z ${size} ${size} "${sourcePng}" --out "${path.join(publicDir, `favicon-${size}.png`)}"`,
      { stdio: 'inherit' },
    );
  }
}

function main() {
  const pythonBin = resolveIcoPython();
  prepareMasterPng(pythonBin);

  console.log('[FlexHubs] Generating .icns and .ico from', sourcePng);

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

  generateIcoWithPython(pythonBin);
  fs.copyFileSync(sourcePng, flatPngOut);

  syncRendererPublicAssets();
  console.log('[FlexHubs] Icon generation complete.');
}

main();