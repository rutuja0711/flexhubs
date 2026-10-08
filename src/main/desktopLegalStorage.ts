import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { DESKTOP_LEGAL_VERSION } from '../shared/desktopLegal';

type DesktopLegalRecord = {
  acceptedVersion: number;
  acceptedAt: string;
};

function legalRecordPath(): string {
  return path.join(app.getPath('userData'), 'desktop-legal-acceptance.json');
}

export function readPersistedDesktopLegalVersion(): number | null {
  const filePath = legalRecordPath();

  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }

    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Partial<DesktopLegalRecord>;
    const version = Number(parsed.acceptedVersion);

    return Number.isFinite(version) ? version : null;
  } catch (error) {
    console.warn('[FlexHubs] Could not read desktop legal acceptance file:', error);
    return null;
  }
}

export function writePersistedDesktopLegalVersion(version: number = DESKTOP_LEGAL_VERSION): void {
  const filePath = legalRecordPath();
  const record: DesktopLegalRecord = {
    acceptedVersion: version,
    acceptedAt: new Date().toISOString(),
  };

  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(record, null, 2), 'utf8');
  } catch (error) {
    console.warn('[FlexHubs] Could not write desktop legal acceptance file:', error);
  }
}
