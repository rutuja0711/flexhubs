import type { CalendarEventItem } from '../../shared/features';
import type { CalendarHubOption, ScheduledMessageItem } from '../../shared/extras';
import { eventMatchesHubConversationFilter, isEventCreator } from '../../shared/extras';
import type {
  CalendarEventTypeFilter,
  CalendarEventsScope,
  CalendarWhenFilter,
} from './CalendarFiltersPopover';

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function isSameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Monday-based week containing `ref`. */
function isDateInSameWeek(date: Date, ref: Date): boolean {
  const day = ref.getDay();
  const distanceToMonday = day === 0 ? 6 : day - 1;
  const weekStart = startOfDay(
    new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() - distanceToMonday),
  );
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const t = date.getTime();
  return t >= weekStart.getTime() && t < weekEnd.getTime();
}

export function eventMatchesWhenFilter(iso: string, when: CalendarWhenFilter, now = new Date()): boolean {
  if (when === 'allDates' || !iso) {
    return when === 'allDates';
  }

  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return false;
  }

  if (when === 'today') {
    return isSameCalendarDay(d, now);
  }

  return isDateInSameWeek(d, now);
}

export function isPrivateCalendarEvent(event: CalendarEventItem): boolean {
  if (event.conversationId || event.channelId || (event.taggedHubs?.length ?? 0) > 0) {
    return false;
  }

  const others = (event.invitees ?? []).filter(
    (invitee) => invitee.userId && event.createdById && invitee.userId !== event.createdById,
  );

  if (others.length > 0) {
    return false;
  }

  const mentionCount = event.mentionUserIds?.length ?? 0;
  return mentionCount === 0;
}

export function isEventLinkedToChat(event: CalendarEventItem): boolean {
  if (event.conversationId || event.channelId || (event.taggedHubs?.length ?? 0) > 0) {
    return true;
  }

  return (event.invitees?.length ?? 0) > 0 || (event.mentionUserIds?.length ?? 0) > 0;
}

export function scheduledMessageMatchesHubFilter(
  item: ScheduledMessageItem,
  selectedConversationIds: string[],
  _hubOptions: CalendarHubOption[],
): boolean {
  if (selectedConversationIds.length === 0) {
    return true;
  }

  return selectedConversationIds.includes(item.conversationId);
}

export function eventMatchesTypeFilter(event: CalendarEventItem, type: CalendarEventTypeFilter): boolean {
  if (type === 'any') {
    return true;
  }
  if (type === 'privateOnly') {
    return isPrivateCalendarEvent(event);
  }
  return isEventLinkedToChat(event);
}

export function eventMatchesScopeFilter(
  event: CalendarEventItem,
  scope: CalendarEventsScope,
  userId: string | null,
  username: string | null,
  displayName: string | null,
): boolean {
  if (scope === 'all') {
    return true;
  }

  const created = isEventCreator(event, userId, username, displayName);

  if (scope === 'createdByMe') {
    return created;
  }

  if (created) {
    return false;
  }

  return Boolean(
    event.invitees?.length ||
      event.myResponseStatus ||
      event.sharedBy ||
      event.canRespond,
  );
}

export function filterCalendarEvents(
  events: CalendarEventItem[],
  options: {
    searchQuery: string;
    scope: CalendarEventsScope;
    eventType: CalendarEventTypeFilter;
    when: CalendarWhenFilter;
    hubConversationIds: string[];
    hubOptions: CalendarHubOption[];
    userId: string | null;
    username: string | null;
    displayName: string | null;
  },
): CalendarEventItem[] {
  const q = options.searchQuery.trim().toLowerCase();

  return events.filter((event) => {
    if (q) {
      const inTitle = event.title.toLowerCase().includes(q);
      const inBody = (event.description || event.notes || '').toLowerCase().includes(q);
      const inHub =
        (event.conversationName ?? '').toLowerCase().includes(q) ||
        (event.taggedHubs ?? []).some((hub) => hub.name.toLowerCase().includes(q));
      if (!inTitle && !inBody && !inHub) {
        return false;
      }
    }

    if (!eventMatchesScopeFilter(event, options.scope, options.userId, options.username, options.displayName)) {
      return false;
    }

    if (!eventMatchesTypeFilter(event, options.eventType)) {
      return false;
    }

    if (!eventMatchesWhenFilter(event.startsAt, options.when)) {
      return false;
    }

    if (
      !eventMatchesHubConversationFilter(event, options.hubConversationIds, options.hubOptions)
    ) {
      return false;
    }

    return true;
  });
}

export function filterScheduledMessages(
  items: ScheduledMessageItem[],
  options: {
    searchQuery: string;
    when: CalendarWhenFilter;
    hubConversationIds: string[];
    hubOptions: CalendarHubOption[];
  },
): ScheduledMessageItem[] {
  const q = options.searchQuery.trim().toLowerCase();

  return items.filter((item) => {
    if (q) {
      const inContent = item.content.toLowerCase().includes(q);
      const inChat = item.conversationName.toLowerCase().includes(q);
      if (!inContent && !inChat) {
        return false;
      }
    }

    if (!eventMatchesWhenFilter(item.scheduledAt, options.when)) {
      return false;
    }

    return scheduledMessageMatchesHubFilter(
      item,
      options.hubConversationIds,
      options.hubOptions,
    );
  });
}
