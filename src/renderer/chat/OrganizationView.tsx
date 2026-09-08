import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FiBriefcase,
  FiClock,
  FiCreditCard,
  FiEdit2,
  FiFileText,
  FiHeadphones,
  FiHome,
  FiLogOut,
  FiSend,
  FiTrash2,
  FiUserPlus,
  FiUsers,
  FiZap,
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
import { userIsWorkspaceOwner, type OrganizationMemberItem } from '../../shared/profile';
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
import { Avatar } from './ChatIcons';
import { useConfirm } from '../ui/ConfirmDialog';
import { useToast } from '../ui/Toast';

const DEFAULT_PLAN_RULES = [
  'Each plan covers a fixed member range: Starter 2–10, Team 11–15, Business 16–20, Custom 21+.',
  'Seat count must cover all active members and pending invites.',
  'Downgrades are blocked while admins or seats in use exceed the target plan limits.',
  'Starter has no Flex assistant. Team and Business include Flex; Business unlocks all command patterns.',
  'Custom plans (21+ members) are arranged with support — they cannot be purchased self-serve.',
];

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

  return `${plan.minSeats}+ seats`;
}

function planCardSubtitle(plan: PaymentPlanItem): string {
  if (plan.contactOnly) {
    return `${plan.minSeats}+ seats • custom limits • support@flexhub.app`;
  }

  const maxInclGst = plan.maxSeats
    ? calculatePlanTotal(plan.pricePerMember, plan.maxSeats, 'annual').total
    : 0;
  const adminLabel = `${plan.adminCount} admin${plan.adminCount === 1 ? '' : 's'}`;

  return `${planSeatLabel(plan)} • ${adminLabel} • up to ₹${maxInclGst.toLocaleString()} incl. GST`;
}

function planIcon(planId: WorkspacePlanId) {
  if (planId === 'starter') return <FiZap size={18} />;
  if (planId === 'team') return <FiUsers size={18} />;
  if (planId === 'business') return <FiHome size={18} />;
  return <FiHeadphones size={18} />;
}

export function OrganizationView({ user, onUnauthorized, onLeftOrganization }: OrganizationViewProps) {
  const toast = useToast();
  const confirm = useConfirm();
  const currentUserId = getUserId(user);

  const [members, setMembers] = useState<OrganizationMemberItem[]>([]);
  const isOwner = useMemo(() => {
    if (userIsWorkspaceOwner(user)) {
      return true;
    }

    const profileEmail =
      typeof user === 'object' && user && 'email' in user && typeof user.email === 'string'
        ? user.email.toLowerCase()
        : '';

    return members.some(
      (member) =>
        member.isOwner &&
        (member.id === currentUserId || (profileEmail !== '' && member.email.toLowerCase() === profileEmail)),
    );
  }, [currentUserId, members, user]);
  const isAdmin = isOwner;

  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<PaymentPlanItem[]>(getDefaultPaymentPlans());
  const [subscription, setSubscription] = useState<OrgSubscriptionInfo | null>(null);
  const [seats, setSeats] = useState<OrganizationSeatsInfo>({ used: 0, total: 0, remaining: 0 });
  const [roles, setRoles] = useState<OrganizationRoleItem[]>([]);
  const [invites, setInvites] = useState<OrganizationInviteItem[]>([]);
  const [invoices, setInvoices] = useState<OrgInvoiceItem[]>([]);
  const [complianceRules, setComplianceRules] = useState<string[]>(DEFAULT_PLAN_RULES);

  const [billingPeriod, setBillingPeriod] = useState<WorkspaceBillingPeriod>('monthly');
  const [selectedPlanId, setSelectedPlanId] = useState<WorkspacePlanId>('team');
  const [teamSize, setTeamSize] = useState(11);
  const [newRoleName, setNewRoleName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRoleId, setInviteRoleId] = useState('');
  const [lastInviteLink, setLastInviteLink] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [leaving, setLeaving] = useState(false);
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

    const unauthorized = [
      subscriptionResult,
      seatsResult,
      membersResult,
      rolesResult,
      invitesResult,
      invoicesResult,
    ].some((result) => !result.ok && onUnauthorized(result.status));

    if (unauthorized) {
      setLoading(false);
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
    if (!selectedPlanId) return;

    void loadPlanCompliance(selectedPlanId, teamSize).then((result) => {
      if (result.ok && result.data.rules.length > 0) {
        setComplianceRules(result.data.rules);
        return;
      }

      setComplianceRules(DEFAULT_PLAN_RULES);
    });
  }, [selectedPlanId, teamSize]);

  const handlePayUpgrade = async () => {
    if (selectedPlan.contactOnly) {
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
      title: 'Leave organization?',
      message:
        'You will lose access to this workspace, organization chats, and hubs. This cannot be undone from the app.',
      confirmLabel: 'Leave organization',
      cancelLabel: 'Stay',
      tone: 'danger',
    });

    if (!confirmed) {
      return;
    }

    setLeaving(true);
    const result = await leaveOrganizationWorkspace();
    setLeaving(false);

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

  const seatTotal = seats.total || subscription?.teamSize || teamSize;
  const seatsRemaining = seats.remaining || Math.max(0, seatTotal - seats.used);
  const displayedRules = complianceRules.length > 0 ? complianceRules : DEFAULT_PLAN_RULES;

  return (
    <div className="h-full overflow-y-auto bg-app-chat-bg px-8 py-8 text-app-text">
      <div className="mx-auto w-full max-w-6xl space-y-8">
        {isOwner ? (
        <div className="flex items-start gap-3">
          <FiCreditCard className="mt-1 text-accent" size={22} />
          <div>
            <h1 className="text-2xl font-bold text-app-text">Subscription</h1>
            <p className="mt-1 text-sm text-app-muted">
              Choose a plan and team size. Price is calculated per member.
            </p>
          </div>
        </div>
        ) : (
        <div>
          <h1 className="text-2xl font-bold text-app-text">Organization</h1>
          <p className="mt-1 text-sm text-app-muted">View teammates in this workspace.</p>
        </div>
        )}

        {isOwner && subscription ? (
          <section className="rounded-2xl border border-app-border bg-app-surface p-6">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-accent">Active plan</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold capitalize text-app-text">{subscription.planName}</h2>
              <span className="rounded-full bg-[#3ecf8e]/15 px-2.5 py-1 text-xs font-medium text-[#3ecf8e] capitalize">
                {subscription.status}
              </span>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-5 text-sm md:grid-cols-4">
              <div>
                <p className="text-app-muted">Team size</p>
                <p className="mt-1 font-medium text-app-text">
                  {subscription.teamSize} members · {subscription.usedSeats} in use
                </p>
              </div>
              <div>
                <p className="text-app-muted">Billing period</p>
                <p className="mt-1 font-medium text-app-text">{billingPeriodLabel(subscription.billingPeriod)}</p>
              </div>
              <div>
                <p className="text-app-muted">Activated on</p>
                <p className="mt-1 font-medium text-app-text">{formatDate(subscription.activatedAt)}</p>
              </div>
              <div>
                <p className="text-app-muted">Renews on</p>
                <p className="mt-1 font-medium text-app-text">{formatDate(subscription.renewsAt)}</p>
              </div>
            </div>
          </section>
        ) : isOwner ? (
          <section className="rounded-2xl border border-dashed border-app-border bg-app-surface p-6">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-accent">Active plan</p>
            <h2 className="mt-2 text-xl font-semibold text-app-text">No subscription on file</h2>
            <p className="mt-1 text-sm text-app-muted">
              Choose a plan below to activate billing for this workspace.
            </p>
          </section>
        ) : null}

        {isOwner ? (
        <>
            <div className="flex justify-center">
              <div className="inline-flex rounded-xl bg-app-surface-input p-1">
                {(['monthly', '6months', 'annual'] as WorkspaceBillingPeriod[]).map((period) => (
                  <button
                    key={period}
                    type="button"
                    onClick={() => setBillingPeriod(period)}
                    className={`rounded-lg px-5 py-2 text-sm font-medium transition-colors ${
                      billingPeriod === period ? 'bg-app-chat-active text-app-text' : 'text-app-muted hover:text-app-text'
                    }`}
                  >
                    {billingPeriodLabel(period)}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {plans.map((plan, index) => {
                const isSelected = selectedPlanId === plan.id;
                const isCurrent = subscription?.planId === plan.id;

                return (
                  <button
                    key={`${plan.id}-${index}`}
                    type="button"
                    onClick={() => {
                      setSelectedPlanId(plan.id);
                      if (plan.contactOnly) return;
                      const next = Math.max(plan.minSeats, teamSize);
                      setTeamSize(plan.maxSeats ? Math.min(plan.maxSeats, next) : next);
                    }}
                    className={`relative rounded-xl border p-4 text-left transition-all ${
                      isSelected
                        ? 'border-accent bg-accent/[0.07] ring-1 ring-accent/30'
                        : 'border-app-border hover:border-app-border-strong'
                    }`}
                  >
                    {isCurrent ? (
                      <span className="absolute top-3 right-3 rounded bg-accent px-1.5 py-0.5 text-[9px] font-semibold uppercase text-white">
                        Current
                      </span>
                    ) : null}
                    <span className="text-accent">{planIcon(plan.id)}</span>
                    <p className="mt-3 text-base font-semibold text-app-text">{plan.name}</p>
                    {plan.contactOnly ? (
                      <p className="mt-1 text-lg font-bold text-accent">Contact us</p>
                    ) : (
                      <p className="mt-1 text-lg font-bold text-app-text">
                        ₹{plan.pricePerMember}{' '}
                        <span className="text-xs font-medium text-app-muted">/ member / mo.</span>
                      </p>
                    )}
                    <p className="mt-2 text-xs leading-relaxed text-app-muted">{planCardSubtitle(plan)}</p>
                  </button>
                );
              })}
            </div>

            {!selectedPlan.contactOnly ? (
              <section className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-base font-semibold text-app-text">Member seats</p>
                    <p className="mt-1 text-sm text-app-muted">
                      {selectedPlan.minSeats}
                      {selectedPlan.maxSeats ? `–${selectedPlan.maxSeats}` : '+'} allowed · minimum{' '}
                      {selectedPlan.minSeats} (includes active members and pending invites)
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setTeamSize(Math.max(selectedPlan.minSeats, teamSize - 1))}
                      className="flex h-9 w-9 items-center justify-center rounded-lg bg-app-chat-active text-lg hover:bg-app-chat-hover"
                    >
                      −
                    </button>
                    <span className="min-w-[2rem] text-center text-base font-semibold">{teamSize}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setTeamSize(
                          selectedPlan.maxSeats ? Math.min(selectedPlan.maxSeats, teamSize + 1) : teamSize + 1,
                        )
                      }
                      className="flex h-9 w-9 items-center justify-center rounded-lg bg-app-chat-active text-lg hover:bg-app-chat-hover"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="text-sm text-app-muted">
                  <p>
                    {teamSize} × ₹{selectedPlan.pricePerMember} × {billingPeriodMultiplier(billingPeriod)} months ={' '}
                    <span className="font-semibold text-app-text">₹{pricing.subtotal.toLocaleString()}</span>
                  </p>
                  <p>
                    + GST (18%): <span className="font-semibold text-app-text">₹{pricing.gst.toLocaleString()}</span>
                  </p>
                  <p className="mt-1 text-base font-bold text-app-text">
                    Total payable: ₹{pricing.total.toLocaleString()}
                  </p>
                </div>

                <section className="rounded-xl border border-app-border bg-app-surface p-5">
                  <p className="mb-3 text-sm font-semibold text-app-text">Plan change rules</p>
                  <ul className="list-disc space-y-1.5 pl-5 text-sm text-app-muted">
                    {displayedRules.map((rule) => (
                      <li key={rule}>{rule}</li>
                    ))}
                  </ul>
                </section>

                <button
                  type="button"
                  disabled={paying}
                  onClick={() => {
                    void handlePayUpgrade();
                  }}
                  className="w-full rounded-xl bg-accent py-3 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
                >
                  {paying ? 'Processing…' : `Pay ₹${pricing.total.toLocaleString()} & update subscription`}
                </button>
                <p className="text-center text-xs text-app-muted">
                  After payment, invite members from the section below — they inherit your plan features.
                </p>
              </section>
            ) : (
              <p className="text-sm text-app-muted">
                Custom workspaces are arranged with support at support@flexhub.app.
              </p>
            )}

            <div className="grid items-start gap-6 lg:grid-cols-2">
              <section className="rounded-2xl border border-app-border bg-app-surface p-6">
                <div className="mb-2 flex items-center gap-2">
                  <FiUserPlus className="text-accent" size={18} />
                  <h3 className="text-lg font-semibold text-app-text">Invite members</h3>
                </div>
                <p className="text-sm text-app-muted">
                  Invite teammates by email. They&apos;ll receive a link to register and join automatically.
                </p>
                <p className="mt-3 text-sm font-medium text-accent-soft">
                  {seats.used}/{seatTotal} seats used · {seatsRemaining} remaining
                </p>
                <label className="mt-4 mb-1.5 block text-sm font-medium text-app-text">Email address</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(event) => setInviteEmail(event.target.value)}
                  placeholder="colleague@company.com"
                  className="mb-3 w-full rounded-lg border border-app-border bg-app-surface-input px-3 py-2.5 text-sm focus:border-accent focus:outline-none"
                />
                <label className="mb-1.5 block text-sm font-medium text-app-text">Assign role</label>
                <select
                  value={inviteRoleId}
                  onChange={(event) => setInviteRoleId(event.target.value)}
                  className="mb-4 w-full rounded-lg border border-app-border bg-app-surface-input px-3 py-2.5 text-sm focus:border-accent focus:outline-none"
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
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-accent py-2.5 text-sm font-semibold text-white disabled:opacity-50"
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
                <div className="mt-4 space-y-2">
                  {invites.length === 0 ? (
                    <p className="text-sm text-app-muted">No pending invitations.</p>
                  ) : (
                    invites.map((invite) => (
                      <div
                        key={invite.id}
                        className="flex items-center justify-between rounded-xl border border-app-border px-3 py-2.5"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm text-app-text">{invite.email}</p>
                          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-app-muted">
                            <FiClock size={12} />
                            Invited · waiting for registration
                            {invite.role ? ` · ${invite.role}` : ''}
                          </p>
                        </div>
                        <button
                          type="button"
                          aria-label={`Revoke invite for ${invite.email}`}
                          className="shrink-0 text-app-muted hover:text-accent-soft"
                          onClick={() => {
                            void handleRevokeInvite(invite);
                          }}
                        >
                          <FiTrash2 size={15} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </section>

              <section className="rounded-2xl border border-app-border bg-app-surface p-6">
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <FiBriefcase className="text-accent" size={18} />
                    <h3 className="text-lg font-semibold text-app-text">Organization roles</h3>
                  </div>
                  <p className="text-sm text-app-muted">
                    {roles.length} roles · {members.length} members
                  </p>
                </div>
                <p className="text-sm text-app-muted">Roles you can assign when inviting new members.</p>
                <form
                  className="mt-4 flex gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void handleAddRole();
                  }}
                >
                  <input
                    type="text"
                    value={newRoleName}
                    onChange={(event) => setNewRoleName(event.target.value)}
                    placeholder="Engineer, Designer, Manager…"
                    className="min-w-0 flex-1 rounded-lg border border-app-border bg-app-surface-input px-3 py-2.5 text-sm focus:border-accent focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="shrink-0 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover"
                  >
                    + Add role
                  </button>
                </form>
                <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {roles.map((roleItem) => (
                    <div
                      key={roleItem.id}
                      className="flex items-center justify-between rounded-xl border border-app-border px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-app-text">{roleItem.name}</p>
                        <p className="text-xs text-app-muted">
                          {roleItem.memberCount} member{roleItem.memberCount === 1 ? '' : 's'}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          aria-label={`Edit ${roleItem.name}`}
                          className="text-app-muted hover:text-app-text"
                          onClick={() => {
                            void handleEditRole(roleItem);
                          }}
                        >
                          <FiEdit2 size={14} />
                        </button>
                        <button
                          type="button"
                          aria-label={`Delete ${roleItem.name}`}
                          className="text-app-muted hover:text-accent-soft"
                          onClick={() => {
                            void handleDeleteRole(roleItem);
                          }}
                        >
                          <FiTrash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <section className="rounded-2xl border border-app-border bg-app-surface p-6">
              <div className="mb-2 flex items-center gap-2">
                <FiFileText className="text-accent" size={18} />
                <h3 className="text-lg font-semibold text-app-text">Billing history</h3>
              </div>
              <p className="mb-4 text-sm text-app-muted">
                Invoices generated after successful subscription payments.
              </p>
              {invoices.length === 0 ? (
                <div className="rounded-xl border border-app-border px-4 py-6 text-sm text-app-muted">
                  No invoices yet. Complete a subscription payment to generate your first invoice.
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-app-border text-sm">
                  {invoices.map((invoice) => (
                    <div
                      key={invoice.id}
                      className="flex items-center justify-between gap-2 border-b border-app-border/50 px-4 py-3 last:border-b-0"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-app-text">{invoice.invoiceNumber}</p>
                        <p className="text-xs text-app-muted">
                          {formatDate(invoice.date)} · {invoice.planLabel}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
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
              )}
            </section>
        </>
        ) : null}

        <section className="rounded-2xl border border-app-border bg-app-surface p-6">
          <div className="mb-2 flex items-center gap-2.5">
            <FiUsers className="text-accent" size={20} />
            <h3 className="text-lg font-semibold text-app-text">Team members {members.length}</h3>
          </div>
          <p className="mb-5 text-sm text-app-muted">
            {isOwner
              ? 'View teammates, transfer ownership, or remove members from your workspace.'
              : 'Teammates in this workspace.'}
          </p>
          <div className="space-y-2">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between rounded-xl border border-app-border px-4 py-3.5"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar imageUrl={member.avatarUrl} initials={member.initials} size="sm" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold text-app-text">
                        {member.name}
                        {member.id === currentUserId ? ' (you)' : ''}
                      </p>
                      {member.isAdmin ? (
                        <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-medium text-accent-soft">
                          Admin
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-app-muted">
                      {member.role || 'No role'}
                      {member.email ? ` · ${member.email}` : ''}
                    </p>
                  </div>
                </div>
                {isAdmin && member.id !== currentUserId ? (
                  <button
                    type="button"
                    aria-label={`Remove ${member.name}`}
                    className="shrink-0 text-app-muted hover:text-accent-soft"
                    onClick={() => {
                      void handleRemoveMember(member);
                    }}
                  >
                    <FiTrash2 size={16} />
                  </button>
                ) : null}
              </div>
            ))}
          </div>
          {isOwner ? (
          <p className="mt-5 text-sm text-app-muted">
            Transfer ownership to hand off billing, invoices, and admin controls to another teammate. You will
            keep your account as a regular member.
          </p>
          ) : null}
          <button
            type="button"
            disabled={leaving}
            onClick={() => {
              void handleLeave();
            }}
            className="mt-4 inline-flex items-center gap-2 rounded-xl border border-red-500/40 px-4 py-2.5 text-sm font-semibold text-red-400 hover:bg-red-500/10 disabled:opacity-50"
          >
            <FiLogOut size={16} />
            {leaving ? 'Leaving…' : 'Leave organization'}
          </button>
        </section>
      </div>
    </div>
  );
}
