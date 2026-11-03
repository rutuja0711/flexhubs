#!/usr/bin/env node
/**
 * Builds FlexHubs-Setup.exe (NSIS) from an Electron Forge prepackaged win32 directory.
 * Run after: npm run package:win  (or electron-forge package --platform=win32 --arch x64)
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));

function resolvePrepackagedDir() {
  const outDir = path.join(projectRoot, 'out');

  if (!fs.existsSync(outDir)) {
    throw new Error('Missing out/ — run electron-forge package for win32 first.');
  }

  const entries = fs
    .readdirSync(outDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.toLowerCase().includes('win32'));

  for (const entry of entries) {
    const candidate = path.join(outDir, entry.name);
    const exeNames = ['FlexHubs Desktop.exe', 'flexhubs-desktop.exe'];
    const hasAppExe = exeNames.some((name) => fs.existsSync(path.join(candidate, name)));

    if (hasAppExe) {
      return candidate;
    }
  }

  // Forge may nest the app under resources or use productName-based folder names.
  for (const entry of entries) {
    const candidate = path.join(outDir, entry.name);
    const nested = path.join(candidate, 'resources', 'app.asar');
    if (fs.existsSync(nested) || fs.existsSync(path.join(candidate, 'resources'))) {
      const exe = ['FlexHubs Desktop.exe', 'flexhubs-desktop.exe'].find((name) =>
        fs.existsSync(path.join(candidate, name)),
      );
      if (exe) {
        return candidate;
      }
    }
  }

  throw new Error(
    `No prepackaged Windows app found under out/*win32*. Run: npm run package:win\nFound: ${entries.map((e) => e.name).join(', ') || '(none)'}`,
  );
}

function mapSigningEnv() {
  const certFile = process.env.WINDOWS_CERTIFICATE_FILE || process.env.CSC_LINK;
  const certPassword = process.env.WINDOWS_CERTIFICATE_PASSWORD || process.env.CSC_KEY_PASSWORD;

  if (certFile) {
    process.env.CSC_LINK = certFile;
  }

  if (certPassword) {
    process.env.CSC_KEY_PASSWORD = certPassword;
  }
}

function main() {
  const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
  const prepackaged = resolvePrepackagedDir();
  const configPath = path.join(projectRoot, 'electron-builder.win.yml');
  const outputDir = path.join(projectRoot, 'out', 'make', 'nsis');

  mapSigningEnv();

  console.log('[FlexHubs] Prepackaged app:', prepackaged);
  console.log('[FlexHubs] NSIS config:', configPath);
  console.log('[FlexHubs] App version:', pkg.version);

  fs.mkdirSync(outputDir, { recursive: true });

  const electronBuilderCli = path.join(projectRoot, 'node_modules', 'electron-builder', 'cli.js');
  if (!fs.existsSync(electronBuilderCli)) {
    throw new Error('electron-builder is not installed. Run npm ci first.');
  }

  const args = [
    electronBuilderCli,
    'build',
    '--win',
    'nsis',
    '--x64',
    '--prepackaged',
    prepackaged,
    '--projectDir',
    projectRoot,
    '--config',
    configPath,
    `-c.extraMetadata.version=${pkg.version}`,
    '--publish',
    'never',
  ];

  const result = spawnSync(process.execPath, args, {
    cwd: projectRoot,
    stdio: 'inherit',
    env: process.env,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  const setupExe = path.join(outputDir, 'FlexHubs-Setup.exe');

  if (!fs.existsSync(setupExe)) {
    const found = fs
      .readdirSync(outputDir)
      .filter((name) => name.toLowerCase().endsWith('.exe') && name.toLowerCase().includes('setup'));

    if (found.length === 0) {
      throw new Error(`NSIS build finished but FlexHubs-Setup.exe was not found in ${outputDir}`);
    }

    console.warn(`[FlexHubs] Expected FlexHubs-Setup.exe; found ${found.join(', ')}`);
  } else {
    console.log('[FlexHubs] Windows installer:', setupExe);
  }
}

main();
