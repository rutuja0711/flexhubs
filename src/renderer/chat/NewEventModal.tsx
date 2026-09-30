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
  onDelete?: () => void;
  onUnauthorized: (status?: number) => boolean;
  conversationId?: string | null;
  editEvent?: import('../../shared/features').CalendarEventItem | null;
  initialDate?: Date | null;
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
  onDelete,
  onUnauthorized,
  conversationId = null,
  editEvent = null,
  initialDate = null,
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

    setTitle(editEvent?.title ?? '');
    
    if (editEvent?.startsAt) {
      try {
        const d = new Date(editEvent.startsAt);
        const localIso = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        setStartsAtLocal(localIso);
      } catch {
        setStartsAtLocal(defaultEventDateTimeLocal());
      }
    } else if (initialDate) {
      const now = new Date(Date.now() + 60 * 60 * 1000);
      const target = new Date(initialDate.getFullYear(), initialDate.getMonth(), initialDate.getDate(), now.getHours(), now.getMinutes());
      const pad = (value: number) => String(value).padStart(2, '0');
      setStartsAtLocal(`${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(target.getDate())}T${pad(target.getHours())}:${pad(target.getMinutes())}`);
    } else {
      setStartsAtLocal(defaultEventDateTimeLocal());
    }
    
    setDescription(editEvent?.description ?? '');
    
    const inviteeIds = editEvent?.invitees?.map(i => i.userId).filter((id): id is string => id !== null) ?? [];
    setSelectedUserIds(inviteeIds);
    setPeopleQuery('');
    setMentionQuery(null);
    setError('');
    setMembersError('');
    void loadCalendarMentionableUsers().then(async (result) => {
      let finalUsers: CalendarMentionableUser[] = [];
      
      if (!result.ok) {
        if (onUnauthorized(result.status)) {
          setMembersLoading(false);
          return;
        }

        setMembersError(result.error);
        const fallback = await loadOrganizationMembers();
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
        if (fallback.ok) {
          finalUsers = fallback.data.map((member) => ({
            id: member.id,
            username: member.username,
            name: member.name,
          }));
        }
      }

      setMentionUsers(finalUsers);
      setMembersLoading(false);

      if (editEvent?.invitees) {
        const ids = editEvent.invitees.map(inv => {
          if (inv.userId) return inv.userId;
          const found = finalUsers.find(u => u.username === inv.username || u.name === inv.name);
          return found?.id;
        }).filter((id): id is string => !!id);
        
        // Only set if we found IDs to avoid clearing already selected ones
        if (ids.length > 0) {
          setSelectedUserIds(prev => Array.from(new Set([...prev, ...ids])));
        }
      }
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
    let result;
    
    if (editEvent) {
      const { updateCalendarEvent } = await import('../extrasApi');
      result = await updateCalendarEvent({
        eventId: editEvent.id,
        title: trimmedTitle,
        startsAt,
        description: description.trim(),
        mentionUserIds,
      });
    } else {
      result = await createCalendarEvent({
        title: trimmedTitle,
        startsAt,
        description: description.trim(),
        mentionUserIds,
        conversationId: conversationId ?? undefined,
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
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4 sm:p-6 backdrop-blur-md animate-fade-in">
      <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-app-border bg-app-surface backdrop-blur-2xl p-6 sm:p-8 shadow-2xl animate-pop-in origin-center">
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-app-border-strong to-transparent pointer-events-none" />

        <div className="mb-5 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-accent text-white shadow-md shadow-accent/20">
              <CalendarNavIcon className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-app-text tracking-tight">{editEvent ? 'Edit event' : 'New event'}</h2>
              <p className="text-xs text-app-muted">Schedule an event or deadline</p>
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

        <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
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
            <div className="relative">
              <input
                type="datetime-local"
                value={startsAtLocal}
                onChange={(event) => setStartsAtLocal(event.target.value)}
                className="datetime-input w-full rounded-xl border border-app-border bg-app-surface-input px-3.5 py-2.5 pr-10 text-sm text-app-text outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
              />
              <CalendarNavIcon className="pointer-events-none absolute top-1/2 right-3.5 h-4 w-4 -translate-y-1/2 text-app-muted" />
            </div>
            <p className="mt-1.5 text-xs text-app-muted">Events must be at least 1 minute from now.</p>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-app-muted">
              Share with
            </label>
            <div className="rounded-2xl border border-app-border bg-app-card p-3.5">
              {selectedUsers.length > 0 ? (
                <div className="mb-3 flex flex-wrap gap-2">
                  {selectedUsers.map((user) => (
                    <span
                      key={user.id}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-app-border bg-app-card px-2.5 py-1 text-xs text-app-text font-medium shadow-xs"
                    >
                      {user.name}
                      <button
                        type="button"
                        aria-label={`Remove ${user.name}`}
                        className="text-app-muted hover:text-accent-soft transition-colors"
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
                  className="w-full rounded-xl border border-app-border bg-app-surface-input py-2 pr-3 pl-9 text-xs text-app-text outline-none focus:border-accent transition-all"
                />
              </div>

              {membersLoading ? (
                <p className="mt-3 text-xs text-app-muted">Loading teammates...</p>
              ) : null}
              {!membersLoading && membersError ? (
                <p className="mt-3 text-xs text-accent-soft">{membersError}</p>
              ) : null}
              {!membersLoading && filteredPeople.length > 0 ? (
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

          {error ? <p className="text-xs text-accent-soft font-medium">{error}</p> : null}

          <div className="flex justify-between items-center pt-3 w-full">
            <div>
              {editEvent && onDelete && (
                <button
                  type="button"
                  className="rounded-xl px-3 py-2 text-xs font-semibold text-accent hover:bg-accent/10 transition-colors"
                  onClick={onDelete}
                  disabled={saving}
                >
                  Delete event
                </button>
              )}
            </div>
            <div className="flex gap-2.5">
              <button
                type="button"
                className="rounded-xl border border-app-border bg-app-card px-4 py-2 text-xs font-semibold text-app-text hover:bg-app-inset transition-colors disabled:opacity-50"
                onClick={onClose}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-white shadow-md shadow-accent/20 hover:bg-accent-hover active:scale-[0.98] disabled:opacity-60 transition-all"
              >
                {saving ? 'Saving…' : editEvent ? 'Save event' : 'Create event'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
