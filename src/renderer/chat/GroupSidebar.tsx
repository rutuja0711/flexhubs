import { useCallback, useEffect, useMemo, useState } from 'react';
import { FiBell, FiChevronDown, FiUserMinus, FiX } from 'react-icons/fi';
import { mapApiPresenceToStatus, type PresenceStatus } from '../../shared/chat';
import {
  formatContactPresenceLabel,
  mapContactPresenceStatus,
  presenceDotClass,
} from '../../shared/contact';
import { resolveAvatarUrl } from '../../shared/profile';
import { loadUserPresence } from '../chatApi';
import { Avatar } from './ChatIcons';
import { ConversationSharedFiles } from './ConversationSharedFiles';
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

type HubMemberDisplay = {
  id: string;
  name: string;
  bio: string | null;
  avatarUrl: string | null;
  avatarInitials: string;
  role: string;
  lastSeenAt: string | null;
  status: string | null;
};

function initialsFromName(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return name.slice(0, 2).toUpperCase();
}

function extractHubMemberDisplay(member: Record<string, unknown>): HubMemberDisplay | null {
  const user = asRecord(member.user);
  const id =
    readRecordString(user, 'id') || readRecordString(member, 'userId') || readRecordString(member, 'id');

  if (!id) {
    return null;
  }

  const name =
    readRecordString(user, 'name') ||
    readRecordString(user, 'username') ||
    readRecordString(member, 'username') ||
    'Member';

  return {
    id,
    name,
    bio: readRecordString(user, 'bio') || null,
    avatarUrl: user ? resolveAvatarUrl(user) : null,
    avatarInitials: initialsFromName(name),
    role: String(member.role ?? 'MEMBER').toUpperCase(),
    lastSeenAt: readRecordString(user, 'lastSeenAt') || readRecordString(user, 'lastSeen') || null,
    status: readRecordString(user, 'status') || readRecordString(user, 'presence') || null,
  };
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
  const [presenceByUserId, setPresenceByUserId] = useState<Map<string, PresenceStatus>>(new Map());
  const [loadedHubDetails, setLoadedHubDetails] = useState<Record<string, unknown> | null>(hubDetails);

  useEffect(() => {
    setLoadedHubDetails(hubDetails);
  }, [hubDetails]);

  const hubMembers = useMemo(
    () =>
      loadedHubDetails
        ? extractHubMembers(loadedHubDetails)
            .map(extractHubMemberDisplay)
            .filter((member): member is HubMemberDisplay => member !== null)
        : [],
    [loadedHubDetails],
  );

  const hubAdmins = useMemo(
    () => hubMembers.filter((member) => member.role === 'ADMIN' || member.role.includes('OWNER')),
    [hubMembers],
  );

  const hubRegularMembers = useMemo(
    () => hubMembers.filter((member) => !hubAdmins.some((admin) => admin.id === member.id)),
    [hubAdmins, hubMembers],
  );

  useEffect(() => {
    const userIds = hubMembers.map((member) => member.id);

    if (userIds.length === 0) {
      setPresenceByUserId(new Map());
      return;
    }

    let cancelled = false;

    void loadUserPresence(userIds).then((result) => {
      if (cancelled || !result.ok) {
        return;
      }

      const nextPresence = new Map<string, PresenceStatus>();

      for (const item of result.data) {
        const status = mapApiPresenceToStatus(item.status);

        if (status) {
          nextPresence.set(item.userId, status);
        }
      }

      setPresenceByUserId(nextPresence);
    });

    return () => {
      cancelled = true;
    };
  }, [hubMembers]);

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

        const conversationRecord = asRecord(result.data.conversation) ?? {};
        const state = deriveHubPanelState(conversationRecord, conversation, currentUserId);
        setLoadedHubDetails(conversationRecord);
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
    <div className="flex h-full w-[360px] shrink-0 flex-col border-l border-app-border/70 bg-app-surface/95 backdrop-blur-xl font-sans text-app-text shadow-2xl">
      <header className="flex flex-col border-b border-app-border/50 px-5 py-4">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <span className="mb-0.5 block text-[10px] font-bold tracking-wider text-app-muted uppercase">Hub Info</span>
            <h2 className="truncate text-base font-semibold text-app-text tracking-tight">{displayName || conversation.title}</h2>
            <p className="mt-0.5 text-xs text-app-muted">
              {refreshing ? 'Refreshing hub details...' : subtitle}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-app-muted transition-colors hover:bg-app-inset hover:text-app-text"
            aria-label="Close hub panel"
          >
            <FiX className="text-base" />
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <ConversationSharedFiles conversationId={conversation.id} />

        {hubAdmins.length > 0 ? (
          <section className="border-b border-app-border/50 p-5">
            <span className="mb-3 block text-[10px] font-bold tracking-wider text-app-muted uppercase">
              Hub admins
            </span>
            <div className="space-y-3">
              {hubAdmins.map((admin) => {
                const liveStatus = presenceByUserId.get(admin.id) ?? mapContactPresenceStatus(admin.status);
                const presenceLabel = formatContactPresenceLabel(liveStatus, admin.lastSeenAt);

                return (
                  <div key={admin.id} className="flex items-start gap-3 rounded-2xl border border-app-border/60 bg-app-card/60 p-3 shadow-xs">
                    <div className="relative shrink-0">
                      <Avatar imageUrl={admin.avatarUrl} initials={admin.avatarInitials} size="md" />
                      <span
                        className={`absolute right-0 bottom-0 h-3 w-3 rounded-full ring-2 ring-app-surface ${presenceDotClass(liveStatus)}`}
                        aria-hidden="true"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold text-app-text">{admin.name}</p>
                        <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold text-accent-soft">
                          Admin
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-app-muted">{presenceLabel}</p>
                      {admin.bio ? (
                        <p className="mt-1 text-xs leading-relaxed text-app-muted">{admin.bio}</p>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        {hubRegularMembers.length > 0 ? (
          <section className="border-b border-app-border/50 p-5">
            <span className="mb-3 block text-[10px] font-bold tracking-wider text-app-muted uppercase">
              Members
            </span>
            <div className="space-y-2">
              {hubRegularMembers.map((member) => {
                const liveStatus = presenceByUserId.get(member.id) ?? mapContactPresenceStatus(member.status);
                const presenceLabel = formatContactPresenceLabel(liveStatus, member.lastSeenAt);

                return (
                  <div key={member.id} className="flex items-center gap-3 rounded-2xl border border-app-border/60 bg-app-card/50 px-3.5 py-2.5 transition-colors hover:bg-app-card">
                    <div className="relative shrink-0">
                      <Avatar imageUrl={member.avatarUrl} initials={member.avatarInitials} size="sm" />
                      <span
                        className={`absolute right-0 bottom-0 h-2.5 w-2.5 rounded-full ring-2 ring-app-surface ${presenceDotClass(liveStatus)}`}
                        aria-hidden="true"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-app-text">{member.name}</p>
                      <p className="text-xs text-app-muted">{presenceLabel}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        {isAdmin ? (
          <section className="border-b border-app-border/50 p-5">
            <span className="mb-3 block text-[10px] font-bold tracking-wider text-app-muted uppercase">Hub details</span>

            <label className="mb-1 block text-xs font-medium text-app-muted">Display name</label>
            <input
              type="text"
              value={displayName}
              disabled={saving}
              className="mb-2 w-full rounded-xl border border-app-border/70 bg-app-surface-input px-3.5 py-2.5 text-sm text-app-text outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:opacity-60 transition-all"
              onChange={(event) => setDisplayName(event.target.value)}
            />
            <p className="mb-3 text-xs text-app-muted">
              {memberCount} member{memberCount === 1 ? '' : 's'} · {adminCount} admin
              {adminCount === 1 ? '' : 's'}
            </p>

            {slug ? <p className="mb-3 text-xs text-app-muted">Slug: #{slug}</p> : null}

            <label className="mb-1 block text-xs font-medium text-app-muted">Description</label>
            <textarea
              value={description}
              maxLength={500}
              rows={4}
              disabled={saving}
              placeholder="Describe this hub..."
              className="mb-1 w-full resize-none rounded-xl border border-app-border/70 bg-app-surface-input px-3.5 py-2.5 text-sm text-app-text outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:opacity-60 transition-all"
              onChange={(event) => setDescription(event.target.value)}
            />
            <p className="mb-4 text-right text-xs text-app-muted">{description.length}/500</p>

            <button
              type="button"
              disabled={saving}
              className="w-full rounded-xl bg-gradient-to-r from-accent to-[#632a38] py-2.5 text-sm font-semibold text-white shadow-md shadow-accent/20 transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
              onClick={() => {
                void handleSaveDetails();
              }}
            >
              {saving ? 'Saving...' : 'Save hub details'}
            </button>
          </section>
        ) : description.trim() ? (
          <section className="border-b border-app-border/50 p-5">
            <span className="mb-2 block text-[10px] font-bold tracking-wider text-app-muted uppercase">About</span>
            <p className="text-sm leading-relaxed text-app-text">{description.trim()}</p>
          </section>
        ) : null}

        {isAdmin ? (
          <section className="border-b border-app-border/50 p-5">
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
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
                  readReceiptsEnabled ? 'bg-accent' : 'bg-app-inset-active'
                }`}
                onClick={() => {
                  void handleReadReceiptsChange(!readReceiptsEnabled);
                }}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-xs transition-transform ${
                    readReceiptsEnabled ? 'left-[22px]' : 'left-0.5'
                  }`}
                />
              </button>
            </div>
          </section>
        ) : null}

        {isAdmin ? (
          <section className="border-b border-app-border/50 p-5">
            <span className="mb-3 block text-[10px] font-bold tracking-wider text-app-muted uppercase">
              Pending invites
            </span>
            <p className="mb-3 text-xs text-app-muted">
              People invited to this hub who have not joined yet.
            </p>

            {invitesLoading ? (
              <p className="text-xs text-app-muted">Loading invites...</p>
            ) : pendingInvites.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-app-border/70 p-4 text-center text-xs text-app-muted">
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
                      className="flex items-center justify-between gap-3 rounded-2xl border border-app-border/60 bg-app-card/50 px-3.5 py-2.5"
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
                        className="flex shrink-0 items-center gap-1.5 rounded-xl border border-accent-soft/30 px-2.5 py-1 text-xs font-medium text-accent-soft transition-colors hover:bg-accent-soft/10 disabled:opacity-50"
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

        <section className="border-t border-app-border/50 p-5">
          <span className="mb-3 block text-[10px] font-bold tracking-wider text-app-muted uppercase">
            Snooze notifications
          </span>
          <div className="relative">
            <button
              type="button"
              disabled={snoozeSaving}
              onClick={() => setSnoozeMenuOpen((open) => !open)}
              className="flex w-full items-center justify-between rounded-2xl border border-app-border/60 bg-app-card/60 px-3.5 py-3 text-left transition-all hover:bg-app-card hover:border-app-border disabled:opacity-50"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-app-inset text-app-muted">
                  <FiBell className="text-base" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-app-text">Snooze for this hub</p>
                  <p className="mt-0.5 text-xs text-app-muted">
                    {snoozed
                      ? formatConversationSnoozeUntil(snoozedUntil, snoozedForever)
                      : 'Notifications on'}
                  </p>
                </div>
              </div>
              <FiChevronDown
                className={`ml-2 shrink-0 text-app-muted transition-transform ${snoozeMenuOpen ? 'rotate-180' : ''}`}
              />
            </button>
            {snoozeMenuOpen ? (
              <div className="absolute z-10 mt-2 w-full rounded-2xl border border-app-border/80 bg-app-surface/95 backdrop-blur-xl p-1.5 shadow-xl">
                {snoozed ? (
                  <button
                    type="button"
                    disabled={snoozeSaving}
                    onClick={() => {
                      void handleSnooze('off');
                    }}
                    className="flex w-full items-center gap-2 rounded-xl px-3.5 py-2 text-left text-xs font-medium text-app-text hover:bg-app-inset transition-colors disabled:opacity-50"
                  >
                    <FiBell className="text-sm text-accent-soft" />
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
                    className="block w-full rounded-xl px-3.5 py-2 text-left text-xs font-medium text-app-text hover:bg-app-inset transition-colors disabled:opacity-50"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </section>
      </div>

      <div className="space-y-2 border-t border-app-border/50 bg-app-surface/60 backdrop-blur-md p-5">
        {error ? (
          <p className="text-center text-xs text-accent-soft" role="alert">
            {error}
          </p>
        ) : null}

        {isAdmin ? (
          <button
            type="button"
            disabled={deleting || leaving}
            className="w-full rounded-xl border border-accent-soft/30 bg-transparent px-4 py-2.5 text-xs font-semibold text-accent-soft transition-colors hover:bg-accent-soft/10 active:scale-[0.98] disabled:opacity-50"
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
          className="w-full rounded-xl border border-app-border bg-app-card/60 px-4 py-2.5 text-xs font-semibold text-app-text transition-colors hover:bg-app-card active:scale-[0.98] disabled:opacity-50"
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
