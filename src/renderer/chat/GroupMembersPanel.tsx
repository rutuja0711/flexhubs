import { useCallback, useEffect, useMemo, useState } from 'react';
import { FiUserMinus, FiUserPlus, FiX } from 'react-icons/fi';
import type { ConversationItem } from '../../shared/chat';
import {
  addConversationMembers,
  removeConversationMember,
  loadUserSearch,
  updateMemberRole,
} from '../chatApi';
import { useConfirm } from '../ui/ConfirmDialog';
import { useToast } from '../ui/Toast';
import { ConversationSharedFiles } from './ConversationSharedFiles';

type GroupMembersPanelProps = {
  conversation: ConversationItem;
  conversationDetails?: Record<string, unknown> | null;
  currentUserId: string | null;
  onClose: () => void;
  onConversationUpdated: () => void;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  return value as Record<string, unknown>;
}

function extractMembers(
  details: Record<string, unknown> | null,
): Array<{ id: string; name: string; role: string }> {
  if (!details) {
    return [];
  }

  const raw =
    (Array.isArray(details.members) && details.members) ||
    (Array.isArray(details.groupMembers) && details.groupMembers) ||
    [];

  return raw
    .map(asRecord)
    .filter((item): item is Record<string, unknown> => item !== null)
    .map((member) => {
      const user = asRecord(member.user);
      const id =
        (typeof user?.id === 'string' && user.id) ||
        (typeof member.userId === 'string' && member.userId) ||
        (typeof member.id === 'string' && member.id) ||
        '';
      const name =
        (typeof user?.username === 'string' && user.username) ||
        (typeof member.username === 'string' && member.username) ||
        (typeof user?.name === 'string' && user.name) ||
        'Member';
      const role = String(member.role ?? 'MEMBER').toUpperCase();

      return { id, name, role };
    })
    .filter((member) => member.id);
}

const MEMBER_ROLES = ['MEMBER', 'ADMIN'] as const;

function resolveIsAdmin(details: Record<string, unknown> | null, currentUserId: string | null): boolean {
  if (!details || !currentUserId) {
    return false;
  }

  if (details.isAdmin === true || details.isOwner === true) {
    return true;
  }

  const myRole = String(details.myRole ?? details.role ?? '').toUpperCase();
  if (myRole === 'ADMIN' || myRole.includes('FOUNDER') || myRole.includes('OWNER')) {
    return true;
  }

  return extractMembers(details).some(
    (member) =>
      member.id === currentUserId &&
      (member.role === 'ADMIN' || member.role.includes('FOUNDER') || member.role.includes('OWNER')),
  );
}

export function GroupMembersPanel({
  conversation,
  conversationDetails = null,
  currentUserId,
  onClose,
  onConversationUpdated,
}: GroupMembersPanelProps) {
  const toast = useToast();
  const confirm = useConfirm();
  const [members, setMembers] = useState<Array<{ id: string; name: string; role: string }>>([]);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ id: string; name: string }>>([]);
  const [searching, setSearching] = useState(false);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const isAdmin = useMemo(
    () => resolveIsAdmin(conversationDetails, currentUserId),
    [conversationDetails, currentUserId],
  );

  useEffect(() => {
    setMembers(extractMembers(conversationDetails));
  }, [conversationDetails]);

  const memberIds = useMemo(() => new Set(members.map((member) => member.id)), [members]);

  const runSearch = useCallback(async (value: string) => {
    const trimmed = value.trim();
    if (trimmed.length < 2) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    const result = await loadUserSearch(trimmed);
    setSearching(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    setSearchResults(
      result.data
        .filter((person) => !memberIds.has(person.id))
        .map((person) => ({ id: person.id, name: person.username || person.name }))
        .slice(0, 8),
    );
  }, [memberIds, toast]);

  const handleAddMember = async (userId: string) => {
    setAdding(true);
    const result = await addConversationMembers(conversation.id, [userId]);
    setAdding(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success('Member added.');
    setQuery('');
    setSearchResults([]);
    onConversationUpdated();
  };

  const handleRemoveMember = async (userId: string, name: string) => {
    const confirmed = await confirm({
      title: 'Remove member',
      message: `Remove ${name} from this group?`,
      confirmLabel: 'Remove',
      tone: 'danger',
    });

    if (!confirmed) {
      return;
    }

    setBusyUserId(userId);
    const result = await removeConversationMember(conversation.id, userId);
    setBusyUserId(null);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success('Member removed.');
    onConversationUpdated();
  };

  const handleRoleChange = async (userId: string, nextRole: string) => {
    setBusyUserId(userId);
    const result = await updateMemberRole(conversation.id, userId, nextRole);
    setBusyUserId(null);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success('Member role updated.');
    onConversationUpdated();
  };

  return (
    <div className="flex h-full w-[360px] shrink-0 flex-col border-l border-app-border/70 bg-app-surface/95 backdrop-blur-xl font-sans text-app-text shadow-2xl">
      <header className="flex items-center justify-between border-b border-app-border/50 px-5 py-4">
        <div className="min-w-0 flex-1">
          <span className="block text-[10px] font-bold tracking-wider text-app-muted uppercase">Group Info</span>
          <h2 className="truncate text-base font-semibold text-app-text tracking-tight">{conversation.title}</h2>
          <p className="mt-0.5 text-xs text-app-muted">{members.length} members</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-xl text-app-muted transition-colors hover:bg-app-inset hover:text-app-text"
          aria-label="Close group panel"
        >
          <FiX className="text-base" />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <ConversationSharedFiles conversationId={conversation.id} />

        <div className="p-5">
        {isAdmin ? (
          <section className="mb-6">
            <span className="mb-2 block text-[10px] font-bold tracking-wider text-app-muted uppercase">Add members</span>
            <input
              type="text"
              value={query}
              placeholder="Search people..."
              className="mb-2 w-full rounded-xl border border-app-border/70 bg-app-surface-input px-3.5 py-2.5 text-sm text-app-text outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
              onChange={(event) => {
                const next = event.target.value;
                setQuery(next);
                void runSearch(next);
              }}
            />
            {searching ? <p className="text-xs text-app-muted">Searching...</p> : null}
            {searchResults.length > 0 ? (
              <div className="space-y-2 mt-2">
                {searchResults.map((person) => (
                  <button
                    key={person.id}
                    type="button"
                    disabled={adding}
                    className="flex w-full items-center justify-between rounded-2xl border border-app-border/60 bg-app-card/60 px-3.5 py-2.5 text-left text-sm hover:bg-app-card hover:border-app-border disabled:opacity-50 transition-all"
                    onClick={() => void handleAddMember(person.id)}
                  >
                    <span className="truncate text-app-text font-medium">{person.name}</span>
                    <FiUserPlus className="shrink-0 text-accent-soft" />
                  </button>
                ))}
              </div>
            ) : null}
          </section>
        ) : null}

        <section>
          <span className="mb-3 block text-[10px] font-bold tracking-wider text-app-muted uppercase">Members</span>
          {members.length === 0 ? (
            <p className="text-xs text-app-muted">No members loaded yet.</p>
          ) : (
            <div className="space-y-2">
              {members.map((member) => {
                const isSelf = member.id === currentUserId;
                const isBusy = busyUserId === member.id;

                return (
                  <div
                    key={member.id}
                    className="flex items-center justify-between gap-2 rounded-2xl border border-app-border/60 bg-app-card/50 px-3.5 py-2.5 transition-colors hover:bg-app-card"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-app-text">
                        {member.name}
                        {isSelf ? ' (you)' : ''}
                      </span>
                      {!isAdmin || isSelf ? (
                        <span className="text-xs text-app-muted">{member.role === 'ADMIN' ? 'Admin' : 'Member'}</span>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {isAdmin && !isSelf ? (
                        <select
                          value={member.role}
                          disabled={Boolean(busyUserId)}
                          className="rounded-xl border border-app-border/70 bg-app-surface-input px-2.5 py-1 text-xs text-app-text outline-none focus:border-accent disabled:opacity-50 transition-colors"
                          onChange={(event) => void handleRoleChange(member.id, event.target.value)}
                        >
                          {MEMBER_ROLES.map((role) => (
                            <option key={role} value={role}>
                              {role === 'ADMIN' ? 'Admin' : 'Member'}
                            </option>
                          ))}
                        </select>
                      ) : null}
                      {isAdmin && !isSelf ? (
                        <button
                          type="button"
                          disabled={Boolean(busyUserId)}
                          className="flex shrink-0 items-center gap-1 rounded-xl px-2.5 py-1 text-xs text-accent-soft hover:bg-accent-soft/10 disabled:opacity-50 transition-colors"
                          onClick={() => void handleRemoveMember(member.id, member.name)}
                        >
                          <FiUserMinus />
                          {isBusy ? 'Removing...' : 'Remove'}
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
        </div>
      </div>
    </div>
  );
}
