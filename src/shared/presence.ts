import {
  mapApiPresenceToStatus,
  mapLivePresenceToStatus,
  normalizePresenceUserId,
  type PresenceStatus,
} from './chat';
import type { PresenceItem } from './realtime';
import type { UserPresenceStatus } from './profile';

/** Map one `/realtime/presence` row to sidebar presence (live API only). */
export function resolvePresenceStatusFromItem(item: PresenceItem): PresenceStatus {
  const parsed = mapApiPresenceToStatus(item.status);

  if (parsed) {
    return parsed;
  }

  if (item.isOnline === true) {
    return 'online';
  }

  if (item.isOnline === false) {
    return 'offline';
  }

  return 'offline';
}

export function isRedisPresenceMode(payload: {
  enabled: boolean;
  mode: string | null;
  redis?: boolean;
}): boolean {
  if (payload.redis === true) {
    return true;
  }

  const mode = (payload.mode ?? '').toLowerCase();

  return mode === 'redis' || mode.includes('redis');
}

/** Live poll rows override bootstrap; missing ids → offline only when the poll returned at least one row (Redis snapshot). */
export function mergePresenceItemsForRequestedUsers(
  items: PresenceItem[],
  requestedUserIds: string[],
  options?: { treatMissingAsOffline?: boolean },
): {
  statusByUserId: Map<string, PresenceStatus>;
  statusMessageByUserId: Map<string, string>;
} {
  const statusByUserId = new Map<string, PresenceStatus>();
  const statusMessageByUserId = new Map<string, string>();
  const treatMissingAsOffline = options?.treatMissingAsOffline === true;

  for (const item of items) {
    const key = normalizePresenceUserId(item.userId);
    statusByUserId.set(key, resolvePresenceStatusFromItem(item));
    statusMessageByUserId.set(key, item.statusMessage ?? '');
  }

  if (treatMissingAsOffline) {
    for (const userId of requestedUserIds) {
      const key = normalizePresenceUserId(userId);

      if (!statusByUserId.has(key)) {
        statusByUserId.set(key, 'offline');
      }
    }
  }

  return { statusByUserId, statusMessageByUserId };
}

export function resolveRemoteUserStatus(
  bootstrapStatus: PresenceStatus | null | undefined,
  liveStatus: PresenceStatus | null | undefined,
  options?: {
    hasLiveEntry?: boolean;
    livePollHadRows?: boolean;
    presentInLiveChannel?: boolean;
  },
): PresenceStatus {
  if (options?.hasLiveEntry && liveStatus) {
    return liveStatus;
  }

  if (options?.livePollHadRows && !options?.hasLiveEntry) {
    return 'offline';
  }

  if (options?.presentInLiveChannel === false) {
    return 'offline';
  }

  return bootstrapStatus ?? 'offline';
}

export function mapUserPresenceStatusToDotStatus(
  status: UserPresenceStatus | string | null | undefined,
): PresenceStatus {
  return mapApiPresenceToStatus(status) ?? 'offline';
}

export function presenceStatusForPeer(
  presenceByUserId: ReadonlyMap<string, PresenceStatus>,
  peerUserId: string | null | undefined,
): PresenceStatus | null {
  if (!peerUserId) {
    return null;
  }

  return presenceByUserId.get(normalizePresenceUserId(peerUserId)) ?? null;
}

export function mergeResolvedPresenceMaps(
  bootstrapByUserId: ReadonlyMap<string, PresenceStatus>,
  liveByUserId: ReadonlyMap<string, PresenceStatus>,
  userIds: string[],
  options?: { livePollHadRows?: boolean },
): Map<string, PresenceStatus> {
  const merged = new Map<string, PresenceStatus>();
  const livePollHadRows = options?.livePollHadRows === true;

  for (const userId of userIds) {
    const key = normalizePresenceUserId(userId);
    const hasLiveEntry = liveByUserId.has(key);

    merged.set(
      key,
      resolveRemoteUserStatus(bootstrapByUserId.get(key), liveByUserId.get(key), {
        hasLiveEntry,
        livePollHadRows,
      }),
    );
  }

  return merged;
}

export function bootstrapPresenceFromConversations(
  conversations: ReadonlyArray<{
    peerUserId: string | null;
    status: PresenceStatus | null;
    kind: string;
    isSelf?: boolean;
  }>,
): Map<string, PresenceStatus> {
  const map = new Map<string, PresenceStatus>();

  for (const conversation of conversations) {
    if (
      conversation.kind === 'hub' ||
      conversation.isSelf ||
      !conversation.peerUserId ||
      !conversation.status
    ) {
      continue;
    }

    map.set(normalizePresenceUserId(conversation.peerUserId), conversation.status);
  }

  return map;
}

export function mapLivePresenceUpdateStatus(status: string | null | undefined): PresenceStatus {
  return mapLivePresenceToStatus(status);
}
