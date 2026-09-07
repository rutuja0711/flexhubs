import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { FiSearch, FiUserPlus, FiX } from 'react-icons/fi';
import type { CalendarMentionableUser } from '../../shared/extras';
import {
  dateTimeLocalToIso,
  defaultEventDateTimeLocal,
  isEventAtLeastOneMinuteFromNow,
  mergeMentionUserIds,
} from '../../shared/extras';
import { loadOrganizationMembers } from '../chatApi';
import { createCalendarEvent, loadCalendarMentionableUsers } from '../extrasApi';
import { CalendarNavIcon } from './ChatIcons';

type NewEventModalProps = {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  onUnauthorized: (status?: number) => boolean;
  conversationId?: string | null;
};

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
  onUnauthorized,
  conversationId = null,
}: NewEventModalProps) {
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const [title, setTitle] = useState('');
  const [startsAtLocal, setStartsAtLocal] = useState(defaultEventDateTimeLocal());
  const [description, setDescription] = useState('');
  const [mentionUsers, setMentionUsers] = useState<CalendarMentionableUser[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [peopleQuery, setPeopleQuery] = useState('');
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) {
      return;
    }

    setTitle('');
    setStartsAtLocal(defaultEventDateTimeLocal());
    setDescription('');
    setSelectedUserIds([]);
    setPeopleQuery('');
    setMentionQuery(null);
    setError('');
    setMembersError('');
    setMembersLoading(true);

    void loadCalendarMentionableUsers().then(async (result) => {
      if (!result.ok) {
        if (onUnauthorized(result.status)) {
          setMembersLoading(false);
          return;
        }

        setMembersError(result.error);
      } else if (result.data.length > 0) {
        setMentionUsers(result.data);
        setMembersLoading(false);
        return;
      }

      const fallback = await loadOrganizationMembers();
      setMembersLoading(false);

      if (!fallback.ok) {
        if (onUnauthorized(fallback.status)) {
          return;
        }
        setMembersError(fallback.error);
        return;
      }

      setMentionUsers(
        fallback.data.map((member) => ({
          id: member.id,
          username: member.username,
          name: member.name,
        })),
      );
    });
  }, [open, onUnauthorized]);

  const selectedUsers = useMemo(
    () => mentionUsers.filter((user) => selectedUserIds.includes(user.id)),
    [mentionUsers, selectedUserIds],
  );

  const filteredPeople = useMemo(() => {
    const query = peopleQuery.trim().toLowerCase();
    return mentionUsers
      .filter((user) => !selectedUserIds.includes(user.id))
      .filter((user) => {
        if (!query) {
          return true;
        }

        return (
          user.name.toLowerCase().includes(query) ||
          user.username.toLowerCase().includes(query)
        );
      })
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

    const mentionUserIds = mergeMentionUserIds(description, mentionUsers, selectedUserIds);

    setSaving(true);
    const result = await createCalendarEvent({
      title: trimmedTitle,
      startsAt,
      description: description.trim(),
      mentionUserIds,
      conversationId: conversationId ?? undefined,
    });
    setSaving(false);

    if (!result.ok) {
      if (onUnauthorized(result.status)) {
        return;
      }
      setError(result.error);
      return;
    }

    onCreated();
    onClose();
  };

  const addPerson = (user: CalendarMentionableUser) => {
    setSelectedUserIds((current) => (current.includes(user.id) ? current : [...current, user.id]));
    setPeopleQuery('');
  };

  const removePerson = (userId: string) => {
    setSelectedUserIds((current) => current.filter((id) => id !== userId));
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
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-6">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-app-border bg-app-inset p-6 shadow-xl">
        <div className="mb-5 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/20 text-accent">
              <CalendarNavIcon className="h-5 w-5" />
            </div>
            <h2 className="text-lg font-bold text-app-text">New event</h2>
          </div>
          <button
            type="button"
            aria-label="Close"
            className="rounded-lg p-2 text-app-muted hover:bg-app-chat-hover hover:text-app-text"
            onClick={onClose}
          >
            <FiX />
          </button>
        </div>

        <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
          <div>
            <label className="mb-2 block text-[11px] font-semibold tracking-wide text-app-muted uppercase">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Team sync, deadline, reminder..."
              className="w-full rounded-xl border border-accent bg-app-surface-input px-3.5 py-3 text-sm text-app-text outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-[11px] font-semibold tracking-wide text-app-muted uppercase">
              When
            </label>
            <div className="relative">
              <input
                type="datetime-local"
                value={startsAtLocal}
                onChange={(event) => setStartsAtLocal(event.target.value)}
                className="datetime-input w-full rounded-xl border border-app-border bg-app-surface-input px-3.5 py-3 pr-10 text-sm text-app-text outline-none"
              />
              <CalendarNavIcon className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-app-muted" />
            </div>
            <p className="mt-2 text-xs text-app-muted">Events must be at least 1 minute from now.</p>
          </div>

          <div>
            <label className="mb-2 block text-[11px] font-semibold tracking-wide text-app-muted uppercase">
              Share with
            </label>
            <div className="rounded-xl border border-app-border bg-app-surface-input p-3">
              {selectedUsers.length > 0 ? (
                <div className="mb-3 flex flex-wrap gap-2">
                  {selectedUsers.map((user) => (
                    <span
                      key={user.id}
                      className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2.5 py-1 text-xs text-accent"
                    >
                      {user.name}
                      <button
                        type="button"
                        aria-label={`Remove ${user.name}`}
                        className="rounded-full p-0.5 hover:bg-app-chat-hover"
                        onClick={() => removePerson(user.id)}
                      >
                        <FiX className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mb-3 text-xs text-app-muted">
                  Only you see this event until you add teammates.
                </p>
              )}

              <div className="relative">
                <FiSearch className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-app-muted" />
                <input
                  type="text"
                  value={peopleQuery}
                  onChange={(event) => setPeopleQuery(event.target.value)}
                  placeholder="Search teammates to invite"
                  className="w-full rounded-lg border border-app-border bg-app-elevated py-2 pr-3 pl-9 text-sm text-app-text outline-none"
                />
              </div>

              {membersLoading ? (
                <p className="mt-3 text-xs text-app-muted">Loading teammates...</p>
              ) : null}
              {!membersLoading && membersError ? (
                <p className="mt-3 text-xs text-accent-soft">{membersError}</p>
              ) : null}
              {!membersLoading && filteredPeople.length > 0 ? (
                <div className="mt-2 overflow-hidden rounded-lg border border-app-border">
                  {filteredPeople.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-app-chat-hover"
                      onClick={() => addPerson(user)}
                    >
                      <FiUserPlus className="h-4 w-4 text-accent-soft" />
                      <span className="font-medium text-app-text">{user.name}</span>
                      <span className="text-app-muted">@{user.username}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <div className="relative">
            <label className="mb-2 block text-[11px] font-semibold tracking-wide text-app-muted uppercase">
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
              rows={4}
              className="w-full resize-none rounded-xl border border-app-border bg-app-surface-input px-3.5 py-3 text-sm text-app-text outline-none"
            />
            {mentionSuggestions.length > 0 ? (
              <div className="absolute right-0 bottom-full left-0 z-10 mb-1 rounded-xl border border-app-border bg-app-elevated py-1 shadow-lg">
                {mentionSuggestions.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    className="flex w-full px-3 py-2 text-left text-sm hover:bg-app-chat-hover"
                    onClick={() => insertMention(user)}
                  >
                    <span className="font-medium text-app-text">{user.name}</span>
                    <span className="ml-2 text-app-muted">@{user.username}</span>
                  </button>
                ))}
              </div>
            ) : null}
            <p className="mt-2 text-xs text-app-muted">
              Teammates you add or @mention will be notified and see this event on their calendar.
            </p>
          </div>

          {error ? <p className="text-sm text-accent-soft">{error}</p> : null}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              className="rounded-xl border border-app-border px-4 py-2.5 text-sm font-semibold text-app-text hover:bg-app-chat-hover"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
