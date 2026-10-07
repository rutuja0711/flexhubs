import { useEffect, useState } from 'react';
import { AppLogoMark } from './brand/AppLogo';
import {
  DESKTOP_LEGAL_VERSION,
  DESKTOP_PRIVACY_URL,
  DESKTOP_TERMS_URL,
  needsDesktopLegalAcceptance,
  storeAcceptedDesktopLegalVersion,
} from '../shared/desktopLegal';

type DesktopLegalGateProps = {
  children: React.ReactNode;
};

export function DesktopLegalGate({ children }: DesktopLegalGateProps) {
  const [checking, setChecking] = useState(true);
  const [mustAccept, setMustAccept] = useState(false);
  const [checkedTerms, setCheckedTerms] = useState(false);

  useEffect(() => {
    if (!window.electronAPI?.getDesktopLegalContext) {
      setChecking(false);
      setMustAccept(false);
      return;
    }

    void window.electronAPI
      .getDesktopLegalContext()
      .then((context) => {
        setMustAccept(needsDesktopLegalAcceptance(context.isPackaged));
      })
      .catch(() => {
        setMustAccept(false);
      })
      .finally(() => {
        setChecking(false);
      });
  }, []);

  const handleAccept = () => {
    storeAcceptedDesktopLegalVersion(DESKTOP_LEGAL_VERSION);
    setMustAccept(false);
  };

  const handleDecline = () => {
    void window.electronAPI?.quitDesktopApp?.();
  };

  const openExternal = (url: string) => {
    void window.electronAPI?.openExternalUrl?.(url);
  };

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-app-chat-bg text-app-text">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  if (!mustAccept) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0e070b] px-6 py-10 text-white">
      <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-[#1b0c13] p-3 shadow-xl">
        <AppLogoMark className="h-8 w-8" />
      </div>

      <h1 className="text-xl font-bold tracking-tight">Welcome to FlexHubs Desktop</h1>
      <p className="mt-2 max-w-lg text-center text-sm text-zinc-400">
        Before you continue, review and accept our terms. On Windows, the installer places the app in your user
        profile (typically{' '}
        <span className="font-mono text-xs text-zinc-300">%LocalAppData%\FlexHubsDesktop</span>) — a standard
        per-user install without a custom folder step.
      </p>

      <div className="mt-6 max-h-48 w-full max-w-xl overflow-y-auto rounded-xl border border-white/10 bg-white/5 p-4 text-left text-xs leading-relaxed text-zinc-300">
        <p className="mb-2 font-semibold text-white">Terms of Use (summary)</p>
        <p>
          By using FlexHubs Desktop you agree to our Terms of Service and Privacy Policy. You are responsible for
          your account, lawful use, and granting permissions (microphone, camera, screen sharing) when using calls
          and meetings.
        </p>
        <p className="mt-2">
          Full terms:{' '}
          <button type="button" className="text-accent underline" onClick={() => openExternal(DESKTOP_TERMS_URL)}>
            flexhubs.in/terms
          </button>
          {' · '}
          <button type="button" className="text-accent underline" onClick={() => openExternal(DESKTOP_PRIVACY_URL)}>
            Privacy
          </button>
        </p>
      </div>

      <label className="mt-5 flex max-w-xl cursor-pointer items-start gap-3 text-left text-sm text-zinc-300">
        <input
          type="checkbox"
          checked={checkedTerms}
          onChange={(event) => setCheckedTerms(event.target.checked)}
          className="mt-1 h-4 w-4 rounded border-white/20 accent-accent"
        />
        <span>
          I have read and agree to the FlexHubs{' '}
          <button type="button" className="text-accent underline" onClick={() => openExternal(DESKTOP_TERMS_URL)}>
            Terms of Service
          </button>{' '}
          and{' '}
          <button type="button" className="text-accent underline" onClick={() => openExternal(DESKTOP_PRIVACY_URL)}>
            Privacy Policy
          </button>
          .
        </span>
      </label>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          disabled={!checkedTerms}
          onClick={handleAccept}
          className="rounded-xl bg-accent px-6 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          Accept & Continue
        </button>
        <button
          type="button"
          onClick={handleDecline}
          className="rounded-xl border border-white/15 px-6 py-2.5 text-sm font-medium text-zinc-300 transition hover:bg-white/5"
        >
          Decline & Exit
        </button>
      </div>
    </div>
  );
}
