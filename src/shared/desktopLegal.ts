/** Bump when terms change to re-prompt packaged desktop users. */
export const DESKTOP_LEGAL_VERSION = 1;

export const DESKTOP_LEGAL_STORAGE_KEY = 'flexhubs.desktop.legalAcceptedVersion';

export const DESKTOP_TERMS_URL = 'https://flexhubs.in/terms';
export const DESKTOP_PRIVACY_URL = 'https://flexhubs.in/privacy';

export function readAcceptedDesktopLegalVersion(): number | null {
  try {
    const raw = localStorage.getItem(DESKTOP_LEGAL_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function storeAcceptedDesktopLegalVersion(version: number = DESKTOP_LEGAL_VERSION): void {
  localStorage.setItem(DESKTOP_LEGAL_STORAGE_KEY, String(version));
}

export function needsDesktopLegalAcceptance(isPackaged: boolean): boolean {
  if (!isPackaged) {
    return false;
  }

  return readAcceptedDesktopLegalVersion() !== DESKTOP_LEGAL_VERSION;
}
