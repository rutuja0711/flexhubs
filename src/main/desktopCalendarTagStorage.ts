import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import type { CalendarEventTagSnapshot } from '../shared/calendarEventTags';

type CalendarTagCacheFile = Record<string, CalendarEventTagSnapshot>;

function tagsFilePath(): string {
  return path.join(app.getPath('userData'), 'calendar-event-tags.json');
}

function readCacheFile(): CalendarTagCacheFile {
  const filePath = tagsFilePath();

  try {
    if (!fs.existsSync(filePath)) {
      return {};
    }

    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as CalendarTagCacheFile;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    console.warn('[FlexHubs] Could not read calendar event tags file:', error);
    return {};
  }
}

function writeCacheFile(record: CalendarTagCacheFile): void {
  const filePath = tagsFilePath();

  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(record, null, 2), 'utf8');
  } catch (error) {
    console.warn('[FlexHubs] Could not write calendar event tags file:', error);
  }
}

export function readPersistedCalendarEventTags(eventId: string): CalendarEventTagSnapshot | null {
  if (!eventId) {
    return null;
  }

  const entry = readCacheFile()[eventId];
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

export function readAllPersistedCalendarEventTags(): CalendarTagCacheFile {
  return readCacheFile();
}

export function writePersistedCalendarEventTags(
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

  const cache = readCacheFile();
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
  writeCacheFile(cache);
}
