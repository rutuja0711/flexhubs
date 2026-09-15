import { mapApiPresenceToStatus, type PresenceStatus } from './chat';
import { normalizeUserProfile, resolveAvatarUrl, type UserPresenceStatus } from './profile';

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  return value as Record<string, unknown>;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function initialsFromName(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return name.slice(0, 2).toUpperCase();
}

export type ContactUserProfile = {
  id: string;
  name: string;
  username: string;
  bio: string | null;
  avatarUrl: string | null;
  avatarInitials: string;
  lastSeenAt: string | null;
  status: UserPresenceStatus;
  sharePresence: boolean;
};

export function normalizeContactUser(payload: unknown): ContactUserProfile | null {
  const record = asRecord(payload);
  const user = asRecord(record?.user) ?? record;

  if (!user) {
    return null;
  }

  const profile = normalizeUserProfile(user);
  const displayName = profile.name.trim() || profile.username.trim() || 'User';

  return {
    id: profile.id,
    name: displayName,
    username: profile.username,
    bio: readString(user.bio),
    avatarUrl: resolveAvatarUrl(user),
    avatarInitials: initialsFromName(displayName),
    lastSeenAt: readString(user.lastSeenAt) ?? readString(user.lastSeen),
    status: profile.status,
    sharePresence: readBoolean(user.sharePresence) ?? readBoolean(user.shareOnlineStatus) ?? true,
  };
}

export function formatContactPresenceLabel(
  status: PresenceStatus | UserPresenceStatus | null,
  lastSeenAt: string | null,
  sharePresence = true,
): string {
  const normalized = String(status ?? '').toLowerCase();

  if (normalized === 'online') {
    return 'Online';
  }

  if (normalized === 'away') {
    return 'Away';
  }

  if (normalized === 'dnd' || normalized === 'busy') {
    return 'Do not disturb';
  }

  if (!sharePresence) {
    return 'Offline';
  }

  if (lastSeenAt) {
    const timestamp = Date.parse(lastSeenAt);

    if (Number.isFinite(timestamp)) {
      const date = new Date(timestamp);
      const now = new Date();
      const sameDay =
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth() &&
        date.getDate() === now.getDate();

      const time = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

      if (sameDay) {
        return `Last seen at ${time}`;
      }

      return `Last seen ${date.toLocaleDateString()} at ${time}`;
    }
  }

  return 'Offline';
}

export function mapContactPresenceStatus(value: string | null | undefined): PresenceStatus | null {
  return mapApiPresenceToStatus(value);
}

export function presenceDotClass(status: PresenceStatus | null): string {
  if (status === 'online') {
    return 'bg-emerald-500';
  }

  if (status === 'away') {
    return 'bg-amber-500';
  }

  if (status === 'dnd') {
    return 'bg-red-500';
  }

  return 'bg-app-muted';
}
