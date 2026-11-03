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

const MEMBER_LIST_KEYS = ['groupMembers', 'members', 'participants', 'users'] as const;

function extractHubMemberRecords(hub: Record<string, unknown>): Record<string, unknown>[] {
  for (const key of MEMBER_LIST_KEYS) {
    const value = hub[key];

    if (!Array.isArray(value)) {
      continue;
    }

    const records = value
      .map(asRecord)
      .filter((item): item is Record<string, unknown> => item !== null);

    if (records.length > 0) {
      return records;
    }
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
    readString(member, 'name') ||
    'Member';

  return {
    id,
    name,
    avatarUrl: user ? resolveAvatarUrl(user) : null,
  };
}

function mergeMemberLists(...lists: HubMemberSummary[][]): HubMemberSummary[] {
  const seen = new Set<string>();
  const merged: HubMemberSummary[] = [];

  for (const list of lists) {
    for (const member of list) {
      if (seen.has(member.id)) {
        continue;
      }

      seen.add(member.id);
      merged.push(member);
    }
  }

  return merged.sort((left, right) => left.name.localeCompare(right.name));
}

function readMembersFromHubRecord(hub: Record<string, unknown> | null): HubMemberSummary[] {
  if (!hub) {
    return [];
  }

  const members: HubMemberSummary[] = [];

  for (const raw of extractHubMemberRecords(hub)) {
    const mapped = mapHubMember(raw);

    if (mapped) {
      members.push(mapped);
    }
  }

  return members;
}

/** Reads hub/group member lists from bootstrap, conversation, or hub detail payloads. */
export function readHubMembersFromBootstrapPayload(payload: unknown): HubMemberSummary[] {
  const record = asRecord(payload);

  if (!record) {
    return [];
  }

  const sources = [
    record,
    asRecord(record.hub),
    asRecord(record.group),
    asRecord(record.conversation),
    asRecord(record.data),
    asRecord(asRecord(record.data)?.conversation),
  ];

  const lists: HubMemberSummary[][] = [];

  for (const source of sources) {
    const members = readMembersFromHubRecord(source);

    if (members.length > 0) {
      lists.push(members);
    }
  }

  return mergeMemberLists(...lists);
}

export function mergeHubMemberSummaries(...lists: HubMemberSummary[][]): HubMemberSummary[] {
  return mergeMemberLists(...lists);
}
