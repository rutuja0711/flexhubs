import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  FiShield,
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
import { userCanManageOrganization, type OrganizationMemberItem } from '../../shared/profile';
import { getCurrentUser, getStoredUser } from '../authApi';
import type { WorkspaceBillingPeriod, WorkspacePlanId } from '../../shared/workspace';
import { getUserId, unwrapAuthUser } from '../../shared/user';
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
  loadOrganizationMembersList,
  loadOrganizationRoles,
  loadOrganizationSeats,
  loadPaymentPlans,
  loadPlanCompliance,
  removeOrganizationMember,
  revokeOrganizationInvite,
  sendOrganizationInvite,
  verifyUpgradeSubscription,
} from '../organizationApi';
import { Avatar, BuildingIcon } from './ChatIcons';
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
  onUserUpdated?: (user: unknown) => void;
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

export function OrganizationView({
  user,
  onUnauthorized,
  onLeftOrganization,
  onUserUpdated,
}: OrganizationViewProps) {
  const toast = useToast();
  const confirm = useConfirm();
  const onUserUpdatedRef = useRef(onUserUpdated);
  const userRef = useRef(user);
  const loadRequestRef = useRef(0);
  const [sessionUser, setSessionUser] = useState(() => unwrapAuthUser(user));
  const currentUserId = getUserId(sessionUser);

  const [members, setMembers] = useState<OrganizationMemberItem[]>([]);
  const canManageOrganization = useMemo(
    () => userCanManageOrganization(sessionUser, members),
    [members, sessionUser],
  );
  const isOwner = canManageOrganization;
  const isAdmin = canManageOrganization;

  useEffect(() => {
    onUserUpdatedRef.current = onUserUpdated;
  }, [onUserUpdated]);

  useEffect(() => {
    userRef.current = user;
    setSessionUser(unwrapAuthUser(user));
  }, [user]);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
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
    const requestId = ++loadRequestRef.current;
    setLoading(true);
    setLoadError('');

    try {
      const meResult = await getCurrentUser();
      if (requestId !== loadRequestRef.current) {
        return;
      }

      let activeUser = unwrapAuthUser(getStoredUser() ?? userRef.current);

      if (meResult.ok) {
        activeUser = unwrapAuthUser(meResult.data.user ?? meResult.data);
        setSessionUser(activeUser);
      } else if (meResult.status === 401 && onUnauthorized(401)) {
        return;
      }

      const canManage = userCanManageOrganization(activeUser);
      const membersPromise = loadOrganizationMembersList(canManage);
      const adminPromises = canManage
        ? ([
            loadPaymentPlans(),
            loadOrgSubscription(),
            loadOrganizationSeats(),
            loadOrganizationRoles(),
            loadOrganizationInvites(),
            loadOrgInvoices(),
          ] as const)
        : [];

      const [membersPage, ...adminResults] = await Promise.all([membersPromise, ...adminPromises]);

      if (requestId !== loadRequestRef.current) {
        return;
      }

      if (membersPage.status === 401 && onUnauthorized(401)) {
        return;
      }

      for (const result of adminResults) {
        if (!result.ok && result.status === 401 && onUnauthorized(401)) {
          return;
        }
      }

      setMembers(membersPage.members);

      const failures: string[] = [];

      if (membersPage.members.length === 0 && membersPage.status && membersPage.status !== 401) {
        failures.push('Could not load organization members.');
      }

      if (canManage) {
        for (const result of adminResults) {
          if (!result.ok && result.error) {
            failures.push(result.error);
          }
        }
      }

      setLoadError(failures[0] ?? '');

      if (!canManage) {
        setSubscription(null);
        setRoles([]);
        setInvites([]);
        setInvoices([]);
        setSeats({ used: 0, total: 0, remaining: 0 });
      } else {
        const [plansResult, subscriptionResult, seatsResult, rolesResult, invitesResult, invoicesResult] =
          adminResults;

        if (plansResult?.ok) {
          setPlans(plansResult.data);
        }

        if (subscriptionResult?.ok) {
          if (subscriptionResult.data) {
            setSubscription(subscriptionResult.data);
            setSelectedPlanId(subscriptionResult.data.planId);
            setBillingPeriod(subscriptionResult.data.billingPeriod);
            setTeamSize((current) => subscriptionResult.data?.teamSize || current || 11);
          } else {
            setSubscription(null);
          }
        }

        if (seatsResult?.ok) {
          setSeats(seatsResult.data);
        }

        if (rolesResult?.ok) {
          setRoles(rolesResult.data);
        }

        if (invitesResult?.ok) {
          setInvites(invitesResult.data);
        }

        if (invoicesResult?.ok) {
          setInvoices(invoicesResult.data);
        }
      }
    } catch (error) {
      if (requestId !== loadRequestRef.current) {
        return;
      }

      console.error('[OrganizationView] load failed:', error);
      setLoadError('Could not load organization settings. Please try again.');
    } finally {
      if (requestId === loadRequestRef.current) {
        setLoading(false);
      }
    }
  }, [onUnauthorized]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!canManageOrganization || !selectedPlanId) return;

    void loadPlanCompliance(selectedPlanId, teamSize).then((result) => {
      if (result.ok && result.data.rules.length > 0) {
        setComplianceRules(result.data.rules);
        return;
      }

      setComplianceRules(DEFAULT_PLAN_RULES);
    });
  }, [canManageOrganization, selectedPlanId, teamSize]);

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

  const refreshRoles = useCallback(async () => {
    const result = await loadOrganizationRoles();
    if (result.ok) {
      setRoles(result.data);
    }
    return result;
  }, []);

  const refreshInvites = useCallback(async () => {
    const result = await loadOrganizationInvites();
    if (result.ok) {
      setInvites(result.data);
    }
    return result;
  }, []);

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

    const invitesResult = await refreshInvites();
    const inviteItems = invitesResult.ok ? invitesResult.data : result.data;
    const sentInvite = inviteItems.find((item) => item.email.toLowerCase() === email.toLowerCase());
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

    const reload = await refreshRoles();
    if (!reload.ok) {
      if (onUnauthorized(reload.status)) return;
      toast.error(reload.error);
      return;
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

    const reload = await refreshRoles();
    if (!reload.ok && onUnauthorized(reload.status)) {
      return;
    }

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

    const reload = await refreshRoles();
    if (!reload.ok && onUnauthorized(reload.status)) {
      return;
    }

    toast.success('Role deleted.');
  };

  const handleRevokeInvite = async (invite: OrganizationInviteItem) => {
    const result = await revokeOrganizationInvite(invite.id);
    if (!result.ok) {
      if (onUnauthorized(result.status)) return;
      toast.error(result.error);
      return;
    }

    const reload = await refreshInvites();
    if (!reload.ok && onUnauthorized(reload.status)) {
      return;
    }

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

  if (loadError && members.length === 0 && !subscription && roles.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 bg-app-chat-bg px-8 text-center text-app-muted">
        <p>{loadError}</p>
        <button
          type="button"
          className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover"
          onClick={() => {
            void loadAll();
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (!canManageOrganization) {
    const currentUserMember = members.find((m) => m.id === currentUserId);
    const currentUserRole = currentUserMember?.role || 'Intern';

    return (
      <div className="flex h-full flex-col bg-app-chat-bg text-app-text overflow-hidden">
        {/* Top Header Bar */}
        <div className="flex h-14 shrink-0 items-center border-b border-app-border/60 bg-white dark:bg-app-surface px-8">
          <h1 className="text-lg font-bold text-app-text tracking-tight">Organization</h1>
        </div>

        {/* Centered Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-8">
          <div className="mx-auto w-full max-w-[620px] space-y-5">
            {loadError ? (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                {loadError}
              </div>
            ) : null}

            {/* Top Card: You're in the team */}
            <div className="rounded-2xl border border-app-border/70 bg-white dark:bg-app-surface p-7 shadow-sm flex flex-col items-center text-center">
              <div className="mb-3.5 flex h-12 w-12 items-center justify-center rounded-2xl bg-app-inset dark:bg-app-surface-input text-app-muted">
                <BuildingIcon size={20} />
              </div>
              <h2 className="text-base font-bold text-app-text tracking-tight">You're in the team</h2>
              <p className="mt-1 text-xs text-app-muted">
                Your role is {currentUserRole}. Only admins can send invites and manage roles.
              </p>
            </div>

            {/* Bottom Card: Team members */}
            <div className="rounded-2xl border border-app-border/70 bg-white dark:bg-app-surface shadow-sm overflow-hidden">
              <div className="flex items-center gap-3.5 p-5 border-b border-app-border/50">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
                  <FiUsers size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-app-text flex items-center gap-2">
                    Team members <span className="text-sm font-normal text-app-muted">{members.length}</span>
                  </h3>
                  <p className="text-xs text-app-muted">People in your organization.</p>
                </div>
              </div>

              <div className="p-4 space-y-2.5">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center gap-3.5 rounded-2xl border border-app-border/70 bg-white dark:bg-app-surface-input p-3.5 transition-colors"
                  >
                    <Avatar imageUrl={member.avatarUrl} initials={member.initials} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-app-text">{member.name}</span>
                        {member.isAdmin || member.isOwner ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-semibold text-accent border border-accent/20">
                            <FiShield className="text-[10px]" />
                            Admin
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-0.5 truncate text-xs text-app-muted">
                        {member.role || 'No role'} · {member.email}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Subtle Leave Organization option */}
            <div className="flex justify-center pt-2">
              <button
                type="button"
                disabled={leaving}
                onClick={() => {
                  void handleLeave();
                }}
                className="inline-flex items-center gap-1.5 text-xs text-red-500/70 hover:text-red-500 transition-colors disabled:opacity-50"
              >
                <FiLogOut size={13} />
                {leaving ? 'Leaving…' : 'Leave organization'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const seatTotal = seats.total || subscription?.teamSize || teamSize;
  const seatsRemaining = seats.remaining || Math.max(0, seatTotal - seats.used);
  const displayedRules = complianceRules.length > 0 ? complianceRules : DEFAULT_PLAN_RULES;

  return (
    <div className="h-full overflow-y-auto bg-app-chat-bg px-8 py-8 text-app-text">
      <div className="mx-auto w-full max-w-6xl space-y-8">
        {loadError ? (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            {loadError}
          </div>
        ) : null}
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
          <section className="rounded-2xl border border-app-border/70 bg-gradient-to-br from-accent/10 via-app-card/70 to-app-card/50 p-6 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-accent-soft">Active plan</p>
            <div className="mt-2 flex flex-wrap items-center gap-2.5">
              <h2 className="text-xl font-bold capitalize text-app-text tracking-tight">{subscription.planName}</h2>
              <span className="rounded-full bg-[#3ecf8e]/15 px-3 py-0.5 text-xs font-medium text-[#3ecf8e] capitalize border border-[#3ecf8e]/20">
                {subscription.status}
              </span>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-5 text-sm md:grid-cols-4">
              <div>
                <p className="text-xs text-app-muted">Team size</p>
                <p className="mt-1 font-semibold text-app-text">
                  {subscription.teamSize} members · {subscription.usedSeats} in use
                </p>
              </div>
              <div>
                <p className="text-xs text-app-muted">Billing period</p>
                <p className="mt-1 font-semibold text-app-text">{billingPeriodLabel(subscription.billingPeriod)}</p>
              </div>
              <div>
                <p className="text-xs text-app-muted">Activated on</p>
                <p className="mt-1 font-semibold text-app-text">{formatDate(subscription.activatedAt)}</p>
              </div>
              <div>
                <p className="text-xs text-app-muted">Renews on</p>
                <p className="mt-1 font-semibold text-app-text">{formatDate(subscription.renewsAt)}</p>
              </div>
            </div>
          </section>
        ) : isOwner ? (
          <section className="rounded-2xl border border-dashed border-app-border/80 bg-app-card/40 p-6">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-accent-soft">Active plan</p>
            <h2 className="mt-2 text-lg font-semibold text-app-text">No subscription on file</h2>
            <p className="mt-1 text-xs text-app-muted">
              Choose a plan below to activate billing for this workspace.
            </p>
          </section>
        ) : null}

        {isOwner ? (
        <>
            <div className="flex justify-center">
              <div className="inline-flex rounded-2xl bg-app-inset/80 p-1 border border-app-border/40 backdrop-blur-sm">
                {(['monthly', '6months', 'annual'] as WorkspaceBillingPeriod[]).map((period) => (
                  <button
                    key={period}
                    type="button"
                    onClick={() => setBillingPeriod(period)}
                    className={`rounded-xl px-5 py-2 text-xs font-medium transition-all duration-150 ${
                      billingPeriod === period ? 'bg-app-card text-app-text font-semibold shadow-sm border border-app-border/60' : 'text-app-muted hover:text-app-text hover:bg-app-inset/60'
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
                    className={`relative rounded-2xl border p-5 text-left transition-all duration-200 ${
                      isSelected
                        ? 'border-accent/80 bg-accent/10 ring-2 ring-accent/30 shadow-md shadow-accent/10'
                        : 'border-app-border/70 bg-app-card/60 hover:bg-app-card hover:border-app-border hover:shadow-xs'
                    }`}
                  >
                    {isCurrent ? (
                      <span className="absolute top-3.5 right-3.5 rounded-lg bg-accent px-2 py-0.5 text-[9px] font-semibold uppercase text-white shadow-xs">
                        Current
                      </span>
                    ) : null}
                    <span className="text-accent-soft inline-block mb-1">{planIcon(plan.id)}</span>
                    <p className="mt-2 text-base font-semibold text-app-text tracking-tight">{plan.name}</p>
                    {plan.contactOnly ? (
                      <p className="mt-1 text-lg font-bold text-accent-soft">Contact us</p>
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
