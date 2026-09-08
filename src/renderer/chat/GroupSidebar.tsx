import { useCallback, useEffect, useMemo, useState } from 'react';
import { FiBell, FiChevronDown, FiUserMinus, FiX } from 'react-icons/fi';
import type { ConversationItem } from '../../shared/chat';
import {
  buildConversationSnoozePayload,
  CONVERSATION_SNOOZE_OPTIONS,
  conversationSnoozeUntil,
  formatConversationSnoozeUntil,
  readConversationSnoozed,
  readHubChannelId,
} from '../../shared/chat';
import type { ChannelInviteItem } from '../../shared/features';
import {
  deleteHubChannel,
  leaveConversation,
  loadChannelInvites,
  loadConversationBootstrap,
  renameConversation,
  revokeHubChannelInvite,
  updateConversationNotificationSettings,
  updateHubChannelDescription,
  updateHubChannelName,
  updateHubChannelSettings,
} from '../chatApi';
import { formatConversationTimestamp } from './format';
import { useConfirm } from '../ui/ConfirmDialog';
import { useToast } from '../ui/Toast';

type GroupSidebarProps = {
  conversation: ConversationItem;
  hubDetails?: Record<string, unknown> | null;
  currentUserId: string | null;
  onClose: () => void;
  onConversationUpdated: () => void;
  onNotificationsSnoozedChange?: (snoozed: boolean) => void;
  onHubDeleted: () => void;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  return value as Record<string, unknown>;
}

function readRecordString(record: Record<string, unknown> | null, key: string): string {
  const value = record?.[key];
  return typeof value === 'string' ? value : '';
}

function extractHubMembers(hub: Record<string, unknown>): Record<string, unknown>[] {
  if (Array.isArray(hub.groupMembers)) {
    return hub.groupMembers
      .map(asRecord)
      .filter((item): item is Record<string, unknown> => item !== null);
  }

  if (Array.isArray(hub.members)) {
    return hub.members.map(asRecord).filter((item): item is Record<string, unknown> => item !== null);
  }

  return [];
}

function resolveHubAdmin(hub: Record<string, unknown>, currentUserId: string | null): boolean {
  if (hub.isAdmin === true || hub.isOwner === true) {
    return true;
  }

  const myRole = String(hub.myRole ?? hub.role ?? '').toUpperCase();
  if (myRole === 'ADMIN' || myRole.includes('FOUNDER') || myRole.includes('OWNER')) {
    return true;
  }

  if (!currentUserId) {
    return false;
  }

  for (const member of extractHubMembers(hub)) {
    const user = asRecord(member.user);
    const memberId = readRecordString(user, 'id') || readRecordString(member, 'userId') || readRecordString(member, 'id');
    const role = String(member.role ?? '').toUpperCase();

    if (memberId === currentUserId && (role === 'ADMIN' || role.includes('FOUNDER') || role.includes('OWNER'))) {
      return true;
    }
  }

  return false;
}

type HubPanelState = {
  displayName: string;
  slug: string;
  description: string;
  readReceiptsEnabled: boolean;
  memberCount: number;
  adminCount: number;
  isAdmin: boolean;
  snoozed: boolean;
};

function deriveHubPanelState(
  hub: Record<string, unknown> | null,
  conversation: ConversationItem,
  currentUserId: string | null,
): HubPanelState {
  if (!hub) {
    return {
      displayName: conversation.title,
      slug: '',
      description: '',
      readReceiptsEnabled: true,
      memberCount: 1,
      adminCount: 1,
      isAdmin: false,
      snoozed: conversation.notificationsSnoozed === true,
    };
  }

  const members = extractHubMembers(hub);
  const admins = members.filter((member) => String(member.role ?? '').toUpperCase() === 'ADMIN');
  const notificationSettings = asRecord(hub.notificationSettings);

  return {
    displayName: readRecordString(hub, 'name') || conversation.title,
    slug: readRecordString(hub, 'slug'),
    description: readRecordString(hub, 'description'),
    readReceiptsEnabled: hub.readReceiptsEnabled !== false,
    memberCount: members.length > 0 ? members.length : 1,
    adminCount: admins.length > 0 ? admins.length : 1,
    isAdmin: resolveHubAdmin(hub, currentUserId),
    snoozed:
      readConversationSnoozed(hub) ||
      conversation.notificationsSnoozed === true ||
      notificationSettings?.snoozed === true,
  };
}

export function GroupSidebar({
  conversation,
  hubDetails = null,
  currentUserId,
  onClose,
  onConversationUpdated,
  onNotificationsSnoozedChange,
  onHubDeleted,
}: GroupSidebarProps) {
  const confirm = useConfirm();
  const toast = useToast();
  const initialState = deriveHubPanelState(hubDetails, conversation, currentUserId);

  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [snoozeSaving, setSnoozeSaving] = useState(false);

  const [displayName, setDisplayName] = useState(initialState.displayName);
  const [slug, setSlug] = useState(initialState.slug);
  const [description, setDescription] = useState(initialState.description);
  const [readReceiptsEnabled, setReadReceiptsEnabled] = useState(initialState.readReceiptsEnabled);
  const [memberCount, setMemberCount] = useState(initialState.memberCount);
  const [adminCount, setAdminCount] = useState(initialState.adminCount);
  const [isAdmin, setIsAdmin] = useState(initialState.isAdmin);
  const [snoozed, setSnoozed] = useState(initialState.snoozed);
  const [snoozedUntil, setSnoozedUntil] = useState<string | null>(null);
  const [snoozedForever, setSnoozedForever] = useState(false);
  const [pendingInvites, setPendingInvites] = useState<ChannelInviteItem[]>([]);
  const [invitesLoading, setInvitesLoading] = useState(false);
  const [revokingInviteId, setRevokingInviteId] = useState<string | null>(null);
  const [snoozeMenuOpen, setSnoozeMenuOpen] = useState(false);

  const loadPendingInvites = useCallback(async () => {
    if (!isAdmin) {
      setPendingInvites([]);
      return;
    }

    setInvitesLoading(true);

    const result = await loadChannelInvites(conversation.id);

    setInvitesLoading(false);

    if (!result.ok) {
      setPendingInvites([]);
      return;
    }

    setPendingInvites(result.data);
  }, [conversation.id, isAdmin]);

  useEffect(() => {
    const state = deriveHubPanelState(hubDetails, conversation, currentUserId);
    setDisplayName(state.displayName);
    setSlug(state.slug);
    setDescription(state.description);
    setReadReceiptsEnabled(state.readReceiptsEnabled);
    setMemberCount(state.memberCount);
    setAdminCount(state.adminCount);
    setIsAdmin(state.isAdmin);
    setSnoozed(state.snoozed);
    setError('');
  }, [hubDetails, conversation.id, conversation.notificationsSnoozed, conversation.title, currentUserId]);

  useEffect(() => {
    if (hubDetails) {
      return;
    }

    let cancelled = false;
    setRefreshing(true);

    void loadConversationBootstrap(conversation.id)
      .then((result) => {
        if (cancelled) {
          return;
        }

        if (!result.ok) {
          setError(result.error);
          return;
        }

        const state = deriveHubPanelState(result.data.conversation, conversation, currentUserId);
        setDisplayName(state.displayName);
        setSlug(state.slug);
        setDescription(state.description);
        setReadReceiptsEnabled(state.readReceiptsEnabled);
        setMemberCount(state.memberCount);
        setAdminCount(state.adminCount);
        setIsAdmin(state.isAdmin);
        setSnoozed(state.snoozed);
      })
      .catch(() => {
        if (!cancelled) {
          setError('Failed to load hub details.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setRefreshing(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [conversation.id, conversation.title, currentUserId, hubDetails]);

  useEffect(() => {
    void loadPendingInvites();
  }, [loadPendingInvites]);

  const subtitle = useMemo(() => {
    const parts = [`${memberCount} member${memberCount === 1 ? '' : 's'}`, `${adminCount} admin`];
    if (isAdmin) {
      parts.push('You are admin');
    }
    return parts.join(' · ');
  }, [adminCount, isAdmin, memberCount]);

  const handleSaveDetails = async () => {
    const name = displayName.trim();
    if (!name) {
      setError('Display name is required.');
      return;
    }

    setSaving(true);
    setError('');

    const channelNameResult = await updateHubChannelName(conversation.id, name);
    let nameError = '';

    if (!channelNameResult.ok) {
      const fallback = await renameConversation(conversation.id, name);
      if (!fallback.ok) {
        nameError = channelNameResult.error;
      }
    }

    const descriptionResult = await updateHubChannelDescription(conversation.id, description.trim());

    setSaving(false);

    if (nameError) {
      setError(nameError);
      toast.error(nameError);
      return;
    }

    if (!descriptionResult.ok) {
      setError(descriptionResult.error);
      toast.error(descriptionResult.error);
      return;
    }

    toast.success('Hub details saved.');
    onConversationUpdated();
  };

  const handleReadReceiptsChange = async (enabled: boolean) => {
    setReadReceiptsEnabled(enabled);
    setError('');

    const result = await updateHubChannelSettings(conversation.id, {
      readReceiptsEnabled: enabled,
    });

    if (!result.ok) {
      setReadReceiptsEnabled(!enabled);
      setError(result.error);
      toast.error(result.error);
      return;
    }

    toast.success('Hub settings updated.');
  };

  const handleSnooze = async (duration: string) => {
    const next = duration !== 'off';
    const until = conversationSnoozeUntil(duration);
    const forever = duration === 'forever';
    setSnoozeSaving(true);
    setError('');

    setSnoozed(next);
    setSnoozedUntil(until);
    setSnoozedForever(forever);
    onNotificationsSnoozedChange?.(next);

    const result = await updateConversationNotificationSettings(
      conversation.id,
      buildConversationSnoozePayload(duration),
    );

    setSnoozeSaving(false);

    if (!result.ok) {
      setSnoozed(!next);
      setSnoozedUntil(null);
      setSnoozedForever(false);
      onNotificationsSnoozedChange?.(!next);
      setError(result.error);
      toast.error(result.error);
      return;
    }

    toast.success(
      next
        ? forever
          ? 'Notifications snoozed indefinitely for this hub.'
          : formatConversationSnoozeUntil(until)
        : 'Notifications enabled for this hub.',
    );
    setSnoozeMenuOpen(false);
  };

  const handleLeave = async () => {
    const hubName = displayName.trim() || conversation.title;
    const confirmed = await confirm({
      title: 'Leave hub',
      message: `Leave "${hubName}"? You will no longer receive messages from this hub.`,
      confirmLabel: 'Leave hub',
      tone: 'danger',
    });

    if (!confirmed) {
      return;
    }

    setLeaving(true);
    setError('');

    const hubId =
      readHubChannelId(hubDetails, conversation.channelId) ??
      conversation.channelId ??
      conversation.id;
    const looksLikeGroup =
      String(hubDetails?.type ?? hubDetails?.kind ?? hubDetails?.conversationType ?? '')
        .toUpperCase()
        .includes('GROUP') &&
      !String(hubDetails?.type ?? hubDetails?.kind ?? '').toUpperCase().includes('HUB');

    const result = looksLikeGroup
      ? await leaveConversation(conversation.id, false)
      : await leaveConversation(hubId, true);

    setLeaving(false);

    if (!result.ok) {
      const message = result.error || 'Failed to leave hub.';
      setError(message);
      toast.error(message);
      return;
    }

    toast.success(`Left "${hubName}".`);
    onConversationUpdated();
    onClose();
  };

  const handleDelete = async () => {
    const hubName = displayName.trim() || conversation.title;
    const confirmed = await confirm({
      title: 'Delete hub',
      message: `Delete "${hubName}" permanently? All messages and members will be removed. This cannot be undone.`,
      confirmLabel: 'Delete hub',
      tone: 'danger',
    });

    if (!confirmed) {
      return;
    }

    setDeleting(true);
    setError('');

    const result = await deleteHubChannel(conversation.id);

    setDeleting(false);

    if (!result.ok) {
      const message = result.error || 'Failed to delete hub.';
      setError(message);
      toast.error(message);
      return;
    }

    toast.success(`"${hubName}" deleted.`);
    onHubDeleted();
    onClose();
  };

  const handleRevokeInvite = async (invite: ChannelInviteItem) => {
    const inviteLabel = invite.username || invite.email || 'this user';
    const confirmed = await confirm({
      title: 'Revoke invite',
      message: `Revoke the hub invite for ${inviteLabel}? They will no longer be able to join with this invite.`,
      confirmLabel: 'Revoke invite',
      tone: 'danger',
    });

    if (!confirmed) {
      return;
    }

    setRevokingInviteId(invite.id);
    setError('');

    const result = await revokeHubChannelInvite(conversation.id, invite.id);

    setRevokingInviteId(null);

    if (!result.ok) {
      setError(result.error);
      toast.error(result.error);
      return;
    }

    toast.success('Invite revoked.');
    void loadPendingInvites();
  };

  return (
    <div className="flex h-full w-[350px] shrink-0 flex-col border-l border-app-border bg-app-inset font-sans text-app-text">
      <header className="flex flex-col border-b border-app-border/40 p-5">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <span className="mb-1 block text-[10px] font-bold tracking-wider text-app-muted uppercase">Hub</span>
            <h2 className="truncate text-lg font-semibold text-app-text">{displayName || conversation.title}</h2>
            <p className="mt-1 text-xs text-app-muted">
              {refreshing ? 'Refreshing hub details...' : subtitle}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-app-muted transition-colors hover:bg-app-chat-hover hover:text-app-text"
            aria-label="Close hub panel"
          >
            <FiX className="text-lg" />
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {isAdmin ? (
          <section className="border-b border-app-border/40 p-5">
            <span className="mb-3 block text-[10px] font-bold tracking-wider text-app-muted uppercase">Hub details</span>

            <label className="mb-1 block text-xs text-app-muted">Display name</label>
            <input
              type="text"
              value={displayName}
              disabled={saving}
              className="mb-2 w-full rounded-xl border border-app-border bg-app-elevated px-3 py-2.5 text-sm text-app-text outline-none focus:border-accent disabled:opacity-60"
              onChange={(event) => setDisplayName(event.target.value)}
            />
            <p className="mb-3 text-xs text-app-muted">
              {memberCount} member{memberCount === 1 ? '' : 's'} · {adminCount} admin
              {adminCount === 1 ? '' : 's'}
            </p>

            {slug ? <p className="mb-3 text-xs text-app-muted">Slug: #{slug}</p> : null}

            <label className="mb-1 block text-xs text-app-muted">Description</label>
            <textarea
              value={description}
              maxLength={500}
              rows={4}
              disabled={saving}
              placeholder="Describe this hub..."
              className="mb-1 w-full resize-none rounded-xl border border-app-border bg-app-elevated px-3 py-2.5 text-sm text-app-text outline-none focus:border-accent disabled:opacity-60"
              onChange={(event) => setDescription(event.target.value)}
            />
            <p className="mb-4 text-right text-xs text-app-muted">{description.length}/500</p>

            <button
              type="button"
              disabled={saving}
              className="w-full rounded-xl bg-accent py-3 text-sm font-semibold text-white transition-opacity disabled:opacity-50"
              onClick={() => {
                void handleSaveDetails();
              }}
            >
              {saving ? 'Saving...' : 'Save hub details'}
            </button>
          </section>
        ) : description.trim() ? (
          <section className="border-b border-app-border/40 p-5">
            <span className="mb-2 block text-[10px] font-bold tracking-wider text-app-muted uppercase">About</span>
            <p className="text-sm leading-relaxed text-app-text">{description.trim()}</p>
          </section>
        ) : null}

        {isAdmin ? (
          <section className="border-b border-app-border/40 p-5">
            <span className="mb-3 block text-[10px] font-bold tracking-wider text-app-muted uppercase">Hub settings</span>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-app-text">Read receipts</p>
                <p className="text-xs text-app-muted">Show when members have read messages.</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={readReceiptsEnabled}
                disabled={saving}
                className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
                  readReceiptsEnabled ? 'bg-accent' : 'bg-app-inset-active'
                }`}
                onClick={() => {
                  void handleReadReceiptsChange(!readReceiptsEnabled);
                }}
              >
                <span
                  className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition-transform ${
                    readReceiptsEnabled ? 'left-[22px]' : 'left-0.5'
                  }`}
                />
              </button>
            </div>
          </section>
        ) : null}

        {isAdmin ? (
          <section className="border-b border-app-border/40 p-5">
            <span className="mb-3 block text-[10px] font-bold tracking-wider text-app-muted uppercase">
              Pending invites
            </span>
            <p className="mb-3 text-xs text-app-muted">
              People invited to this hub who have not joined yet.
            </p>

            {invitesLoading ? (
              <p className="text-sm text-app-muted">Loading invites...</p>
            ) : pendingInvites.length === 0 ? (
              <p className="rounded-xl border border-dashed border-app-border px-3 py-4 text-sm text-app-muted">
                No pending invites.
              </p>
            ) : (
              <div className="space-y-2">
                {pendingInvites.map((invite) => {
                  const label = invite.username || invite.email || 'Invited user';
                  const isRevoking = revokingInviteId === invite.id;

                  return (
                    <div
                      key={invite.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-app-border bg-app-elevated px-3 py-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-app-text">{label}</p>
                        <p className="truncate text-xs text-app-muted">
                          {invite.email && invite.username ? invite.email : null}
                          {invite.createdAt ? (
                            <>
                              {invite.email && invite.username ? ' · ' : ''}
                              {formatConversationTimestamp(invite.createdAt)}
                            </>
                          ) : null}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={isRevoking || Boolean(revokingInviteId)}
                        className="flex shrink-0 items-center gap-1.5 rounded-lg border border-accent-soft/30 px-2.5 py-1.5 text-xs font-medium text-accent-soft transition-colors hover:bg-accent-soft/10 disabled:opacity-50"
                        onClick={() => {
                          void handleRevokeInvite(invite);
                        }}
                      >
                        <FiUserMinus className="text-sm" />
                        {isRevoking ? 'Revoking...' : 'Revoke'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        ) : null}

        <section className="p-5">
          <span className="mb-3 block text-[10px] font-bold tracking-wider text-app-muted uppercase">
            Snooze notifications
          </span>
          <div className="relative">
            <button
              type="button"
              disabled={snoozeSaving}
              onClick={() => setSnoozeMenuOpen((open) => !open)}
              className="flex w-full items-center justify-between rounded-xl border border-app-border bg-app-elevated px-3 py-3 text-left transition-colors hover:border-app-muted disabled:opacity-50"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-app-text">Snooze for this hub</p>
                <p className="mt-0.5 text-xs text-app-muted">
                  {snoozed
                    ? formatConversationSnoozeUntil(snoozedUntil, snoozedForever)
                    : 'Notifications on'}
                </p>
              </div>
              <FiChevronDown
                className={`ml-2 shrink-0 text-app-muted transition-transform ${snoozeMenuOpen ? 'rotate-180' : ''}`}
              />
            </button>
            {snoozeMenuOpen ? (
              <div className="absolute z-10 mt-2 w-full rounded-xl border border-app-border bg-app-elevated py-1 shadow-lg">
                {snoozed ? (
                  <button
                    type="button"
                    disabled={snoozeSaving}
                    onClick={() => {
                      void handleSnooze('off');
                    }}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-app-text hover:bg-app-chat-hover disabled:opacity-50"
                  >
                    <FiBell className="text-base text-accent-soft" />
                    Turn notifications back on
                  </button>
                ) : null}
                {CONVERSATION_SNOOZE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    disabled={snoozeSaving}
                    onClick={() => {
                      void handleSnooze(option.value);
                    }}
                    className="block w-full px-4 py-2.5 text-left text-sm text-app-text hover:bg-app-chat-hover disabled:opacity-50"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </section>
      </div>

      <div className="space-y-3 border-t border-app-border/40 bg-app-inset p-5">
        {error ? (
          <p className="text-center text-xs text-accent-soft" role="alert">
            {error}
          </p>
        ) : null}

        {isAdmin ? (
          <button
            type="button"
            disabled={deleting || leaving}
            className="w-full rounded-2xl border border-accent-soft/30 bg-transparent px-4 py-3.5 text-sm font-semibold text-accent-soft transition-colors hover:bg-accent-soft/10 disabled:opacity-50"
            onClick={() => {
              void handleDelete();
            }}
          >
            {deleting ? 'Deleting...' : 'Delete hub'}
          </button>
        ) : null}

        <button
          type="button"
          disabled={leaving || deleting}
          className="w-full rounded-2xl border border-accent-soft/30 bg-transparent px-4 py-3.5 text-sm font-semibold text-accent-soft transition-colors hover:bg-accent-soft/10 disabled:opacity-50"
          onClick={() => {
            void handleLeave();
          }}
        >
          {leaving ? 'Leaving...' : 'Leave Hub'}
        </button>
      </div>
    </div>
  );
}
