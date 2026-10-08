import { FormEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { FiSearch, FiUserPlus, FiX } from 'react-icons/fi';
import type { CalendarHubOption, CalendarMentionableUser } from '../../shared/extras';
import {
  dateTimeLocalToIso,
  defaultEventDateTimeLocal,
  isEventAtLeastOneMinuteFromNow,
  mergeCalendarPeopleWithInvitees,
  mergeHubConversationIds,
  mergeMentionUserIds,
  parseHubConversationIdsFromText,
  parseMentionUserIdsFromText,
  resolveEventCanRespond,
  resolveMyEventResponse,
} from '../../shared/extras';
import { CalendarEventInviteActions } from './CalendarEventInviteActions';
import {
  buildCalendarInviteesFromMentionUsers,
  mergeCalendarEventTagFields,
  readCalendarEventTagSnapshot,
  readCalendarEventTagSnapshotAsync,
  writeCalendarEventTagSnapshotAsync,
} from '../../shared/calendarEventTags';
import type { CalendarEventItem } from '../../shared/features';
import { loadOrganizationMembers } from '../chatApi';
import {
  createCalendarEvent,
  loadCalendarEventById,
  loadCalendarMentionableUsers,
} from '../extrasApi';
import { CalendarNavIcon } from './ChatIcons';
import { CalendarSharedInviteeAvatars } from './CalendarSharedInviteeAvatars';

type NewEventModalProps = {
  open: boolean;
  onClose: () => void;
  onCreated: (saved?: CalendarEventItem) => void;
  onDelete?: () => void;
  onUnauthorized: (status?: number) => boolean;
  conversationId?: string | null;
  editEvent?: CalendarEventItem | null;
  initialDate?: Date | null;
  hubOptions?: CalendarHubOption[];
  readOnly?: boolean;
  viewerUserId?: string | null;
  viewerUsername?: string | null;
  viewerDisplayName?: string | null;
  onCalendarResponse?: () => void;
};

function channelIdsForHubConversations(
  conversationIds: string[],
  hubs: CalendarHubOption[],
): string[] {
  return [
    ...new Set(
      conversationIds
        .map((id) => hubs.find((hub) => hub.conversationId === id)?.channelId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
}

function formatWhenLabel(localValue: string): string {
  if (!localValue) {
    return 'Pick date and time';
  }

  const parsed = new Date(localValue);
  if (Number.isNaN(parsed.getTime())) {
    return localValue;
  }

  return parsed.toLocaleString(undefined, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function activeMentionQuery(value: string, cursor: number | null): string | null {
  if (cursor === null) {
    return null;
  }

  const beforeCursor = value.slice(0, cursor);
  const match = beforeCursor.match(/@([a-zA-Z0-9._-]*)$/);
  return match ? (match[1] ?? '') : null;
}

export function NewEventModal({
  open,
  onClose,
  onCreated,
  onDelete,
  onUnauthorized,
  conversationId = null,
  editEvent = null,
  initialDate = null,
  hubOptions = [],
  readOnly = false,
  viewerUserId = null,
  viewerUsername = null,
  viewerDisplayName = null,
  onCalendarResponse,
}: NewEventModalProps) {
  const isViewOnly = readOnly && Boolean(editEvent);
  const showCalendarInviteActions =
    isViewOnly &&
    editEvent &&
    (resolveEventCanRespond(editEvent, viewerUserId, viewerUsername, viewerDisplayName) ||
      editEvent.canRespond === true);
  const calendarInviteStatus = editEvent
    ? resolveMyEventResponse(editEvent, viewerUserId, viewerUsername, viewerDisplayName)
    : null;
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const [title, setTitle] = useState('');
  const [startsAtLocal, setStartsAtLocal] = useState(defaultEventDateTimeLocal());
  const [description, setDescription] = useState('');
  const [mentionUsers, setMentionUsers] = useState<CalendarMentionableUser[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [removedInviteeIds, setRemovedInviteeIds] = useState<string[]>([]);
  const [peopleQuery, setPeopleQuery] = useState('');
  const [hubQuery, setHubQuery] = useState('');
  const [selectedHubConversationIds, setSelectedHubConversationIds] = useState<string[]>([]);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const initialDateMs = initialDate?.getTime() ?? null;
  const hubOptionsRef = useRef(hubOptions);
  const inviteeSourceRef = useRef<CalendarEventItem | null>(null);
  const editEventRef = useRef(editEvent);
  editEventRef.current = editEvent;
  hubOptionsRef.current = hubOptions;

  const mergeInviteeFieldsFromSource = (
    source: Pick<CalendarEventItem, 'invitees' | 'mentionUserIds'>,
    mode: 'replace' | 'merge' = 'merge',
  ) => {
    const inviteeIdsFromEvent = (source.invitees ?? [])
      .map((invitee) => invitee.userId)
      .filter((id): id is string => Boolean(id));
    const initialSelectedIds = [
      ...new Set([...inviteeIdsFromEvent, ...(source.mentionUserIds ?? [])]),
    ];

    setSelectedUserIds((current) =>
      mode === 'replace'
        ? initialSelectedIds
        : [...new Set([...current, ...initialSelectedIds])],
    );

    if (mode === 'replace') {
      setRemovedInviteeIds([]);
    }

    const seedPeopleFromInvitees = (source.invitees ?? []).map((invitee, index) => {
      const username = invitee.username?.trim() || '';
      const name = invitee.name?.trim() || username || 'Teammate';
      const id =
        invitee.userId ??
        (username ? `invitee:${username.toLowerCase()}` : `invitee-${index}-${name.toLowerCase()}`);
      return { id, username: username || name, name };
    });

    for (const userId of source.mentionUserIds ?? []) {
      if (!userId || seedPeopleFromInvitees.some((person) => person.id === userId)) {
        continue;
      }
      seedPeopleFromInvitees.push({
        id: userId,
        username: 'member',
        name: 'Tagged member',
      });
    }

    setMentionUsers((current) => {
      const byId = new Map(current.map((person) => [person.id, person]));
      for (const person of seedPeopleFromInvitees) {
        byId.set(person.id, person);
      }
      return [...byId.values()];
    });
  };

  useLayoutEffect(() => {
    if (!open || !editEvent) {
      return;
    }

    const cached = readCalendarEventTagSnapshot(editEvent.id);
    const merged = mergeCalendarEventTagFields(editEvent, cached ?? undefined);
    inviteeSourceRef.current = merged;
    mergeInviteeFieldsFromSource(merged, 'replace');
  }, [open, editEvent?.id]);

  useEffect(() => {
    if (!open) {
      setMembersLoading(false);
      inviteeSourceRef.current = null;
      return;
    }

    let cancelled = false;
    const activeEditEvent = editEventRef.current;

    void (async () => {
      let eventForForm: CalendarEventItem | null = activeEditEvent;

      if (activeEditEvent) {
        const tags = await readCalendarEventTagSnapshotAsync(activeEditEvent.id);
        eventForForm = mergeCalendarEventTagFields(activeEditEvent, tags ?? undefined);
        inviteeSourceRef.current = eventForForm;
        if (!cancelled) {
          mergeInviteeFieldsFromSource(eventForForm, 'merge');
        }
      } else {
        inviteeSourceRef.current = null;
        if (!cancelled) {
          setSelectedUserIds([]);
          setRemovedInviteeIds([]);
          setMentionUsers([]);
        }
      }

      if (cancelled) {
        return;
      }

      setTitle(eventForForm?.title ?? '');

      if (eventForForm?.startsAt) {
        try {
          const d = new Date(eventForForm.startsAt);
          const localIso = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
            .toISOString()
            .slice(0, 16);
          setStartsAtLocal(localIso);
        } catch {
          setStartsAtLocal(defaultEventDateTimeLocal());
        }
      } else if (initialDate) {
        const now = new Date(Date.now() + 60 * 60 * 1000);
        const target = new Date(
          initialDate.getFullYear(),
          initialDate.getMonth(),
          initialDate.getDate(),
          now.getHours(),
          now.getMinutes(),
        );
        const pad = (value: number) => String(value).padStart(2, '0');
        setStartsAtLocal(
          `${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(target.getDate())}T${pad(target.getHours())}:${pad(target.getMinutes())}`,
        );
      } else {
        setStartsAtLocal(defaultEventDateTimeLocal());
      }

      setDescription(eventForForm?.description ?? eventForForm?.notes ?? '');

      if (activeEditEvent?.id) {
        const tags = await readCalendarEventTagSnapshotAsync(activeEditEvent.id);
        const detailResult = await loadCalendarEventById(activeEditEvent.id);

        if (!cancelled) {
          if (detailResult.ok) {
            eventForForm = mergeCalendarEventTagFields(
              detailResult.data,
              tags ?? undefined,
              activeEditEvent,
              eventForForm ?? undefined,
            );
          } else {
            eventForForm = mergeCalendarEventTagFields(
              activeEditEvent,
              tags ?? undefined,
              eventForForm ?? undefined,
            );
          }

          inviteeSourceRef.current = eventForForm;
          mergeInviteeFieldsFromSource(eventForForm, 'merge');
        }
      }

      const hubIdsFromEvent = [
        ...(eventForForm?.taggedHubs?.map((hub) => hub.conversationId).filter(Boolean) ?? []),
        eventForForm?.conversationId,
        !activeEditEvent && conversationId ? conversationId : null,
      ].filter((id): id is string => Boolean(id));
      setSelectedHubConversationIds([...new Set(hubIdsFromEvent)]);
      setPeopleQuery('');
      setHubQuery('');
      setMentionQuery(null);
      setError('');
      setMembersError('');
      setMembersLoading(true);

      const result = await loadCalendarMentionableUsers();
      let finalUsers: CalendarMentionableUser[] = [];

      if (!result.ok) {
        if (onUnauthorized(result.status)) {
          if (!cancelled) {
            setMembersLoading(false);
          }
          return;
        }

        if (!cancelled) {
          setMembersError(result.error);
        }
        const fallback = await loadOrganizationMembers();
        if (cancelled) {
          return;
        }
        if (fallback.ok) {
          finalUsers = fallback.data.map((member) => ({
            id: member.id,
            username: member.username,
            name: member.name,
          }));
        }
      } else if (result.data.length > 0) {
        finalUsers = result.data;
      } else {
        const fallback = await loadOrganizationMembers();
        if (cancelled) {
          return;
        }
        if (fallback.ok) {
          finalUsers = fallback.data.map((member) => ({
            id: member.id,
            username: member.username,
            name: member.name,
          }));
        }
      }

      if (cancelled) {
        return;
      }

      const inviteeSource = inviteeSourceRef.current ?? eventForForm ?? activeEditEvent;
      const { people, selectedUserIds: inviteeUserIds } = mergeCalendarPeopleWithInvitees(
        finalUsers,
        inviteeSource?.invitees,
      );
      const descriptionText = inviteeSource?.description ?? inviteeSource?.notes ?? '';
      const mentionIdsFromNotes = parseMentionUserIdsFromText(descriptionText, people);
      const hubIdsFromNotes = parseHubConversationIdsFromText(
        descriptionText,
        hubOptionsRef.current,
      );
      const selectedIds = [
        ...new Set([
          ...inviteeUserIds,
          ...mentionIdsFromNotes,
          ...(inviteeSource?.mentionUserIds ?? []),
        ]),
      ];

      setMentionUsers((current) => {
        const byId = new Map(current.map((person) => [person.id, person]));
        for (const person of people) {
          byId.set(person.id, person);
        }
        return [...byId.values()];
      });
      setSelectedUserIds((current) => [...new Set([...current, ...selectedIds])]);
      setSelectedHubConversationIds((current) => [...new Set([...current, ...hubIdsFromNotes])]);
      setMembersLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [conversationId, editEvent?.id, initialDateMs, open, onUnauthorized]);

  const displayedInvitees = useMemo(() => {
    const byId = new Map<string, CalendarMentionableUser>();

    for (const id of selectedUserIds) {
      if (!id || removedInviteeIds.includes(id)) {
        continue;
      }

      const fromPeople = mentionUsers.find((entry) => entry.id === id);
      byId.set(
        id,
        fromPeople ?? {
          id,
          username: 'member',
          name: 'Tagged member',
        },
      );
    }

    return [...byId.values()];
  }, [mentionUsers, removedInviteeIds, selectedUserIds]);

  const peopleSearchActive = peopleQuery.trim().length > 0;

  const selectedHubs = useMemo(
    () => hubOptions.filter((hub) => selectedHubConversationIds.includes(hub.conversationId)),
    [hubOptions, selectedHubConversationIds],
  );

  const displayedHubTags = useMemo(() => {
    if (selectedHubs.length > 0) {
      return selectedHubs;
    }

    if (!editEvent?.taggedHubs?.length) {
      return [];
    }

    return editEvent.taggedHubs.map((hub, index) => ({
      conversationId: hub.conversationId ?? `hub-tag-${index}`,
      channelId: hub.channelId ?? null,
      name: hub.name,
      slug: hub.slug ?? hub.name,
    }));
  }, [editEvent?.taggedHubs, selectedHubs]);

  const filteredHubs = useMemo(() => {
    const query = hubQuery.trim().toLowerCase();
    if (!query) {
      return [];
    }

    return hubOptions
      .filter((hub) => !selectedHubConversationIds.includes(hub.conversationId))
      .filter(
        (hub) =>
          hub.name.toLowerCase().includes(query) ||
          hub.slug.toLowerCase().includes(query),
      )
      .slice(0, 8);
  }, [hubOptions, hubQuery, selectedHubConversationIds]);

  const filteredPeople = useMemo(() => {
    const query = peopleQuery.trim().toLowerCase();
    if (!query) {
      return [];
    }

    return mentionUsers
      .filter((user) => !selectedUserIds.includes(user.id))
      .filter(
        (user) =>
          user.name.toLowerCase().includes(query) ||
          user.username.toLowerCase().includes(query),
      )
      .slice(0, 8);
  }, [mentionUsers, peopleQuery, selectedUserIds]);

  const mentionSuggestions = useMemo(() => {
    if (mentionQuery === null) {
      return [];
    }

    const query = mentionQuery.toLowerCase();
    return mentionUsers
      .filter((user) => !selectedUserIds.includes(user.id))
      .filter(
        (user) =>
          user.username.toLowerCase().includes(query) ||
          user.name.toLowerCase().includes(query),
      )
      .slice(0, 6);
  }, [mentionQuery, mentionUsers, selectedUserIds]);

  const viewNotes = description.trim();
  const viewHubNames = displayedHubTags.map((hub) => hub.name);
  const organizerLabel =
    editEvent?.sharedBy?.trim() ||
    (editEvent?.conversationName ? `Hub: ${editEvent.conversationName}` : '');

  if (!open) {
    return null;
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError('Enter an event title.');
      return;
    }

    const startsAt = dateTimeLocalToIso(startsAtLocal);
    if (!isEventAtLeastOneMinuteFromNow(startsAt)) {
      setError('Events must be at least 1 minute from now.');
      return;
    }

    // Match web CreateCalendarEventModal: invitees are mentionUserIds only.
    const mentionUserIds = [
      ...new Set(
        selectedUserIds.filter(
          (id) => id && !id.startsWith('invitee:') && !id.startsWith('invitee-'),
        ),
      ),
    ];
    const hubConversationIds = mergeHubConversationIds(
      description,
      hubOptions,
      selectedHubConversationIds,
    );
    const mentionChannelIds = channelIdsForHubConversations(hubConversationIds, hubOptions);
    const primaryConversationId =
      hubConversationIds[0] ?? conversationId ?? editEvent?.conversationId ?? undefined;

    setSaving(true);
    let result;
    
    if (editEvent) {
      const { updateCalendarEvent } = await import('../extrasApi');
      result = await updateCalendarEvent({
        eventId: editEvent.id,
        title: trimmedTitle,
        startsAt,
        description: description.trim(),
        mentionUserIds,
        conversationId: primaryConversationId ?? null,
        conversationIds: hubConversationIds,
        mentionChannelIds,
      });
    } else {
      result = await createCalendarEvent({
        title: trimmedTitle,
        startsAt,
        description: description.trim(),
        mentionUserIds,
        conversationId: primaryConversationId,
        conversationIds: hubConversationIds,
        mentionChannelIds,
      });
    }
    
    setSaving(false);

    if (!result.ok) {
      if (onUnauthorized(result.status)) {
        return;
      }
      setError(result.error);
      return;
    }

    const eventId = result.data.id || editEvent?.id;
    if (!eventId) {
      setError('Event saved but the app did not receive an event id.');
      return;
    }

    const invitees = buildCalendarInviteesFromMentionUsers(selectedUserIds, mentionUsers);
    const savedEvent = mergeCalendarEventTagFields(
      { ...result.data, id: eventId },
      { mentionUserIds, invitees },
    );
    await writeCalendarEventTagSnapshotAsync(eventId, {
      mentionUserIds,
      invitees,
    });

    onCreated(savedEvent as CalendarEventItem);
    onClose();
  };

  const addPerson = (user: CalendarMentionableUser) => {
    setMentionUsers((current) => {
      if (current.some((entry) => entry.id === user.id)) {
        return current;
      }
      return [...current, user];
    });
    setSelectedUserIds((current) => (current.includes(user.id) ? current : [...current, user.id]));
    setPeopleQuery('');
  };

  const removePerson = (userId: string) => {
    setSelectedUserIds((current) => current.filter((id) => id !== userId));
    setRemovedInviteeIds((current) =>
      current.includes(userId) ? current : [...current, userId],
    );
  };

  const addHub = (hub: CalendarHubOption) => {
    setSelectedHubConversationIds((current) =>
      current.includes(hub.conversationId) ? current : [...current, hub.conversationId],
    );
    setHubQuery('');
  };

  const removeHub = (hubConversationId: string) => {
    setSelectedHubConversationIds((current) =>
      current.filter((id) => id !== hubConversationId),
    );
  };

  const insertMention = (user: CalendarMentionableUser) => {
    const textarea = notesRef.current;
    const cursor = textarea?.selectionStart ?? description.length;
    const beforeCursor = description.slice(0, cursor);
    const afterCursor = description.slice(cursor);
    const updatedBefore = beforeCursor.replace(/@([a-zA-Z0-9._-]*)$/, `@${user.username} `);
    const nextValue = `${updatedBefore}${afterCursor}`;

    setDescription(nextValue);
    setMentionQuery(null);
    addPerson(user);

    requestAnimationFrame(() => {
      const nextCursor = updatedBefore.length + 1;
      textarea?.focus();
      textarea?.setSelectionRange(nextCursor, nextCursor);
    });
  };

  const updateDescription = (value: string, cursor: number | null) => {
    setDescription(value);
    setMentionQuery(activeMentionQuery(value, cursor));
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4 sm:p-6 backdrop-blur-md animate-fade-in">
      <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-app-border bg-app-surface backdrop-blur-2xl p-6 sm:p-8 shadow-2xl animate-pop-in origin-center">
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-app-border-strong to-transparent pointer-events-none" />

        <div className="mb-5 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-accent text-white shadow-md shadow-accent/20">
              <CalendarNavIcon className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-app-text tracking-tight">
                {isViewOnly ? 'View event' : editEvent ? 'Edit event' : 'New event'}
              </h2>
              <p className="text-xs text-app-muted">
                {isViewOnly
                  ? 'You were invited to this event — only the organizer can edit it.'
                  : 'Schedule an event or deadline'}
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-xl text-app-muted transition-colors hover:bg-app-inset hover:text-app-text"
            onClick={onClose}
          >
            <FiX className="text-base" />
          </button>
        </div>

        <form
          onSubmit={(event) => {
            if (isViewOnly) {
              event.preventDefault();
              return;
            }
            void handleSubmit(event);
          }}
          className="space-y-4"
        >
          {isViewOnly ? (
            <>
              <div className="rounded-2xl border border-app-border bg-app-card p-4 space-y-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-app-muted">
                    Event
                  </p>
                  <p className="mt-1 text-lg font-semibold text-app-text">{title.trim() || 'Untitled event'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-app-muted">
                    When
                  </p>
                  <p className="mt-1 text-sm text-app-text">{formatWhenLabel(startsAtLocal)}</p>
                </div>
                {organizerLabel ? (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-app-muted">
                      Organizer
                    </p>
                    <p className="mt-1 text-sm text-app-text">{organizerLabel}</p>
                  </div>
                ) : null}
              </div>

              {(editEvent?.invitees?.length ?? 0) > 0 ? (
                <div className="rounded-2xl border border-app-border bg-app-card p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-app-muted">
                    Shared with
                  </p>
                  <CalendarSharedInviteeAvatars invitees={editEvent?.invitees ?? []} />
                </div>
              ) : null}

              {viewHubNames.length > 0 ? (
                <div className="rounded-2xl border border-app-border bg-app-card p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-app-muted">
                    Hubs
                  </p>
                  <p className="mt-2 text-sm text-app-text">{viewHubNames.join(', ')}</p>
                </div>
              ) : null}

              {viewNotes ? (
                <div className="rounded-2xl border border-app-border bg-app-card p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-app-muted">
                    Notes
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-app-text">{viewNotes}</p>
                </div>
              ) : null}

              {isViewOnly &&
              editEvent &&
              (showCalendarInviteActions ||
                calendarInviteStatus === 'ACCEPTED' ||
                calendarInviteStatus === 'DECLINED') ? (
                <CalendarEventInviteActions
                  eventId={editEvent.id}
                  responseStatus={calendarInviteStatus}
                  onComplete={onCalendarResponse}
                  onUnauthorized={onUnauthorized}
                />
              ) : null}
            </>
          ) : (
            <>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-app-muted">
                  Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Team sync, deadline, reminder..."
                  className="w-full rounded-xl border border-app-border bg-app-surface-input px-3.5 py-2.5 text-sm text-app-text outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-app-muted">
                  When
                </label>
                <div className="relative overflow-hidden rounded-xl border border-app-border bg-app-surface-input focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20">
                  <div className="pointer-events-none flex w-full items-stretch" aria-hidden>
                    <span className="min-w-0 flex-1 px-3.5 py-2.5 text-sm text-app-text">
                      {formatWhenLabel(startsAtLocal)}
                    </span>
                    <span className="flex shrink-0 items-center border-l border-app-border px-3.5 text-app-muted">
                      <CalendarNavIcon className="h-4 w-4" />
                    </span>
                  </div>
                  <input
                    type="datetime-local"
                    value={startsAtLocal}
                    onChange={(event) => setStartsAtLocal(event.target.value)}
                    aria-label="Event date and time"
                    className="datetime-input absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
                  />
                </div>
                <p className="mt-1.5 text-xs text-app-muted">
                  Events must be at least 1 minute from now.
                </p>
              </div>

              <div>
                <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-app-muted">
                  Tag people
                </label>
                <div className="rounded-2xl border border-app-border bg-app-card p-3.5">
                  <div className="relative">
                    <FiSearch className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-app-muted" />
                    <input
                      type="text"
                      value={peopleQuery}
                      onChange={(event) => setPeopleQuery(event.target.value)}
                      placeholder="Search teammates to invite..."
                      className="w-full rounded-full border border-app-border bg-app-surface-input py-2.5 pr-3 pl-9 text-xs text-app-text outline-none focus:border-accent focus:ring-1 focus:ring-accent/20"
                    />
                  </div>

                  <div className="mt-3 min-h-8 flex flex-wrap gap-2">
                    {displayedInvitees.map((user) => (
                      <span
                        key={user.id}
                        className="inline-flex items-center gap-2 rounded-full border border-accent/35 bg-accent/15 px-3 py-1.5 text-xs font-medium text-app-text"
                      >
                        <FiUserPlus className="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden="true" />
                        @{user.username || user.name}
                        <button
                          type="button"
                          aria-label={`Remove ${user.name}`}
                          className="text-accent hover:text-accent-hover transition-colors"
                          onClick={() => removePerson(user.id)}
                        >
                          <FiX className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>

                  <p className="mt-3 text-xs text-app-muted">
                    Only tagged people will see this event besides you.
                  </p>

                  {membersError ? (
                    <p className="mt-2 text-xs text-accent-soft">{membersError}</p>
                  ) : null}

                  {peopleSearchActive && membersLoading ? (
                    <p className="mt-2 text-xs text-app-muted">Loading teammates…</p>
                  ) : null}

                  {peopleSearchActive && !membersLoading && filteredPeople.length > 0 ? (
                    <div className="mt-2 overflow-hidden rounded-xl border border-app-border bg-app-card">
                      {filteredPeople.map((user) => (
                        <button
                          key={user.id}
                          type="button"
                          className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs hover:bg-app-inset transition-colors"
                          onClick={() => addPerson(user)}
                        >
                          <FiUserPlus className="h-3.5 w-3.5 text-accent-soft" />
                          <span className="font-semibold text-app-text">{user.name}</span>
                          <span className="text-app-muted">@{user.username}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>

              {hubOptions.length > 0 ? (
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-app-muted">
                    Tag hubs
                  </label>
                  <div className="rounded-2xl border border-app-border bg-app-card p-3.5">
                    <div className="relative">
                      <FiSearch className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-app-muted" />
                      <input
                        type="text"
                        value={hubQuery}
                        onChange={(event) => setHubQuery(event.target.value)}
                        placeholder="Search hubs to tag..."
                        className="w-full rounded-xl border border-app-border bg-app-surface-input py-2.5 pr-3 pl-9 text-xs text-app-text outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-all"
                      />
                    </div>

                    {displayedHubTags.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {displayedHubTags.map((hub) => (
                          <span
                            key={hub.conversationId}
                            className="inline-flex items-center gap-2 rounded-full border border-violet-500/35 bg-violet-500/15 px-3 py-1.5 text-xs font-medium text-app-text"
                          >
                            <span className="text-violet-400" aria-hidden="true">
                              #
                            </span>
                            {hub.name}
                            <button
                              type="button"
                              aria-label={`Remove ${hub.name}`}
                              className="text-violet-400 hover:text-violet-300 transition-colors"
                              onClick={() => removeHub(hub.conversationId)}
                            >
                              <FiX className="h-3.5 w-3.5" />
                            </button>
                          </span>
                        ))}
                      </div>
                    ) : null}

                    <p className="mt-3 text-xs text-app-muted">
                      Tagged hubs see this event on their calendar. You can also type #hub-name in notes.
                    </p>

                    {filteredHubs.length > 0 ? (
                      <div className="mt-2 overflow-hidden rounded-xl border border-app-border bg-app-card">
                        {filteredHubs.map((hub) => (
                          <button
                            key={hub.conversationId}
                            type="button"
                            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs hover:bg-app-inset transition-colors"
                            onClick={() => addHub(hub)}
                          >
                            <span className="font-semibold text-violet-400">#</span>
                            <span className="font-semibold text-app-text">{hub.name}</span>
                            <span className="text-app-muted">@{hub.slug}</span>
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}

              <div className="relative">
                <label className="mb-1.5 block text-xs font-medium text-app-muted">
                  Notes
                </label>
                <textarea
                  ref={notesRef}
                  value={description}
                  onChange={(event) =>
                    updateDescription(event.target.value, event.target.selectionStart)
                  }
                  onClick={(event) =>
                    updateDescription(
                      event.currentTarget.value,
                      event.currentTarget.selectionStart,
                    )
                  }
                  onKeyUp={(event) =>
                    updateDescription(
                      event.currentTarget.value,
                      event.currentTarget.selectionStart,
                    )
                  }
                  placeholder="Private notes... Use @name to share with a teammate"
                  rows={3}
                  className="w-full resize-none rounded-xl border border-app-border bg-app-surface-input px-3.5 py-2.5 text-sm text-app-text outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
                />
                {mentionSuggestions.length > 0 ? (
                  <div className="absolute right-0 bottom-full left-0 z-10 mb-1 rounded-2xl border border-app-border bg-app-surface backdrop-blur-xl p-1 shadow-xl">
                    {mentionSuggestions.map((user) => (
                      <button
                        key={user.id}
                        type="button"
                        className="flex w-full px-3 py-2 text-left text-xs hover:bg-app-inset rounded-xl transition-colors"
                        onClick={() => insertMention(user)}
                      >
                        <span className="font-semibold text-app-text">{user.name}</span>
                        <span className="ml-2 text-app-muted">@{user.username}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
                <p className="mt-1.5 text-xs text-app-muted">
                  Teammates you add or @mention will be notified and see this event on their calendar.
                </p>
              </div>
            </>
          )}

          {error ? <p className="text-xs text-accent-soft font-medium">{error}</p> : null}

          <div className="flex justify-between items-center pt-3 w-full">
            <div>
              {editEvent && onDelete && !isViewOnly ? (
                <button
                  type="button"
                  className="rounded-xl px-3 py-2 text-xs font-semibold text-accent hover:bg-accent/10 transition-colors"
                  onClick={onDelete}
                  disabled={saving}
                >
                  Delete event
                </button>
              ) : null}
            </div>
            <div className="flex gap-2.5">
              <button
                type="button"
                className="rounded-xl border border-app-border bg-app-card px-4 py-2 text-xs font-semibold text-app-text hover:bg-app-inset transition-colors disabled:opacity-50"
                onClick={onClose}
                disabled={saving}
              >
                {isViewOnly ? 'Close' : 'Cancel'}
              </button>
              {!isViewOnly ? (
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-white shadow-md shadow-accent/20 hover:bg-accent-hover active:scale-[0.98] disabled:opacity-60 transition-all"
                >
                  {saving ? 'Saving…' : editEvent ? 'Save event' : 'Create event'}
                </button>
              ) : null}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
