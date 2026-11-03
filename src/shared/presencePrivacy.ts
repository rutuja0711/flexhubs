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
