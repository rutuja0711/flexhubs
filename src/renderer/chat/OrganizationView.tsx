import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FiEdit2,
  FiBriefcase,
  FiFileText,
  FiLogOut,
  FiSend,
  FiTrash2,
  FiUserPlus,
  FiUsers,
} from 'react-icons/fi';
import {
  billingPeriodLabel,
  billingPeriodMultiplier,
  calculatePlanTotal,
  getDefaultPaymentPlans,
  type OrgSubscriptionInfo,
  type PaymentPlanItem,
} from '../../shared/payments';
import type {
  OrganizationInviteItem,
  OrganizationRoleItem,
  OrganizationSeatsInfo,
  OrgInvoiceItem,
} from '../../shared/organization';
import { toProductionRegisterUrl } from '../../shared/organization';
import { normalizeUserProfile, type OrganizationMemberItem } from '../../shared/profile';
import type { WorkspaceBillingPeriod, WorkspacePlanId } from '../../shared/workspace';
import { getUserId } from '../../shared/user';
import {
  createOrganizationRole,
  createUpgradeOrder,
  deleteOrganizationRole,
  updateOrganizationRole,
  leaveOrganizationWorkspace,
  loadOrgInvoiceById,
  loadOrgInvoices,
  loadOrgSubscription,
  loadOrganizationInvites,
  loadOrganizationMembersAdmin,
  loadOrganizationRoles,
  loadOrganizationSeats,
  loadPaymentPlans,
  loadPlanCompliance,
  removeOrganizationMember,
  revokeOrganizationInvite,
  sendOrganizationInvite,
  verifyUpgradeSubscription,
} from '../organizationApi';
import { useConfirm } from '../ui/ConfirmDialog';
import { useToast } from '../ui/Toast';

type OrganizationViewProps = {
  user: unknown;
  onUnauthorized: (status?: number) => boolean;
  onLeftOrganization?: () => void;
};

function loadRazorpay(): Promise<boolean> {
  return new Promise((resolve) => {
    if ((window as Window & { Razorpay?: unknown }).Razorpay) {
      resolve(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

function formatDate(value: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function planSeatLabel(plan: PaymentPlanItem): string {
  if (plan.maxSeats) {
    return `${plan.minSeats}–${plan.maxSeats} seats`;
  }

  return `${plan.minSeats}+ members`;
}

export function OrganizationView({ user, onUnauthorized, onLeftOrganization }: OrganizationViewProps) {
  const toast = useToast();
  const confirm = useConfirm();
  const profile = normalizeUserProfile(user);
  const currentUserId = getUserId(user);

  const role = profile.organizationRole || 'Member';
  const isAdmin =
    role === 'Admin' ||
    role === 'Director' ||
    role === 'Founder' ||
    role.toLowerCase().includes('admin');

  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<PaymentPlanItem[]>(getDefaultPaymentPlans());
  const [subscription, setSubscription] = useState<OrgSubscriptionInfo | null>(null);
  const [seats, setSeats] = useState<OrganizationSeatsInfo>({ used: 0, total: 0, remaining: 0 });
  const [members, setMembers] = useState<OrganizationMemberItem[]>([]);
  const [roles, setRoles] = useState<OrganizationRoleItem[]>([]);
  const [invites, setInvites] = useState<OrganizationInviteItem[]>([]);
  const [invoices, setInvoices] = useState<OrgInvoiceItem[]>([]);
  const [complianceRules, setComplianceRules] = useState<string[]>([]);

  const [billingPeriod, setBillingPeriod] = useState<WorkspaceBillingPeriod>('monthly');
  const [selectedPlanId, setSelectedPlanId] = useState<WorkspacePlanId>('team');
  const [teamSize, setTeamSize] = useState(11);
  const [newRoleName, setNewRoleName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRoleId, setInviteRoleId] = useState('');
  const [lastInviteLink, setLastInviteLink] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [sendingInvite, setSendingInvite] = useState(false);

  const selectedPlan = plans.find((plan) => plan.id === selectedPlanId) ?? plans[1] ?? plans[0];
  const pricing = useMemo(
    () => calculatePlanTotal(selectedPlan?.pricePerMember ?? 0, teamSize, billingPeriod),
    [billingPeriod, selectedPlan?.pricePerMember, teamSize],
  );

  const loadAll = useCallback(async () => {
    setLoading(true);

    const [
      plansResult,
      subscriptionResult,
      seatsResult,
      membersResult,
      rolesResult,
      invitesResult,
      invoicesResult,
    ] = await Promise.all([
      loadPaymentPlans(),
      loadOrgSubscription(),
      loadOrganizationSeats(),
      loadOrganizationMembersAdmin(),
      loadOrganizationRoles(),
      loadOrganizationInvites(),
      loadOrgInvoices(),
    ]);

    if (
      [subscriptionResult, seatsResult, membersResult, rolesResult, invitesResult, invoicesResult].some(
        (result) => !result.ok && onUnauthorized(result.status),
      )
    ) {
      return;
    }

    if (plansResult.ok) {
      setPlans(plansResult.data);
    }

    if (subscriptionResult.ok && subscriptionResult.data) {
      setSubscription(subscriptionResult.data);
      setSelectedPlanId(subscriptionResult.data.planId);
      setBillingPeriod(subscriptionResult.data.billingPeriod);
      setTeamSize(subscriptionResult.data.teamSize || teamSize);
    }

    if (seatsResult.ok) setSeats(seatsResult.data);
    if (membersResult.ok) setMembers(membersResult.data);
    if (rolesResult.ok) setRoles(rolesResult.data);
    if (invitesResult.ok) setInvites(invitesResult.data);
    if (invoicesResult.ok) setInvoices(invoicesResult.data);

    setLoading(false);
  }, [onUnauthorized]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!isAdmin || !selectedPlanId) return;

    void loadPlanCompliance(selectedPlanId, teamSize).then((result) => {
      if (result.ok) {
        setComplianceRules(result.data.rules);
      }
    });
  }, [isAdmin, selectedPlanId, teamSize]);

  const handlePayUpgrade = async () => {
    if (!isAdmin || selectedPlan.contactOnly) {
      toast.info('Contact FlexHubs support for custom workspace pricing.');
      return;
    }

    setPaying(true);

    const orderResult = await createUpgradeOrder({
      planId: selectedPlanId,
      billingPeriod,
      teamSize,
    });

    if (!orderResult.ok) {
      setPaying(false);
      toast.error(orderResult.error);
      return;
    }

    const razorpayReady = await loadRazorpay();

    if (!razorpayReady) {
      setPaying(false);
      toast.error('Payment checkout failed to load.');
      return;
    }

    setPaying(false);

    const order = orderResult.data;
    const Razorpay = (
      window as Window & { Razorpay?: new (options: Record<string, unknown>) => { open: () => void } }
    ).Razorpay;

    if (!Razorpay) {
      toast.error('Payment checkout failed to load.');
      return;
    }

    const paymentObject = new Razorpay({
      key: order.key || 'rzp_test_placeholder',
      amount: order.amount,
      currency: order.currency || 'INR',
      name: 'FlexHubs',
      description: `${selectedPlan.name} Plan - ${teamSize} seats`,
      order_id: order.id,
      handler: (response: {
        razorpay_payment_id: string;
        razorpay_order_id: string;
        razorpay_signature: string;
      }) => {
        void (async () => {
          setPaying(true);
          const verifyResult = await verifyUpgradeSubscription({
            paymentId: response.razorpay_payment_id,
            orderId: response.razorpay_order_id,
            signature: response.razorpay_signature,
            planId: selectedPlanId,
            billingPeriod,
            teamSize,
          });
          setPaying(false);

          if (!verifyResult.ok) {
            toast.error(verifyResult.error);
            return;
          }

          toast.success('Subscription updated successfully.');
          void loadAll();
        })();
      },
      theme: { color: '#F43F5E' },
    });

    paymentObject.open();
  };

  const handleSendInvite = async () => {
    const email = inviteEmail.trim();
    if (!email) {
      toast.error('Enter an email address.');
      return;
    }

    setSendingInvite(true);
    const result = await sendOrganizationInvite(email, inviteRoleId || null);
    setSendingInvite(false);

    if (!result.ok) {
      if (onUnauthorized(result.status)) return;
      toast.error(result.error);
      return;
    }

    setInviteEmail('');
    setInvites(result.data);

    const sentInvite = result.data.find((item) => item.email.toLowerCase() === email.toLowerCase());
    const registerLink = toProductionRegisterUrl(sentInvite?.registerUrl);
    if (registerLink) {
      setLastInviteLink(registerLink);
    }

    toast.success(
      registerLink
        ? 'Invitation sent. Copy the registration link below if the email link does not work.'
        : 'Invitation sent.',
    );
    void loadOrganizationSeats().then((seatsResult) => {
      if (seatsResult.ok) setSeats(seatsResult.data);
    });
  };

  const handleAddRole = async () => {
    const name = newRoleName.trim();
    if (!name) {
      toast.error('Enter a role name.');
      return;
    }

    const result = await createOrganizationRole(name);
    if (!result.ok) {
      if (onUnauthorized(result.status)) return;
      toast.error(result.error);
      return;
    }

    setNewRoleName('');

    if (result.data.length > 0) {
      setRoles(result.data);
    } else {
      const reload = await loadOrganizationRoles();
      if (reload.ok) setRoles(reload.data);
    }

    toast.success(`Role "${name}" added.`);
  };

  const handleEditRole = async (role: OrganizationRoleItem) => {
    const nextName = window.prompt('Rename role', role.name)?.trim();
    if (!nextName || nextName === role.name) return;

    const result = await updateOrganizationRole(role.id, nextName);
    if (!result.ok) {
      if (onUnauthorized(result.status)) return;
      toast.error(result.error);
      return;
    }

    setRoles(result.data);
    toast.success('Role updated.');
  };

  const handleDeleteRole = async (role: OrganizationRoleItem) => {
    const confirmed = await confirm({
      title: 'Delete role',
      message: `Delete the "${role.name}" role? Members with this role may need to be reassigned.`,
      confirmLabel: 'Delete role',
      tone: 'danger',
    });

    if (!confirmed) return;

    const result = await deleteOrganizationRole(role.id);
    if (!result.ok) {
      if (onUnauthorized(result.status)) return;
      toast.error(result.error);
      return;
    }

    setRoles(result.data);
    toast.success('Role deleted.');
  };

  const handleRevokeInvite = async (invite: OrganizationInviteItem) => {
    const result = await revokeOrganizationInvite(invite.id);
    if (!result.ok) {
      if (onUnauthorized(result.status)) return;
      toast.error(result.error);
      return;
    }

    setInvites(result.data);
    toast.success('Invitation revoked.');
  };

  const handleRemoveMember = async (member: OrganizationMemberItem) => {
    const confirmed = await confirm({
      title: 'Remove member',
      message: `Remove ${member.name} from the organization?`,
      confirmLabel: 'Remove',
      tone: 'danger',
    });

    if (!confirmed) return;

    const result = await removeOrganizationMember(member.id);
    if (!result.ok) {
      if (onUnauthorized(result.status)) return;
      toast.error(result.error);
      return;
    }

    toast.success(`${member.name} removed.`);
    void loadAll();
  };

  const handleViewInvoice = async (invoiceId: string) => {
    const result = await loadOrgInvoiceById(invoiceId);
    if (!result.ok) {
      if (onUnauthorized(result.status)) return;
      toast.error(result.error);
      return;
    }

    if (result.data.url) {
      window.open(result.data.url, '_blank', 'noopener,noreferrer');
      return;
    }

    toast.info(
      `${result.data.invoiceNumber} · ${formatDate(result.data.date)} · ${result.data.planLabel} · ₹${result.data.amount.toLocaleString()}`,
    );
  };

  const handleLeave = async () => {
    const confirmed = await confirm({
      title: 'Leave organization',
      message: 'Leave this workspace? You will lose access to organization chats and hubs.',
      confirmLabel: 'Leave organization',
      tone: 'danger',
    });

    if (!confirmed) return;

    const result = await leaveOrganizationWorkspace();
    if (!result.ok) {
      if (onUnauthorized(result.status)) return;
      toast.error(result.error);
      return;
    }

    toast.success('You left the organization.');
    onLeftOrganization?.();
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-app-chat-bg text-app-muted">
        Loading organization...
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-app-chat-bg px-6 py-6 text-app-text">
      <div className="mx-auto max-w-5xl space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-app-text">Organization</h1>
          {isAdmin ? (
            <span className="rounded-md border border-red-500/25 px-2 py-0.5 text-[11px] font-medium text-red-400">
              Admin
            </span>
          ) : null}
        </div>

        {subscription ? (
          <section className="rounded-xl border border-app-border bg-app-surface p-4">
            <p className="text-[10px] font-medium uppercase tracking-wide text-app-muted">Active plan</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold text-app-text">{subscription.planName}</h2>
              <span className="rounded-full bg-[#3ecf8e]/15 px-2 py-0.5 text-[11px] font-medium text-[#3ecf8e] capitalize">
                {subscription.status}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-xs md:grid-cols-4">
              <div>
                <p className="text-app-muted">Team size</p>
                <p className="mt-0.5 font-medium text-app-text">
                  {subscription.teamSize} members · {subscription.usedSeats} in use
                </p>
              </div>
              <div>
                <p className="text-app-muted">Billing</p>
                <p className="mt-0.5 font-medium text-app-text">{billingPeriodLabel(subscription.billingPeriod)}</p>
              </div>
              <div>
                <p className="text-app-muted">Activated</p>
                <p className="mt-0.5 font-medium text-app-text">{formatDate(subscription.activatedAt)}</p>
              </div>
              <div>
                <p className="text-app-muted">Renews</p>
                <p className="mt-0.5 font-medium text-app-text">{formatDate(subscription.renewsAt)}</p>
              </div>
            </div>
          </section>
        ) : null}

        {isAdmin ? (
          <section className="rounded-xl border border-app-border bg-app-surface p-4">
            <div className="mb-4 flex justify-center">
              <div className="inline-flex rounded-lg bg-app-surface-input p-0.5">
                {(['monthly', '6months', 'annual'] as WorkspaceBillingPeriod[]).map((period) => (
                  <button
                    key={period}
                    type="button"
                    onClick={() => setBillingPeriod(period)}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                      billingPeriod === period ? 'bg-app-chat-active text-app-text' : 'text-app-muted hover:text-app-text'
                    }`}
                  >
                    {billingPeriodLabel(period)}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
              {plans.map((plan, index) => {
                const isSelected = selectedPlanId === plan.id;
                const isCurrent = subscription?.planId === plan.id;

                return (
                  <button
                    key={`${plan.id}-${index}`}
                    type="button"
                    onClick={() => {
                      setSelectedPlanId(plan.id);
                      if (!plan.contactOnly) setTeamSize(plan.minSeats);
                    }}
                    className={`relative rounded-lg border p-3 text-left transition-all ${
                      isSelected
                        ? 'border-accent ring-1 ring-accent/40 bg-accent/[0.06]'
                        : 'border-app-border hover:border-app-border-strong'
                    }`}
                  >
                    {isSelected ? (
                      <span className="absolute top-2 right-2 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[10px] text-white">
                        ✓
                      </span>
                    ) : null}
                    {isCurrent ? (
                      <span className="mb-1 inline-block rounded bg-app-chat-hover px-1.5 py-0.5 text-[9px] font-semibold uppercase">
                        Current
                      </span>
                    ) : null}
                    <p className="text-sm font-medium text-app-text">{plan.name}</p>
                    {plan.contactOnly ? (
                      <p className="mt-1 text-sm font-semibold text-accent">Contact us</p>
                    ) : (
                      <p className="mt-1 text-lg font-semibold text-app-text">₹{plan.pricePerMember}</p>
                    )}
                    <p className="mt-1 text-[10px] leading-snug text-app-muted">
                      {plan.contactOnly ? plan.features : `${planSeatLabel(plan)} · ${plan.adminCount} admin${plan.adminCount === 1 ? '' : 's'}`}
                    </p>
                  </button>
                );
              })}
            </div>

            {!selectedPlan.contactOnly ? (
              <div className="space-y-3 rounded-lg border border-app-border bg-app-surface-input p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-app-text">Team size</p>
                    <p className="text-[11px] text-app-muted">
                      {selectedPlan.minSeats}
                      {selectedPlan.maxSeats ? `–${selectedPlan.maxSeats}` : '+'} on {selectedPlan.name}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setTeamSize(Math.max(selectedPlan.minSeats, teamSize - 1))}
                      className="flex h-7 w-7 items-center justify-center rounded-md bg-app-chat-active text-sm hover:bg-app-chat-hover"
                    >
                      −
                    </button>
                    <span className="min-w-[1.5rem] text-center text-sm font-medium">{teamSize}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setTeamSize(
                          selectedPlan.maxSeats ? Math.min(selectedPlan.maxSeats, teamSize + 1) : teamSize + 1,
                        )
                      }
                      className="flex h-7 w-7 items-center justify-center rounded-md bg-app-chat-active text-sm hover:bg-app-chat-hover"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="text-xs text-app-muted">
                  <p>
                    {teamSize} × ₹{selectedPlan.pricePerMember} × {billingPeriodMultiplier(billingPeriod)} mo ={' '}
                    <span className="text-app-text">₹{pricing.subtotal.toLocaleString()}</span>
                  </p>
                  <p>
                    GST (18%): <span className="text-app-text">₹{pricing.gst.toLocaleString()}</span>
                  </p>
                  <p className="mt-1 text-sm font-semibold text-app-text">Total: ₹{pricing.total.toLocaleString()}</p>
                </div>

                {complianceRules.length > 0 ? (
                  <ul className="list-disc space-y-0.5 pl-4 text-[11px] text-app-muted">
                    {complianceRules.map((rule) => (
                      <li key={rule}>{rule}</li>
                    ))}
                  </ul>
                ) : null}

                <button
                  type="button"
                  disabled={paying}
                  onClick={() => {
                    void handlePayUpgrade();
                  }}
                  className="w-full rounded-lg bg-accent py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {paying ? 'Processing…' : `Pay ₹${pricing.total.toLocaleString()} & update`}
                </button>
              </div>
            ) : null}
          </section>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-2">
          {isAdmin ? (
            <section className="rounded-xl border border-app-border bg-app-surface p-4">
              <div className="mb-3 flex items-center gap-2">
                <FiUserPlus className="text-accent" size={16} />
                <div>
                  <h3 className="text-sm font-semibold text-app-text">Invite members</h3>
                  <p className="text-[11px] text-app-muted">
                    {seats.used}/{seats.total || subscription?.teamSize || teamSize} seats · {seats.remaining} left
                  </p>
                </div>
              </div>
              <input
                type="email"
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                placeholder="colleague@company.com"
                className="mb-2 w-full rounded-lg border border-app-border bg-app-surface-input px-3 py-2 text-sm focus:border-accent focus:outline-none"
              />
              <select
                value={inviteRoleId}
                onChange={(event) => setInviteRoleId(event.target.value)}
                className="mb-3 w-full rounded-lg border border-app-border bg-app-surface-input px-3 py-2 text-sm focus:border-accent focus:outline-none"
              >
                <option value="">No role assigned</option>
                {roles.map((roleItem) => (
                  <option key={roleItem.id} value={roleItem.id}>
                    {roleItem.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={sendingInvite}
                onClick={() => {
                  void handleSendInvite();
                }}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-accent py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                <FiSend size={14} />
                {sendingInvite ? 'Sending…' : 'Send invitation'}
              </button>
              {lastInviteLink ? (
                <div className="mt-3 rounded-lg border border-accent-soft/30 bg-accent-soft/5 p-3">
                  <p className="mb-2 text-[11px] text-app-muted">
                    Registration link (use this if the email button is broken):
                  </p>
                  <p className="mb-2 break-all text-[11px] text-app-text">{lastInviteLink}</p>
                  <button
                    type="button"
                    className="text-[11px] font-medium text-accent-soft hover:underline"
                    onClick={() => {
                      void navigator.clipboard.writeText(lastInviteLink).then(() => {
                        toast.success('Invite link copied.');
                      });
                    }}
                  >
                    Copy link
                  </button>
                </div>
              ) : null}
              <div className="mt-3 space-y-1.5">
                {invites.length === 0 ? (
                  <p className="text-xs text-app-muted">No pending invitations.</p>
                ) : (
                  invites.map((invite) => (
                    <div
                      key={invite.id}
                      className="flex items-center justify-between rounded-lg border border-app-border px-2.5 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-xs text-app-text">{invite.email}</p>
                        <p className="text-[10px] text-app-muted">{invite.role}</p>
                      </div>
                      <button
                        type="button"
                        className="shrink-0 text-[11px] text-accent-soft hover:underline"
                        onClick={() => {
                          void handleRevokeInvite(invite);
                        }}
                      >
                        Revoke
                      </button>
                    </div>
                  ))
                )}
              </div>
            </section>
          ) : null}

          {isAdmin ? (
            <section className="rounded-xl border border-app-border bg-app-surface p-4">
              <div className="mb-3 flex items-center gap-2">
                <FiBriefcase className="text-accent" size={16} />
                <div>
                  <h3 className="text-sm font-semibold text-app-text">Roles</h3>
                  <p className="text-[11px] text-app-muted">
                    {roles.length} roles · {members.length} members
                  </p>
                </div>
              </div>
              <form
                className="mb-3 flex gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleAddRole();
                }}
              >
                <input
                  type="text"
                  value={newRoleName}
                  onChange={(event) => setNewRoleName(event.target.value)}
                  placeholder="Engineer, Designer…"
                  className="min-w-0 flex-1 rounded-lg border border-app-border bg-app-surface-input px-3 py-2 text-sm focus:border-accent focus:outline-none"
                />
                <button
                  type="submit"
                  className="shrink-0 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-hover"
                >
                  Add
                </button>
              </form>
              <div className="flex flex-wrap gap-1.5">
                {roles.map((roleItem) => (
                  <div
                    key={roleItem.id}
                    className="flex items-center gap-1.5 rounded-md border border-app-border px-2 py-1"
                  >
                    <span className="text-xs text-app-text">{roleItem.name}</span>
                    <span className="text-[10px] text-app-muted">({roleItem.memberCount})</span>
                    <button
                      type="button"
                      aria-label={`Edit ${roleItem.name}`}
                      className="text-app-muted hover:text-app-text"
                      onClick={() => {
                        void handleEditRole(roleItem);
                      }}
                    >
                      <FiEdit2 size={12} />
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${roleItem.name}`}
                      className="text-app-muted hover:text-accent-soft"
                      onClick={() => {
                        void handleDeleteRole(roleItem);
                      }}
                    >
                      <FiTrash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>

        {isAdmin && invoices.length > 0 ? (
          <section className="rounded-xl border border-app-border bg-app-surface p-4">
            <div className="mb-3 flex items-center gap-2">
              <FiFileText className="text-accent" size={16} />
              <h3 className="text-sm font-semibold text-app-text">Billing history</h3>
            </div>
            <div className="overflow-hidden rounded-lg border border-app-border text-xs">
              {invoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between gap-2 border-b border-app-border/50 px-3 py-2 last:border-b-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-app-text">{invoice.invoiceNumber}</p>
                    <p className="text-[10px] text-app-muted">
                      {formatDate(invoice.date)} · {invoice.planLabel}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-app-text">₹{invoice.amount.toLocaleString()}</span>
                    <button
                      type="button"
                      className="text-accent-soft hover:underline"
                      onClick={() => {
                        void handleViewInvoice(invoice.id);
                      }}
                    >
                      View
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className="rounded-xl border border-app-border bg-app-surface p-4">
          <div className="mb-3 flex items-center gap-2">
            <FiUsers className="text-accent" size={16} />
            <h3 className="text-sm font-semibold text-app-text">Team members ({members.length})</h3>
          </div>
          <div className="space-y-1.5">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between rounded-lg border border-app-border px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-xs font-medium text-app-text">
                      {member.name}
                      {member.id === currentUserId ? ' (you)' : ''}
                    </p>
                    {member.isAdmin ? (
                      <span className="rounded border border-red-500/25 px-1.5 py-0.5 text-[9px] text-red-400">Admin</span>
                    ) : null}
                  </div>
                  <p className="truncate text-[10px] text-app-muted">
                    {member.role}
                    {member.email ? ` · ${member.email}` : ''}
                  </p>
                </div>
                {isAdmin && member.id !== currentUserId ? (
                  <button
                    type="button"
                    className="shrink-0 text-[11px] text-accent-soft hover:underline"
                    onClick={() => {
                      void handleRemoveMember(member);
                    }}
                  >
                    Remove
                  </button>
                ) : null}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              void handleLeave();
            }}
            className="mt-3 flex items-center gap-1.5 text-xs text-accent-soft hover:underline"
          >
            <FiLogOut size={12} />
            Leave organization
          </button>
        </section>
      </div>
    </div>
  );
}
