import type { ProfileSettings } from '../shared/profile';

const STORAGE_PREFIX = 'flexhubs-desktop:privacy-settings:';

export const PRIVACY_SETTING_KEYS = [
  'shareOnlineStatus',
  'showLastActive',
  'readReceipts',
  'profileVisibility',
  'emailVisibility',
  'statusVisibility',
  'allowDirectMessagesFrom',
  'callPrivacy',
] as const satisfies ReadonlyArray<keyof ProfileSettings>;

export type PrivacySettingKey = (typeof PRIVACY_SETTING_KEYS)[number];

export function pickPrivacySettings(settings: ProfileSettings): Partial<ProfileSettings> {
  const picked: Partial<ProfileSettings> = {};

  for (const key of PRIVACY_SETTING_KEYS) {
    const value = settings[key];
    if (value !== undefined) {
      (picked as Record<string, unknown>)[key] = value;
    }
  }

  return picked;
}

export function mergePrivacySettings(
  base: ProfileSettings,
  overlay: Partial<ProfileSettings> | null | undefined,
): ProfileSettings {
  if (!overlay) {
    return base;
  }

  return {
    ...base,
    ...pickPrivacySettings({ ...base, ...overlay } as ProfileSettings),
  };
}

export function readStoredPrivacySettings(userId: string): Partial<ProfileSettings> | null {
  if (!userId.trim()) {
    return null;
  }

  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${userId}`);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<ProfileSettings>;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export function writeStoredPrivacySettings(
  userId: string,
  patch: Partial<ProfileSettings>,
): void {
  if (!userId.trim()) {
    return;
  }

  const previous = readStoredPrivacySettings(userId) ?? {};
  const next = { ...previous, ...patch };

  try {
    localStorage.setItem(`${STORAGE_PREFIX}${userId}`, JSON.stringify(next));
  } catch {
    // Ignore quota / private mode errors.
  }
}
