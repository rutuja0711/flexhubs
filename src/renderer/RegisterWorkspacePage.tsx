import { useEffect, useMemo, useState } from 'react';
import { FiMoon, FiSun, FiTrash2 } from 'react-icons/fi';
import type {
  WorkspaceBillingPeriod,
  WorkspacePlanId,
  WorkspaceSeatInput,
} from '../shared/workspace';
import {
  billingPeriodLabel,
  billingPeriodMultiplier,
  calculatePlanTotal,
  getDefaultPaymentPlans,
  type PaymentPlanItem,
} from '../shared/payments';
import { storeAuth } from './authApi';
import { createWorkspaceOrder, loadPaymentPlans, loadSignupPlanCompliance, verifyWorkspaceSubscription } from './organizationApi';
import { useTheme } from './theme/ThemeProvider';
import { useToast } from './ui/Toast';

type RegisterWorkspacePageProps = {
  onBackToLogin: () => void;
  onWorkspaceCreated: () => void;
};

type SeatRow = WorkspaceSeatInput & { id: number; label: string; isOwner?: boolean };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

function planSeatLabel(plan: PaymentPlanItem): string {
  if (plan.maxSeats) {
    return `${plan.minSeats}–${plan.maxSeats} members on ${plan.name}`;
  }

  return `${plan.minSeats}+ members on ${plan.name}`;
}

function EyeIcon({ hidden }: { hidden: boolean }) {
  if (hidden) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M2 12C2 12 5 5 12 5C19 5 22 12 22 12C22 12 19 19 12 19C5 19 2 12 2 12Z"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.75" />
      </svg>
    );
  }

  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 3L21 21M10.58 10.58C10.21 10.95 10 11.45 10 12C10 13.1 10.9 14 12 14C12.55 14 13.05 13.79 13.42 13.42M17.94 17.94C16.23 19.24 14.21 20 12 20C7 20 2.73 16.11 1 12C2.17 8.78 4.5 6.03 7.5 4.47M9.9 4.24C10.59 4.09 11.29 4 12 4C17 4 21.27 7.89 23 12C22.55 13.22 21.91 14.33 21.12 15.3"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function validateWorkspaceForm(input: {
  orgName: string;
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
}): string | null {
  if (!input.orgName.trim()) {
    return 'Organization name is required.';
  }

  if (!input.username.trim()) {
    return 'Username is required.';
  }

  if (!input.email.trim()) {
    return 'Work email is required.';
  }

  if (!EMAIL_PATTERN.test(input.email.trim())) {
    return 'Enter a valid work email address.';
  }

  if (!input.password) {
    return 'Password is required.';
  }

  if (input.password.length < 8) {
    return 'Password must be at least 8 characters.';
  }

  if (input.password !== input.confirmPassword) {
    return 'Passwords do not match.';
  }

  return null;
}

export default function RegisterWorkspacePage({
  onBackToLogin,
  onWorkspaceCreated,
}: RegisterWorkspacePageProps) {
  const toast = useToast();
  const { theme, toggleTheme } = useTheme();

  const [step, setStep] = useState<1 | 2>(1);
  const [plans, setPlans] = useState<PaymentPlanItem[]>(getDefaultPaymentPlans());
  const [billingPeriod, setBillingPeriod] = useState<WorkspaceBillingPeriod>('monthly');
  const [selectedPlanId, setSelectedPlanId] = useState<WorkspacePlanId>('team');
  const [teamSize, setTeamSize] = useState(11);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [customRoles, setCustomRoles] = useState<string[]>([]);
  const [newRoleName, setNewRoleName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [complianceRules, setComplianceRules] = useState<string[]>([]);
  const [complianceMinSeats, setComplianceMinSeats] = useState<number | null>(null);
  const [complianceMaxSeats, setComplianceMaxSeats] = useState<number | null>(null);

  const [orgName, setOrgName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [seats, setSeats] = useState<SeatRow[]>([]);

  const currentPlan = plans.find((plan) => plan.id === selectedPlanId) ?? plans[1] ?? plans[0];
  const monthsMultiplier = billingPeriodMultiplier(billingPeriod);
  const pricing = calculatePlanTotal(currentPlan?.pricePerMember ?? 0, teamSize, billingPeriod);

  const roleOptions = useMemo(
    () => ['Admin', 'Member', ...customRoles.filter((role) => role !== 'Admin' && role !== 'Member')],
    [customRoles],
  );

  const seatMinimum = Math.max(
    currentPlan.minSeats,
    complianceMinSeats ?? currentPlan.minSeats,
  );
  const seatMaximum = currentPlan.maxSeats ?? complianceMaxSeats ?? null;

  const clampTeamSize = (value: number) => {
    if (currentPlan.contactOnly) return value;
    const min = seatMinimum;
    const max = seatMaximum ?? value;
    return Math.min(Math.max(value, min), max);
  };

  useEffect(() => {
    void loadPaymentPlans().then((result) => {
      if (result.ok && result.data.length > 0) {
        setPlans(result.data);
      }
    });
  }, []);

  useEffect(() => {
    if (currentPlan.contactOnly) {
      setComplianceRules([]);
      setComplianceMinSeats(null);
      setComplianceMaxSeats(null);
      return;
    }

    void loadSignupPlanCompliance(selectedPlanId, teamSize).then((result) => {
      if (!result.ok) {
        return;
      }

      setComplianceRules(result.data.rules);
      setComplianceMinSeats(result.data.minSeats);
      setComplianceMaxSeats(result.data.maxSeats);
    });
  }, [currentPlan.contactOnly, selectedPlanId, teamSize]);

  useEffect(() => {
    if (!currentPlan || currentPlan.contactOnly) return;

    setTeamSize((current) => clampTeamSize(current));
  }, [currentPlan, complianceMinSeats, complianceMaxSeats]);

  useEffect(() => {
    setSeats((current) => {
      if (current.length === teamSize) {
        return current;
      }

      if (current.length < teamSize) {
        const next = [...current];
        for (let index = current.length; index < teamSize; index += 1) {
          next.push({
            id: index + 1,
            label: `Seat ${index + 1}`,
            role: 'Member',
            admin: false,
            inviteEmail: '',
          });
        }
        return next.map((seat, index) =>
          index === 0
            ? { ...seat, id: 1, label: username.trim() || 'You', isOwner: true, role: 'Admin', admin: true }
            : { ...seat, id: index + 1, label: `Seat ${index + 1}` },
        );
      }

      return current.slice(0, teamSize).map((seat, index) =>
        index === 0
          ? { ...seat, id: 1, label: username.trim() || 'You', isOwner: true, role: 'Admin', admin: true }
          : { ...seat, id: index + 1, label: `Seat ${index + 1}`, isOwner: false },
      );
    });
  }, [teamSize, username]);

  const teamSetup = useMemo(
    () => ({
      roles: ['Admin', 'Member', ...customRoles.filter((role) => role !== 'Admin' && role !== 'Member')],
      slots: seats.map((seat) => ({
        roleName: seat.role,
        isAdmin: seat.admin,
        email: seat.isOwner ? email.trim() : seat.inviteEmail.trim(),
      })),
    }),
    [customRoles, email, seats],
  );

  const adminCount = seats.filter((seat) => seat.admin).length;

  const updateSeat = (index: number, patch: Partial<SeatRow>) => {
    setSeats((current) =>
      current.map((seat, seatIndex) => {
        if (seatIndex !== index) {
          return seat;
        }

        const next = { ...seat, ...patch };

        if (patch.role === 'Admin') {
          next.admin = true;
        }

        if (patch.admin === false && seat.isOwner) {
          return seat;
        }

        if (patch.admin === true) {
          next.role = 'Admin';
        }

        return next;
      }),
    );
  };

  const handleAddRole = () => {
    const name = newRoleName.trim();
    if (!name) {
      toast.error('Enter a role name.');
      return;
    }

    if (name.toLowerCase() === 'admin' || name.toLowerCase() === 'member') {
      toast.error('Admin and Member are built-in roles.');
      return;
    }

    if (customRoles.some((role) => role.toLowerCase() === name.toLowerCase())) {
      toast.error('That role already exists.');
      return;
    }

    setCustomRoles((current) => [...current, name]);
    setNewRoleName('');
    toast.success(`Role "${name}" added.`);
  };

  const handleRemoveRole = (role: string) => {
    setCustomRoles((current) => current.filter((item) => item !== role));
    setSeats((current) =>
      current.map((seat) => (seat.role === role ? { ...seat, role: 'Member', admin: false } : seat)),
    );
  };

  const handleCheckout = async () => {
    setFormError('');

    if (currentPlan.contactOnly) {
      toast.info('Contact FlexHubs support for custom workspace pricing.');
      return;
    }

    if (adminCount > currentPlan.adminCount) {
      setFormError(`This plan allows up to ${currentPlan.adminCount} admin${currentPlan.adminCount === 1 ? '' : 's'}.`);
      return;
    }

    if (teamSize < seatMinimum) {
      setFormError(`This plan requires at least ${seatMinimum} seats.`);
      return;
    }

    if (seatMaximum !== null && teamSize > seatMaximum) {
      setFormError(`This plan allows up to ${seatMaximum} seats.`);
      return;
    }

    const validationError = validateWorkspaceForm({
      orgName,
      username,
      email,
      password,
      confirmPassword,
    });

    if (validationError) {
      setFormError(validationError);
      return;
    }

    setCheckoutLoading(true);

    const orderResult = await createWorkspaceOrder({
      planId: selectedPlanId,
      billingPeriod,
      teamSize,
    });

    if (!orderResult.ok) {
      setCheckoutLoading(false);
      setFormError(orderResult.error);
      return;
    }

    const razorpayReady = await loadRazorpay();

    if (!razorpayReady) {
      setCheckoutLoading(false);
      const message = 'Payment checkout failed to load. Check your internet connection.';
      setFormError(message);
      toast.error(message);
      return;
    }

    setCheckoutLoading(false);

    const order = orderResult.data;
    const Razorpay = (
      window as Window & { Razorpay?: new (options: Record<string, unknown>) => { open: () => void } }
    ).Razorpay;

    if (!Razorpay) {
      setFormError('Payment checkout failed to load.');
      return;
    }

    const paymentObject = new Razorpay({
      key: order.key || 'rzp_test_placeholder',
      amount: order.amount,
      currency: order.currency || 'INR',
      name: 'FlexHubs',
      description: `${currentPlan.name} Plan - ${teamSize} seats`,
      order_id: order.id,
      handler: (response: {
        razorpay_payment_id: string;
        razorpay_order_id: string;
        razorpay_signature: string;
      }) => {
        void (async () => {
          setCheckoutLoading(true);

          const verifyResult = await verifyWorkspaceSubscription({
            paymentId: response.razorpay_payment_id,
            orderId: response.razorpay_order_id,
            signature: response.razorpay_signature,
            organizationName: orgName.trim(),
            planId: selectedPlanId,
            billingPeriod,
            teamSize,
            username: username.trim(),
            email: email.trim(),
            password,
            confirmPassword,
            teamSetup,
          });

          setCheckoutLoading(false);

          if (!verifyResult.ok) {
            setFormError(verifyResult.error);
            toast.error(verifyResult.error);
            return;
          }

          storeAuth(verifyResult.data);
          toast.success('Workspace created successfully.');
          onWorkspaceCreated();
        })();
      },
      prefill: {
        name: username.trim(),
        email: email.trim(),
      },
      theme: {
        color: '#F43F5E',
      },
    });

    paymentObject.open();
  };

  const inputClassName =
    'w-full rounded-xl border border-app-border bg-app-surface-input px-4 py-3 text-sm text-app-text focus:border-accent focus:outline-none';

  return (
    <div className="flex h-screen w-full flex-col bg-app-bg text-app-text">
      <header className="flex items-center justify-between px-8 py-4">
        <button
          type="button"
          onClick={step === 1 ? onBackToLogin : () => setStep(1)}
          className="text-sm text-app-muted transition-colors hover:text-app-text"
        >
          ← {step === 1 ? 'Back to sign in' : 'Back to plans'}
        </button>
        <button
          type="button"
          aria-label="Toggle theme"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-app-muted transition-colors hover:bg-app-chat-hover hover:text-app-text"
          onClick={toggleTheme}
        >
          {theme === 'dark' ? <FiSun size={18} /> : <FiMoon size={18} />}
        </button>
      </header>

      <main className="flex flex-1 flex-col items-center overflow-y-auto px-6 py-10">
        {step === 1 ? (
          <div className="w-full max-w-4xl space-y-6">
            <div className="text-center">
              <h1 className="text-2xl font-bold">Choose your plan</h1>
              <p className="mt-2 text-sm text-app-muted">Billing period, team size, then workspace details.</p>
            </div>

            <div className="rounded-2xl border border-app-border bg-app-surface p-6 shadow-app">
              <div className="mb-6 flex justify-center">
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

              <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
                {plans.map((plan, index) => {
                  const isSelected = selectedPlanId === plan.id;

                  return (
                    <button
                      key={`${plan.id}-${index}`}
                      type="button"
                      onClick={() => {
                        setSelectedPlanId(plan.id);
                        if (!plan.contactOnly) setTeamSize(plan.minSeats);
                      }}
                      className={`relative rounded-xl border p-4 text-left transition-all ${
                        isSelected
                          ? 'border-accent bg-accent/[0.07] ring-1 ring-accent/30'
                          : 'border-app-border hover:border-app-border-strong'
                      }`}
                    >
                      {isSelected ? (
                        <span className="absolute top-3 right-3 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[11px] text-white">
                          ✓
                        </span>
                      ) : null}
                      <p className="text-base font-semibold">{plan.name}</p>
                      {plan.contactOnly ? (
                        <p className="mt-2 text-lg font-bold text-accent">Contact us</p>
                      ) : (
                        <p className="mt-2 text-2xl font-bold">₹{plan.pricePerMember}</p>
                      )}
                      <p className="mt-2 text-xs leading-relaxed text-app-muted">
                        {plan.maxSeats ? `${plan.minSeats}–${plan.maxSeats} seats` : `${plan.minSeats}+ members`}
                        {!plan.contactOnly ? ` · ${plan.adminCount} admin${plan.adminCount === 1 ? '' : 's'}` : ''}
                      </p>
                      <p className="mt-3 text-xs text-app-muted">{plan.features}</p>
                    </button>
                  );
                })}
              </div>

              {!currentPlan.contactOnly ? (
                <div className="mb-6 space-y-3 rounded-xl border border-app-border bg-app-surface-input p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-base font-semibold">Team size</p>
                      <p className="text-sm text-app-muted">{planSeatLabel(currentPlan)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setTeamSize(clampTeamSize(teamSize - 1))}
                        className="flex h-9 w-9 items-center justify-center rounded-lg bg-app-chat-active text-lg hover:bg-app-chat-hover"
                      >
                        −
                      </button>
                      <span className="min-w-[2rem] text-center text-base font-semibold">{teamSize}</span>
                      <button
                        type="button"
                        onClick={() => setTeamSize(clampTeamSize(teamSize + 1))}
                        className="flex h-9 w-9 items-center justify-center rounded-lg bg-app-chat-active text-lg hover:bg-app-chat-hover"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <div className="text-sm text-app-muted">
                    <p>
                      {teamSize} × ₹{currentPlan.pricePerMember} × {monthsMultiplier} month
                      {monthsMultiplier > 1 ? 's' : ''} ={' '}
                      <span className="font-semibold text-app-text">₹{pricing.subtotal.toLocaleString()}</span>
                    </p>
                    <p>
                      + GST (18%): <span className="font-semibold text-app-text">₹{pricing.gst.toLocaleString()}</span>
                    </p>
                    <p className="mt-1 text-base font-bold text-app-text">Total: ₹{pricing.total.toLocaleString()}</p>
                  </div>
                  {complianceRules.length > 0 ? (
                    <ul className="list-disc space-y-0.5 pl-4 text-xs text-app-muted">
                      {complianceRules.map((rule) => (
                        <li key={rule}>{rule}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}

              <button
                type="button"
                onClick={() =>
                  currentPlan.contactOnly
                    ? toast.info('Email support@flexhub.app for custom pricing.')
                    : setStep(2)
                }
                className="w-full rounded-xl bg-accent py-3.5 text-base font-semibold text-white hover:bg-accent-hover"
              >
                {currentPlan.contactOnly ? 'Contact support' : `Continue with ${currentPlan.name}`}
              </button>
            </div>

            <p className="text-center text-sm text-app-muted">
              Invited by your team?{' '}
              <button type="button" className="font-medium text-accent hover:underline" onClick={onBackToLogin}>
                Sign in with your invitation
              </button>
            </p>
          </div>
        ) : (
          <div className="w-full max-w-5xl space-y-6">
            <div className="text-center">
              <p className="text-xs font-semibold uppercase tracking-wider text-accent">Step 2 of 2</p>
              <h1 className="mt-2 text-2xl font-bold">Create your workspace</h1>
              <p className="mt-2 text-sm text-app-muted">
                {currentPlan.name} · {teamSize} seats · {billingPeriodLabel(billingPeriod)} · ₹
                {pricing.total.toLocaleString()} incl. GST
              </p>
            </div>

            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
              <div className="rounded-2xl border border-app-border bg-app-surface p-6 shadow-app">
                {formError ? (
                  <p
                    className="mb-5 rounded-xl border border-accent/35 bg-accent/10 px-4 py-3 text-sm text-accent-soft"
                    role="alert"
                  >
                    {formError}
                  </p>
                ) : null}

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-sm font-medium">Organization name</label>
                    <input
                      type="text"
                      value={orgName}
                      onChange={(event) => setOrgName(event.target.value)}
                      placeholder="Acme Inc"
                      className={inputClassName}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">Username</label>
                    <input
                      type="text"
                      value={username}
                      onChange={(event) => setUsername(event.target.value)}
                      placeholder="Choose a username"
                      className={inputClassName}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">Work email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="you@company.com"
                      className={inputClassName}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">Password</label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder="Create a strong password"
                        className={`${inputClassName} pr-11`}
                      />
                      <button
                        type="button"
                        className="absolute top-1/2 right-3 -translate-y-1/2 text-app-muted hover:text-app-text"
                        onClick={() => setShowPassword((c) => !c)}
                      >
                        <EyeIcon hidden={!showPassword} />
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">Confirm password</label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        placeholder="Re-enter your password"
                        className={`${inputClassName} pr-11`}
                      />
                      <button
                        type="button"
                        className="absolute top-1/2 right-3 -translate-y-1/2 text-app-muted hover:text-app-text"
                        onClick={() => setShowConfirmPassword((c) => !c)}
                      >
                        <EyeIcon hidden={!showConfirmPassword} />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-6 border-t border-app-border pt-6">
                  <h3 className="text-base font-semibold">Team roles & seats</h3>
                  <p className="mt-1 text-sm text-app-muted">
                    {teamSize} seats · up to {currentPlan.adminCount} admin{currentPlan.adminCount === 1 ? '' : 's'} ·
                    invite emails optional
                  </p>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <span className="rounded-lg border border-app-border px-3 py-1.5 text-sm">Admin</span>
                    <span className="rounded-lg border border-app-border px-3 py-1.5 text-sm">Member</span>
                    {customRoles.map((role) => (
                      <span
                        key={role}
                        className="flex items-center gap-2 rounded-lg border border-app-border px-3 py-1.5 text-sm"
                      >
                        {role}
                        <button
                          type="button"
                          onClick={() => handleRemoveRole(role)}
                          className="text-app-muted hover:text-accent"
                          aria-label={`Remove ${role}`}
                        >
                          <FiTrash2 size={14} />
                        </button>
                      </span>
                    ))}
                  </div>

                  <form
                    className="mt-3 flex gap-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      handleAddRole();
                    }}
                  >
                    <input
                      type="text"
                      value={newRoleName}
                      onChange={(event) => setNewRoleName(event.target.value)}
                      placeholder="Add role (e.g. Engineer)"
                      className={`${inputClassName} py-2.5`}
                    />
                    <button
                      type="submit"
                      className="shrink-0 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover"
                    >
                      Add role
                    </button>
                  </form>

                  <div className="mt-4 overflow-hidden rounded-xl border border-app-border">
                    <div className="grid grid-cols-[minmax(5rem,7rem)_8rem_3.5rem_minmax(0,1fr)] gap-3 border-b border-app-border bg-app-surface-input px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-app-muted">
                      <span>Seat</span>
                      <span>Role</span>
                      <span className="text-center">Admin</span>
                      <span>Invite email</span>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {seats.map((seat, index) => (
                        <div
                          key={seat.id}
                          className="grid grid-cols-[minmax(5rem,7rem)_8rem_3.5rem_minmax(0,1fr)] items-center gap-3 border-b border-app-border/50 px-4 py-3 last:border-b-0"
                        >
                          <span className="truncate text-sm font-medium">{seat.label}</span>
                          <select
                            value={seat.role}
                            disabled={seat.isOwner}
                            onChange={(event) => updateSeat(index, { role: event.target.value })}
                            className="w-full rounded-lg border border-app-border bg-app-surface-input px-2 py-2 text-sm disabled:opacity-60"
                          >
                            {roleOptions.map((role) => (
                              <option key={role} value={role}>
                                {role}
                              </option>
                            ))}
                          </select>
                          <input
                            type="checkbox"
                            checked={seat.admin}
                            disabled={seat.isOwner}
                            onChange={(event) => updateSeat(index, { admin: event.target.checked })}
                            className="mx-auto h-4 w-4"
                          />
                          {seat.isOwner ? (
                            <span className="text-sm text-app-muted">Your account</span>
                          ) : (
                            <input
                              type="email"
                              value={seat.inviteEmail}
                              onChange={(event) => updateSeat(index, { inviteEmail: event.target.value })}
                              placeholder="Optional — add later"
                              className="w-full rounded-lg border border-app-border bg-app-surface-input px-3 py-2 text-sm"
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={checkoutLoading}
                  onClick={() => {
                    void handleCheckout();
                  }}
                  className="mt-6 w-full rounded-xl bg-accent py-3.5 text-base font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
                >
                  {checkoutLoading ? 'Processing…' : `Pay ₹${pricing.total.toLocaleString()} & create workspace`}
                </button>
              </div>

              <aside className="rounded-2xl border border-app-border bg-app-surface p-5 lg:sticky lg:top-6">
                <p className="text-xs font-semibold uppercase tracking-wide text-app-muted">Order summary</p>
                <p className="mt-2 text-lg font-bold">{currentPlan.name}</p>
                <div className="mt-4 space-y-2 text-sm text-app-muted">
                  <div className="flex justify-between gap-3">
                    <span>Seats</span>
                    <span className="text-app-text">{teamSize}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span>Billing</span>
                    <span className="text-app-text">{billingPeriodLabel(billingPeriod)}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span>Subtotal</span>
                    <span className="text-app-text">₹{pricing.subtotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span>GST</span>
                    <span className="text-app-text">₹{pricing.gst.toLocaleString()}</span>
                  </div>
                </div>
                <div className="mt-4 flex justify-between border-t border-app-border pt-4 text-base font-semibold">
                  <span>Total</span>
                  <span>₹{pricing.total.toLocaleString()}</span>
                </div>
                {complianceRules.length > 0 ? (
                  <ul className="mt-4 list-disc space-y-0.5 pl-4 text-xs text-app-muted">
                    {complianceRules.map((rule) => (
                      <li key={rule}>{rule}</li>
                    ))}
                  </ul>
                ) : null}
              </aside>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

