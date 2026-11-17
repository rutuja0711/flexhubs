import { app, nativeImage } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

export function resolveAssetsDir(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'assets');
  }

  const fromAppPath = path.join(app.getAppPath(), 'assets');
  if (fs.existsSync(fromAppPath)) {
    return fromAppPath;
  }

  return path.join(__dirname, '..', '..', 'assets');
}

/** Full application icon PNG (symbol on background) — for notifications and fallbacks. */
export function resolveAppIconPngPath(): string {
  const assetsDir = resolveAssetsDir();
  const candidates = [
    path.join(assetsDir, 'app-icon.png'),
    path.join(assetsDir, 'icon.png'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return path.join(assetsDir, 'app-icon.png');
}

export function resolveAppIconIcnsPath(): string | undefined {
  const icnsPath = path.join(resolveAssetsDir(), 'icon.icns');
  return fs.existsSync(icnsPath) ? icnsPath : undefined;
}

export function resolveAppIconImage(): Electron.NativeImage | undefined {
  const assetsDir = resolveAssetsDir();

  if (process.platform === 'darwin') {
    const icnsPath = path.join(assetsDir, 'icon.icns');
    if (fs.existsSync(icnsPath)) {
      const icon = nativeImage.createFromPath(icnsPath);
      if (!icon.isEmpty()) {
        return icon;
      }
    }
  }

  const candidates = [
    path.join(assetsDir, 'app-icon.png'),
    path.join(assetsDir, 'icon.png'),
    path.join(assetsDir, 'icon.ico'),
  ];

  for (const iconPath of candidates) {
    if (!fs.existsSync(iconPath)) {
      continue;
    }

    const icon = nativeImage.createFromPath(iconPath);
    if (!icon.isEmpty()) {
      return icon;
    }
  }

  if (process.platform === 'win32' && app.isPackaged) {
    const exeIcon = nativeImage.createFromPath(process.execPath);
    if (!exeIcon.isEmpty()) {
      return exeIcon;
    }
  }

  return undefined;
}