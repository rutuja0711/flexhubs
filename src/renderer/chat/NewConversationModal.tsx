import { useCallback, useEffect, useMemo, useState } from 'react';
import { FiMessageSquare, FiUser, FiUsers, FiX } from 'react-icons/fi';
import { FiStar } from 'react-icons/fi';
import type { SearchPerson } from '../../shared/search';
import type { FriendRelationship } from '../../shared/features';
import { validateSearchInput } from '../../shared/search';
import {
  blockUser,
  loadFriendRelationship,
  loadUserSearch,
  respondFriendRequest,
  sendFriendRequest,
  unblockUser,
} from '../chatApi';
import { Avatar } from './ChatIcons';
import { SearchField } from './SearchField';

type NewConversationModalProps = {
  selfLabel: string;
  onClose: () => void;
  onMessageUser: (userId: string) => void;
  onMessageSelf: () => void;
  onCreateHub: (name: string, memberIds: string[]) => Promise<{ ok: boolean; error?: string }>;
  onCreateGroup?: (name: string, memberIds: string[]) => Promise<{ ok: boolean; error?: string }>;
};

function validateTeammateSearch(query: string): { ok: true; value: string } | { ok: false; error: string } {
  const trimmed = query.trim();

  if (!trimmed) {
    return { ok: true, value: '' };
  }

  if (trimmed.length < 3) {
    return { ok: false, error: 'Type at least 3 characters to search.' };
  }

  if (trimmed.length > 120) {
    return { ok: false, error: 'Search must be 120 characters or fewer.' };
  }

  return { ok: true, value: trimmed };
}

export function NewConversationModal({
  selfLabel,
  onClose,
  onMessageUser,
  onMessageSelf,
  onCreateHub,
  onCreateGroup,
}: NewConversationModalProps) {
  const [mode, setMode] = useState<'direct' | 'group'>('direct');
  const [groupKind, setGroupKind] = useState<'hub' | 'group'>('hub');
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

  const refreshRelationship = useCallback(async (userId: string) => {
    setRelationshipLoading(true);
    setRelationshipError('');

    const response = await loadFriendRelationship(userId);
    setRelationshipLoading(false);

    if (response.ok) {
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
    if (mode !== 'group') {
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
    setTeammateLoading(true);

    const timer = window.setTimeout(() => {
      loadUserSearch(validation.value).then((response) => {
        setTeammateLoading(false);

        if (!response.ok) {
          setActionError(response.error);
          setTeammateResults([]);
          return;
        }

        setActionError('');
        setTeammateResults(response.data);
      });
    }, 300);

    return () => window.clearTimeout(timer);
  }, [mode, teammateQuery]);

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

  const createButtonLabel = useMemo(() => {
    if (!groupName.trim()) {
      return 'Enter a hub name';
    }

    if (otherMemberCount < 1) {
      return 'Select 1 more member';
    }

    return groupKind === 'group' ? 'Create group' : 'Create hub';
  }, [groupName, otherMemberCount, groupKind]);

  const canCreateHub = groupName.trim().length > 0 && otherMemberCount >= 1 && !creatingHub;

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

  const handleCreateHub = async () => {
    if (!canCreateHub) {
      return;
    }

    setCreatingHub(true);
    setActionError('');

    const response =
      groupKind === 'hub' || !onCreateGroup
        ? await onCreateHub(groupName.trim(), selectedMembers.map((member) => member.id))
        : await onCreateGroup(groupName.trim(), selectedMembers.map((member) => member.id));

    setCreatingHub(false);

    if (!response.ok) {
      setActionError(response.error ?? 'Could not create hub.');
      return;
    }

    onClose();
  };

  return (
    <>
      <button
        type="button"
        aria-label="Close new conversation"
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="fixed top-1/2 left-1/2 z-50 flex max-h-[90vh] w-full max-w-[420px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[20px] border border-app-border bg-app-elevated shadow-app">
        <div className="border-b border-app-border/40 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-white">
                <FiMessageSquare className="text-lg" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-app-text">New conversation</h2>
                <p className="text-sm text-app-muted">Search organization teammates by username</p>
              </div>
            </div>
            <button type="button" className="text-app-muted hover:text-app-text" onClick={onClose} aria-label="Close">
              <FiX className="text-xl" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="mb-4 flex rounded-xl bg-app-inset p-1">
            <button
              type="button"
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                mode === 'direct' ? 'bg-app-inset-active text-app-text' : 'text-app-muted hover:text-app-text'
              }`}
              onClick={() => setMode('direct')}
            >
              <FiUser />
              Direct
            </button>
            <button
              type="button"
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                mode === 'group' ? 'bg-app-inset-active text-app-text' : 'text-app-muted hover:text-app-text'
              }`}
              onClick={() => setMode('group')}
            >
              <FiUsers />
              Group
            </button>
          </div>

          {mode === 'direct' ? (
            <>
              <button
                type="button"
                className="mb-4 flex w-full items-center gap-3 rounded-xl border border-app-border bg-app-inset px-4 py-3 text-left"
                onClick={onMessageSelf}
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/15 text-accent-soft">
                <FiStar />
              </span>
                <span>
                  <span className="block text-sm font-medium text-app-text">{selfLabel}</span>
                  <span className="text-xs text-app-muted">Message yourself</span>
                </span>
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
                Users are not listed. Enter an exact username to start a conversation.
              </p>

              {loading ? <p className="mt-4 text-sm text-app-muted">Searching...</p> : null}

              {result ? (
                <div className="mt-4 rounded-xl border border-app-border bg-app-inset p-4">
                  <div className="mb-3 flex items-center gap-3">
                    <Avatar imageUrl={result.avatarUrl} initials={result.initials} />
                    <div>
                      <p className="font-medium text-app-text">{result.name}</p>
                      <p className="text-sm text-app-muted">@{result.username}</p>
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

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded-[10px] bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                      disabled={actionPending || relationshipLoading || !canMessage}
                      onClick={() => onMessageUser(result.id)}
                    >
                      Message
                    </button>

                    {!relationshipLoading && relationship?.requestReceived ? (
                      <>
                        <button
                          type="button"
                          className="rounded-[10px] bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
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
                          className="rounded-[10px] border border-app-border px-4 py-2 text-sm text-app-muted disabled:opacity-50"
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
                        className="rounded-[10px] border border-app-border px-4 py-2 text-sm text-accent-soft disabled:opacity-50"
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
                      <span className="self-center text-xs text-app-muted">Already friends</span>
                    ) : null}

                    {!relationshipLoading && relationship?.requestSent ? (
                      <span className="self-center text-xs text-app-muted">Request sent</span>
                    ) : null}

                    {!relationshipLoading && relationship?.isBlocked ? (
                      <button
                        type="button"
                        className="rounded-[10px] border border-app-border px-4 py-2 text-sm text-app-text disabled:opacity-50"
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
                        className="rounded-[10px] border border-accent-soft/40 px-4 py-2 text-sm text-accent-soft disabled:opacity-50"
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
                Type at least 3 characters to find teammates in your organization.
              </p>

              <p className="mb-2 text-[0.6875rem] font-semibold tracking-[0.08em] text-app-muted uppercase">
                Type
              </p>
              <div className="mb-4 flex rounded-xl bg-app-inset p-1">
                <button
                  type="button"
                  className={`flex-1 rounded-lg px-3 py-2 text-sm ${groupKind === 'hub' ? 'bg-app-inset-active text-app-text' : 'text-app-muted'}`}
                  onClick={() => setGroupKind('hub')}
                >
                  Hub
                </button>
                <button
                  type="button"
                  className={`flex-1 rounded-lg px-3 py-2 text-sm ${groupKind === 'group' ? 'bg-app-inset-active text-app-text' : 'text-app-muted'}`}
                  onClick={() => setGroupKind('group')}
                >
                  Group chat
                </button>
              </div>

              <p className="mb-2 text-[0.6875rem] font-semibold tracking-[0.08em] text-app-muted uppercase">
                {groupKind === 'hub' ? 'Hub name' : 'Group name'}
              </p>
              <input
                type="text"
                value={groupName}
                placeholder="e.g. Project team"
                className="w-full rounded-[10px] border border-app-border bg-app-surface-input px-3 py-3 text-sm text-app-text outline-none placeholder:text-app-placeholder focus:border-accent"
                onChange={(event) => setGroupName(event.target.value)}
              />

              <p className="mt-4 mb-2 text-[0.6875rem] font-semibold tracking-[0.08em] text-app-muted uppercase">
                Selected ({selectedCount} including you)
              </p>
              <div className="min-h-[72px] rounded-xl border border-dashed border-app-border bg-app-inset p-3">
                <div className="mb-2 flex flex-wrap gap-2">
                  <span className="inline-flex items-center rounded-lg bg-app-inset-active px-2.5 py-1 text-xs text-app-text">
                    {selfLabel} (you)
                  </span>
                  {selectedMembers.map((member) => (
                    <span
                      key={member.id}
                      className="inline-flex items-center gap-1 rounded-lg bg-app-inset-active px-2.5 py-1 text-xs text-app-text"
                    >
                      {member.name}
                      <button
                        type="button"
                        className="text-app-muted hover:text-app-text"
                        aria-label={`Remove ${member.name}`}
                        onClick={() => removeMember(member.id)}
                      >
                        <FiX />
                      </button>
                    </span>
                  ))}
                </div>
                {otherMemberCount === 0 ? (
                  <p className="text-sm text-app-muted">Add at least 1 other person from search results</p>
                ) : null}
              </div>

              <div className="mt-6 flex min-h-[160px] flex-col items-center justify-center px-4 py-6 text-center">
                {teammateLoading ? (
                  <p className="text-sm text-app-muted">Searching...</p>
                ) : teammateResults.length > 0 ? (
                  <div className="w-full space-y-2">
                    {teammateResults.map((person) => {
                      const isSelected = selectedMembers.some((member) => member.id === person.id);

                      return (
                        <button
                          key={person.id}
                          type="button"
                          className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                            isSelected
                              ? 'border-accent/40 bg-accent/10'
                              : 'border-app-border bg-app-inset hover:bg-app-inset-active'
                          }`}
                          onClick={() => addMember(person)}
                        >
                          <Avatar imageUrl={person.avatarUrl} initials={person.initials} size="sm" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-app-text">{person.name}</p>
                            <p className="truncate text-xs text-app-muted">@{person.username}</p>
                          </div>
                          <span className="text-xs text-app-muted">{isSelected ? 'Added' : 'Add'}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <>
                    <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-app-chat-hover text-app-muted">
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.75" />
                        <path d="M20 20L16.65 16.65" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
                      </svg>
                    </div>
                    <p className="text-sm font-medium text-app-text">Search for teammates</p>
                    <p className="mt-1 text-sm text-app-muted">Pick members, then create your hub.</p>
                  </>
                )}
              </div>
            </>
          )}

          {actionMessage ? (
            <p className="mt-3 text-sm text-[#3ecf8e]" role="status">
              {actionMessage}
            </p>
          ) : null}

          {actionError ? (
            <p className="mt-3 text-sm text-accent-soft" role="alert">
              {actionError}
            </p>
          ) : null}
        </div>

        {mode === 'group' ? (
          <div className="border-t border-app-border/40 p-5">
            <button
              type="button"
              className="w-full rounded-xl bg-accent py-3.5 text-sm font-semibold text-white transition-opacity disabled:opacity-50"
              disabled={!canCreateHub}
              onClick={() => {
                void handleCreateHub();
              }}
            >
              {createButtonLabel}
            </button>
          </div>
        ) : null}
      </div>
    </>
  );
}
