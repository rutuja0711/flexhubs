import { FormEvent, useEffect, useState, type HTMLAttributes, type ReactNode } from 'react';
import {
  loadInviteDetails,
  registerAccount,
  requestPasswordReset,
  resetAccountPassword,
  verifyPasswordResetCode,
} from './authExtrasApi';
import { storeAuth } from './authApi';
import { AppLogoHorizontal } from './brand/AppLogo';
import { readInviteRegistrationEmail } from '../shared/auth';
import {
  FiMessageSquare,
  FiShield,
  FiUsers,
  FiMoon,
  FiSun,
  FiMail,
  FiLock,
  FiZap,
  FiMic,
  FiCheckCircle,
  FiArrowLeft,
} from 'react-icons/fi';
import { useTheme } from './theme/ThemeProvider';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESEND_SECONDS = 20;

export const inputClassName =
  'w-full rounded-xl border border-app-border-strong bg-white px-3.5 py-3 text-app-text shadow-sm outline-none transition-all placeholder:text-app-placeholder focus:border-accent focus:ring-2 focus:ring-accent/15 dark:border-app-border dark:bg-app-surface-input dark:shadow-none dark:focus:ring-accent/20';

export const submitClassName =
  'w-full rounded-xl border-none bg-gradient-to-r from-[#943853] via-[#802D45] to-[#6a2337] px-4 py-3.5 text-[0.9375rem] font-semibold text-white shadow-lg shadow-accent/20 transition-all hover:brightness-110 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed dark:shadow-accent/25';

export const formAlertClassName =
  'flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-xs leading-snug text-red-700 dark:border-accent/35 dark:bg-accent/10 dark:text-accent-soft';

export const formErrorClassName =
  'text-[11px] leading-snug text-red-600 dark:text-accent-soft';

export const formSuccessClassName = 'text-xs text-emerald-600 dark:text-emerald-400';

export const authSecondaryButtonClassName =
  'flex items-center justify-center gap-2 rounded-xl border border-app-border bg-white px-3 py-2.5 text-xs font-semibold text-app-text shadow-sm transition-all hover:border-accent hover:bg-accent/[0.04] hover:text-accent active:scale-[0.98] dark:border-app-border dark:bg-app-surface-input dark:shadow-none dark:hover:bg-accent/5';

type ForgotStep = 'email' | 'code' | 'password';

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

export function RegisterPage({
  onBack,
  onCreatePersonalAccount,
  onCreateWorkspace,
}: {
  onBack: () => void;
  onCreatePersonalAccount?: () => void;
  onCreateWorkspace?: () => void;
}) {
  return (
    <AuthShell
      title="Create account"
      subtitle="Choose the account type that best fits your workflow."
      onBack={onBack}
    >
      <div className="space-y-4">
        {onCreatePersonalAccount ? (
          <button
            type="button"
            className="group relative flex w-full flex-col items-start gap-1 rounded-2xl border border-app-border bg-white p-4 text-left shadow-sm transition-all hover:border-accent hover:bg-accent/[0.04] dark:bg-app-surface-input dark:shadow-none dark:hover:bg-accent/5"
            onClick={onCreatePersonalAccount}
          >
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/15 text-accent">
                <FiUsers size={16} />
              </span>
              <span className="text-sm font-semibold text-app-text">Personal Account</span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-app-muted">
              Connect and chat with friends or colleagues 1-on-1 and in direct groups by username.
            </p>
          </button>
        ) : null}

        {onCreateWorkspace ? (
          <button
            type="button"
            className="group relative flex w-full flex-col items-start gap-1 rounded-2xl border border-app-border bg-white p-4 text-left shadow-sm transition-all hover:border-accent hover:bg-accent/[0.04] dark:bg-app-surface-input dark:shadow-none dark:hover:bg-accent/5"
            onClick={onCreateWorkspace}
          >
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-white shadow-sm shadow-accent/40">
                <FiShield size={16} />
              </span>
              <span className="text-sm font-semibold text-app-text">Company Workspace</span>
              <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold text-accent">
                For Teams
              </span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-app-muted">
              Dedicated organization hubs, channels, admin controls, team billing, and role management.
            </p>
          </button>
        ) : null}
      </div>
    </AuthShell>
  );
}

export function ForgotPasswordPage({
  onBack,
  onDone,
  initialEmail = '',
  initialStep = 'email',
}: {
  onBack: () => void;
  onDone?: () => void;
  initialEmail?: string;
  initialStep?: ForgotStep;
}) {
  const [step, setStep] = useState<ForgotStep>(initialStep);
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [codeVerified, setCodeVerified] = useState(initialStep === 'password');
  const [resendSeconds, setResendSeconds] = useState(0);

  useEffect(() => {
    if (resendSeconds <= 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setResendSeconds((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [resendSeconds]);

  const startResendCooldown = () => {
    setResendSeconds(RESEND_SECONDS);
  };

  const handleSendCode = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setMessage('');

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError('Email is required.');
      return;
    }

    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      setError('Enter a valid email address.');
      return;
    }

    setLoading(true);
    const result = await requestPasswordReset(trimmedEmail);
    setLoading(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setEmail(trimmedEmail);
    setCode('');
    setCodeVerified(false);
    setStep('code');
    startResendCooldown();

    if (result.data.delivered === false) {
      setMessage(
        "We couldn't send email from this environment. Check the server terminal for your 6-digit code, then enter it on the next step.",
      );
      return;
    }

    setMessage(
      result.data.message ??
        'If an account exists for that email, a reset code has been sent.',
    );
  };

  const handleVerifyCode = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setMessage('');

    const trimmedEmail = email.trim();
    const trimmedCode = code.trim();

    if (!trimmedEmail) {
      setError('Email is required.');
      return;
    }

    if (!/^\d{6}$/.test(trimmedCode)) {
      setError('Enter the 6-digit reset code from your email.');
      return;
    }

    setLoading(true);
    const result = await verifyPasswordResetCode({
      email: trimmedEmail,
      code: trimmedCode,
    });
    setLoading(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setCodeVerified(true);
    setStep('password');
    setMessage(result.data.message ?? 'Code verified. Choose your new password.');
  };

  const handleResetPassword = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setMessage('');

    if (!codeVerified) {
      setError('Please verify your reset code before choosing a new password.');
      setStep('code');
      return;
    }

    if (!password) {
      setError('Password is required.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    const result = await resetAccountPassword({
      email: email.trim(),
      code: code.trim(),
      password,
      confirmPassword,
    });
    setLoading(false);

    if (!result.ok) {
      setError(result.error);
      if (result.status === 400) {
        setCodeVerified(false);
        setStep('code');
      }
      return;
    }

    setMessage(result.data.message ?? 'Password updated. You can sign in now.');
    onDone?.();
  };

  const handleResend = async () => {
    if (resendSeconds > 0 || loading) {
      return;
    }

    setError('');
    setMessage('');
    setLoading(true);
    const result = await requestPasswordReset(email.trim());
    setLoading(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    startResendCooldown();
    setMessage(result.data.message ?? 'A new reset code has been sent.');
  };

  if (step === 'email') {
    return (
      <AuthShell
        title="Reset password"
        subtitle="Enter your email to receive a 6-digit verification code."
        onBack={onBack}
      >
        <form className="space-y-4" onSubmit={(event) => void handleSendCode(event)}>
          <Field
            label="Email address"
            icon={<FiMail size={16} />}
            value={email}
            type="email"
            onChange={setEmail}
            placeholder="you@company.com"
          />
          {message ? <p className={formSuccessClassName}>{message}</p> : null}
          {error ? <p className={formErrorClassName}>{error}</p> : null}
          <button type="submit" disabled={loading} className={submitClassName}>
            {loading ? 'Sending code...' : 'Send reset code'}
          </button>
        </form>
      </AuthShell>
    );
  }

  if (step === 'code') {
    return (
      <AuthShell
        title="Verify reset code"
        subtitle="Enter the 6-digit code sent to your email."
        onBack={onBack}
      >
        <form className="space-y-4" onSubmit={(event) => void handleVerifyCode(event)}>
          <Field
            label="Email address"
            icon={<FiMail size={16} />}
            value={email}
            type="email"
            onChange={setEmail}
            placeholder="you@company.com"
          />
          <Field
            label="6-Digit Reset Code"
            icon={<FiShield size={16} />}
            value={code}
            onChange={setCode}
            placeholder="123456"
            inputMode="numeric"
            autoComplete="one-time-code"
          />
          {message ? <p className={formSuccessClassName}>{message}</p> : null}
          {error ? <p className={formErrorClassName}>{error}</p> : null}
          <button type="submit" disabled={loading} className={submitClassName}>
            {loading ? 'Verifying...' : 'Verify code'}
          </button>
          <div className="flex flex-col items-center gap-2 pt-2 text-xs">
            <button
              type="button"
              className="text-accent hover:underline"
              onClick={() => {
                setStep('email');
                setCode('');
                setError('');
                setMessage('');
              }}
            >
              Use a different email
            </button>
            <button
              type="button"
              disabled={resendSeconds > 0 || loading}
              className="text-app-muted hover:text-app-text disabled:opacity-50"
              onClick={() => void handleResend()}
            >
              {resendSeconds > 0 ? `Resend code in ${resendSeconds}s` : "Didn't get a code? Resend"}
            </button>
          </div>
        </form>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Choose new password"
      subtitle={`Code verified for ${email.trim()}. Enter your new password.`}
      onBack={onBack}
    >
      <form className="space-y-4" onSubmit={(event) => void handleResetPassword(event)}>
        <PasswordField
          label="New password"
          value={password}
          visible={showPassword}
          placeholder="At least 8 characters"
          onToggle={() => setShowPassword((current) => !current)}
          onChange={setPassword}
        />
        <PasswordField
          label="Confirm new password"
          value={confirmPassword}
          visible={showConfirmPassword}
          placeholder="Re-enter your new password"
          onToggle={() => setShowConfirmPassword((current) => !current)}
          onChange={setConfirmPassword}
        />
        {message ? <p className={formSuccessClassName}>{message}</p> : null}
        {error ? <p className={formErrorClassName}>{error}</p> : null}
        <button type="submit" disabled={loading} className={submitClassName}>
          {loading ? 'Saving...' : 'Set new password'}
        </button>
        <button
          type="button"
          className="w-full text-center text-xs text-accent hover:underline"
          onClick={() => {
            setStep('code');
            setCodeVerified(false);
            setError('');
            setMessage('');
          }}
        >
          Back to code verification
        </button>
      </form>
    </AuthShell>
  );
}

/** @deprecated Use ForgotPasswordPage with email + OTP flow instead. */
export function ResetPasswordPage({
  onBack,
  onDone,
}: {
  token?: string;
  onBack: () => void;
  onDone: () => void;
}) {
  return <ForgotPasswordPage onBack={onBack} onDone={onDone} initialStep="email" />;
}

export function InviteRegisterPage({
  inviteToken,
  onBack,
  onRegistered,
}: {
  inviteToken: string;
  onBack: () => void;
  onRegistered: () => void;
}) {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [inviteError, setInviteError] = useState('');
  const [error, setError] = useState('');
  const [loadingInvite, setLoadingInvite] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void loadInviteDetails(inviteToken).then((result) => {
      if (result.ok) {
        setEmail(readInviteRegistrationEmail(result.data));
        setInviteError('');
      } else {
        setInviteError(result.error);
      }

      setLoadingInvite(false);
    });
  }, [inviteToken]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');

    const trimmedEmail = email.trim();
    const trimmedUsername = username.trim();

    if (!trimmedEmail) {
      setError('This invitation is missing an email address.');
      return;
    }

    if (!trimmedUsername) {
      setError('Username is required.');
      return;
    }

    if (!password) {
      setError('Password is required.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    const result = await registerAccount({
      inviteToken,
      email: trimmedEmail,
      username: trimmedUsername,
      password,
      confirmPassword,
    });
    setLoading(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    storeAuth(result.data);
    onRegistered();
  };

  if (loadingInvite) {
    return (
      <AuthShell title="Accept invite" subtitle="Loading invitation details..." onBack={onBack}>
        <div className="flex items-center justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      </AuthShell>
    );
  }

  if (inviteError) {
    return (
      <AuthShell title="Accept invite" subtitle="This invitation could not be loaded." onBack={onBack}>
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-accent/30 dark:bg-accent/10 dark:text-accent-soft">
          {inviteError}
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Accept invite"
      subtitle="Complete your account details to join the workspace."
      onBack={onBack}
    >
      <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
        <Field
          label="Work email"
          icon={<FiMail size={16} />}
          value={email}
          onChange={setEmail}
          type="email"
          autoComplete="email"
        />
        <Field
          label="Username"
          icon={<FiUsers size={16} />}
          value={username}
          onChange={setUsername}
          autoComplete="username"
          placeholder="your_handle"
        />
        <Field
          label="Password"
          icon={<FiLock size={16} />}
          value={password}
          onChange={setPassword}
          type="password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
        />
        <Field
          label="Confirm password"
          icon={<FiLock size={16} />}
          value={confirmPassword}
          onChange={setConfirmPassword}
          type="password"
          autoComplete="new-password"
          placeholder="Re-enter password"
        />
        {error ? <p className={formErrorClassName}>{error}</p> : null}
        <button type="submit" disabled={loading} className={submitClassName}>
          {loading ? 'Joining...' : 'Create account & join'}
        </button>
      </form>
    </AuthShell>
  );
}

/**
 * Rich Left Showcase Panel featuring Flexhubs Brand & Interactive Workspace Mockup
 */
export function BrandingPanel() {
  const { theme } = useTheme();
  const logoTheme = theme === 'dark' ? 'dark' : 'light';

  const features = [
    {
      icon: FiZap,
      title: 'Ultra-fast Real-time Messaging',
      description: 'DMs, group channels, and high-frequency sync.',
    },
    {
      icon: FiMic,
      title: 'Voice & Video Hubs',
      description: 'Low-latency spatial audio rooms & screen sharing.',
    },
    {
      icon: FiShield,
      title: 'Enterprise Workspace Security',
      description: 'Role-based access, audit trails & encryption.',
    },
  ];

  return (
    <div className="relative hidden w-[48%] flex-col justify-between overflow-hidden bg-gradient-to-br from-[#faf8f9] via-[#f3ebef] to-[#e6dce1] p-10 text-[#14151a] lg:flex select-none dark:from-[#1b0b14] dark:via-[#12070e] dark:to-[#090307] dark:text-white">
      {/* Ambient background glow orbs */}
      <div className="pointer-events-none absolute -top-24 -left-24 h-96 w-96 rounded-full bg-accent/15 blur-[100px] dark:bg-accent/25" />
      <div className="pointer-events-none absolute top-1/2 -right-24 h-80 w-80 rounded-full bg-[#943853]/10 blur-[90px] dark:bg-[#943853]/20" />
      <div className="pointer-events-none absolute -bottom-20 left-1/4 h-72 w-72 rounded-full bg-accent/10 blur-[80px] dark:bg-accent/15" />

      {/* Subtle background tech grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07] dark:opacity-[0.04]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, rgba(20,21,26,0.35) 1px, transparent 0)',
          backgroundSize: '24px 24px',
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 hidden opacity-[0.04] dark:block"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
          backgroundSize: '24px 24px',
        }}
      />

      {/* Top Header */}
      <div className="relative z-10">
        <div className="flex items-center">
          <AppLogoHorizontal className="h-11" theme={logoTheme} />
        </div>

        <h1 className="mt-8 text-3xl font-extrabold tracking-tight leading-tight text-[#14151a] dark:text-white">
          Connect, chat, and collaborate{' '}
          <span className="bg-gradient-to-r from-[#943853] via-[#c45a75] to-[#14151a] bg-clip-text text-transparent dark:from-[#e3829b] dark:via-[#f7b5c6] dark:to-white">
            in real time
          </span>
        </h1>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-[#14151a]/70 dark:text-white/75">
          Flexhubs brings your team conversations, audio hubs, and workspaces together into one seamless, high-performance client.
        </p>

        {/* Realistic Desktop App Mockup Card */}
        <div className="relative mt-7 overflow-hidden rounded-2xl border border-black/[0.08] bg-white/55 p-4 shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-white/15 dark:bg-white/[0.04] dark:shadow-2xl">
          {/* Mock Window Bar */}
          <div className="flex items-center justify-between border-b border-black/[0.06] pb-3 dark:border-white/10">
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-[#ff5f56]/80" />
              <div className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]/80" />
              <div className="h-2.5 w-2.5 rounded-full bg-[#27c93f]/80" />
              <span className="ml-2 text-[11px] font-medium text-[#14151a]/55 dark:text-white/60">
                ⚡️ Acme Engineering Hub
              </span>
            </div>
            <span className="flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 dark:border-emerald-500/20">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500 dark:bg-emerald-400" />
              18 Online
            </span>
          </div>

          {/* Mock Chat Feed Preview */}
          <div className="mt-3.5 space-y-3 text-xs">
            {/* Message 1 */}
            <div className="flex items-start gap-2.5">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 text-[11px] font-bold text-white shadow-sm">
                AK
              </div>
              <div className="flex-1 rounded-xl border border-black/[0.05] bg-white/65 p-2.5 backdrop-blur-md dark:border-white/5 dark:bg-white/[0.06]">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#14151a]/95 dark:text-white/95">Alex Kim</span>
                  <span className="text-[10px] text-[#14151a]/45 dark:text-white/40">11:42 AM</span>
                </div>
                <p className="mt-1 leading-snug text-[#14151a]/80 dark:text-white/80">
                  Just deployed the real-time audio rooms to production! 🚀
                </p>
                <div className="mt-2 flex items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 rounded-md bg-black/[0.04] px-1.5 py-0.5 text-[10px] text-[#14151a]/85 dark:bg-white/10 dark:text-white/90">
                    🔥 6
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-md bg-black/[0.04] px-1.5 py-0.5 text-[10px] text-[#14151a]/85 dark:bg-white/10 dark:text-white/90">
                    🎉 4
                  </span>
                </div>
              </div>
            </div>

            {/* Active Voice Hub Pill */}
            <div className="flex items-center justify-between rounded-xl border border-accent/30 bg-accent/15 px-3 py-2 backdrop-blur-sm dark:border-accent/35 dark:bg-accent/20">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-accent text-white">
                  <FiMic size={12} />
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-[#14151a] dark:text-white">Sprint Planning Room</p>
                  <p className="text-[10px] text-[#14151a]/60 dark:text-white/60">3 members connected</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <span className="h-2 w-1 animate-bounce rounded-full bg-accent-soft" />
                <span
                  className="h-3.5 w-1 animate-bounce rounded-full bg-[#14151a]/70 dark:bg-white"
                  style={{ animationDelay: '150ms' }}
                />
                <span className="h-2 w-1 animate-bounce rounded-full bg-accent-soft" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Feature Highlights Grid */}
      <div className="relative z-10 space-y-3.5 pt-6">
        {features.map((feature) => (
          <div
            key={feature.title}
            className="flex items-center gap-3.5 rounded-xl border border-black/[0.06] bg-white/45 p-2.5 backdrop-blur-md transition-colors hover:bg-white/60 dark:border-white/5 dark:bg-white/[0.03] dark:hover:bg-white/[0.06]"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-[#5e1f30] text-white shadow-md shadow-accent/20">
              <feature.icon size={16} />
            </div>
            <div>
              <p className="text-xs font-semibold text-[#14151a]/95 dark:text-white/95">{feature.title}</p>
              <p className="text-[11px] leading-tight text-[#14151a]/65 dark:text-white/65">{feature.description}</p>
            </div>
          </div>
        ))}

        {/* Security / Quality stamp */}
        <div className="flex items-center justify-between border-t border-black/[0.08] pt-2 text-[11px] text-[#14151a]/50 dark:border-white/10 dark:text-white/50">
          <span className="flex items-center gap-1">
            <FiCheckCircle size={12} className="text-emerald-600 dark:text-emerald-400" /> End-to-end encrypted
          </span>
          <span>99.9% Real-time SLA</span>
          <span>High-performance Hubs</span>
        </div>
      </div>
    </div>
  );
}

/** Shared auth / onboarding backdrop (gradient + accent glow). */
export function AppShellBackground() {
  return (
    <>
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/70 via-transparent to-app-inset/45 dark:from-[#12131c]/90 dark:via-[#0a0b10]/40 dark:to-[#040408]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute top-12 right-[10%] h-72 w-72 rounded-full bg-accent/[0.07] blur-[100px] dark:bg-accent/[0.14]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute bottom-16 left-[8%] h-56 w-56 rounded-full bg-accent/[0.04] blur-[80px] dark:bg-accent/[0.08]"
        aria-hidden="true"
      />
    </>
  );
}

/**
 * Universal Authentication Page Shell
 */
export function AuthShell({
  title,
  subtitle,
  onBack,
  children,
  headerContent,
  backLabel = 'Back to sign in',
}: {
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  children: ReactNode;
  headerContent?: ReactNode;
  backLabel?: string;
}) {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="relative flex h-screen w-full overflow-hidden bg-app-bg-login text-app-text">
      <AppShellBackground />
      <div className="relative z-[1] flex min-h-0 min-w-0 flex-1">
      <BrandingPanel />

      {/* Right Form Area */}
      <div className="relative flex flex-1 flex-col items-center justify-center overflow-y-auto p-6 sm:p-10">

        {/* Theme Toggle Button */}
        <div className="absolute top-6 right-6 z-20">
          <button
            type="button"
            aria-label="Toggle theme"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-app-border bg-app-surface text-app-muted shadow-sm transition-all hover:border-app-border-strong hover:text-app-text hover:shadow-md active:scale-95 dark:hover:shadow"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {theme === 'dark' ? <FiSun size={17} className="text-amber-400" /> : <FiMoon size={17} className="text-app-text" />}
          </button>
        </div>

        {/* Main Form Card */}
        <div className="relative z-10 w-full max-w-[440px] rounded-[24px] border border-app-border bg-app-surface p-7 shadow-[0_20px_50px_rgba(15,23,42,0.08)] sm:p-9 dark:border-app-border dark:bg-app-surface/95 dark:shadow-2xl dark:backdrop-blur-md">
          {/* Back Action */}
          {onBack ? (
            <button
              type="button"
              className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-app-muted transition-colors hover:text-app-text"
              onClick={onBack}
            >
              <FiArrowLeft size={14} /> {backLabel}
            </button>
          ) : null}

          {/* Mobile Logo Header */}
          <div className="mb-6 flex justify-center lg:hidden">
            <AppLogoHorizontal className="h-10" theme={theme === 'dark' ? 'dark' : 'light'} />
          </div>

          {headerContent}
          
          {title ? (
            <h2 className="text-2xl font-bold tracking-tight text-app-text">
              {title}
            </h2>
          ) : null}
          
          {subtitle ? (
            <p className="mt-1.5 mb-6 text-xs sm:text-sm leading-relaxed text-app-muted">
              {subtitle}
            </p>
          ) : null}

          {children}
        </div>
      </div>
      </div>
    </div>
  );
}

export function Field({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  inputMode,
  autoComplete,
  icon,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  inputMode?: HTMLAttributes<HTMLInputElement>['inputMode'];
  autoComplete?: string;
  icon?: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-app-text">{label}</span>
      <div className="relative flex items-center">
        {icon ? (
          <span className="pointer-events-none absolute left-3.5 text-app-muted">
            {icon}
          </span>
        ) : null}
        <input
          type={type}
          value={value}
          placeholder={placeholder}
          inputMode={inputMode}
          autoComplete={autoComplete}
          className={`${inputClassName} ${icon ? 'pl-10' : ''}`}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
    </label>
  );
}

export function PasswordField({
  label,
  value,
  visible,
  placeholder,
  onToggle,
  onChange,
}: {
  label: string;
  value: string;
  visible: boolean;
  placeholder?: string;
  onToggle: () => void;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-app-text">{label}</span>
      <div className="relative flex items-center">
        <span className="pointer-events-none absolute left-3.5 text-app-muted">
          <FiLock size={16} />
        </span>
        <input
          type={visible ? 'text' : 'password'}
          value={value}
          placeholder={placeholder}
          autoComplete="new-password"
          className={`${inputClassName} pl-10 pr-11`}
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          type="button"
          className="absolute right-3 flex h-7 w-7 items-center justify-center rounded-md text-app-muted transition-colors hover:text-app-text"
          aria-label={visible ? 'Hide password' : 'Show password'}
          onClick={onToggle}
        >
          <EyeIcon hidden={!visible} />
        </button>
      </div>
    </label>
  );
}
