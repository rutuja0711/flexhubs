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

export type CreateCalendarEventInput = {
  title: string;
  startsAt: string;
  description?: string;
  mentionUserIds?: string[];
  conversationId?: string;
};

export type CalendarEventInvitee = {
  userId: string | null;
  username: string;
  name: string;
  status: string;
};

export type CalendarEventItem = {
  id: string;
  title: string;
  startsAt: string;
  createdAt: string;
  createdById: string | null;
  description: string;
  notes: string;
  status: string | null;
  myResponseStatus: string | null;
  sharedBy: string;
  invitees: CalendarEventInvitee[];
  isOwner: boolean;
  canRespond: boolean;
  canDelete: boolean;
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

export function mergeMentionUserIds(
  description: string,
  users: CalendarMentionableUser[],
  selectedUserIds: string[],
): string[] {
  const validIds = new Set(users.map((user) => user.id));
  const merged = new Set<string>();

  for (const id of parseMentionUserIdsFromText(description, users)) {
    merged.add(id);
  }

  for (const id of selectedUserIds) {
    if (validIds.has(id)) {
      merged.add(id);
    }
  }

  return [...merged];
}

function normalizeInvitee(record: Record<string, unknown>): CalendarEventInvitee | null {
  const user = asRecord(record.user) ?? asRecord(record.member) ?? record;
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

  if (!username && !name && !readString(user.id) && !readString(record.userId)) {
    return null;
  }

  return {
    username,
    name,
    userId:
      readString(user.id) ??
      readString(record.userId) ??
      readString(record.id) ??
      null,
    status: status.toUpperCase(),
  };
}

function extractCalendarInvitees(record: Record<string, unknown>): CalendarEventInvitee[] {
  const data = asRecord(record.data);
  const keys = [
    'responses',
    'mentions',
    'invitees',
    'participants',
    'attendees',
    'mentionUsers',
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
        const item = asRecord(entry);

        if (!item) {
          continue;
        }

        const invitee = normalizeInvitee(item);

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

  return (
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
        null;
      const sharedBy =
        readString(record.sharedByUsername) ??
        readString(record.sharedBy) ??
        readString(record.createdByName) ??
        readString(record.sharedByName) ??
        (creator ? readString(creator.name) ?? readString(creator.username) : null) ??
        '';
      const createdById =
        readString(record.createdById) ??
        readString(record.creatorId) ??
        (creator ? readString(creator.id) : null) ??
        null;
      const myResponseStatus = readMyResponseStatus(record);
      const isOwner =
        record.isOwner === true ||
        record.isCreator === true ||
        record.createdByMe === true;
      const invitees = extractCalendarInvitees(record);
      const canRespond = !isOwner && myResponseStatus === 'PENDING';

      return {
        id: readString(record.id) ?? `event-${index}`,
        title: readString(record.title) ?? readString(record.name) ?? 'Event',
        startsAt:
          readString(record.startsAt) ??
          readString(record.startAt) ??
          readString(record.date) ??
          '',
        createdAt:
          readString(record.createdAt) ??
          readString(record.updatedAt) ??
          readString(record.startsAt) ??
          '',
        createdById,
        description: readString(record.description) ?? readString(record.notes) ?? '',
        notes: readString(record.notes) ?? readString(record.description) ?? '',
        status: readString(record.status) ?? myResponseStatus,
        myResponseStatus,
        sharedBy,
        invitees,
        isOwner,
        canRespond,
        canDelete: record.canDelete === true || isOwner,
      };
    }),
  );
}

export function normalizeScheduledMessages(payload: unknown): ScheduledMessageItem[] {
  return extractArray(payload, ['messages', 'scheduledMessages', 'items', 'data'])
    .map(asRecord)
    .filter((item): item is Record<string, unknown> => item !== null)
    .map((record, index) => {
      const conversation = asRecord(record.conversation);

      return {
        id: readString(record.id) ?? `scheduled-${index}`,
        conversationId:
          readString(record.conversationId) ?? readString(conversation?.id) ?? '',
        conversationName:
          readString(record.conversationName) ??
          readString(conversation?.name) ??
          readString(conversation?.title) ??
          'Chat',
        content: readString(record.content) ?? readString(record.text) ?? '',
        scheduledAt:
          readString(record.scheduledAt) ??
          readString(record.sendAt) ??
          readString(record.scheduledFor) ??
          '',
        status: readString(record.status) ?? 'PENDING',
      };
    });
}

export function normalizeAiTextResult(payload: unknown): AiTextResult {
  const record = asRecord(payload) ?? {};

  return {
    text:
      readString(record.text) ??
      readString(record.content) ??
      readString(record.result) ??
      readString(record.output) ??
      '',
  };
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
