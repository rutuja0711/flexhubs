import { app, safeStorage } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

export type PersistedAuthSession = {
  token: string;
  user: unknown;
};

type PersistedAuthFile = {
  /** Present when safeStorage encryption is used. */
  tokenEnc?: string;
  /** Legacy / fallback plain token. */
  token?: string;
  user?: unknown;
  updatedAt: string;
};

function sessionFilePath(): string {
  return path.join(app.getPath('userData'), 'desktop-auth-session.json');
}

function encryptToken(token: string): { tokenEnc?: string; token?: string } {
  if (safeStorage.isEncryptionAvailable()) {
    try {
      return { tokenEnc: safeStorage.encryptString(token).toString('base64') };
    } catch (error) {
      console.warn('[FlexHubs] Could not encrypt auth token:', error);
    }
  }

  return { token };
}

function decryptToken(record: PersistedAuthFile): string | null {
  if (record.tokenEnc) {
    if (!safeStorage.isEncryptionAvailable()) {
      return null;
    }

    try {
      return safeStorage.decryptString(Buffer.from(record.tokenEnc, 'base64'));
    } catch (error) {
      console.warn('[FlexHubs] Could not decrypt auth token:', error);
      return null;
    }
  }

  return typeof record.token === 'string' && record.token.trim() ? record.token.trim() : null;
}

export function readPersistedAuthSession(): PersistedAuthSession | null {
  const filePath = sessionFilePath();

  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }

    const record = JSON.parse(fs.readFileSync(filePath, 'utf8')) as PersistedAuthFile;
    const token = decryptToken(record);

    if (!token) {
      return null;
    }

    return {
      token,
      user: record.user ?? null,
    };
  } catch (error) {
    console.warn('[FlexHubs] Could not read auth session file:', error);
    return null;
  }
}

export function writePersistedAuthSession(session: PersistedAuthSession): void {
  const filePath = sessionFilePath();
  const tokenFields = encryptToken(session.token.trim());
  const record: PersistedAuthFile = {
    ...tokenFields,
    user: session.user,
    updatedAt: new Date().toISOString(),
  };

  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(record, null, 2), {
      encoding: 'utf8',
      mode: 0o600,
    });
  } catch (error) {
    console.warn('[FlexHubs] Could not write auth session file:', error);
  }
}

export function clearPersistedAuthSession(): void {
  const filePath = sessionFilePath();

  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.warn('[FlexHubs] Could not clear auth session file:', error);
  }
}
