import type { CalendarEventInvitee, CalendarMentionableUser } from './extras';

export type CalendarEventTagSnapshot = {
  mentionUserIds: string[];
  invitees: CalendarEventInvitee[];
};

const STORAGE_KEY = 'flexhubs.desktop.calendarEventTags.v1';

type TagCacheRecord = Record<string, CalendarEventTagSnapshot>;

function readTagCache(): TagCacheRecord {
  if (typeof localStorage === 'undefined') {
    return {};
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as TagCacheRecord;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeTagCache(record: TagCacheRecord): void {
  if (typeof localStorage === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch {
    // ignore quota / private mode
  }
}

export function readCalendarEventTagSnapshot(eventId: string): CalendarEventTagSnapshot | null {
  if (!eventId) {
    return null;
  }

  const entry = readTagCache()[eventId];
  if (!entry) {
    return null;
  }

  const mentionUserIds = [...new Set((entry.mentionUserIds ?? []).filter(Boolean))];
  const invitees = (entry.invitees ?? []).filter(
    (invitee) => invitee.userId || invitee.username || invitee.name,
  );

  if (mentionUserIds.length === 0 && invitees.length === 0) {
    return null;
  }

  return { mentionUserIds, invitees };
}

export async function readCalendarEventTagSnapshotAsync(
  eventId: string,
): Promise<CalendarEventTagSnapshot | null> {
  const fromMain = await readCalendarEventTagSnapshotFromMain(eventId);
  const fromLocal = readCalendarEventTagSnapshot(eventId);

  if (fromMain && fromLocal) {
    return mergeCalendarEventTagFields(
      { mentionUserIds: [], invitees: [] },
      fromMain,
      fromLocal,
    );
  }

  return fromMain ?? fromLocal;
}

export async function readAllCalendarEventTagSnapshotsAsync(): Promise<TagCacheRecord> {
  const merged: TagCacheRecord = { ...readTagCache() };

  if (typeof window === 'undefined') {
    return merged;
  }

  try {
    const api = (
      window as unknown as {
        electronAPI?: {
          getAllCalendarEventTags?: () => Promise<TagCacheRecord>;
        };
      }
    ).electronAPI;

    const fromMain = await api?.getAllCalendarEventTags?.();
    if (fromMain && typeof fromMain === 'object') {
      for (const [eventId, snapshot] of Object.entries(fromMain)) {
        merged[eventId] = mergeCalendarEventTagFields(
          { mentionUserIds: merged[eventId]?.mentionUserIds ?? [], invitees: merged[eventId]?.invitees ?? [] },
          snapshot,
        );
      }
    }
  } catch {
    // use local only
  }

  return merged;
}

async function readCalendarEventTagSnapshotFromMain(
  eventId: string,
): Promise<CalendarEventTagSnapshot | null> {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const api = (
      window as unknown as {
        electronAPI?: {
          getCalendarEventTags?: (eventId: string) => Promise<CalendarEventTagSnapshot | null>;
        };
      }
    ).electronAPI;

    if (!api?.getCalendarEventTags) {
      return null;
    }

    return await api.getCalendarEventTags(eventId);
  } catch {
    return null;
  }
}

export async function writeCalendarEventTagSnapshotAsync(
  eventId: string,
  snapshot: CalendarEventTagSnapshot,
): Promise<void> {
  writeCalendarEventTagSnapshot(eventId, snapshot);

  if (typeof window === 'undefined') {
    return;
  }

  try {
    const api = (
      window as unknown as {
        electronAPI?: {
          setCalendarEventTags?: (
            eventId: string,
            snapshot: CalendarEventTagSnapshot,
          ) => Promise<void>;
        };
      }
    ).electronAPI;

    await api?.setCalendarEventTags?.(eventId, snapshot);
  } catch {
    // localStorage copy already saved
  }
}

export function writeCalendarEventTagSnapshot(
  eventId: string,
  snapshot: CalendarEventTagSnapshot,
): void {
  if (!eventId) {
    return;
  }

  const mentionUserIds = [...new Set(snapshot.mentionUserIds.filter(Boolean))];
  const invitees = snapshot.invitees.filter(
    (invitee) => invitee.userId || invitee.username || invitee.name,
  );

  if (mentionUserIds.length === 0 && invitees.length === 0) {
    return;
  }

  const cache = readTagCache();
  cache[eventId] = {
    mentionUserIds,
    invitees: invitees.map((invitee) => ({
      userId: invitee.userId ?? null,
      username: invitee.username?.trim() || invitee.name?.trim() || 'member',
      name: invitee.name?.trim() || invitee.username?.trim() || 'Teammate',
      status: (invitee.status ?? 'PENDING').toUpperCase(),
      avatarUrl: invitee.avatarUrl ?? null,
    })),
  };
  writeTagCache(cache);
}

export function buildCalendarInviteesFromMentionUsers(
  selectedUserIds: string[],
  mentionUsers: CalendarMentionableUser[],
): CalendarEventInvitee[] {
  const byId = new Map(mentionUsers.map((user) => [user.id, user]));
  const invitees: CalendarEventInvitee[] = [];
  const seen = new Set<string>();

  for (const userId of selectedUserIds) {
    if (!userId || userId.startsWith('invitee:') || userId.startsWith('invitee-')) {
      continue;
    }

    if (seen.has(userId)) {
      continue;
    }

    seen.add(userId);
    const user = byId.get(userId);
    const username = user?.username?.trim() || '';
    const name = user?.name?.trim() || username || 'Teammate';

    invitees.push({
      userId,
      username: username || name,
      name,
      status: 'PENDING',
    });
  }

  return invitees;
}

export function mergeCalendarEventTagFields<
  T extends {
    id?: string;
    mentionUserIds?: string[];
    invitees?: CalendarEventInvitee[];
  },
>(event: T, ...sources: Array<CalendarEventTagSnapshot | T | null | undefined>): T {
  const mentionIds = new Set<string>(event.mentionUserIds ?? []);
  const inviteesByKey = new Map<string, CalendarEventInvitee>();

  const addInvitee = (invitee: CalendarEventInvitee) => {
    const key =
      invitee.userId ??
      invitee.username?.trim().toLowerCase() ??
      invitee.name?.trim().toLowerCase() ??
      '';
    if (!key) {
      return;
    }
    inviteesByKey.set(key, invitee);
    if (invitee.userId) {
      mentionIds.add(invitee.userId);
    }
  };

  for (const invitee of event.invitees ?? []) {
    addInvitee(invitee);
  }

  for (const source of sources) {
    if (!source) {
      continue;
    }

    for (const id of source.mentionUserIds ?? []) {
      if (id) {
        mentionIds.add(id);
      }
    }

    for (const invitee of source.invitees ?? []) {
      addInvitee(invitee);
    }
  }

  return {
    ...event,
    mentionUserIds: [...mentionIds],
    invitees: [...inviteesByKey.values()],
  };
}
