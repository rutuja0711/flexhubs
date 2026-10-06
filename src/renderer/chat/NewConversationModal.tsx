import { useCallback, useEffect, useMemo, useState } from 'react';
import { FiMessageSquare, FiUser, FiUsers, FiX } from 'react-icons/fi';
import { FiStar } from 'react-icons/fi';
import type { SearchPerson } from '../../shared/search';
import type { FriendRelationship } from '../../shared/features';
import { syncPeerBlockFromRelationship } from '../blockedUsersSync';
import type { TeammateItem } from '../../shared/messages';
import { validateSearchInput } from '../../shared/search';
import {
  blockUser,
  loadFriendRelationship,
  loadOrganizationMembers,
  loadUserSearch,
  respondFriendRequest,
  sendFriendRequest,
  unblockUser,
} from '../chatApi';
import { Avatar } from './ChatIcons';
import { SearchField } from './SearchField';

type ComposeMode = 'direct' | 'hub' | 'group';

type NewConversationModalProps = {
  selfLabel: string;
  teammates?: TeammateItem[];
  initialMode?: ComposeMode;
  onClose: () => void;
  onMessageUser: (userId: string) => void;
  onMessageSelf: () => void;
  onCreateHub: (name: string, memberIds: string[]) => Promise<{ ok: boolean; error?: string }>;
  onCreateGroup?: (name: string, memberIds: string[]) => Promise<{ ok: boolean; error?: string }>;
};

function normalizeTeammateQuery(query: string): string {
  return query.trim().replace(/^@+/, '').trim();
}

function validateTeammateSearch(query: string): { ok: true; value: string } | { ok: false; error: string } {
  const normalized = normalizeTeammateQuery(query);

  if (!normalized) {
    return { ok: true, value: '' };
  }

  if (normalized.length < 2) {
    return { ok: false, error: 'Type at least 2 characters to search.' };
  }

  if (normalized.length > 120) {
    return { ok: false, error: 'Search must be 120 characters or fewer.' };
  }

  return { ok: true, value: normalized };
}

function teammateToPerson(member: TeammateItem): SearchPerson {
  return {
    id: member.id,
    name: member.name,
    username: member.username,
    avatarUrl: member.avatarUrl,
    initials: member.initials,
    status: null,
  };
}

function personMatchesQuery(person: { name: string; username: string }, query: string): boolean {
  const needle = query.toLowerCase();
  return (
    person.name.toLowerCase().includes(needle) || person.username.toLowerCase().includes(needle)
  );
}

function mergeSearchPeople(primary: SearchPerson[], extra: SearchPerson[]): SearchPerson[] {
  const byId = new Map<string, SearchPerson>();

  for (const person of [...primary, ...extra]) {
    if (!person.id || byId.has(person.id)) {
      continue;
    }

    byId.set(person.id, person);
  }

  return [...byId.values()];
}

export function NewConversationModal({
  selfLabel,
  teammates = [],
  initialMode = 'direct',
  onClose,
  onMessageUser,
  onMessageSelf,
  onCreateHub,
  onCreateGroup,
}: NewConversationModalProps) {
  const [mode, setMode] = useState<ComposeMode>(initialMode);
  const [username, setUsername] = useState('');
  const [searchError, setSearchError] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SearchPerson | null>(null);
  const [relationship, setRelationship] = useState<FriendRelationship | null>(null);
  const [relationshipLoading, setRelationshipLoading] = useState(false);
  const [relationshipError, setRelationshipError] = useState('');
  const [actionPending, setActionPending] = useState(false);

  const [teammateQuery, setTeammateQuery] = useState('');
  const [teammateSearchError, setTeammateSearchError] = useState('');
  const [teammateLoading, setTeammateLoading] = useState(false);
  const [teammateResults, setTeammateResults] = useState<SearchPerson[]>([]);
  const [groupName, setGroupName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<SearchPerson[]>([]);
  const [creatingHub, setCreatingHub] = useState(false);
  const [orgTeammates, setOrgTeammates] = useState<TeammateItem[]>(teammates);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  const refreshRelationship = useCallback(async (userId: string) => {
    setRelationshipLoading(true);
    setRelationshipError('');

    const response = await loadFriendRelationship(userId);
    setRelationshipLoading(false);

    if (response.ok) {
      syncPeerBlockFromRelationship(userId, response.data);
      setRelationship(response.data);
      return;
    }

    setRelationship(null);
    setRelationshipError(response.error);
  }, []);

  useEffect(() => {
    if (mode !== 'direct') {
      return;
    }

    const validation = validateSearchInput(username);

    if (!validation.ok) {
      setSearchError(validation.error);
      setResult(null);
      setRelationship(null);
      setRelationshipError('');
      return;
    }

    if (!validation.value) {
      setSearchError('');
      setResult(null);
      setRelationship(null);
      setRelationshipError('');
      return;
    }

    setSearchError('');
    setLoading(true);
    setActionError('');
    setActionMessage('');

    const timer = window.setTimeout(() => {
      loadUserSearch(validation.value).then((response) => {
        setLoading(false);

        if (!response.ok) {
          setActionError(response.error);
          setResult(null);
          setRelationship(null);
          setRelationshipError('');
          return;
        }

        setResult(response.data[0] ?? null);

        if (!response.data[0]) {
          setActionError('No user found with that username.');
        }
      });
    }, 300);

    return () => window.clearTimeout(timer);
  }, [mode, username]);

  useEffect(() => {
    setOrgTeammates(teammates);
  }, [teammates]);

  useEffect(() => {
    if ((mode !== 'group' && mode !== 'hub') || orgTeammates.length > 0) {
      return;
    }

    let cancelled = false;

    void loadOrganizationMembers().then((response) => {
      if (cancelled || !response.ok) {
        return;
      }

      setOrgTeammates(response.data);
    });

    return () => {
      cancelled = true;
    };
  }, [mode, orgTeammates.length]);

  useEffect(() => {
    if (mode !== 'group' && mode !== 'hub') {
      return;
    }

    const validation = validateTeammateSearch(teammateQuery);

    if (!validation.ok) {
      setTeammateSearchError(validation.error);
      setTeammateResults([]);
      return;
    }

    if (!validation.value) {
      setTeammateSearchError('');
      setTeammateResults([]);
      return;
    }

    setTeammateSearchError('');
    setActionError('');
    setTeammateResults(
      orgTeammates.filter((member) => personMatchesQuery(member, validation.value)).map(teammateToPerson),
    );
    setTeammateLoading(true);

    const timer = window.setTimeout(() => {
      loadUserSearch(validation.value).then((response) => {
        setTeammateLoading(false);

        if (!response.ok) {
          return;
        }

        setTeammateResults((current) =>
          mergeSearchPeople(
            current,
            response.data.filter((person) => personMatchesQuery(person, validation.value)),
          ),
        );
      });
    }, 200);

    return () => window.clearTimeout(timer);
  }, [mode, orgTeammates, teammateQuery]);

  useEffect(() => {
    if (!result) {
      setRelationship(null);
      setRelationshipError('');
      return;
    }

    void refreshRelationship(result.id);
  }, [refreshRelationship, result]);

  const runAction = async (action: () => Promise<{ ok: boolean; error?: string }>, successText: string) => {
    if (!result) {
      return;
    }

    setActionPending(true);
    setActionError('');
    setActionMessage('');

    const response = await action();
    setActionPending(false);

    if (!response.ok) {
      setActionError(response.error ?? 'Action failed.');
      return;
    }

    setActionMessage(successText);
    await refreshRelationship(result.id);
  };

  const canMessage =
    relationship &&
    !relationship.isBlocked &&
    (relationship.canMessage || relationship.isFriend || relationship.sameOrganization);

  const selectedCount = selectedMembers.length + 1;
  const otherMemberCount = selectedMembers.length;

  const createKind = mode === 'hub' ? 'hub' : 'group';

  const createButtonLabel = useMemo(() => {
    if (!groupName.trim()) {
      return createKind === 'hub' ? 'Enter a hub name' : 'Enter a group name';
    }

    if (otherMemberCount < 1) {
      return 'Select 1 more member';
    }

    return createKind === 'hub' ? 'Create hub' : 'Create group';
  }, [createKind, groupName, otherMemberCount]);

  const canCreateGroup = groupName.trim().length > 0 && otherMemberCount >= 1 && !creatingHub;

  const addMember = (person: SearchPerson) => {
    setSelectedMembers((current) => {
      if (current.some((member) => member.id === person.id)) {
        return current;
      }

      return [...current, person];
    });
  };

  const removeMember = (personId: string) => {
    setSelectedMembers((current) => current.filter((member) => member.id !== personId));
  };

  const handleCreateGroup = async () => {
    if (!canCreateGroup) {
      return;
    }

    setCreatingHub(true);
    setActionError('');

    const create =
      mode === 'hub' ? onCreateHub : (onCreateGroup ?? onCreateHub);
    const response = await create(
      groupName.trim(),
      selectedMembers.map((member) => member.id),
    );

    setCreatingHub(false);

    if (!response.ok) {
      setActionError(response.error ?? `Could not create ${createKind}.`);
      return;
    }

    onClose();
  };

  return (
    <>
      <button
        type="button"
        aria-label="Close new conversation"
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md animate-fade-in transition-opacity"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none p-4 sm:p-6">
        <div className="pointer-events-auto relative flex max-h-[90vh] w-full max-w-[560px] flex-col overflow-hidden rounded-3xl border border-app-border bg-app-surface shadow-2xl animate-pop-in origin-center">
          <div className="border-b border-app-border px-6 py-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3.5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-accent-hover text-white shadow-md shadow-accent/20">
                  <FiMessageSquare className="text-xl" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-app-text tracking-tight">New conversation</h2>
                  <p className="text-xs text-app-muted">Start a direct chat, hub, or project group</p>
                </div>
              </div>
              <button
                type="button"
                className="flex h-9 w-9 items-center justify-center rounded-xl text-app-muted hover:text-app-text hover:bg-app-inset transition-colors"
                onClick={onClose}
                aria-label="Close"
              >
                <FiX className="text-lg" />
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <div className="mb-5 flex rounded-2xl bg-app-inset p-1">
              <button
                type="button"
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-medium transition-all duration-150 ${
                  mode === 'direct'
                    ? 'bg-app-surface text-app-text shadow-sm font-semibold'
                    : 'text-app-muted hover:text-app-text hover:bg-app-chat-hover'
                }`}
                onClick={() => setMode('direct')}
              >
                <FiUser className="text-sm" />
                Direct
              </button>
              <button
                type="button"
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-medium transition-all duration-150 ${
                  mode === 'hub'
                    ? 'bg-app-surface text-app-text shadow-sm font-semibold'
                    : 'text-app-muted hover:text-app-text hover:bg-app-chat-hover'
                }`}
                onClick={() => setMode('hub')}
              >
                <FiUsers className="text-sm" />
                Hub
              </button>
              <button
                type="button"
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-medium transition-all duration-150 ${
                  mode === 'group'
                    ? 'bg-app-surface text-app-text shadow-sm font-semibold'
                    : 'text-app-muted hover:text-app-text hover:bg-app-chat-hover'
                }`}
                onClick={() => setMode('group')}
              >
                <FiUsers className="text-sm" />
                Group
              </button>
            </div>

            {mode === 'direct' ? (
              <>
                <button
                  type="button"
                  className="mb-5 flex w-full items-center gap-3.5 rounded-2xl border border-app-border bg-app-inset p-3.5 text-left transition-all duration-200 hover:bg-app-chat-hover hover:border-app-border-strong group"
                  onClick={onMessageSelf}
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/15 text-accent-soft group-hover:scale-105 transition-transform">
                    <FiStar className="text-base" />
                  </span>
                  <div>
                    <span className="block text-sm font-medium text-app-text">{selfLabel}</span>
                    <span className="text-xs text-app-muted">Note to self • Message yourself</span>
                  </div>
                </button>

                <p className="mb-2 text-[0.6875rem] font-semibold tracking-[0.08em] text-app-muted uppercase">
                  Username
                </p>
                <SearchField
                  value={username}
                  placeholder="Enter username..."
                  error={searchError}
                  variant="modal"
                  onChange={setUsername}
                />
                <p className="mt-2 text-xs text-app-muted">
                  Users are not listed publicly. Enter an exact username to start a conversation.
                </p>

                {loading ? <p className="mt-4 text-xs text-app-muted">Searching...</p> : null}

                {result ? (
                  <div className="mt-4 rounded-2xl border border-app-border bg-app-inset p-4">
                    <div className="mb-3.5 flex items-center gap-3">
                      <Avatar imageUrl={result.avatarUrl} initials={result.initials} />
                      <div>
                        <p className="font-medium text-app-text text-sm">{result.name}</p>
                        <p className="text-xs text-app-muted">@{result.username}</p>
                      </div>
                    </div>

                    {relationshipLoading ? (
                      <p className="mb-3 text-xs text-app-muted">Loading relationship...</p>
                    ) : null}

                    {!relationshipLoading && relationship?.isBlocked ? (
                      <p className="mb-3 text-xs text-accent-soft">This user is blocked. Unblock to message or add as friend.</p>
                    ) : null}

                    {!relationshipLoading && relationshipError ? (
                      <p className="mb-3 text-xs text-accent-soft" role="alert">
                        {relationshipError}
                      </p>
                    ) : null}

                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        type="button"
                        className="rounded-xl bg-gradient-to-r from-accent to-accent-hover px-4 py-2 text-xs font-semibold text-white shadow-sm shadow-accent/20 transition-all duration-200 active:scale-95 disabled:opacity-50"
                        disabled={actionPending || relationshipLoading || !canMessage}
                        onClick={() => onMessageUser(result.id)}
                      >
                        Message
                      </button>

                      {!relationshipLoading && relationship?.requestReceived ? (
                        <>
                          <button
                            type="button"
                            className="rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-white shadow-sm disabled:opacity-50"
                            disabled={actionPending}
                            onClick={() => {
                              void runAction(
                                () => respondFriendRequest(result.id, 'ACCEPTED'),
                                'Friend request accepted.',
                              );
                            }}
                          >
                            Accept request
                          </button>
                          <button
                            type="button"
                            className="rounded-xl border border-app-border px-4 py-2 text-xs text-app-muted hover:text-app-text transition-colors disabled:opacity-50"
                            disabled={actionPending}
                            onClick={() => {
                              void runAction(
                                () => respondFriendRequest(result.id, 'DECLINED'),
                                'Friend request declined.',
                              );
                            }}
                          >
                            Decline
                          </button>
                        </>
                      ) : null}

                      {!relationshipLoading &&
                      relationship &&
                      !relationship.isFriend &&
                      !relationship.requestSent &&
                      !relationship.requestReceived ? (
                        <button
                          type="button"
                          className="rounded-xl border border-app-border/80 bg-app-inset/60 px-4 py-2 text-xs text-accent-soft hover:bg-app-inset transition-colors disabled:opacity-50"
                          disabled={actionPending || relationship.isBlocked}
                          onClick={() => {
                            void runAction(
                              () => sendFriendRequest(result.id),
                              'Friend request sent.',
                            );
                          }}
                        >
                          Add friend
                        </button>
                      ) : null}

                      {!relationshipLoading && relationship?.isFriend ? (
                        <span className="self-center text-xs text-app-muted px-2">Already friends</span>
                      ) : null}

                      {!relationshipLoading && relationship?.requestSent ? (
                        <span className="self-center text-xs text-app-muted px-2">Request sent</span>
                      ) : null}

                      {!relationshipLoading && relationship?.isBlocked ? (
                        <button
                          type="button"
                          className="rounded-xl border border-app-border px-4 py-2 text-xs text-app-text hover:bg-app-inset transition-colors disabled:opacity-50"
                          disabled={actionPending}
                          onClick={() => {
                            void runAction(() => unblockUser(result.id), 'User unblocked.');
                          }}
                        >
                          Unblock
                        </button>
                      ) : !relationshipLoading ? (
                        <button
                          type="button"
                          className="rounded-xl border border-accent-soft/40 px-4 py-2 text-xs text-accent-soft hover:bg-accent/10 transition-colors disabled:opacity-50"
                          disabled={actionPending || relationshipLoading}
                          onClick={() => {
                            void runAction(() => blockUser(result.id), 'User blocked.');
                          }}
                        >
                          Block
                        </button>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <>
                <p className="mb-2 text-[0.6875rem] font-semibold tracking-[0.08em] text-app-muted uppercase">
                  {createKind === 'hub' ? 'Hub name' : 'Group name'}
                </p>
                <input
                  type="text"
                  value={groupName}
                  placeholder={createKind === 'hub' ? 'e.g. Training' : 'e.g. Project team'}
                  className="w-full rounded-xl border border-app-border bg-app-inset px-3.5 py-2.5 text-sm text-app-text outline-none placeholder:text-app-placeholder focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
                  onChange={(event) => setGroupName(event.target.value)}
                />

                <p className="mt-5 mb-2 text-[0.6875rem] font-semibold tracking-[0.08em] text-app-muted uppercase">
                  Selected ({selectedCount} including you)
                </p>
                <div className="min-h-[72px] rounded-2xl border border-dashed border-app-border bg-app-inset p-3">
                  <div className="mb-2 flex flex-wrap gap-2">
                    <span className="inline-flex items-center rounded-xl bg-app-surface border border-app-border px-3 py-1 text-xs text-app-text font-medium">
                      {selfLabel} (you)
                    </span>
                    {selectedMembers.map((member) => (
                      <span
                        key={member.id}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-app-surface border border-app-border px-3 py-1 text-xs text-app-text font-medium"
                      >
                        {member.name}
                        <button
                          type="button"
                          className="text-app-muted hover:text-accent-soft transition-colors"
                          aria-label={`Remove ${member.name}`}
                          onClick={() => removeMember(member.id)}
                        >
                          <FiX className="text-xs" />
                        </button>
                      </span>
                    ))}
                  </div>
                  {otherMemberCount === 0 ? (
                    <p className="text-xs text-app-muted">Add at least 1 other person from search results</p>
                  ) : null}
                </div>

                <p className="mt-5 mb-2 text-[0.6875rem] font-semibold tracking-[0.08em] text-app-muted uppercase">
                  Search teammates
                </p>
                <SearchField
                  value={teammateQuery}
                  placeholder="Teammate username..."
                  error={teammateSearchError}
                  variant="modal"
                  onChange={setTeammateQuery}
                />
                <p className="mt-2 text-xs text-app-muted">
                  Type a name or username to find teammates in your organization.
                </p>

                {teammateResults.length > 0 ? (
                  <div className="mt-4 space-y-2">
                    {teammateResults.map((person) => {
                      const isSelected = selectedMembers.some((member) => member.id === person.id);

                      return (
                        <button
                          key={person.id}
                          type="button"
                          className={`flex w-full items-center gap-3 rounded-2xl border px-3.5 py-2.5 text-left transition-all duration-150 ${
                            isSelected
                              ? 'border-accent/40 bg-accent/10 shadow-xs'
                              : 'border-app-border bg-app-inset hover:bg-app-chat-hover'
                          }`}
                          onClick={() => addMember(person)}
                        >
                          <Avatar imageUrl={person.avatarUrl} initials={person.initials} size="sm" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-app-text">{person.name}</p>
                            <p className="truncate text-xs text-app-muted">@{person.username}</p>
                          </div>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-lg ${
                            isSelected ? 'text-accent-soft bg-accent/15' : 'text-app-muted'
                          }`}>
                            {isSelected ? 'Added' : '+ Add'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : teammateLoading ? (
                  <p className="mt-4 text-xs text-app-muted">Searching...</p>
                ) : normalizeTeammateQuery(teammateQuery).length >= 2 ? (
                  <p className="mt-4 text-xs text-app-muted">No teammates match that search.</p>
                ) : null}
              </>
            )}

            {actionMessage ? (
              <p className="mt-4 text-xs text-[#3ecf8e] font-medium" role="status">
                {actionMessage}
              </p>
            ) : null}

            {actionError ? (
              <p className="mt-4 text-xs text-accent-soft font-medium" role="alert">
                {actionError}
              </p>
            ) : null}
          </div>

          {mode === 'group' || mode === 'hub' ? (
            <div className="border-t border-app-border bg-app-inset p-5">
              <button
                type="button"
                className="w-full rounded-xl bg-gradient-to-r from-accent to-[#632a38] py-3 text-sm font-semibold text-white shadow-lg shadow-accent/20 transition-all duration-200 hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
                disabled={!canCreateGroup}
                onClick={() => {
                  void handleCreateGroup();
                }}
              >
                {createButtonLabel}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
