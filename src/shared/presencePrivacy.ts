export type PresenceViewerContext = {
  id: string;
  sharePresence?: boolean;
};

export type PresenceTargetContext = {
  id: string;
  sharePresence?: boolean;
};

/** Same rule as web `presencePrivacy.ts` — viewer must share to see others; target can opt out. */
export function canViewPresence(
  viewer: PresenceViewerContext,
  target: PresenceTargetContext,
): boolean {
  if (!viewer.id || !target.id) {
    return false;
  }

  if (viewer.id === target.id) {
    return true;
  }

  if (viewer.sharePresence === false) {
    return false;
  }

  if (target.sharePresence === false) {
    return false;
  }

  return true;
}

/** Whether this device should publish live presence (PATCH /users/status, heartbeat). */
export function shouldSharePresenceWithOthers(options: {
  profileShareOnlineStatus?: boolean | null;
  settingsShareOnlineStatus?: boolean | null;
}): boolean {
  if (typeof options.settingsShareOnlineStatus === 'boolean') {
    return options.settingsShareOnlineStatus;
  }

  if (options.profileShareOnlineStatus === false) {
    return false;
  }

  return true;
}

/**
 * Whether the viewer may see a peer's presence dot / subtitle.
 * Hiding *your* status must not hide everyone else's (web `sharePresence` is publish-only).
 */
export function canViewPeerPresence(
  viewer: PresenceViewerContext,
  target: PresenceTargetContext,
): boolean {
  if (!viewer.id || !target.id) {
    return false;
  }

  if (viewer.id === target.id) {
    return true;
  }

  if (target.sharePresence === false) {
    return false;
  }

  return true;
}
