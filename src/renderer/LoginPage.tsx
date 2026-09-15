import { FormEvent, useState } from 'react';
import { login, storeAuth } from './authApi';
import {
  AuthShell,
  authSecondaryButtonClassName,
  formAlertClassName,
  formErrorClassName,
  inputClassName,
  submitClassName,
} from './AuthFlowPages';
import { FiMail, FiLock, FiAlertCircle, FiUserPlus, FiGrid, FiArrowRight } from 'react-icons/fi';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type FieldErrors = {
  email?: string;
  password?: string;
};

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

function validateForm(email: string, password: string): FieldErrors {
  const errors: FieldErrors = {};
  const trimmedEmail = email.trim();

  if (!trimmedEmail) {
    errors.email = 'Email is required.';
  } else if (!EMAIL_PATTERN.test(trimmedEmail)) {
    errors.email = 'Enter a valid email address.';
  }

  if (!password) {
    errors.password = 'Password is required.';
  }

  return errors;
}

function classifyLoginError(
  error: string,
  status?: number,
  field?: 'email' | 'password',
): FieldErrors | { form: string } {
  if (field === 'email') {
    return { email: error || 'Invalid email.' };
  }

  if (field === 'password') {
    return { password: error || 'Invalid password.' };
  }

  const message = error.toLowerCase();
  const mentionsEmail =
    message.includes('email') ||
    message.includes('user not found') ||
    message.includes('no account') ||
    message.includes('account not found') ||
    message.includes('unknown user');
  const mentionsPassword = message.includes('password');

  if (mentionsEmail && !mentionsPassword) {
    return { email: error || 'No account found with this email.' };
  }

  if (mentionsPassword && !mentionsEmail) {
    return { password: error || 'Invalid password.' };
  }

  if (status === 404) {
    return { email: error || 'No account found with this email.' };
  }

  if (status === 401 || message.includes('credential') || message.includes('unauthorized')) {
    return { password: error || 'Invalid email or password.' };
  }

  return { form: error };
}

export default function LoginPage({
  onLoggedIn,
  onCreatePersonalAccount,
  onCreateWorkspace,
  onForgotPassword,
}: {
  onLoggedIn: () => void;
  onCreatePersonalAccount?: () => void;
  onCreateWorkspace?: () => void;
  onForgotPassword?: () => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError('');

    const validationErrors = validateForm(email, password);
    setFieldErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    setIsSubmitting(true);

    const result = await login({
      email: email.trim(),
      password,
    });

    setIsSubmitting(false);

    if (!result.ok) {
      const classified = classifyLoginError(result.error, result.status, result.field);

      if ('form' in classified) {
        setFieldErrors({});
        setFormError(classified.form);
        return;
      }

      setFormError('');
      setFieldErrors(classified);
      return;
    }

    storeAuth(result.data);
    onLoggedIn();
  };

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to your Flexhubs account to access your workspaces and chats."
    >
      <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
        {formError ? (
          <div className={formAlertClassName} role="alert">
            <FiAlertCircle size={16} className="mt-0.5 shrink-0 text-red-500 dark:text-accent" />
            <span>{formError}</span>
          </div>
        ) : null}

        {/* Email Field */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-app-text" htmlFor="email">
            Email address
          </label>
          <div className="relative flex items-center">
            <span className="pointer-events-none absolute left-3.5 text-app-muted">
              <FiMail size={16} />
            </span>
            <input
              id="email"
              className={`${inputClassName} pl-10 ${
                fieldErrors.email ? 'border-accent focus:border-accent ring-2 ring-accent/20' : ''
              }`}
              type="email"
              placeholder="you@company.com"
              autoComplete="email"
              value={email}
              aria-invalid={Boolean(fieldErrors.email)}
              aria-describedby={fieldErrors.email ? 'email-error' : undefined}
              onChange={(event) => {
                setEmail(event.target.value);
                if (fieldErrors.email) {
                  setFieldErrors((current) => ({ ...current, email: undefined }));
                }
                if (formError) {
                  setFormError('');
                }
              }}
            />
          </div>
          {fieldErrors.email ? (
            <p id="email-error" className={formErrorClassName} role="alert">
              {fieldErrors.email}
            </p>
          ) : null}
        </div>

        {/* Password Field */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-app-text" htmlFor="password">
              Password
            </label>
            {onForgotPassword ? (
              <button
                type="button"
                className="text-xs font-medium text-accent transition-opacity hover:opacity-85"
                onClick={onForgotPassword}
              >
                Forgot password?
              </button>
            ) : null}
          </div>
          <div className="relative flex items-center">
            <span className="pointer-events-none absolute left-3.5 text-app-muted">
              <FiLock size={16} />
            </span>
            <input
              id="password"
              className={`${inputClassName} pl-10 pr-11 ${
                fieldErrors.password ? 'border-accent focus:border-accent ring-2 ring-accent/20' : ''
              }`}
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter your password"
              autoComplete="current-password"
              value={password}
              aria-invalid={Boolean(fieldErrors.password)}
              aria-describedby={fieldErrors.password ? 'password-error' : undefined}
              onChange={(event) => {
                setPassword(event.target.value);
                if (fieldErrors.password) {
                  setFieldErrors((current) => ({ ...current, password: undefined }));
                }
                if (formError) {
                  setFormError('');
                }
              }}
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
          {fieldErrors.password ? (
            <p id="password-error" className={formErrorClassName} role="alert">
              {fieldErrors.password}
            </p>
          ) : null}
        </div>

        {/* Submit Action */}
        <button
          type="submit"
          className={`${submitClassName} mt-2 flex items-center justify-center gap-2`}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              <span>Signing in...</span>
            </>
          ) : (
            <>
              <span>Sign in</span>
              <FiArrowRight size={16} />
            </>
          )}
        </button>
      </form>

      {/* Account Options Section */}
      {onCreatePersonalAccount || onCreateWorkspace ? (
        <div className="mt-6 pt-5 border-t border-app-border space-y-3">
          <p className="text-center text-[11px] font-semibold uppercase tracking-wider text-app-muted">
            Don't have an account?
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {onCreatePersonalAccount ? (
              <button
                type="button"
                className={authSecondaryButtonClassName}
                onClick={onCreatePersonalAccount}
              >
                <FiUserPlus size={14} className="text-accent" />
                <span>Create account</span>
              </button>
            ) : null}

            {onCreateWorkspace ? (
              <button
                type="button"
                className={authSecondaryButtonClassName}
                onClick={onCreateWorkspace}
              >
                <FiGrid size={14} className="text-accent" />
                <span>New workspace</span>
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </AuthShell>
  );
}
