import type { AvatarStyleItem, ProfileSettings, UserProfileState } from '../shared/profile';

export type ProfileCacheSnapshot = {
  profile: UserProfileState;
  settings: ProfileSettings;
  avatarStyles: AvatarStyleItem[];
  cachedAt: number;
};

let snapshot: ProfileCacheSnapshot | null = null;

export function readProfileCache(): ProfileCacheSnapshot | null {
  return snapshot;
}

export function writeProfileCache(next: Omit<ProfileCacheSnapshot, 'cachedAt'>): void {
  snapshot = {
    ...next,
    cachedAt: Date.now(),
  };
}

export function clearProfileCache(): void {
  snapshot = null;
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
