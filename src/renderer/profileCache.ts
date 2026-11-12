import type { AvatarStyleItem, ProfileSettings, UserProfileState } from '../shared/profile';

export type ProfileCacheSnapshot = {
  profile: UserProfileState;
  settings: ProfileSettings;
  avatarStyles: AvatarStyleItem[];
  cachedAt: number;
};

const PROFILE_CACHE_STORAGE_KEY = 'flexhubs:profileSettingsCache';
const PROFILE_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

let snapshot: ProfileCacheSnapshot | null = null;

function readProfileCacheFromDisk(): ProfileCacheSnapshot | null {
  if (typeof localStorage === 'undefined') {
    return null;
  }

  try {
    const raw = localStorage.getItem(PROFILE_CACHE_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as ProfileCacheSnapshot;
    if (!parsed?.profile || !parsed?.settings || !parsed.cachedAt) {
      return null;
    }

    if (Date.now() - parsed.cachedAt > PROFILE_CACHE_TTL_MS) {
      localStorage.removeItem(PROFILE_CACHE_STORAGE_KEY);
      return null;
    }

    return {
      ...parsed,
      avatarStyles: Array.isArray(parsed.avatarStyles) ? parsed.avatarStyles : [],
    };
  } catch {
    return null;
  }
}

function writeProfileCacheToDisk(next: ProfileCacheSnapshot): void {
  if (typeof localStorage === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(PROFILE_CACHE_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore quota / privacy mode errors.
  }
}

export function readProfileCache(): ProfileCacheSnapshot | null {
  if (snapshot) {
    return snapshot;
  }

  const fromDisk = readProfileCacheFromDisk();
  if (fromDisk) {
    snapshot = fromDisk;
  }

  return snapshot;
}

export function writeProfileCache(next: Omit<ProfileCacheSnapshot, 'cachedAt'>): void {
  snapshot = {
    ...next,
    cachedAt: Date.now(),
  };
  writeProfileCacheToDisk(snapshot);
}

export function clearProfileCache(): void {
  snapshot = null;
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(PROFILE_CACHE_STORAGE_KEY);
    } catch {
      // ignore
    }
  }
}

const PEER_PROFILE_TTL_MS = 15 * 60 * 1000;

export type PeerProfileSnapshot = {
  userId: string;
  name: string;
  username: string;
  avatarUrl: string | null;
  cachedAt: number;
};

const peerProfiles = new Map<string, PeerProfileSnapshot>();

export function readPeerProfile(userId: string): PeerProfileSnapshot | null {
  const cached = peerProfiles.get(userId);

  if (!cached) {
    return null;
  }

  if (Date.now() - cached.cachedAt > PEER_PROFILE_TTL_MS) {
    peerProfiles.delete(userId);
    return null;
  }

  return cached;
}

export function writePeerProfile(snapshot: Omit<PeerProfileSnapshot, 'cachedAt'>): PeerProfileSnapshot {
  const next: PeerProfileSnapshot = {
    ...snapshot,
    cachedAt: Date.now(),
  };

  peerProfiles.set(snapshot.userId, next);
  return next;
}

export function clearPeerProfileCache(): void {
  peerProfiles.clear();
}
