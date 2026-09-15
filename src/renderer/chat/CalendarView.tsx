import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { FiCalendar, FiClock, FiTrash2, FiX } from 'react-icons/fi';
import type { CalendarEventItem } from '../../shared/features';
import type { ScheduledMessageItem } from '../../shared/extras';
import { resolveEventCanDelete, resolveEventCanRespond, resolveMyEventResponse } from '../../shared/extras';
import { getUserDisplayName, getUserId, getUserUsername } from '../../shared/user';
import {
  deleteCalendarEvent,
  loadScheduledMessages,
  respondToCalendarEvent,
} from '../extrasApi';
import { deleteConversationScheduledMessage } from '../chatApi';
import { useConfirm } from '../ui/ConfirmDialog';
import { useToast } from '../ui/Toast';
import { formatConversationTimestamp } from './format';
import { NewEventModal } from './NewEventModal';

type CalendarViewProps = {
  events: CalendarEventItem[];
  loading: boolean;
  error: string;
  user: unknown;
  onRetry: () => void;
  onRefresh: () => void;
  onNotificationsRefresh?: () => void;
  onUnauthorized: (status?: number) => boolean;
  highlightEventId?: string | null;
  onHighlightHandled?: () => void;
};

type CalendarTab = 'events' | 'scheduled';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];

const DAY_ORDER = ['TODAY', 'TOMORROW'];

function formatEventDateTime(value: string): string {
  if (!value) {
    return '';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const day = date.getDate();
  const month = MONTHS[date.getMonth()] ?? '';
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${day} ${month}, ${hours}:${minutes}`;
}

function getDayLabel(value: string): string {
  if (!value) {
    return 'UPCOMING';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'UPCOMING';
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const eventDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((eventDay.getTime() - today.getTime()) / 86_400_000);

  if (diffDays === 0) {
    return 'TODAY';
  }

  if (diffDays === 1) {
    return 'TOMORROW';
  }

  return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase();
}

function inviteeStatusClass(status: string): string {
  const normalized = status.toUpperCase();

  if (normalized === 'ACCEPTED') {
    return 'text-[#3ecf8e]';
  }

  if (normalized === 'DECLINED') {
    return 'text-app-muted';
  }

  return 'text-[#f5c451]';
}

function sortEventsWithinGroup(events: CalendarEventItem[]): CalendarEventItem[] {
  return [...events].sort((left, right) => {
    const leftCreated = Date.parse(left.createdAt ?? '') || Date.parse(left.startsAt);
    const rightCreated = Date.parse(right.createdAt ?? '') || Date.parse(right.startsAt);

    if (leftCreated !== rightCreated) {
      return rightCreated - leftCreated;
    }

    return Date.parse(right.startsAt) - Date.parse(left.startsAt);
  });
}

function groupEventsByDay(events: CalendarEventItem[]): Array<{ label: string; events: CalendarEventItem[] }> {
  const groups = new Map<string, CalendarEventItem[]>();

  for (const event of events) {
    const label = getDayLabel(event.startsAt);
    const current = groups.get(label) ?? [];
    current.push(event);
    groups.set(label, current);
  }

  return [...groups.entries()]
    .sort(([left], [right]) => {
      const leftIndex = DAY_ORDER.indexOf(left);
      const rightIndex = DAY_ORDER.indexOf(right);

      if (leftIndex !== -1 || rightIndex !== -1) {
        return (leftIndex === -1 ? 99 : leftIndex) - (rightIndex === -1 ? 99 : rightIndex);
      }

      return left.localeCompare(right);
    })
    .map(([label, groupedEvents]) => ({
      label,
      events: sortEventsWithinGroup(groupedEvents),
    }));
}

function EventCard({
  event,
  actingOn,
  highlighted,
  cardRef,
  userId,
  username,
  displayName,
  respondedEventIds,
  onRespond,
  onDelete,
}: {
  event: CalendarEventItem;
  actingOn: string | null;
  highlighted: boolean;
  cardRef?: RefObject<HTMLDivElement | null>;
  userId: string | null;
  username: string | null;
  displayName: string | null;
  respondedEventIds: ReadonlySet<string>;
  onRespond: (event: CalendarEventItem, accept: boolean) => void;
  onDelete: (event: CalendarEventItem) => void;
}) {
  const invitees = event.invitees ?? [];
  const mentionLine = invitees.map((invitee) => `@${invitee.username || invitee.name}`).join(' ');
  const extrasEvent = event as import('../../shared/extras').CalendarEventItem;
  const myResponse = resolveMyEventResponse(extrasEvent, userId, username, displayName);
  const canRespond =
    !extrasEvent.isOwner &&
    !respondedEventIds.has(event.id) &&
    resolveEventCanRespond(extrasEvent, userId, username, displayName);
  const canDelete = resolveEventCanDelete(extrasEvent, userId);

  return (
    <article
      ref={cardRef}
      className={`rounded-2xl border p-5 transition-all duration-200 ${
        highlighted
          ? 'border-accent/80 bg-accent/10 ring-2 ring-accent/30 shadow-md shadow-accent/10'
          : 'border-app-border/70 bg-app-card/60 hover:bg-app-card hover:border-app-border hover:shadow-xs'
      }`}
    >
      <div className="mb-3 flex items-start justify-between gap-4">
        <h3 className="min-w-0 flex-1 text-base font-semibold text-app-text tracking-tight">{event.title}</h3>
        <div className="flex shrink-0 items-center gap-2">
          {event.startsAt ? (
            <span className="rounded-lg bg-app-inset/80 px-2.5 py-1 text-xs font-medium whitespace-nowrap text-app-muted border border-app-border/50">
              {formatEventDateTime(event.startsAt)}
            </span>
          ) : null}
          {canDelete ? (
            <button
              type="button"
              disabled={actingOn === event.id}
              aria-label="Delete event"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-app-muted transition-colors hover:bg-app-inset hover:text-accent-soft"
              onClick={() => void onDelete(event)}
            >
              <FiX size={15} />
            </button>
          ) : null}
        </div>
      </div>

      {mentionLine ? <p className="mb-2 text-xs font-medium text-accent-soft">{mentionLine}</p> : null}

      {invitees.length > 0 ? (
        <div className="mb-3 flex flex-col gap-1.5 rounded-xl border border-app-border/50 bg-app-inset/40 p-3">
          {invitees.map((invitee) => (
            <div
              key={`${event.id}-${invitee.userId ?? invitee.username ?? invitee.name}`}
              className="flex items-center justify-between gap-3 text-xs"
            >
              <span className="truncate text-app-text font-medium">{invitee.name || invitee.username}</span>
              <span
                className={`shrink-0 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md bg-app-card ${inviteeStatusClass(invitee.status)}`}
              >
                {invitee.status}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {event.sharedBy ? (
        <p className="mb-2 text-xs text-app-muted">Shared by <span className="text-app-text font-medium">{event.sharedBy}</span></p>
      ) : null}

      {(event.notes || event.description) ? (
        <p className="mb-3 text-xs text-app-muted leading-relaxed">{event.notes || event.description}</p>
      ) : null}

      {myResponse && !canRespond ? (
        <p className={`mb-2 text-xs font-medium ${inviteeStatusClass(myResponse)}`}>
          Your response: {myResponse}
        </p>
      ) : null}

      {canRespond ? (
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            disabled={actingOn === event.id}
            className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-4 py-1.5 text-xs font-semibold text-white shadow-xs transition-all hover:bg-accent-hover active:scale-[0.98] disabled:opacity-60"
            onClick={() => void onRespond(event, true)}
          >
            <span aria-hidden="true">✓</span>
            Accept
          </button>
          <button
            type="button"
            disabled={actingOn === event.id}
            className="inline-flex items-center gap-1.5 rounded-xl border border-app-border bg-app-card/80 px-4 py-1.5 text-xs font-semibold text-app-muted transition-all hover:bg-app-inset hover:text-app-text active:scale-[0.98] disabled:opacity-60"
            onClick={() => void onRespond(event, false)}
          >
            <span aria-hidden="true">✕</span>
            Decline
          </button>
        </div>
      ) : null}
    </article>
  );
}

export function CalendarView({
  events,
  loading,
  error,
  user,
  onRetry,
  onRefresh,
  onNotificationsRefresh,
  onUnauthorized,
  highlightEventId = null,
  onHighlightHandled,
}: CalendarViewProps) {
  const toast = useToast();
  const confirm = useConfirm();
  const highlightedEventRef = useRef<HTMLDivElement | null>(null);
  const [tab, setTab] = useState<CalendarTab>('events');
  const [modalOpen, setModalOpen] = useState(false);
  const [scheduled, setScheduled] = useState<ScheduledMessageItem[]>([]);
  const [scheduledLoading, setScheduledLoading] = useState(false);
  const [scheduledError, setScheduledError] = useState('');
  const [actingOn, setActingOn] = useState<string | null>(null);
  const [respondedEventIds, setRespondedEventIds] = useState<Set<string>>(() => new Set());

  const userId = getUserId(user);
  const username = getUserUsername(user);
  const displayName = getUserDisplayName(user);
  const groupedEvents = useMemo(() => groupEventsByDay(events), [events]);

  useEffect(() => {
    const alreadyResponded = new Set<string>();

    for (const event of events) {
      const extrasEvent = event as import('../../shared/extras').CalendarEventItem;

      if (extrasEvent.isOwner) {
        continue;
      }

      const response = resolveMyEventResponse(extrasEvent, userId, username, displayName);

      if (response === 'ACCEPTED' || response === 'DECLINED') {
        alreadyResponded.add(event.id);
      }
    }

    setRespondedEventIds(alreadyResponded);
  }, [displayName, events, userId, username]);

  useEffect(() => {
    if (tab !== 'scheduled') {
      return;
    }

    setScheduledLoading(true);
    setScheduledError('');

    void loadScheduledMessages().then((result) => {
      setScheduledLoading(false);

      if (!result.ok) {
        if (onUnauthorized(result.status)) {
          return;
        }
        setScheduledError(result.error);
        return;
      }

      setScheduled(result.data);
    });
  }, [onUnauthorized, tab]);

  useEffect(() => {
    if (!highlightEventId || loading) {
      return;
    }

    setTab('events');

    const frame = window.requestAnimationFrame(() => {
      highlightedEventRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      onHighlightHandled?.();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [highlightEventId, loading, onHighlightHandled]);

  const handleRespond = async (event: CalendarEventItem, accept: boolean) => {
    setActingOn(event.id);
    const result = await respondToCalendarEvent(event.id, accept);
    setActingOn(null);

    if (!result.ok) {
      if (onUnauthorized(result.status)) return;

      const alreadyResponded = result.error.toLowerCase().includes('already responded');
      if (alreadyResponded) {
        setRespondedEventIds((current) => new Set([...current, event.id]));
        toast.success(accept ? 'Event accepted.' : 'Event declined.');
        onRefresh();
        onNotificationsRefresh?.();
        return;
      }

      toast.error(result.error);
      return;
    }

    setRespondedEventIds((current) => new Set([...current, event.id]));
    toast.success(accept ? 'Event accepted.' : 'Event declined.');
    onRefresh();
    onNotificationsRefresh?.();
  };

  const handleDelete = async (event: CalendarEventItem) => {
    const confirmed = await confirm({
      title: 'Delete event',
      message: `Delete "${event.title}"? This cannot be undone.`,
      confirmLabel: 'Delete event',
      tone: 'danger',
    });

    if (!confirmed) {
      return;
    }

    setActingOn(event.id);
    const result = await deleteCalendarEvent(event.id);
    setActingOn(null);

    if (!result.ok) {
      if (onUnauthorized(result.status)) return;
      toast.error(result.error);
      return;
    }

    toast.success('Event deleted.');
    onRefresh();
  };

  const handleDeleteScheduled = async (item: ScheduledMessageItem) => {
    const confirmed = await confirm({
      title: 'Cancel scheduled message',
      message: 'Remove this scheduled message? It will not be sent.',
      confirmLabel: 'Remove',
      tone: 'danger',
    });

    if (!confirmed) {
      return;
    }

    setActingOn(item.id);
    const result = await deleteConversationScheduledMessage(item.conversationId, item.id);
    setActingOn(null);

    if (!result.ok) {
      if (onUnauthorized(result.status)) return;
      toast.error(result.error);
      return;
    }

    toast.success('Scheduled message removed.');
    setScheduled((current) => current.filter((entry) => entry.id !== item.id));
  };

  return (
    <div className="flex h-full flex-col bg-app-chat-bg">
      <header className="flex items-center justify-between border-b border-app-border/50 px-8 py-6 bg-app-surface/50 backdrop-blur-sm">
        <div>
          <h1 className="text-2xl font-bold text-app-text tracking-tight">Calendar</h1>
          {tab === 'scheduled' ? (
            <button
              type="button"
              className="mt-1 text-xs font-medium text-accent-soft transition-colors hover:text-accent"
              onClick={() => setTab('events')}
            >
              ← Back to events
            </button>
          ) : (
            <button
              type="button"
              className="mt-1 text-xs font-medium text-app-muted transition-colors hover:text-app-text"
              onClick={() => setTab('scheduled')}
            >
              View scheduled messages →
            </button>
          )}
        </div>
        {tab === 'events' ? (
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="rounded-xl bg-gradient-to-r from-accent to-[#632a38] px-4 py-2 text-xs font-semibold text-white shadow-md shadow-accent/20 transition-all hover:brightness-110 active:scale-[0.98]"
          >
            + New event
          </button>
        ) : null}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-8 py-6">
        {tab === 'events' ? (
          <>
            {loading ? <p className="text-sm text-app-muted">Loading calendar...</p> : null}
            {!loading && error ? (
              <div role="alert">
                <p className="mb-3 text-sm text-accent-soft">{error}</p>
                <button
                  type="button"
                  className="rounded-[10px] border border-app-border px-3 py-2 text-sm"
                  onClick={onRetry}
                >
                  Try again
                </button>
              </div>
            ) : null}
            {!loading && !error && events.length === 0 ? (
              <div className="mx-auto max-w-md text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[16px] border border-app-border bg-app-chat-panel text-app-muted">
                  <FiCalendar className="text-2xl" />
                </div>
                <h2 className="mb-2 text-lg font-semibold text-app-text">Nothing scheduled yet</h2>
                <p className="text-sm text-app-muted">
                  Create a private event or schedule a message from chat to see it here.
                </p>
              </div>
            ) : null}
            {!loading && !error && events.length > 0 ? (
              <div className="flex w-full flex-col gap-6">
                {groupedEvents.map((group) => (
                  <section key={group.label}>
                    <h2 className="mb-3 text-xs font-semibold tracking-[0.14em] text-app-muted">
                      {group.label}
                    </h2>
                    <div className="flex flex-col gap-3">
                      {group.events.map((event) => (
                        <EventCard
                          key={event.id}
                          event={event}
                          actingOn={actingOn}
                          highlighted={highlightEventId === event.id}
                          cardRef={highlightEventId === event.id ? highlightedEventRef : undefined}
                          userId={userId}
                          username={username}
                          displayName={displayName}
                          respondedEventIds={respondedEventIds}
                          onRespond={handleRespond}
                          onDelete={handleDelete}
                        />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            ) : null}
          </>
        ) : (
          <>
            {scheduledLoading ? <p className="text-sm text-app-muted">Loading scheduled messages...</p> : null}
            {!scheduledLoading && scheduledError ? (
              <div role="alert">
                <p className="mb-3 text-sm text-accent-soft">{scheduledError}</p>
                <button
                  type="button"
                  className="rounded-[10px] border border-app-border px-3 py-2 text-sm"
                  onClick={() => setTab('scheduled')}
                >
                  Try again
                </button>
              </div>
            ) : null}
            {!scheduledLoading && !scheduledError && scheduled.length === 0 ? (
              <div className="mx-auto max-w-md text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[16px] border border-app-border bg-app-chat-panel text-app-muted">
                  <FiClock className="text-2xl" />
                </div>
                <h2 className="mb-2 text-lg font-semibold text-app-text">No scheduled messages</h2>
                <p className="text-sm text-app-muted">Messages scheduled from chat will appear here.</p>
              </div>
            ) : null}
            {!scheduledLoading && !scheduledError && scheduled.length > 0 ? (
              <div className="flex flex-col gap-3">
                {scheduled.map((item) => (
                  <div key={item.id} className="flex items-start justify-between gap-4 rounded-[12px] border border-app-border bg-app-surface p-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-app-text">{item.content || 'Scheduled message'}</p>
                      <p className="text-sm text-app-muted">
                        {item.conversationName}
                        {item.scheduledAt ? ` · ${formatConversationTimestamp(item.scheduledAt)}` : ''}
                      </p>
                      <p className="mt-1 text-xs uppercase tracking-wide text-accent-soft">{item.status}</p>
                    </div>
                    <button
                      type="button"
                      disabled={actingOn === item.id}
                      aria-label="Remove scheduled message"
                      title="Remove scheduled message"
                      className="flex shrink-0 items-center gap-1 rounded-lg border border-app-border px-3 py-2 text-xs text-app-muted transition-colors hover:border-accent-soft hover:text-accent-soft disabled:opacity-50"
                      onClick={() => void handleDeleteScheduled(item)}
                    >
                      <FiTrash2 className="h-4 w-4" />
                      {actingOn === item.id ? 'Removing...' : 'Remove'}
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </>
        )}
      </div>

      <NewEventModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={() => {
          toast.success('Event created.');
          onRefresh();
        }}
        onUnauthorized={onUnauthorized}
      />
    </div>
  );
}
