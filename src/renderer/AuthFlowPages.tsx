import { FormEvent, useEffect, useState, type HTMLAttributes, type ReactNode } from 'react';
import {
  loadInviteDetails,
  registerAccount,
  requestPasswordReset,
  resetAccountPassword,
  verifyPasswordResetCode,
} from './authExtrasApi';
import { storeAuth } from './authApi';
import { readInviteRegistrationEmail } from '../shared/auth';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESEND_SECONDS = 20;

const inputClassName =
  'w-full rounded-[10px] border border-app-border bg-app-surface-input px-3.5 py-3 text-app-text outline-none transition-colors placeholder:text-app-placeholder focus:border-app-border-strong';

const submitClassName =
  'mt-1 w-full rounded-[10px] border-none bg-accent px-4 py-3.5 text-[0.9375rem] font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-70';

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
  onCreateWorkspace,
}: {
  onBack: () => void;
  onCreateWorkspace?: () => void;
}) {
  return (
    <AuthShell
      title="Create account"
      subtitle="New FlexHubs accounts are created through a workspace or a team invitation."
      onBack={onBack}
    >
      <div className="space-y-4 text-sm leading-relaxed text-app-muted">
        <p>
          To get started, create a company workspace for your team, or open the invitation link you
          received by email.
        </p>
        {onCreateWorkspace ? (
          <button type="button" className={submitClassName} onClick={onCreateWorkspace}>
            Create a workspace
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
        subtitle="Enter the email address linked to your FlexHubs account. We'll send a 6-digit code to verify it's you."
        onBack={onBack}
      >
        <form className="space-y-4" onSubmit={(event) => void handleSendCode(event)}>
          <Field label="Email" value={email} type="email" onChange={setEmail} placeholder="you@company.com" />
          {message ? <p className="text-sm text-[#3ecf8e]">{message}</p> : null}
          {error ? <p className="text-sm text-accent-soft">{error}</p> : null}
          <button type="submit" disabled={loading} className={submitClassName}>
            {loading ? 'Sending...' : 'Send reset code'}
          </button>
        </form>
      </AuthShell>
    );
  }

  if (step === 'code') {
    return (
      <AuthShell
        title="Verify your email"
        subtitle="Enter your account email again and the 6-digit code we sent. Codes expire after 10 minutes."
        onBack={onBack}
      >
        <form className="space-y-4" onSubmit={(event) => void handleVerifyCode(event)}>
          <Field label="Email" value={email} type="email" onChange={setEmail} placeholder="you@company.com" />
          <Field
            label="Reset code"
            value={code}
            onChange={setCode}
            placeholder="6-digit code"
            inputMode="numeric"
            autoComplete="one-time-code"
          />
          {message ? <p className="text-sm text-[#3ecf8e]">{message}</p> : null}
          {error ? <p className="text-sm text-accent-soft">{error}</p> : null}
          <button type="submit" disabled={loading} className={submitClassName}>
            {loading ? 'Verifying...' : 'Verify code'}
          </button>
          <div className="flex flex-col items-center gap-2 pt-2 text-sm">
            <button
              type="button"
              className="text-accent hover:opacity-85"
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
              {resendSeconds > 0 ? `Resend in ${resendSeconds}s` : "Didn't get a code? Resend"}
            </button>
          </div>
        </form>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Choose a new password"
      subtitle={`Code verified for ${email.trim()}. Enter and confirm your new password below.`}
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
        {message ? <p className="text-sm text-[#3ecf8e]">{message}</p> : null}
        {error ? <p className="text-sm text-accent-soft">{error}</p> : null}
        <button type="submit" disabled={loading} className={submitClassName}>
          {loading ? 'Saving...' : 'Set new password'}
        </button>
        <button
          type="button"
          className="w-full text-sm text-accent hover:opacity-85"
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
      <AuthShell title="Accept invite" subtitle="Loading invitation..." onBack={onBack}>
        <p className="text-sm text-app-muted">Checking your invitation link...</p>
      </AuthShell>
    );
  }

  if (inviteError) {
    return (
      <AuthShell title="Accept invite" subtitle="This invitation could not be loaded." onBack={onBack}>
        <p className="text-sm text-accent-soft">{inviteError}</p>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Accept invite" subtitle="Complete your account to join the workspace." onBack={onBack}>
      <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
        <Field label="Work email" value={email} onChange={setEmail} type="email" autoComplete="email" />
        <Field label="Username" value={username} onChange={setUsername} autoComplete="username" />
        <Field label="Password" value={password} onChange={setPassword} type="password" autoComplete="new-password" />
        <Field
          label="Confirm password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          type="password"
          autoComplete="new-password"
        />
        {error ? <p className="text-sm text-accent-soft">{error}</p> : null}
        <button type="submit" disabled={loading} className={submitClassName}>
          {loading ? 'Joining...' : 'Create account & join'}
        </button>
      </form>
    </AuthShell>
  );
}

function AuthShell({
  title,
  subtitle,
  onBack,
  children,
}: {
  title: string;
  subtitle: string;
  onBack: () => void;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-full items-center justify-center bg-app-bg-login p-6">
      <div className="w-full max-w-[420px] rounded-[20px] border border-app-border bg-app-surface p-8 shadow-app">
        <button type="button" className="mb-4 text-sm text-app-muted hover:text-app-text" onClick={onBack}>
          ← Back to login
        </button>
        <h1 className="text-2xl font-bold text-app-text">{title}</h1>
        <p className="mt-1 mb-6 text-sm text-app-muted">{subtitle}</p>
        {children}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  inputMode,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  inputMode?: HTMLAttributes<HTMLInputElement>['inputMode'];
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-app-text">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        inputMode={inputMode}
        autoComplete={autoComplete}
        className={inputClassName}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function PasswordField({
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
      <span className="mb-2 block text-sm font-medium text-app-text">{label}</span>
      <div className="relative">
        <input
          type={visible ? 'text' : 'password'}
          value={value}
          placeholder={placeholder}
          autoComplete="new-password"
          className={`${inputClassName} pr-11`}
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          type="button"
          className="absolute top-1/2 right-3 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md border-none bg-transparent text-app-muted transition-colors hover:text-app-text"
          aria-label={visible ? 'Hide password' : 'Show password'}
          onClick={onToggle}
        >
          <EyeIcon hidden={!visible} />
        </button>
      </div>
    </label>
  );
}
