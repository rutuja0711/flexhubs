import {
  buildCalendarEventAnnouncementContent,
  type FlexhubCalendarEventAnnouncement,
} from '../shared/calendarChat';
import { sendChatMessage } from './chatApi';

export async function announceCalendarEventToHubs(
  conversationIds: string[],
  event: Pick<FlexhubCalendarEventAnnouncement, 'eventId' | 'title' | 'startsAt' | 'endsAt'>,
  action: FlexhubCalendarEventAnnouncement['action'],
): Promise<string[]> {
  const targets = [...new Set(conversationIds.map((id) => id.trim()).filter(Boolean))];
  if (targets.length === 0) {
    return [];
  }

  const content = buildCalendarEventAnnouncementContent({
    v: 1,
    eventId: event.eventId,
    title: event.title,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    action,
  });

  const results = await Promise.all(
    targets.map(async (conversationId) => {
      const result = await sendChatMessage(conversationId, content);
      return result.ok ? conversationId : null;
    }),
  );

  return results.filter((id): id is string => Boolean(id));
}
