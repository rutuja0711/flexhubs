function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  return value as Record<string, unknown>;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/** LinkedIn-style cover proportions used across popup, settings, and full profile. */
export const PROFILE_BANNER_ASPECT = 4;
export const PROFILE_BANNER_MAX_BYTES = 5 * 1024 * 1024;
export const PROFILE_BANNER_ACCEPT = 'image/jpeg,image/jpg,image/png,image/webp';
export const PROFILE_BANNER_MIN_WIDTH = 480;
export const PROFILE_BANNER_MIN_HEIGHT = 120;

const COVER_FIELD_KEYS = [
  'coverUrl',
  'cover_url',
  'cover',
  'cover_image',
  'coverImageUrl',
  'cover_image_url',
  'coverImage',
  'bannerUrl',
  'banner_url',
  'coverBannerUrl',
  'profileBannerUrl',
  'profile_banner_url',
  'profileCoverUrl',
  'profile_cover_url',
  'coverPhoto',
  'coverPhotoUrl',
  'headerImageUrl',
  'profileBackgroundUrl',
  'backgroundImageUrl',
] as const;

const LOCAL_COVER_STORAGE_PREFIX = 'flexhubs:profileCover:';

/** Best available cover URL from API/profile payloads, then device-local fallback. */
export function resolveEffectiveCoverBanner(
  userId: string | null | undefined,
  ...sources: unknown[]
): string | null {
  for (const source of sources) {
    const fromSource = resolveProfileBannerUrl(source);
    if (fromSource) {
      return fromSource;
    }
  }

  return readPersistedLocalCover(userId);
}

export function readPersistedLocalCover(userId: string | null | undefined): string | null {
  if (!userId) {
    return null;
  }

  try {
    const raw = localStorage.getItem(`${LOCAL_COVER_STORAGE_PREFIX}${userId}`);
    return raw?.trim() ? raw.trim() : null;
  } catch {
    return null;
  }
}

export function writePersistedLocalCover(userId: string | null | undefined, url: string | null): void {
  if (!userId) {
    return;
  }

  try {
    const key = `${LOCAL_COVER_STORAGE_PREFIX}${userId}`;

    if (url?.trim()) {
      localStorage.setItem(key, url.trim());
      return;
    }

    localStorage.removeItem(key);
  } catch {
    // Ignore quota errors.
  }
}

const ALLOWED_MIME = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);

export type ProfileBannerValidationResult =
  | { ok: true }
  | { ok: false; error: string };

export function validateProfileBannerFile(file: File): ProfileBannerValidationResult {
  const mime = (file.type || '').toLowerCase();

  if (!ALLOWED_MIME.has(mime)) {
    return { ok: false, error: 'Use JPG, PNG, or WebP for your cover image.' };
  }

  if (file.size > PROFILE_BANNER_MAX_BYTES) {
    const limitMb = Math.round(PROFILE_BANNER_MAX_BYTES / (1024 * 1024));
    return { ok: false, error: `Cover image must be ${limitMb} MB or smaller.` };
  }

  return { ok: true };
}

export function resolveProfileBannerUrl(source: unknown): string | null {
  const record = asRecord(source);

  if (!record) {
    return null;
  }

  const candidates = [
    record,
    asRecord(record.user),
    asRecord(record.profile),
    asRecord(record.data),
  ].filter((entry): entry is Record<string, unknown> => entry !== null);

  for (const entry of candidates) {
    const url =
      readString(entry.coverUrl) ??
      readString(entry.cover_url) ??
      readString(entry.cover) ??
      readString(entry.cover_image) ??
      readString(entry.coverImageUrl) ??
      readString(entry.cover_image_url) ??
      readString(entry.coverImage) ??
      readString(entry.bannerUrl) ??
      readString(entry.banner_url) ??
      readString(entry.coverBannerUrl) ??
      readString(entry.profileBannerUrl) ??
      readString(entry.profileCoverUrl) ??
      readString(entry.coverPhotoUrl) ??
      readString(entry.coverPhoto) ??
      readString(entry.headerImageUrl) ??
      readString(entry.profileBackgroundUrl) ??
      readString(entry.backgroundImageUrl);

    if (url) {
      return url;
    }
  }

  return null;
}

export function readUserDesignation(source: unknown): string | null {
  const record = asRecord(source);

  if (!record) {
    return null;
  }

  const user = asRecord(record.user) ?? record;

  return (
    readString(user.jobTitle) ??
    readString(user.designation) ??
    readString(user.position) ??
    readString(user.title)
  );
}

export function readUserOrganizationName(source: unknown): string | null {
  const record = asRecord(source);

  if (!record) {
    return null;
  }

  const user = asRecord(record.user) ?? record;

  return (
    readString(asRecord(user.organization)?.name) ??
    readString(user.organizationName) ??
    readString(record.organizationName)
  );
}

export function normalizeClientDeviceLabel(
  raw: string | null | undefined,
): 'Mobile' | 'Web' | 'Desktop' | null {
  if (!raw) {
    return null;
  }

  const normalized = raw.toLowerCase();

  if (
    normalized.includes('mobile') ||
    normalized.includes('android') ||
    normalized.includes('ios') ||
    normalized.includes('iphone')
  ) {
    return 'Mobile';
  }

  if (normalized.includes('web') || normalized.includes('browser')) {
    return 'Web';
  }

  if (
    normalized.includes('desktop') ||
    normalized.includes('electron') ||
    normalized.includes('win') ||
    normalized.includes('mac') ||
    normalized.includes('linux')
  ) {
    return 'Desktop';
  }

  return null;
}

export function readUserClientDevice(source: unknown): 'Mobile' | 'Web' | 'Desktop' | null {
  const record = asRecord(source);

  if (!record) {
    return null;
  }

  const user = asRecord(record.user) ?? record;

  const raw =
    readString(user.activeClient) ??
    readString(user.client) ??
    readString(user.clientType) ??
    readString(user.platform) ??
    readString(user.deviceType) ??
    readString(user.lastClient);

  return normalizeClientDeviceLabel(raw);
}

/** PATCH body for cover — mirrors web `{ avatar: fileUrl }` (single canonical field). */
export function buildCoverUpdatePayload(url: string | null): Record<string, unknown> {
  if (!url) {
    return { cover: null };
  }

  return { cover: url };
}

/** Read the cover URL we intended to save from a PATCH payload. */
export function pickCoverUrlFromUpdates(
  updates: Record<string, unknown>,
): string | null | undefined {
  const clearing = Object.keys(updates).some(
    (key) => isProfileCoverFieldKey(key) && updates[key] === null,
  );

  if (clearing) {
    return null;
  }

  for (const key of COVER_FIELD_KEYS) {
    const value = updates[key];

    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
}

/** Read banner URL from PATCH /users/profile response, else fall back to what we just uploaded. */
export function resolveCoverUrlAfterProfileSave(
  response: unknown,
  fallbackUrl?: string | null,
): string | null {
  const fromApi = resolveProfileBannerUrl(response);
  if (fromApi) {
    return fromApi;
  }

  if (fallbackUrl === null) {
    return null;
  }

  if (typeof fallbackUrl === 'string' && fallbackUrl.trim()) {
    return fallbackUrl.trim();
  }

  return null;
}

export function isProfileCoverFieldKey(key: string): boolean {
  return (COVER_FIELD_KEYS as readonly string[]).includes(key);
}

/** Keep `authUser` in sync so `/me` and peer views see the new cover without a full reload. */
export function mergeCoverFieldsIntoUserRecord(
  user: Record<string, unknown>,
  url: string | null,
): Record<string, unknown> {
  return {
    ...user,
    cover: url,
    coverUrl: url,
    coverImageUrl: url,
    coverBannerUrl: url,
  };
}

export function resolveProfileUserId(
  profileId?: string | null,
  sessionUserId?: string | null,
  storedUser?: unknown,
): string | null {
  const fromProfile = typeof profileId === 'string' ? profileId.trim() : '';
  if (fromProfile) {
    return fromProfile;
  }

  const fromSession = typeof sessionUserId === 'string' ? sessionUserId.trim() : '';
  if (fromSession) {
    return fromSession;
  }

  const record = asRecord(storedUser);
  const fromStored = readString(record?.id) ?? readString(record?.userId);
  return fromStored;
}