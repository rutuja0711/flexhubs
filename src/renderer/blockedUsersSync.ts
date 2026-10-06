import { resolveViewerBlockedByPeer } from '../shared/blocking';
import type { BlockedUserItem, FriendRelationship } from '../shared/features';
import { loadBlockedUsers } from './chatApi';

let blockedUserIds = new Set<string>();
let blockedByPeerIds = new Set<string>();
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

export function getBlockedUserIds(): ReadonlySet<string> {
  return blockedUserIds;
}

export function getBlockedByPeerIds(): ReadonlySet<string> {
  return blockedByPeerIds;
}

export function subscribeBlockedUsers(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setBlockedUserIdsFromList(users: BlockedUserItem[]): void {
  blockedUserIds = new Set(users.map((user) => user.id).filter(Boolean));
  emit();
}

export function markUserBlocked(userId: string): void {
  if (!userId) {
    return;
  }

  blockedUserIds.add(userId);
  blockedByPeerIds.delete(userId);
  emit();
}

export function markUserUnblocked(userId: string): void {
  if (!userId) {
    return;
  }

  blockedUserIds.delete(userId);
  emit();
}

export function syncPeerBlockFromRelationship(
  peerUserId: string,
  relationship: FriendRelationship,
): void {
  if (!peerUserId) {
    return;
  }

  const blockedByPeer = resolveViewerBlockedByPeer(peerUserId, relationship, blockedUserIds);
  const had = blockedByPeerIds.has(peerUserId);

  if (blockedByPeer) {
    blockedByPeerIds.add(peerUserId);
  } else {
    blockedByPeerIds.delete(peerUserId);
  }

  if (had !== blockedByPeer) {
    emit();
  }
}

export async function refreshBlockedUsersFromApi(): Promise<ReadonlySet<string>> {
  const result = await loadBlockedUsers();

  if (result.ok) {
    setBlockedUserIdsFromList(result.data);
  }

  return blockedUserIds;
}
