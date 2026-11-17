import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  DESKTOP_APP_BUNDLE_ID,
  WINDOWS_NOTIFICATION_DISPLAY_NAME,
} from '../../shared/desktopAppId';
import { resolveAssetsDir } from '../appBrandAssets';

const START_MENU_SUBFOLDER = 'FlexHubs';
const SHELL_SHORTCUT_NAME = 'FlexHubs.lnk';

function windowsProgramsFolder(): string {
  return path.join(app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs');
}

export function shellShortcutPath(): string {
  return path.join(windowsProgramsFolder(), START_MENU_SUBFOLDER, SHELL_SHORTCUT_NAME);
}

function setShortcutAumidScriptPath(): string | null {
  const candidates = [
    path.join(resolveAssetsDir(), 'windows', 'set-lnk-aumid.ps1'),
    path.join(app.getAppPath(), 'assets', 'windows', 'set-lnk-aumid.ps1'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

function runCommand(file: string, args: string[]): boolean {
  try {
    execFileSync(file, args, { stdio: 'ignore', windowsHide: true });
    return true;
  } catch (error) {
    console.warn(`[FlexHubs] Command failed (${file}):`, error);
    return false;
  }
}

function runPowerShell(args: string[]): boolean {
  if (process.platform !== 'win32') {
    return false;
  }

  const systemRoot = process.env.SystemRoot || process.env.WINDIR || 'C:\\Windows';
  const powershell = path.join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');

  if (!fs.existsSync(powershell)) {
    return false;
  }

  return runCommand(powershell, ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', ...args]);
}

function writeNotificationRegistry(): boolean {
  const regKey = `HKCU\\Software\\Classes\\AppUserModelId\\${DESKTOP_APP_BUNDLE_ID}`;
  const iconResource = `${process.execPath},0`;
  const registeredAppsKey = 'HKCU\\Software\\RegisteredApplications';

  const wroteDefault = runCommand('reg', [
    'add',
    regKey,
    '/ve',
    '/d',
    WINDOWS_NOTIFICATION_DISPLAY_NAME,
    '/f',
  ]);
  const wroteDisplayName = runCommand('reg', [
    'add',
    regKey,
    '/v',
    'DisplayName',
    '/t',
    'REG_SZ',
    '/d',
    WINDOWS_NOTIFICATION_DISPLAY_NAME,
    '/f',
  ]);
  const wroteIcon = runCommand('reg', [
    'add',
    regKey,
    '/v',
    'IconResource',
    '/t',
    'REG_SZ',
    '/d',
    iconResource,
    '/f',
  ]);
  const wroteRegisteredApp = runCommand('reg', [
    'add',
    registeredAppsKey,
    '/v',
    WINDOWS_NOTIFICATION_DISPLAY_NAME,
    '/t',
    'REG_SZ',
    '/d',
    `Software\\Classes\\AppUserModelId\\${DESKTOP_APP_BUNDLE_ID}`,
    '/f',
  ]);

  return wroteDefault && wroteDisplayName && wroteIcon && wroteRegisteredApp;
}

function ensureWindowsShellShortcut(): void {
  const shortcut = shellShortcutPath();

  try {
    fs.mkdirSync(path.dirname(shortcut), { recursive: true });
  } catch {
    // ignore
  }

  const script = setShortcutAumidScriptPath();
  if (!script) {
    console.warn('[FlexHubs] Windows notification shortcut script missing — toasts may not register.');
    return;
  }

  runPowerShell([
    '-File',
    script,
    '-ShortcutPath',
    shortcut,
    '-TargetPath',
    process.execPath,
    '-WorkingDirectory',
    path.dirname(process.execPath),
    '-AppUserModelId',
    DESKTOP_APP_BUNDLE_ID,
    '-Description',
    WINDOWS_NOTIFICATION_DISPLAY_NAME,
  ]);
}

export type WindowsNotificationIdentityStatus = {
  ok: boolean;
  registry: boolean;
  shellShortcut: boolean;
  aumidScript: boolean;
  shortcutPath: string;
};

export function getWindowsNotificationIdentityStatus(): WindowsNotificationIdentityStatus {
  const script = setShortcutAumidScriptPath();
  const shortcut = shellShortcutPath();

  return {
    ok: Boolean(script) && fs.existsSync(shortcut),
    registry: true,
    shellShortcut: fs.existsSync(shortcut),
    aumidScript: Boolean(script),
    shortcutPath: shortcut,
  };
}

/** Idempotent — safe on every packaged launch (covers in-app updates that skip NSIS hooks). */
export function registerWindowsNotificationIdentity(): void {
  if (process.platform !== 'win32' || !app.isPackaged) {
    return;
  }

  app.setAppUserModelId(DESKTOP_APP_BUNDLE_ID);

  const registryOk = writeNotificationRegistry();
  ensureWindowsShellShortcut();

  const status = getWindowsNotificationIdentityStatus();
  console.log(
    `[FlexHubs] Windows notification identity — registry: ${registryOk ? 'ok' : 'failed'}, ` +
      `shell shortcut: ${status.shellShortcut ? 'ok' : 'missing'}, ` +
      `AUMID: ${DESKTOP_APP_BUNDLE_ID}, display name: ${WINDOWS_NOTIFICATION_DISPLAY_NAME}`,
  );
}