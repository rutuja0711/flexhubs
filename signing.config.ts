import path from 'node:path';
import type { NotaryToolCredentials } from '@electron/notarize/lib/types';
import type { OsxSignOptions } from '@electron/osx-sign/dist/esm/types';

const projectRoot = __dirname;

export function isSigningEnabled(): boolean {
  return process.env.SKIP_CODE_SIGNING !== 'true';
}

export function getMacOsSignConfig(): OsxSignOptions | undefined {
  if (!isSigningEnabled()) {
    return undefined;
  }

  const hasMacCredentials =
    Boolean(process.env.MACOS_CERTIFICATE) ||
    Boolean(process.env.MAC_DEVELOPER_IDENTITY) ||
    Boolean(process.env.APPLE_ID) ||
    Boolean(process.env.APPLE_API_KEY);

  if (!hasMacCredentials) {
    return undefined;
  }

  return {
    ...(process.env.MAC_DEVELOPER_IDENTITY
      ? { identity: process.env.MAC_DEVELOPER_IDENTITY }
      : {}),
    hardenedRuntime: true,
    entitlements: path.join(projectRoot, 'entitlements.mac.plist'),
    'entitlements-inherit': path.join(projectRoot, 'entitlements.mac.inherit.plist'),
    'gatekeeper-assess': false,
  };
}

export function getMacOsNotarizeConfig(): NotaryToolCredentials | undefined {
  if (!isSigningEnabled()) {
    return undefined;
  }

  if (process.env.APPLE_API_KEY && process.env.APPLE_KEY_ID && process.env.APPLE_ISSUER_ID) {
    return {
      appleApiKey: process.env.APPLE_API_KEY,
      appleApiKeyId: process.env.APPLE_KEY_ID,
      appleApiIssuer: process.env.APPLE_ISSUER_ID,
    };
  }

  if (
    process.env.APPLE_ID &&
    process.env.APPLE_APP_SPECIFIC_PASSWORD &&
    process.env.APPLE_TEAM_ID
  ) {
    return {
      appleId: process.env.APPLE_ID,
      appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
      teamId: process.env.APPLE_TEAM_ID,
    };
  }

  return undefined;
}

export type WindowsSignConfig = {
  certificateFile: string;
  certificatePassword?: string;
};

export function getWindowsSignConfig(): WindowsSignConfig | undefined {
  if (!isSigningEnabled()) {
    return undefined;
  }

  const certificateFile = process.env.WINDOWS_CERTIFICATE_FILE || process.env.CSC_LINK;

  if (!certificateFile) {
    return undefined;
  }

  return {
    certificateFile,
    certificatePassword:
      process.env.WINDOWS_CERTIFICATE_PASSWORD || process.env.CSC_KEY_PASSWORD || undefined,
  };
}

export function hasMacSigningCredentials(): boolean {
  return Boolean(getMacOsSignConfig());
}

export function hasWindowsSigningCredentials(): boolean {
  return Boolean(getWindowsSignConfig());
}
