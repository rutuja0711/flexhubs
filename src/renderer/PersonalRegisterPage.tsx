import { FormEvent, useEffect, useState, type ReactNode } from 'react';
import {
  registerIndividualAccount,
  sendIndividualRegistrationOtp,
  verifyIndividualRegistrationOtp,
} from './authExtrasApi';
import { storeAuth } from './authApi';
import { AuthShell, inputClassName, submitClassName } from './AuthFlowPages';
import { FiMail, FiUser, FiLock, FiCheckCircle, FiArrowRight } from 'react-icons/fi';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESEND_SECONDS = 60;

type Step = 'email' | 'verify' | 'account';

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

function StepIndicator({ step }: { step: Step }) {
  const steps = [
    { id: 'email' as const, label: 'Email', num: '1' },
    { id: 'verify' as const, label: 'Verify', num: '2' },
    { id: 'account' as const, label: 'Profile', num: '3' },
  ];
  const currentIndex = steps.findIndex((item) => item.id === step);

  return (
    <div className="mb-6 flex items-center justify-between px-2">
      {steps.map((item, index) => {
        const completed = index < currentIndex;
        const active = item.id === step;

        return (
          <div key={item.id} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all shadow-sm ${
                  completed
                    ? 'bg-emerald-500 text-white shadow-emerald-500/20'
                    : active
                    ? 'bg-gradient-to-br from-accent to-[#6a2337] text-white ring-4 ring-accent/20'
                    : 'border border-app-border bg-app-surface-input text-app-muted'
                }`}
              >
                {completed ? '✓' : item.num}
              </div>
              <span
                className={`text-[11px] font-medium tracking-tight ${
                  active ? 'text-app-text font-semibold' : 'text-app-muted'
                }`}
              >
                {item.label}
              </span>
            </div>

            {index < steps.length - 1 ? (
              <div
                className={`mx-2 mb-4 h-[2px] flex-1 rounded-full transition-all ${
                  completed ? 'bg-emerald-500/80' : 'bg-app-border'
                }`}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export default function PersonalRegisterPage({
  onBack,
  onRegistered,
}: {
  onBack: () => void;
  onRegistered: () => void;
}) {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
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

  const handleSendOtp = async (event: FormEvent) => {
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
    const result = await sendIndividualRegistrationOtp(trimmedEmail);
    setLoading(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setEmail(trimmedEmail);
    setCode('');
    setStep('verify');
    startResendCooldown();

    if (result.data.delivered === false) {
      setMessage(
        "We couldn't send email from this environment. Check the server terminal for your 6-digit code.",
      );
      return;
    }

    setMessage(result.data.message ?? 'Verification code sent. Check your inbox.');
  };

  const handleVerifyOtp = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setMessage('');

    const trimmedEmail = email.trim();
    const trimmedCode = code.replace(/\D/g, '');

    if (!trimmedEmail) {
      setError('Email is required.');
      return;
    }

    if (!/^\d{6}$/.test(trimmedCode)) {
      setError('Enter the 6-digit code from your email.');
      return;
    }

    setLoading(true);
    const result = await verifyIndividualRegistrationOtp({
      email: trimmedEmail,
      code: trimmedCode,
    });
    setLoading(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setCode(trimmedCode);
    setStep('account');
    setMessage(result.data.message ?? 'Email verified. Finish setting up your account.');
  };

  const handleCreateAccount = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setMessage('');

    const trimmedEmail = email.trim();
    const trimmedUsername = username.trim();
    const trimmedCode = code.replace(/\D/g, '');

    if (!/^\d{6}$/.test(trimmedCode)) {
      setError('Your verification code expired or is missing. Verify your email again.');
      setStep('verify');
      return;
    }

    if (!trimmedUsername) {
      setError('Username is required.');
      return;
    }

    if (trimmedUsername.length < 3) {
      setError('Username must be at least 3 characters.');
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
    const result = await registerIndividualAccount({
      email: trimmedEmail,
      username: trimmedUsername,
      password,
      confirmPassword,
      emailVerificationCode: trimmedCode,
    });
    setLoading(false);

    if (!result.ok) {
      setError(result.error);
      if (result.status === 400 && /code|verify|otp/i.test(result.error)) {
        setStep('verify');
      }
      return;
    }

    storeAuth(result.data);
    onRegistered();
  };

  const handleResend = async () => {
    if (resendSeconds > 0 || loading) {
      return;
    }

    setError('');
    setMessage('');
    setLoading(true);
    const result = await sendIndividualRegistrationOtp(email.trim());
    setLoading(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    startResendCooldown();
    setMessage(result.data.message ?? 'A new verification code has been sent.');
  };

  if (step === 'email') {
    return (
      <AuthShell
        headerContent={<StepIndicator step="email" />}
        title="Personal Signup"
        subtitle="Enter your email to receive a 6-digit confirmation code."
        onBack={onBack}
      >
        <form className="space-y-4" onSubmit={(event) => void handleSendOtp(event)}>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-app-text" htmlFor="personal-email">
              Email address
            </label>
            <div className="relative flex items-center">
              <span className="pointer-events-none absolute left-3.5 text-app-muted">
                <FiMail size={16} />
              </span>
              <input
                id="personal-email"
                type="email"
                value={email}
                placeholder="you@email.com"
                autoComplete="email"
                className={`${inputClassName} pl-10`}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
          </div>

          {message ? <p className="text-xs text-emerald-500">{message}</p> : null}
          {error ? <p className="text-xs text-accent-soft">{error}</p> : null}

          <button
            type="submit"
            disabled={loading}
            className={`${submitClassName} flex items-center justify-center gap-2`}
          >
            {loading ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                <span>Sending code...</span>
              </>
            ) : (
              <>
                <span>Send verification code</span>
                <FiArrowRight size={16} />
              </>
            )}
          </button>
        </form>
      </AuthShell>
    );
  }

  if (step === 'verify') {
    return (
      <AuthShell
        headerContent={<StepIndicator step="verify" />}
        title="Verify email"
        subtitle={`Enter the 6-digit code sent to ${email.trim()}.`}
        onBack={onBack}
      >
        <form className="space-y-4" onSubmit={(event) => void handleVerifyOtp(event)}>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-app-text">Email address</label>
            <div className="relative flex items-center">
              <span className="pointer-events-none absolute left-3.5 text-app-muted">
                <FiMail size={16} />
              </span>
              <input
                type="email"
                value={email}
                readOnly
                className={`${inputClassName} pl-10 opacity-75 cursor-not-allowed`}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-app-text">6-Digit verification code</label>
            <input
              type="text"
              value={code}
              placeholder="0 0 0 0 0 0"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              className={`${inputClassName} text-center tracking-[0.3em] font-semibold text-lg`}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
            />
          </div>

          {message ? <p className="text-xs text-emerald-500">{message}</p> : null}
          {error ? <p className="text-xs text-accent-soft">{error}</p> : null}

          <button
            type="submit"
            disabled={loading}
            className={`${submitClassName} flex items-center justify-center gap-2`}
          >
            {loading ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                <span>Verifying...</span>
              </>
            ) : (
              <>
                <span>Verify code</span>
                <FiArrowRight size={16} />
              </>
            )}
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
              {resendSeconds > 0 ? `Resend in ${resendSeconds}s` : "Didn't get a code? Resend"}
            </button>
          </div>
        </form>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      headerContent={<StepIndicator step="account" />}
      title="Complete your profile"
      subtitle="Choose your unique username and account password."
      onBack={onBack}
    >
      <form className="space-y-4" onSubmit={(event) => void handleCreateAccount(event)}>
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2.5 text-xs font-medium text-emerald-500">
          <FiCheckCircle size={15} />
          <span>Email verified: {email.trim()}</span>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-app-text" htmlFor="username">
            Username handle
          </label>
          <div className="relative flex items-center">
            <span className="pointer-events-none absolute left-3.5 text-app-muted">
              <FiUser size={16} />
            </span>
            <input
              id="username"
              type="text"
              value={username}
              placeholder="e.g. alex_kim"
              autoComplete="username"
              className={`${inputClassName} pl-10`}
              onChange={(event) => setUsername(event.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-app-text" htmlFor="personal-pass">
            Password
          </label>
          <div className="relative flex items-center">
            <span className="pointer-events-none absolute left-3.5 text-app-muted">
              <FiLock size={16} />
            </span>
            <input
              id="personal-pass"
              type={showPassword ? 'text' : 'password'}
              value={password}
              placeholder="At least 8 characters"
              autoComplete="new-password"
              className={`${inputClassName} pl-10 pr-11`}
              onChange={(event) => setPassword(event.target.value)}
            />
            <button
              type="button"
              className="absolute right-3 flex h-7 w-7 items-center justify-center rounded-md text-app-muted transition-colors hover:text-app-text"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              onClick={() => setShowPassword((current) => !current)}
            >
              <EyeIcon hidden={!showPassword} />
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-app-text" htmlFor="personal-pass-confirm">
            Confirm password
          </label>
          <div className="relative flex items-center">
            <span className="pointer-events-none absolute left-3.5 text-app-muted">
              <FiLock size={16} />
            </span>
            <input
              id="personal-pass-confirm"
              type={showConfirmPassword ? 'text' : 'password'}
              value={confirmPassword}
              placeholder="Re-enter password"
              autoComplete="new-password"
              className={`${inputClassName} pl-10 pr-11`}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
            <button
              type="button"
              className="absolute right-3 flex h-7 w-7 items-center justify-center rounded-md text-app-muted transition-colors hover:text-app-text"
              aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
              onClick={() => setShowConfirmPassword((current) => !current)}
            >
              <EyeIcon hidden={!showConfirmPassword} />
            </button>
          </div>
        </div>

        {message ? <p className="text-xs text-emerald-500">{message}</p> : null}
        {error ? <p className="text-xs text-accent-soft">{error}</p> : null}

        <button
          type="submit"
          disabled={loading}
          className={`${submitClassName} flex items-center justify-center gap-2`}
        >
          {loading ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              <span>Creating account...</span>
            </>
          ) : (
            <>
              <span>Create personal account</span>
              <FiArrowRight size={16} />
            </>
          )}
        </button>

        <button
          type="button"
          className="w-full text-center text-xs text-accent hover:underline"
          onClick={() => {
            setStep('verify');
            setError('');
            setMessage('');
          }}
        >
          Back to verification step
        </button>
      </form>
    </AuthShell>
  );
}
