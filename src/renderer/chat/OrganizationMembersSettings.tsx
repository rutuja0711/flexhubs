import { useCallback, useState } from 'react';
import {
  FiEdit2,
  FiLogOut,
  FiMessageSquare,
  FiPhone,
  FiRepeat,
  FiShield,
  FiTrash2,
  FiUsers,
  FiVideo,
} from 'react-icons/fi';
import type { OrganizationRoleItem } from '../../shared/organization';
import type { OrganizationMemberItem } from '../../shared/profile';
import { getCurrentUser } from '../authApi';
import {
  loadOrganizationRoles,
  removeOrganizationMember,
  transferOrganizationOwnership,
  updateOrganizationMember,
} from '../organizationApi';
import { Avatar } from './ChatIcons';
import { useConfirm } from '../ui/ConfirmDialog';
import { useToast } from '../ui/Toast';

function memberRoleLabel(member: OrganizationMemberItem): string {
  const label = member.role?.trim();
  return label || 'No role';
}

function formatMemberSubline(member: OrganizationMemberItem): string {
  const email = member.email?.trim();
  const rolePart = memberRoleLabel(member);
  return email ? `${rolePart} · ${email}` : rolePart;
}

export type OrganizationMembersSettingsProps = {
  members: OrganizationMemberItem[];
  onMembersChange: (next: OrganizationMemberItem[] | ((current: OrganizationMemberItem[]) => OrganizationMemberItem[])) => void;
  roles: OrganizationRoleItem[];
  onRolesChange?: (roles: OrganizationRoleItem[]) => void;
  currentUserId: string | null;
  canManage: boolean;
  leaving: boolean;
  onLeave: () => void | Promise<void>;
  onUnauthorized: (status?: number) => boolean;
  onUserUpdated?: (user: unknown) => void;
  onOpenDirectChat?: (
    userId: string,
    options?: { displayName?: string; username?: string; avatarUrl?: string | null },
  ) => void | Promise<unknown>;
  onBeforeOpenChat?: () => void;
  onMemberCall?: (userId: string, displayName: string, video: boolean) => void | Promise<void>;
  callBusy?: boolean;
  /** Compact card for non-admin org home vs full admin section */
  variant?: 'card' | 'section';
};

export function OrganizationMembersSettings({
  members,
  onMembersChange,
  roles,
  onRolesChange,
  currentUserId,
  canManage,
  leaving,
  onLeave,
  onUnauthorized,
  onUserUpdated,
  onOpenDirectChat,
  onBeforeOpenChat,
  onMemberCall,
  callBusy = false,
  variant = 'section',
}: OrganizationMembersSettingsProps) {
  const toast = useToast();
  const confirm = useConfirm();

  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editEmail, setEditEmail] = useState('');
  const [editRoleId, setEditRoleId] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [transferringId, setTransferringId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const subtitle = canManage
    ? 'View teammates, edit email or role, transfer ownership, or remove members from your workspace.'
    : 'People in your organization.';

  const ensureRolesForEdit = useCallback(async () => {
    if (roles.length > 0 || !canManage) {
      return;
    }

    setRolesLoading(true);
    const result = await loadOrganizationRoles();
    setRolesLoading(false);

    if (result.ok) {
      onRolesChange?.(result.data);
    } else if (!onUnauthorized(result.status)) {
      toast.error(result.error);
    }
  }, [canManage, onRolesChange, onUnauthorized, roles.length, toast]);

  const openEdit = (member: OrganizationMemberItem) => {
    void ensureRolesForEdit();
    setEditingMemberId(member.id);
    setEditEmail(member.email);
    setEditRoleId(member.organizationRoleId ?? '');
  };

  const closeEdit = () => {
    if (savingEdit) return;
    setEditingMemberId(null);
  };

  const handleSaveEdit = async () => {
    const member = members.find((row) => row.id === editingMemberId);
    if (!member) return;

    const normalizedEmail = editEmail.trim().toLowerCase();
    if (!normalizedEmail) {
      toast.error('Email is required.');
      return;
    }

    const patch: { email?: string; organizationRoleId?: string | null } = {};
    const previousEmail = member.email.trim().toLowerCase();

    if (normalizedEmail !== previousEmail) {
      patch.email = normalizedEmail;
    }

    const previousRoleId = member.organizationRoleId ?? '';
    if (editRoleId !== previousRoleId) {
      patch.organizationRoleId = editRoleId ? editRoleId : null;
    }

    if (Object.keys(patch).length === 0) {
      toast.info('No changes to save.');
      setEditingMemberId(null);
      return;
    }

    setSavingEdit(true);
    const result = await updateOrganizationMember(member.id, patch);
    setSavingEdit(false);

    if (!result.ok) {
      if (onUnauthorized(result.status)) return;
      if (result.status === 409) {
        toast.error('That email is already in use.');
        return;
      }
      toast.error(result.error);
      return;
    }

    const updated = result.data;
    onMembersChange((current) => current.map((row) => (row.id === updated.id ? updated : row)));
    setEditingMemberId(null);
    toast.success('Member updated.');

    if (updated.id === currentUserId) {
      const meResult = await getCurrentUser();
      if (meResult.ok) {
        const userPayload = meResult.data.user ?? meResult.data;
        onUserUpdated?.(userPayload);
      }
    }
  };

  const handleTransfer = async (member: OrganizationMemberItem) => {
    const confirmed = await confirm({
      title: 'Transfer ownership?',
      message: `Transfer organization ownership to ${member.name}? You will lose admin controls and billing access. This cannot be undone from the app without another transfer.`,
      confirmLabel: 'Transfer ownership',
      tone: 'danger',
    });

    if (!confirmed) return;

    setTransferringId(member.id);
    const result = await transferOrganizationOwnership(member.id);
    setTransferringId(null);

    if (!result.ok) {
      if (onUnauthorized(result.status)) return;
      toast.error(result.error);
      return;
    }

    const newOwnerId = result.data.newOwnerId ?? member.id;
    onMembersChange((current) =>
      current.map((row) => {
        if (row.id === currentUserId) {
          return { ...row, isAdmin: false, isOwner: false };
        }
        if (row.id === newOwnerId) {
          return { ...row, isAdmin: true, isOwner: true };
        }
        return row;
      }),
    );

    onUserUpdated?.(result.data.user);
    toast.success(
      result.data.organizationName
        ? `Ownership transferred. ${result.data.organizationName} is now owned by ${member.name}.`
        : 'Ownership transferred.',
    );
  };

  const handleRemove = async (member: OrganizationMemberItem) => {
    const confirmed = await confirm({
      title: 'Remove member',
      message: `Remove ${member.name} from the organization?`,
      confirmLabel: 'Remove',
      tone: 'danger',
    });

    if (!confirmed) return;

    setRemovingId(member.id);
    const result = await removeOrganizationMember(member.id);
    setRemovingId(null);

    if (!result.ok) {
      if (onUnauthorized(result.status)) return;
      toast.error(result.error);
      return;
    }

    onMembersChange((current) => current.filter((row) => row.id !== member.id));
    toast.success(`${member.name} removed.`);
  };

  const handleLeaveClick = async () => {
    const message = canManage
      ? 'You will lose access to this workspace, organization chats, and hubs. If you are the only admin, another member may be promoted. This cannot be undone from the app.'
      : 'You will lose access to this workspace, organization chats, and hubs. This cannot be undone from the app.';

    const confirmed = await confirm({
      title: 'Leave organization?',
      message,
      confirmLabel: 'Leave organization',
      cancelLabel: 'Stay',
      tone: 'danger',
    });

    if (!confirmed) return;
    await onLeave();
  };

  const handleMessage = (member: OrganizationMemberItem) => {
    onBeforeOpenChat?.();
    void onOpenDirectChat?.(member.id, {
      displayName: member.name,
      username: member.username,
      avatarUrl: member.avatarUrl,
    });
  };

  const listBody = (
    <div className="space-y-2.5">
      {members.map((member) => {
        const isSelf = member.id === currentUserId;
        const isEditing = editingMemberId === member.id;
        const displayName = `${member.name}${isSelf ? ' (you)' : ''}`;

        return (
          <div
            key={member.id}
            className="rounded-2xl border border-app-border bg-white p-3.5 shadow-xs transition-colors dark:bg-app-surface-input"
          >
            <div className="flex items-center gap-3.5">
              <Avatar imageUrl={member.avatarUrl} initials={member.initials} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-sm font-medium text-app-text">{displayName}</span>
                  {member.isAdmin ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-semibold text-accent">
                      <FiShield className="text-[10px]" aria-hidden="true" />
                      Admin
                    </span>
                  ) : null}
                </div>
                <p className="mt-0.5 truncate text-xs text-app-muted">{formatMemberSubline(member)}</p>
              </div>

              <div className="flex shrink-0 items-center gap-0.5">
                {!isSelf ? (
                  <>
                    {onOpenDirectChat ? (
                      <button
                        type="button"
                        title={`Message ${member.name}`}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-app-muted transition-colors hover:bg-app-inset hover:text-accent-soft"
                        onClick={() => handleMessage(member)}
                      >
                        <FiMessageSquare className="h-[17px] w-[17px]" strokeWidth={1.75} aria-hidden="true" />
                      </button>
                    ) : null}
                    {onMemberCall ? (
                      <>
                        <button
                          type="button"
                          title={`Call ${member.name}`}
                          disabled={callBusy}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-app-muted transition-colors hover:bg-app-inset hover:text-accent-soft disabled:opacity-40"
                          onClick={() => {
                            void onMemberCall(member.id, member.name, false);
                          }}
                        >
                          <FiPhone className="h-[16px] w-[16px]" strokeWidth={1.75} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          title={`Video call ${member.name}`}
                          disabled={callBusy}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-app-muted transition-colors hover:bg-app-inset hover:text-accent-soft disabled:opacity-40"
                          onClick={() => {
                            void onMemberCall(member.id, member.name, true);
                          }}
                        >
                          <FiVideo className="h-[17px] w-[17px]" strokeWidth={1.75} aria-hidden="true" />
                        </button>
                      </>
                    ) : null}
                  </>
                ) : null}

                {canManage ? (
                  <>
                    {!isSelf && (onOpenDirectChat || onMemberCall) ? (
                      <span className="mx-1 h-5 w-px bg-app-border" aria-hidden="true" />
                    ) : null}
                    <button
                      type="button"
                      title={`Edit ${member.name}`}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-app-muted transition-colors hover:bg-app-inset hover:text-app-text"
                      onClick={() => openEdit(member)}
                    >
                      <FiEdit2 className="h-[15px] w-[15px]" strokeWidth={1.75} aria-hidden="true" />
                    </button>
                    {!isSelf ? (
                      <>
                        <button
                          type="button"
                          title={`Transfer ownership to ${member.name}`}
                          disabled={transferringId === member.id}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-app-muted transition-colors hover:bg-app-inset hover:text-accent-soft disabled:opacity-40"
                          onClick={() => {
                            void handleTransfer(member);
                          }}
                        >
                          <FiRepeat className="h-[16px] w-[16px]" strokeWidth={1.75} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          title={`Remove ${member.name}`}
                          disabled={removingId === member.id}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-app-muted transition-colors hover:bg-app-inset hover:text-accent-soft disabled:opacity-40"
                          onClick={() => {
                            void handleRemove(member);
                          }}
                        >
                          <FiTrash2 className="h-[15px] w-[15px]" strokeWidth={1.75} aria-hidden="true" />
                        </button>
                      </>
                    ) : null}
                  </>
                ) : null}
              </div>
            </div>

            {isEditing ? (
              <div className="mt-3.5 border-t border-app-border/60 pt-3.5">
                <label className="mb-1.5 block text-xs font-medium text-app-text">Email</label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(event) => setEditEmail(event.target.value)}
                  className="mb-3 w-full rounded-lg border border-app-border bg-app-surface-input px-3 py-2 text-sm focus:border-accent focus:outline-none"
                />
                <label className="mb-1.5 block text-xs font-medium text-app-text">Organization role</label>
                <select
                  value={editRoleId}
                  disabled={rolesLoading}
                  onChange={(event) => setEditRoleId(event.target.value)}
                  className="mb-3 w-full rounded-lg border border-app-border bg-app-surface-input px-3 py-2 text-sm focus:border-accent focus:outline-none disabled:opacity-50"
                >
                  <option value="">No role assigned</option>
                  {roles.map((roleItem) => (
                    <option key={roleItem.id} value={roleItem.id}>
                      {roleItem.name}
                    </option>
                  ))}
                </select>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    disabled={savingEdit}
                    className="rounded-lg border border-app-border px-3 py-1.5 text-xs font-medium text-app-text hover:bg-app-chat-hover disabled:opacity-50"
                    onClick={closeEdit}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={savingEdit}
                    className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
                    onClick={() => {
                      void handleSaveEdit();
                    }}
                  >
                    {savingEdit ? 'Saving…' : 'Save changes'}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );

  const leaveControl =
    variant === 'card' ? (
      <div className="flex justify-center pt-2">
        <button
          type="button"
          disabled={leaving}
          onClick={() => {
            void handleLeaveClick();
          }}
          className="inline-flex items-center gap-1.5 text-xs text-red-500/70 transition-colors hover:text-red-500 disabled:opacity-50"
        >
          <FiLogOut size={13} aria-hidden="true" />
          {leaving ? 'Leaving…' : 'Leave organization'}
        </button>
      </div>
    ) : (
      <button
        type="button"
        disabled={leaving}
        onClick={() => {
          void handleLeaveClick();
        }}
        className="mt-4 inline-flex items-center gap-2 rounded-xl border border-red-500/40 px-4 py-2.5 text-sm font-semibold text-red-400 hover:bg-red-500/10 disabled:opacity-50"
      >
        <FiLogOut size={16} aria-hidden="true" />
        {leaving ? 'Leaving…' : 'Leave organization'}
      </button>
    );

  if (variant === 'card') {
    return (
      <div className="space-y-5">
        <div className="overflow-hidden rounded-2xl border border-app-border bg-white shadow-sm dark:bg-app-surface">
          <div className="flex items-center gap-3.5 bg-black/[0.02] p-5 dark:bg-white/[0.02]">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
              <FiUsers size={18} aria-hidden="true" />
            </div>
            <div>
              <h3 className="flex items-center gap-2 text-sm font-bold text-app-text">
                Team members
                <span className="text-sm font-normal text-app-muted">{members.length}</span>
              </h3>
              <p className="text-xs text-app-muted">{subtitle}</p>
            </div>
          </div>
          <div className="p-4">{listBody}</div>
        </div>
        {leaveControl}
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-app-border bg-app-surface p-6">
      <div className="mb-2 flex items-center gap-2.5">
        <FiUsers className="text-accent" size={20} aria-hidden="true" />
        <h3 className="text-lg font-semibold text-app-text">
          Team members <span className="font-normal text-app-muted">{members.length}</span>
        </h3>
      </div>
      <p className="mb-5 text-sm text-app-muted">{subtitle}</p>
      {listBody}
      {leaveControl}
    </section>
  );
}