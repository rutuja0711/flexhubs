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

/** Same artwork as Dock — always assets/app-icon.png (from desktopicon.png). */
export function resolveNotificationIconImage(): Electron.NativeImage | undefined {
  const pngPath = resolveAppIconPngPath();
  if (!fs.existsSync(pngPath)) {
    return undefined;
  }

  const icon = nativeImage.createFromPath(pngPath);
  return icon.isEmpty() ? undefined : icon;
}

export function resolveAppIconImage(): Electron.NativeImage | undefined {
  const fromMasterPng = resolveNotificationIconImage();
  if (fromMasterPng) {
    return fromMasterPng;
  }

  const assetsDir = resolveAssetsDir();
  const candidates = [
    path.join(assetsDir, 'icon.png'),
    path.join(assetsDir, 'icon.ico'),
    path.join(assetsDir, 'icon.icns'),
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