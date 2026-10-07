import { resolveAvatarUrl } from './profile';

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  return value as Record<string, unknown>;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function extractArray(payload: unknown, keys: string[]): unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }

  const record = asRecord(payload);

  if (!record) {
    return [];
  }

  for (const key of keys) {
    const value = record[key];

    if (Array.isArray(value)) {
      return value;
    }
  }

  return [];
}

export type CalendarMentionableUser = {
  id: string;
  username: string;
  name: string;
};

export type CalendarTaggedHub = {
  conversationId?: string | null;
  channelId?: string | null;
  name: string;
  slug?: string;
};

export type CalendarHubOption = {
  conversationId: string;
  channelId: string | null;
  name: string;
  slug: string;
};

export type CreateCalendarEventInput = {
  title: string;
  startsAt: string;
  description?: string;
  mentionUserIds?: string[];
  conversationId?: string;
  conversationIds?: string[];
  mentionChannelIds?: string[];
  channelIds?: string[];
};

export type UpdateCalendarEventInput = {
  eventId: string;
  title?: string;
  startsAt?: string;
  description?: string;
  mentionUserIds?: string[];
  conversationId?: string | null;
  conversationIds?: string[];
  mentionChannelIds?: string[];
  channelIds?: string[];
};

export type CalendarEventInvitee = {
  userId?: string | null;
  username: string;
  name: string;
  status: string;
  avatarUrl?: string | null;
};

export type CalendarEventItem = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string | null;
  mentionUserIds: string[];
  createdAt: string;
  createdById: string | null;
  createdByAvatarUrl?: string | null;
  description: string;
  notes: string;
  status: string | null;
  myResponseStatus: string | null;
  sharedBy: string;
  invitees: CalendarEventInvitee[];
  conversationId?: string | null;
  conversationName?: string;
  channelId?: string | null;
  taggedHubs?: CalendarTaggedHub[];
  isOwner?: boolean;
  canRespond?: boolean;
  canDelete?: boolean;
};

export type ScheduledMessageItem = {
  id: string;
  conversationId: string;
  conversationName: string;
  content: string;
  scheduledAt: string;
  status: string;
};

export type AiTextResult = {
  text: string;
  action: string | null;
  conversationId: string | null;
  conversationName: string | null;
  message: string | null;
  scheduledAt: string | null;
  snoozeUntil: string | null;
  snoozeHours: number | null;
};

export type PushVapidKeyResult = {
  publicKey: string;
};

export function normalizeCalendarMentionableUsers(payload: unknown): CalendarMentionableUser[] {
  return extractArray(payload, ['users', 'items', 'data', 'mentionableUsers', 'members'])
    .map(asRecord)
    .filter((item): item is Record<string, unknown> => item !== null)
    .map((record, index) => {
      const user = asRecord(record.user) ?? record;

      return {
        id: readString(user.id) ?? readString(record.id) ?? readString(record.userId) ?? `user-${index}`,
        username: readString(user.username) ?? readString(record.username) ?? '',
        name:
          readString(user.name) ??
          readString(user.displayName) ??
          readString(record.name) ??
          readString(record.displayName) ??
          readString(user.username) ??
          readString(record.username) ??
          'Teammate',
      };
    })
    .filter((user) => user.id && user.username);
}

export function calendarHubSlug(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug || 'hub';
}

export function buildCalendarHubOptions(
  conversations: Array<{
    id: string;
    kind: string;
    title: string;
    channelId: string | null;
  }>,
): CalendarHubOption[] {
  return conversations
    .filter((conversation) => conversation.kind === 'hub')
    .map((conversation) => ({
      conversationId: conversation.id,
      channelId: conversation.channelId,
      name: conversation.title,
      slug: calendarHubSlug(conversation.title),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function parseHubConversationIdsFromText(
  text: string,
  hubs: CalendarHubOption[],
): string[] {
  const ids = new Set<string>();
  const mentionPattern = /#([a-zA-Z0-9._-]+)/g;

  for (const match of text.matchAll(mentionPattern)) {
    const token = match[1]?.toLowerCase();
    if (!token) {
      continue;
    }

    const hub = hubs.find(
      (entry) =>
        entry.slug.toLowerCase() === token ||
        entry.name.toLowerCase().replace(/\s+/g, '-') === token ||
        entry.name.toLowerCase().replace(/\s+/g, '') === token,
    );

    if (hub) {
      ids.add(hub.conversationId);
    }
  }

  return [...ids];
}

export function mergeHubConversationIds(
  description: string,
  hubs: CalendarHubOption[],
  selectedHubConversationIds: string[],
): string[] {
  return [
    ...new Set([
      ...selectedHubConversationIds,
      ...parseHubConversationIdsFromText(description, hubs),
    ]),
  ];
}

export function collectEventHubMatchKeys(
  event: Pick<
    CalendarEventItem,
    'conversationId' | 'channelId' | 'taggedHubs'
  >,
): Set<string> {
  const keys = new Set<string>();

  if (event.conversationId) {
    keys.add(event.conversationId);
  }

  if (event.channelId) {
    keys.add(event.channelId);
  }

  for (const hub of event.taggedHubs ?? []) {
    if (hub.conversationId) {
      keys.add(hub.conversationId);
    }

    if (hub.channelId) {
      keys.add(hub.channelId);
    }
  }

  return keys;
}

export function eventMatchesHubConversationFilter(
  event: Pick<CalendarEventItem, 'conversationId' | 'channelId' | 'taggedHubs'>,
  selectedConversationIds: string[],
  hubOptions: CalendarHubOption[],
): boolean {
  if (selectedConversationIds.length === 0) {
    return true;
  }

  const selectedKeys = new Set<string>();

  for (const conversationId of selectedConversationIds) {
    selectedKeys.add(conversationId);
    const hub = hubOptions.find((entry) => entry.conversationId === conversationId);
    if (hub?.channelId) {
      selectedKeys.add(hub.channelId);
    }
  }

  const eventKeys = collectEventHubMatchKeys(event);

  for (const key of selectedKeys) {
    if (eventKeys.has(key)) {
      return true;
    }
  }

  return false;
}

export function parseMentionUserIdsFromText(
  text: string,
  users: CalendarMentionableUser[],
): string[] {
  const ids = new Set<string>();
  const mentionPattern = /@([a-zA-Z0-9._-]+)/g;

  for (const match of text.matchAll(mentionPattern)) {
    const username = match[1]?.toLowerCase();
    if (!username) {
      continue;
    }

    const user = users.find((entry) => entry.username.toLowerCase() === username);
    if (user) {
      ids.add(user.id);
    }
  }

  return [...ids];
}

export function mergeCalendarPeopleWithInvitees(
  people: CalendarMentionableUser[],
  invitees: CalendarEventInvitee[] | undefined,
): { people: CalendarMentionableUser[]; selectedUserIds: string[] } {
  const byId = new Map<string, CalendarMentionableUser>();

  for (const person of people) {
    byId.set(person.id, person);
  }

  const selectedUserIds: string[] = [];

  for (const invitee of invitees ?? []) {
    const username = invitee.username?.trim() ?? '';
    const name = invitee.name?.trim() || username || 'Teammate';
    let person: CalendarMentionableUser | undefined;

    if (invitee.userId) {
      person = byId.get(invitee.userId);
      if (!person) {
        person = {
          id: invitee.userId,
          username: username || name,
          name,
        };
        byId.set(person.id, person);
      }
    } else {
      person = [...byId.values()].find(
        (entry) =>
          (username && entry.username.toLowerCase() === username.toLowerCase()) ||
          (name && entry.name.toLowerCase() === name.toLowerCase()),
      );
    }

    if (person) {
      selectedUserIds.push(person.id);
      continue;
    }

    if (username || name) {
      const fallbackId = invitee.userId ?? `invitee:${username.toLowerCase() || name.toLowerCase()}`;
      const fallbackPerson: CalendarMentionableUser = {
        id: fallbackId,
        username: username || name,
        name,
      };
      byId.set(fallbackPerson.id, fallbackPerson);
      selectedUserIds.push(fallbackPerson.id);
    }
  }

  return {
    people: [...byId.values()],
    selectedUserIds: [...new Set(selectedUserIds)],
  };
}

export function mergeMentionUserIds(
  description: string,
  users: CalendarMentionableUser[],
  selectedUserIds: string[],
): string[] {
  const merged = new Set<string>();

  for (const id of parseMentionUserIdsFromText(description, users)) {
    merged.add(id);
  }

  for (const id of selectedUserIds) {
    if (!id || id.startsWith('invitee:') || id.startsWith('invitee-')) {
      continue;
    }
    merged.add(id);
  }

  return [...merged];
}

function normalizeInvitee(record: Record<string, unknown>): CalendarEventInvitee | null {
  const user = asRecord(record.user) ?? asRecord(record.member) ?? record;
  const userId =
    readString(user.id) ??
    readString(record.userId) ??
    readString(record.memberId) ??
    readString(record.id) ??
    null;
  const username =
    readString(record.username) ??
    readString(user.username) ??
    readString(record.handle) ??
    '';
  const name =
    readString(record.name) ??
    readString(user.name) ??
    readString(user.displayName) ??
    username;
  const status =
    readString(record.status) ??
    readString(record.responseStatus) ??
    readString(record.response) ??
    'PENDING';

  if (!userId && !username && !name) {
    return null;
  }

  return {
    username,
    name: name || username || 'Teammate',
    userId,
    status: status.toUpperCase(),
    avatarUrl: resolveAvatarUrl(user) ?? resolveAvatarUrl(record),
  };
}

function extractCalendarMentionUserIds(record: Record<string, unknown>): string[] {
  const data = asRecord(record.data);
  const ids = new Set<string>();
  const sources = [record, data].filter((item): item is Record<string, unknown> => item !== null);
  const keys = [
    'mentionUserIds',
    'inviteeIds',
    'inviteeUserIds',
    'mentionedUserIds',
    'taggedUserIds',
  ];

  for (const source of sources) {
    for (const key of keys) {
      const value = source[key];
      if (!Array.isArray(value)) {
        continue;
      }

      for (const entry of value) {
        if (typeof entry === 'string' || typeof entry === 'number') {
          const id = String(entry).trim();
          if (id) {
            ids.add(id);
          }
          continue;
        }

        const item = asRecord(entry);
        if (!item) {
          continue;
        }

        const nestedUser = asRecord(item.user) ?? asRecord(item.member);
        const id =
          readString(item.userId) ??
          readString(item.memberId) ??
          readString(item.id) ??
          (nestedUser ? readString(nestedUser.id) : null);

        if (id) {
          ids.add(id);
        }
      }
    }
  }

  return [...ids];
}

function extractCalendarTaggedHubs(record: Record<string, unknown>): CalendarTaggedHub[] {
  const data = asRecord(record.data);
  const hubs: CalendarTaggedHub[] = [];
  const seen = new Set<string>();
  const sources = [record, data].filter((item): item is Record<string, unknown> => item !== null);

  const pushHub = (hub: CalendarTaggedHub) => {
    const key = `${hub.conversationId ?? ''}:${hub.channelId ?? ''}:${hub.name}`;
    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    hubs.push(hub);
  };

  for (const source of sources) {
    for (const key of ['taggedHubs', 'hubs', 'channels', 'taggedChannels', 'mentionChannels']) {
      const value = source[key];
      if (!Array.isArray(value)) {
        continue;
      }

      for (const entry of value) {
        const item = asRecord(entry);
        if (!item) {
          continue;
        }

        const name =
          readString(item.name) ??
          readString(item.title) ??
          readString(item.channelName) ??
          'Hub';

        pushHub({
          conversationId:
            readString(item.conversationId) ??
            readString(asRecord(item.conversation)?.id) ??
            null,
          channelId: readString(item.channelId) ?? readString(item.id) ?? null,
          name,
          slug: readString(item.slug) ?? calendarHubSlug(name),
        });
      }
    }
  }

  const conversation =
    asRecord(record.conversation) ??
    asRecord(data?.conversation) ??
    asRecord(record.channel) ??
    asRecord(data?.channel);
  const conversationId =
    readString(record.conversationId) ??
    readString(data?.conversationId) ??
    readString(conversation?.id) ??
    null;
  const conversationName =
    readString(record.conversationName) ??
    readString(data?.conversationName) ??
    readString(conversation?.name) ??
    readString(conversation?.title) ??
    readString(record.hubName) ??
    readString(data?.hubName) ??
    '';
  const channelId =
    readString(record.channelId) ??
    readString(data?.channelId) ??
    readString(conversation?.channelId) ??
    null;

  if (conversationId && conversationName) {
    pushHub({
      conversationId,
      channelId,
      name: conversationName,
      slug: readString(conversation?.slug) ?? calendarHubSlug(conversationName),
    });
  }

  return hubs;
}

function extractCalendarInvitees(record: Record<string, unknown>): CalendarEventInvitee[] {
  const data = asRecord(record.data);
  const keys = [
    'responses',
    'mentions',
    'invitees',
    'inviteeIds',
    'participants',
    'attendees',
    'mentionUsers',
    'mentionedUsers',
    'taggedUsers',
    'mentionUserIds',
    'mentionResponses',
    'calendarResponses',
  ];
  const invitees: CalendarEventInvitee[] = [];
  const seen = new Set<string>();

  const sources = [record, data].filter((item): item is Record<string, unknown> => item !== null);

  for (const source of sources) {
    for (const key of keys) {
      const value = source[key];

      if (!Array.isArray(value)) {
        continue;
      }

      for (const entry of value) {
        let invitee: CalendarEventInvitee | null = null;

        if (typeof entry === 'string') {
          invitee = {
            userId: entry,
            username: '',
            name: '',
            status: 'PENDING',
          };
        } else {
          const item = asRecord(entry);
          if (item) {
            invitee = normalizeInvitee(item);
          }
        }

        if (!invitee) {
          continue;
        }

        const dedupeKey = invitee.userId ?? invitee.username ?? invitee.name;

        if (seen.has(dedupeKey)) {
          continue;
        }

        seen.add(dedupeKey);
        invitees.push(invitee);
      }
    }
  }

  return invitees;
}

function readMyResponseStatus(record: Record<string, unknown>): string | null {
  const data = asRecord(record.data);
  const myResponse =
    asRecord(record.myResponse) ??
    asRecord(record.response) ??
    asRecord(record.currentUserResponse) ??
    asRecord(data?.myResponse) ??
    asRecord(data?.response);
  const actions = asRecord(record.actions) ?? asRecord(data?.actions);

  return (
    readString(record.myInviteStatus) ??
    readString(record.myResponseStatus) ??
    readString(record.myStatus) ??
    readString(record.viewerResponse) ??
    readString(record.viewerResponseStatus) ??
    (myResponse ? readString(myResponse.status) ?? readString(myResponse.response) : null) ??
    readString(record.responseStatus) ??
    readString(record.userResponse) ??
    readString(record.invitationStatus) ??
    (actions ? readString(actions.responseStatus) : null) ??
    (record.hasResponded === true ? 'ACCEPTED' : null) ??
    null
  )?.toUpperCase() ?? null;
}

export function sortCalendarEvents(events: CalendarEventItem[]): CalendarEventItem[] {
  return [...events].sort((left, right) => {
    const leftCreated = Date.parse(left.createdAt) || Date.parse(left.startsAt);
    const rightCreated = Date.parse(right.createdAt) || Date.parse(right.startsAt);

    if (leftCreated !== rightCreated) {
      return rightCreated - leftCreated;
    }

    return Date.parse(right.startsAt) - Date.parse(left.startsAt);
  });
}

export function findCurrentUserInvitee(
  event: CalendarEventItem,
  userId: string | null,
  username: string | null,
  displayName: string | null,
): CalendarEventInvitee | null {
  const invitees = event.invitees ?? [];
  const normalizedUsername = username?.toLowerCase() ?? '';
  const normalizedDisplayName = displayName?.toLowerCase() ?? '';

  return (
    invitees.find((person) => {
      if (userId && person.userId && person.userId === userId) {
        return true;
      }

      const personUsername = person.username.toLowerCase();
      const personName = person.name.toLowerCase();

      return (
        (normalizedUsername &&
          (personUsername === normalizedUsername || personName === normalizedUsername)) ||
        (normalizedDisplayName &&
          (personName === normalizedDisplayName || personUsername === normalizedDisplayName))
      );
    }) ?? null
  );
}

export function resolveEventCreatorDisplayName(
  event: Pick<CalendarEventItem, 'sharedBy' | 'createdById' | 'isOwner' | 'invitees'>,
  viewerUserId: string | null,
  viewerUsername: string | null,
  viewerDisplayName: string | null,
): string {
  const sharedBy = event.sharedBy?.trim();
  if (sharedBy) {
    return sharedBy;
  }

  if (viewerUserId && event.createdById && viewerUserId === event.createdById) {
    return viewerDisplayName?.trim() || viewerUsername?.trim() || 'You';
  }

  if (event.createdById && event.invitees?.length) {
    const creatorInvitee = event.invitees.find(
      (invitee) => invitee.userId && invitee.userId === event.createdById,
    );

    if (creatorInvitee) {
      return creatorInvitee.name?.trim() || creatorInvitee.username?.trim() || 'Teammate';
    }
  }

  if (event.isOwner) {
    return viewerDisplayName?.trim() || viewerUsername?.trim() || 'You';
  }

  return viewerUsername?.trim() || viewerDisplayName?.trim() || 'Teammate';
}

function findEventCreatorInvitee(
  event: Pick<CalendarEventItem, 'sharedBy' | 'createdById' | 'invitees'>,
): CalendarEventInvitee | null {
  const invitees = event.invitees ?? [];

  if (event.createdById) {
    const byId = invitees.find(
      (invitee) => invitee.userId && invitee.userId === event.createdById,
    );
    if (byId) {
      return byId;
    }
  }

  const sharedBy = event.sharedBy?.trim().toLowerCase();
  if (!sharedBy) {
    return null;
  }

  return (
    invitees.find((invitee) => {
      const name = invitee.name?.trim().toLowerCase() ?? '';
      const username = invitee.username?.trim().toLowerCase() ?? '';
      return name === sharedBy || username === sharedBy;
    }) ?? null
  );
}

export function enrichCalendarEventsWithTeammateAvatars(
  events: CalendarEventItem[],
  teammates: {
    id: string;
    name: string;
    username: string;
    avatarUrl: string | null;
  }[],
): CalendarEventItem[] {
  if (!teammates.length) {
    return events;
  }

  const avatarById = new Map(teammates.map((member) => [member.id, member.avatarUrl]));
  const avatarByName = new Map(
    teammates.map((member) => [member.name.trim().toLowerCase(), member.avatarUrl]),
  );
  const avatarByUsername = new Map(
    teammates.map((member) => [member.username.trim().toLowerCase(), member.avatarUrl]),
  );

  const lookupAvatar = (userId?: string | null, name?: string, username?: string): string | null => {
    if (userId && avatarById.has(userId)) {
      return avatarById.get(userId) ?? null;
    }

    const normalizedName = name?.trim().toLowerCase();
    if (normalizedName && avatarByName.has(normalizedName)) {
      return avatarByName.get(normalizedName) ?? null;
    }

    const normalizedUsername = username?.trim().toLowerCase();
    if (normalizedUsername && avatarByUsername.has(normalizedUsername)) {
      return avatarByUsername.get(normalizedUsername) ?? null;
    }

    return null;
  };

  return events.map((event) => {
    const invitees = event.invitees?.map((invitee) => {
      if (invitee.avatarUrl) {
        return invitee;
      }

      const avatarUrl = lookupAvatar(invitee.userId, invitee.name, invitee.username);
      return avatarUrl ? { ...invitee, avatarUrl } : invitee;
    });

    let createdByAvatarUrl = event.createdByAvatarUrl ?? lookupAvatar(event.createdById, null, null);

    if (!createdByAvatarUrl && event.sharedBy) {
      createdByAvatarUrl =
        lookupAvatar(null, event.sharedBy, event.sharedBy) ?? createdByAvatarUrl;
    }

    if (!createdByAvatarUrl) {
      const creatorInvitee = findEventCreatorInvitee({ ...event, invitees: invitees ?? event.invitees });
      createdByAvatarUrl = creatorInvitee?.avatarUrl ?? null;
    }

    return {
      ...event,
      invitees: invitees ?? event.invitees,
      createdByAvatarUrl,
    };
  });
}

export function resolveEventCreatorAvatarUrl(
  event: Pick<
    CalendarEventItem,
    'sharedBy' | 'createdById' | 'createdByAvatarUrl' | 'isOwner' | 'invitees'
  >,
  viewerUserId: string | null,
  viewerAvatarUrl: string | null,
): string | null {
  if (viewerUserId && event.createdById && viewerUserId === event.createdById) {
    return viewerAvatarUrl;
  }

  if (event.isOwner) {
    return viewerAvatarUrl;
  }

  if (event.createdByAvatarUrl) {
    return event.createdByAvatarUrl;
  }

  const creatorInvitee = findEventCreatorInvitee(event);
  if (creatorInvitee?.avatarUrl) {
    return creatorInvitee.avatarUrl;
  }

  return null;
}

export function isEventCreator(
  event: CalendarEventItem,
  userId: string | null,
  username: string | null,
  displayName: string | null,
): boolean {
  if (event.isOwner) {
    return true;
  }

  if (userId && event.createdById && userId === event.createdById) {
    return true;
  }

  if (!event.sharedBy) {
    return false;
  }

  const sharedBy = event.sharedBy.toLowerCase();

  return Boolean(
    (username && sharedBy === username.toLowerCase()) ||
    (displayName && sharedBy === displayName.toLowerCase()) ||
    (username && sharedBy.includes(username.toLowerCase()) && !event.invitees?.length)
  );
}

export function resolveMyEventResponse(
  event: CalendarEventItem,
  userId: string | null,
  username: string | null,
  displayName: string | null,
): string | null {
  const invitee = findCurrentUserInvitee(event, userId, username, displayName);
  const inviteeStatus = invitee?.status.toUpperCase() ?? null;
  const myStatus = event.myResponseStatus?.toUpperCase() ?? null;

  if (myStatus === 'ACCEPTED' || myStatus === 'DECLINED') {
    return myStatus;
  }

  if (inviteeStatus === 'ACCEPTED' || inviteeStatus === 'DECLINED') {
    return inviteeStatus;
  }

  if (myStatus === 'PENDING') {
    return myStatus;
  }

  if (inviteeStatus === 'PENDING') {
    return inviteeStatus;
  }

  return myStatus ?? inviteeStatus;
}

export function resolveEventCanRespond(
  event: CalendarEventItem,
  userId: string | null,
  username: string | null,
  displayName: string | null,
): boolean {
  if (isEventCreator(event, userId, username, displayName)) {
    return false;
  }

  const myStatus = resolveMyEventResponse(event, userId, username, displayName);

  return myStatus === 'PENDING';
}

export function resolveEventCanDelete(
  event: CalendarEventItem,
  userId: string | null,
): boolean {
  if (event.canDelete) {
    return true;
  }

  return Boolean(userId && event.createdById && event.createdById === userId);
}

export function normalizeCalendarEventsDetailed(payload: unknown): CalendarEventItem[] {
  return sortCalendarEvents(
    extractArray(payload, ['events', 'items', 'data'])
    .map(asRecord)
    .filter((item): item is Record<string, unknown> => item !== null)
    .map((record, index) => {
      const data = asRecord(record.data);
      const creator =
        asRecord(record.createdBy) ??
        asRecord(record.creator) ??
        asRecord(record.owner) ??
        asRecord(data?.createdBy) ??
        asRecord(data?.creator) ??
        asRecord(record.author) ??
        null;
      const sharedByUser =
        asRecord(record.sharedByUser) ??
        (typeof record.sharedBy === 'object' ? asRecord(record.sharedBy) : null) ??
        asRecord(record.user) ??
        null;
      const sharedBy =
        readString(record.sharedByUsername) ??
        readString(record.sharedByName) ??
        readString(record.createdByName) ??
        readString(record.creatorName) ??
        readString(record.organizerName) ??
        (typeof record.sharedBy === 'string' ? readString(record.sharedBy) : null) ??
        (sharedByUser
          ? readString(sharedByUser.displayName) ??
            readString(sharedByUser.name) ??
            readString(sharedByUser.username)
          : null) ??
        (creator
          ? readString(creator.displayName) ??
            readString(creator.name) ??
            readString(creator.username)
          : null) ??
        '';
      const createdById =
        readString(record.createdById) ??
        readString(record.creatorId) ??
        (creator ? readString(creator.id) : null) ??
        null;
      const createdByAvatarUrl =
        resolveAvatarUrl(creator) ??
        resolveAvatarUrl(sharedByUser) ??
        resolveAvatarUrl(record.createdBy) ??
        resolveAvatarUrl(record.creator) ??
        null;
      const myResponseStatus = readMyResponseStatus(record);
      const isOwner =
        record.isOwner === true ||
        record.isCreator === true ||
        record.createdByMe === true;
      const invitees = extractCalendarInvitees(record);
      const mentionUserIds = [
        ...new Set([
          ...extractCalendarMentionUserIds(record),
          ...invitees.map((invitee) => invitee.userId).filter((id): id is string => Boolean(id)),
        ]),
      ];
      const canRespond = !isOwner && myResponseStatus === 'PENDING';
      const taggedHubs = extractCalendarTaggedHubs(record);
      const conversationId =
        readString(record.conversationId) ??
        readString(data?.conversationId) ??
        readString(record.chatId) ??
        taggedHubs[0]?.conversationId ??
        null;
      const conversationName =
        readString(record.conversationName) ??
        readString(data?.conversationName) ??
        taggedHubs[0]?.name ??
        '';
      const channelId =
        readString(record.channelId) ??
        readString(data?.channelId) ??
        taggedHubs[0]?.channelId ??
        null;

      return {
        id: readString(record.id) ?? `event-${index}`,
        title: readString(record.title) ?? readString(record.name) ?? 'Event',
        startsAt:
          readString(record.startsAt) ??
          readString(record.startAt) ??
          readString(record.date) ??
          '',
        endsAt: readString(record.endsAt) ?? readString(record.endAt) ?? null,
        mentionUserIds,
        createdAt:
          readString(record.createdAt) ??
          readString(record.updatedAt) ??
          readString(record.startsAt) ??
          '',
        createdById,
        createdByAvatarUrl,
        description: readString(record.description) ?? readString(record.notes) ?? '',
        notes: readString(record.notes) ?? readString(record.description) ?? '',
        status: readString(record.status) ?? myResponseStatus,
        myResponseStatus,
        sharedBy,
        invitees,
        conversationId,
        conversationName,
        channelId,
        taggedHubs,
        isOwner,
        canRespond,
        canDelete: record.canDelete === true || isOwner,
      };
    }),
  );
}

export function normalizeScheduledMessage(
  payload: unknown,
  index = 0,
  fallbackConversationId = '',
): ScheduledMessageItem | null {
  const record = asRecord(payload);
  if (!record) {
    return null;
  }

  const nested =
    asRecord(record.scheduledMessage) ??
    asRecord(record.message) ??
    asRecord(record.data) ??
    record;
  const message = asRecord(nested.message) ?? asRecord(record.message);
  const conversation =
    asRecord(nested.conversation) ?? asRecord(record.conversation) ?? asRecord(message?.conversation);
  const messageText =
    typeof record.message === 'string'
      ? record.message
      : typeof nested.message === 'string'
        ? nested.message
        : '';

  const id =
    readString(nested.id) ??
    readString(record.id) ??
    readString(record.scheduledId) ??
    readString(message?.id) ??
    `scheduled-${index}-${fallbackConversationId || 'local'}`;

  return {
    id,
    conversationId:
      readString(nested.conversationId) ??
      readString(record.conversationId) ??
      readString(conversation?.id) ??
      fallbackConversationId,
    conversationName:
      readString(nested.conversationName) ??
      readString(record.conversationName) ??
      readString(conversation?.name) ??
      readString(conversation?.title) ??
      'Chat',
    content:
      readString(nested.content) ??
      readString(record.content) ??
      readString(nested.text) ??
      readString(record.text) ??
      readString(message?.content) ??
      readString(message?.text) ??
      readString(message?.body) ??
      readString(record.body) ??
      readString(messageText) ??
      '',
    scheduledAt:
      readString(nested.scheduledAt) ??
      readString(record.scheduledAt) ??
      readString(nested.sendAt) ??
      readString(record.sendAt) ??
      readString(nested.scheduledFor) ??
      readString(record.scheduledFor) ??
      '',
    status: readString(nested.status) ?? readString(record.status) ?? 'PENDING',
  };
}

export function isPendingScheduledMessage(item: ScheduledMessageItem): boolean {
  const status = (item.status || 'PENDING').toUpperCase();
  return !['SENT', 'CANCELLED', 'CANCELED', 'DELIVERED', 'FAILED', 'COMPLETED'].includes(status);
}

export function normalizeScheduledMessages(payload: unknown): ScheduledMessageItem[] {
  const list = extractArray(payload, [
    'messages',
    'scheduledMessages',
    'scheduled',
    'items',
    'data',
    'results',
  ]);

  if (list.length === 0) {
    const single = normalizeScheduledMessage(payload);
    return single ? [single] : [];
  }

  return list
    .map((entry, index) => normalizeScheduledMessage(entry, index))
    .filter((item): item is ScheduledMessageItem => item !== null);
}

export function normalizeAiTextResult(payload: unknown): AiTextResult {
  if (typeof payload === 'string' && payload.trim()) {
    return {
      text: payload.trim(),
      action: null,
      conversationId: null,
      conversationName: null,
      message: null,
      scheduledAt: null,
      snoozeUntil: null,
      snoozeHours: null,
    };
  }

  const record = asRecord(payload) ?? {};
  const nested =
    asRecord(record.data) ??
    asRecord(record.result) ??
    asRecord(record.command) ??
    asRecord(record.actionPayload) ??
    {};

  const hoursValue = nested.snoozeHours ?? record.snoozeHours ?? nested.hours ?? record.hours;
  const snoozeHours =
    typeof hoursValue === 'number' && Number.isFinite(hoursValue)
      ? hoursValue
      : typeof hoursValue === 'string' && Number.isFinite(Number(hoursValue))
        ? Number(hoursValue)
        : null;

  return {
    text:
      readString(record.reply) ??
      readString(record.text) ??
      readString(record.content) ??
      readString(record.output) ??
      readString(record.transcript) ??
      readString(record.transcription) ??
      readString(nested.reply) ??
      readString(nested.text) ??
      readString(nested.content) ??
      readString(nested.output) ??
      readString(nested.transcript) ??
      readString(nested.transcription) ??
      readString(record.transcribedText) ??
      readString(nested.transcribedText) ??
      '',
    action:
      readString(record.action) ??
      readString(record.intent) ??
      readString(nested.action) ??
      readString(nested.intent),
    conversationId:
      readString(record.conversationId) ??
      readString(nested.conversationId) ??
      readString(record.channelId) ??
      readString(nested.channelId),
    conversationName:
      readString(record.conversationName) ??
      readString(record.conversation) ??
      readString(record.channel) ??
      readString(nested.conversationName) ??
      readString(nested.conversation) ??
      readString(nested.channel),
    message:
      readString(record.message) ??
      readString(record.body) ??
      readString(nested.message) ??
      readString(nested.body),
    scheduledAt:
      readString(record.scheduledAt) ??
      readString(record.sendAt) ??
      readString(nested.scheduledAt) ??
      readString(nested.sendAt),
    snoozeUntil:
      readString(record.snoozeUntil) ??
      readString(record.snoozedUntil) ??
      readString(nested.snoozeUntil) ??
      readString(nested.snoozedUntil),
    snoozeHours,
  };
}

export function sanitizeAiApiError(error: string): string {
  if (/incorrect api key|invalid api key|api key provided/i.test(error)) {
    return 'Flex AI is unavailable because the server API key is invalid. Ask an admin to update it.';
  }

  return error;
}

export function parseFlexDateTime(raw: string | null | undefined): string | null {
  if (!raw?.trim()) {
    return null;
  }

  const trimmed = raw.trim();
  if (trimmed.includes('T') || /^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const parsed = Date.parse(trimmed);
    if (!Number.isNaN(parsed)) {
      return new Date(parsed).toISOString();
    }
  }

  const lower = trimmed.toLowerCase().replace(/\./g, '');
  const timeMatch = lower.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);

  if (!timeMatch) {
    return null;
  }

  let hours = Number(timeMatch[1]);
  const minutes = timeMatch[2] ? Number(timeMatch[2]) : 0;
  const meridian = timeMatch[3];

  if (meridian === 'pm' && hours < 12) {
    hours += 12;
  }

  if (meridian === 'am' && hours === 12) {
    hours = 0;
  }

  const date = new Date();
  if (/\btomorrow\b/.test(lower)) {
    date.setDate(date.getDate() + 1);
  }

  date.setHours(hours, minutes, 0, 0);

  if (date.getTime() <= Date.now()) {
    date.setDate(date.getDate() + 1);
  }

  return date.toISOString();
}

export function inferFlexIntent(input: string, result: AiTextResult): AiTextResult {
  const next: AiTextResult = { ...result };
  const text = input.trim();

  if (!next.action) {
    if (/^open\s+/i.test(text)) {
      next.action = 'open';
    } else if (/keep me on snooze|snooze (?:me|notifications|all)\b/i.test(text)) {
      next.action = 'snooze_me';
    } else if (/^snooze\s+/i.test(text)) {
      next.action = 'snooze';
    } else if (/^send\b/i.test(text) && /\bfor\s+/i.test(text)) {
      next.action = 'schedule';
    } else if (/^send\b/i.test(text)) {
      next.action = 'send';
    }
  }

  if (!next.conversationName) {
    const openName = text.match(/^open\s+(.+)$/i)?.[1];
    const snoozeName = text.match(/^snooze\s+(.+?)(?:\s+for\b|$)/i)?.[1];
    next.conversationName = openName?.trim() || snoozeName?.trim() || null;
  }

  if (!next.message) {
    const scheduledSend = text.match(/^send\s+(.+?)\s+for\s+.+$/i)?.[1];
    const immediateSend = text.match(/^send\s+(.+)$/i)?.[1];
    next.message = scheduledSend?.trim() || immediateSend?.trim() || null;
  }

  if (!next.scheduledAt) {
    const forMatch = text.match(/\bfor\s+(.+)$/i)?.[1];
    const parsed = parseFlexDateTime(forMatch ?? next.scheduledAt);
    if (parsed && (next.action === 'schedule' || next.action === 'send')) {
      next.scheduledAt = parsed;
      next.action = 'schedule';
    }
  } else {
    next.scheduledAt = parseFlexDateTime(next.scheduledAt) ?? next.scheduledAt;
  }

  if (next.snoozeHours == null) {
    const hours = text.match(/for\s+(\d+(?:\.\d+)?)\s*hours?/i)?.[1];
    if (hours) {
      next.snoozeHours = Number(hours);
    }
  }

  return next;
}

export function hoursToSnoozePreset(hours: number): string {
  if (hours <= 0.75) {
    return '30m';
  }

  if (hours <= 1.5) {
    return '1h';
  }

  if (hours <= 3) {
    return '2h';
  }

  if (hours <= 6) {
    return '4h';
  }

  if (hours <= 12) {
    return '8h';
  }

  return '24h';
}

export function normalizeVapidPublicKey(payload: unknown): PushVapidKeyResult {
  const record = asRecord(payload) ?? {};

  return {
    publicKey:
      readString(record.publicKey) ??
      readString(record.vapidPublicKey) ??
      readString(record.key) ??
      '',
  };
}

export function defaultEventDateTimeLocal(): string {
  const date = new Date(Date.now() + 60 * 60 * 1000);
  date.setSeconds(0, 0);

  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function dateTimeLocalToIso(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString();
  }

  return parsed.toISOString();
}

export function isEventAtLeastOneMinuteFromNow(isoValue: string): boolean {
  const parsed = new Date(isoValue).getTime();
  if (Number.isNaN(parsed)) {
    return false;
  }

  return parsed - Date.now() >= 60_000;
}
