import { FormEvent, useState } from 'react';
import { login, storeAuth } from './authApi';

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
    return { email: 'Invalid email.' };
  }

  if (mentionsPassword && !mentionsEmail) {
    return { password: 'Invalid password.' };
  }

  if (status === 404) {
    return { email: 'Invalid email.' };
  }

  if (status === 401 || message.includes('credential') || message.includes('unauthorized')) {
    return { password: 'Invalid password.' };
  }

  return { form: error };
}

const pageClassName =
  'relative flex min-h-full items-center justify-center bg-app-bg p-6';

const cardClassName =
  'w-full max-w-[520px] rounded-[20px] border border-app-border bg-app-surface p-8 shadow-app';

const inputClassName =
  'w-full rounded-[10px] border border-app-border bg-app-surface-input px-3.5 py-3 text-app-text outline-none transition-colors placeholder:text-app-placeholder focus:border-app-border-strong';

const submitClassName =
  'mt-1 w-full rounded-[10px] border-none bg-accent px-4 py-3.5 text-[0.9375rem] font-semibold text-white transition-colors hover:bg-accent-hover active:bg-accent-active disabled:cursor-not-allowed disabled:opacity-70';

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
    <div className={pageClassName}>
      <div className={cardClassName}>
        <header className="mb-7">
          <h1 className="mb-2 text-[1.75rem] font-bold text-app-text">Sign in</h1>
          <p className="text-[0.9375rem] leading-normal text-app-muted">
            Welcome back. Enter your credentials to open your workspace.
          </p>
        </header>

        <form className="flex flex-col gap-5" onSubmit={handleSubmit} noValidate>
          {formError ? (
            <div
              className="rounded-[10px] border border-accent/35 bg-accent/10 px-3.5 py-3 text-sm leading-snug text-accent-soft"
              role="alert"
            >
              {formError}
            </div>
          ) : null}

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-app-text" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              className={`${inputClassName}${fieldErrors.email ? ' border-accent focus:border-accent' : ''}`}
              type="text"
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
            {fieldErrors.email ? (
              <p id="email-error" className="text-[0.8125rem] leading-snug text-accent-soft" role="alert">
                {fieldErrors.email}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-app-text" htmlFor="password">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                className={`${inputClassName} pr-11${fieldErrors.password ? ' border-accent focus:border-accent' : ''}`}
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
                className="absolute top-1/2 right-3 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md border-none bg-transparent text-app-muted transition-colors hover:text-app-text"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                onClick={() => setShowPassword((current) => !current)}
              >
                <EyeIcon hidden={!showPassword} />
              </button>
            </div>
            {fieldErrors.password ? (
              <p id="password-error" className="text-[0.8125rem] leading-snug text-accent-soft" role="alert">
                {fieldErrors.password}
              </p>
            ) : null}
          </div>

          <button
            type="button"
            className="-mt-2 self-end text-sm font-medium text-accent transition-opacity hover:opacity-85"
            onClick={() => onForgotPassword?.()}
          >
            Forgot password?
          </button>

          <button type="submit" className={submitClassName} disabled={isSubmitting}>
            {isSubmitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        {onCreatePersonalAccount || onCreateWorkspace ? (
          <footer className="mt-7 space-y-3 border-t border-app-border pt-6 text-center text-sm text-app-muted">
            {onCreatePersonalAccount ? (
              <p>
                New here?{' '}
                <button
                  type="button"
                  className="font-medium text-accent underline transition-opacity hover:opacity-85"
                  onClick={onCreatePersonalAccount}
                >
                  Create a personal account
                </button>
              </p>
            ) : null}
            {onCreateWorkspace ? (
              <p>
                Starting a company workspace?{' '}
                <button
                  type="button"
                  className="font-medium text-accent underline transition-opacity hover:opacity-85"
                  onClick={onCreateWorkspace}
                >
                  Create a workspace
                </button>
              </p>
            ) : null}
          </footer>
        ) : null}
      </div>
    </div>
  );
}
