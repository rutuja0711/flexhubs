import { resolveAvatarUrl } from '../../shared/profile';

export type HubMemberSummary = {
  id: string;
  name: string;
  avatarUrl: string | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  return value as Record<string, unknown>;
}

function readString(record: Record<string, unknown> | null, key: string): string {
  const value = record?.[key];
  return typeof value === 'string' ? value : '';
}

function extractHubMemberRecords(hub: Record<string, unknown>): Record<string, unknown>[] {
  if (Array.isArray(hub.groupMembers)) {
    return hub.groupMembers
      .map(asRecord)
      .filter((item): item is Record<string, unknown> => item !== null);
  }

  if (Array.isArray(hub.members)) {
    return hub.members.map(asRecord).filter((item): item is Record<string, unknown> => item !== null);
  }

  return [];
}

function mapHubMember(member: Record<string, unknown>): HubMemberSummary | null {
  const user = asRecord(member.user);
  const id =
    readString(user, 'id') || readString(member, 'userId') || readString(member, 'id');

  if (!id) {
    return null;
  }

  const name =
    readString(user, 'name') ||
    readString(user, 'username') ||
    readString(member, 'username') ||
    'Member';

  return {
    id,
    name,
    avatarUrl: user ? resolveAvatarUrl(user) : null,
  };
}

export function readHubMembersFromBootstrapPayload(payload: unknown): HubMemberSummary[] {
  const record = asRecord(payload);
  const hub = asRecord(record?.hub) ?? asRecord(record?.group) ?? record;

  if (!hub) {
    return [];
  }

  const seen = new Set<string>();
  const members: HubMemberSummary[] = [];

  for (const raw of extractHubMemberRecords(hub)) {
    const mapped = mapHubMember(raw);

    if (!mapped || seen.has(mapped.id)) {
      continue;
    }

    seen.add(mapped.id);
    members.push(mapped);
  }

  return members.sort((left, right) => left.name.localeCompare(right.name));
}
