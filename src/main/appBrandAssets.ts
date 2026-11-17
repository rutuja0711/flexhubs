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

export function resolveAppIconPngPath(): string {
  const assetsDir = resolveAssetsDir();
  return path.join(assetsDir, 'logo-symbol.png');
}

export function resolveAppIconImage(): Electron.NativeImage | undefined {
  const assetsDir = resolveAssetsDir();
  const candidates = [
    path.join(assetsDir, 'logo-symbol.png'),
    path.join(assetsDir, 'logo-symbol.icns'),
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

export function resolveAppIconIcnsPath(): string | undefined {
  const icnsPath = path.join(resolveAssetsDir(), 'logo-symbol.icns');
  return fs.existsSync(icnsPath) ? icnsPath : undefined;
}