import { useCallback, useEffect, useState } from 'react';
import ChatPage from './ChatPage';
import LoginPage from './LoginPage';
import { clearAuth, getCurrentUser, getStoredToken, performLogout } from './authApi';
import { AppLogoMark } from './brand/AppLogo';
import { FiRefreshCw, FiAlertCircle } from 'react-icons/fi';

import RegisterWorkspacePage from './RegisterWorkspacePage';
import PersonalRegisterPage from './PersonalRegisterPage';
import {
  ForgotPasswordPage,
  InviteRegisterPage,
  RegisterPage,
} from './AuthFlowPages';
import NotificationOverlay from './NotificationOverlay';
import { ErrorBoundary } from './ErrorBoundary';

type Screen =
  | 'checking'
  | 'login'
  | 'chat'
  | 'register'
  | 'personal-register'
  | 'signup'
  | 'forgot'
  | 'reset'
  | 'invite';

window.addEventListener('error', (e) => {
  window.electronAPI?.logRendererDebug?.(`[App Error]: ${e.message} at ${e.filename}:${e.lineno}:${e.colno}`);
  console.error('[App Error]', e);
});
window.addEventListener('unhandledrejection', (e) => {
  window.electronAPI?.logRendererDebug?.(`[App Unhandled Rejection]: ${e.reason}`);
  console.error('[App Unhandled Rejection]', e);
});

function App() {
  const [screen, setScreen] = useState<Screen>('checking');
  window.electronAPI?.logRendererDebug?.("App rendered with screen: " + screen + " URL: " + window.location.href);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotStep, setForgotStep] = useState<'email' | 'code' | 'password'>('email');
  const [inviteToken, setInviteToken] = useState('');
  const [isCheckingOffline, setIsCheckingOffline] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  const checkUserSession = useCallback(async () => {
    setIsCheckingOffline(false);
    setIsRetrying(true);

    const token = getStoredToken();

    if (!token) {
      setIsRetrying(false);
      setScreen('login');
      return;
    }

    try {
      const result = await getCurrentUser();

      if (!result.ok) {
        if (result.status === 401) {
          clearAuth();
          setScreen('login');
        } else {
          // Non-401 error (network, server offline, etc.)
          setIsCheckingOffline(true);
        }
        return;
      }

      setScreen('chat');
    } catch {
      setIsCheckingOffline(true);
    } finally {
      setIsRetrying(false);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const emailParam = params.get('email') || hashParams.get('email');
    const invite =
      params.get('invite') ||
      params.get('inviteToken') ||
      hashParams.get('invite') ||
      hashParams.get('inviteToken');

    if (emailParam) {
      setForgotEmail(emailParam);
      setForgotStep('code');
      setScreen('forgot');
      return;
    }

    if (params.get('route') === 'notification' || hashParams.get('route') === 'notification' || hashParams.has('route=notification')) {
      setScreen('notification' as any);
      return;
    }

    if (invite) {
      setInviteToken(invite);
      setScreen('invite');
      return;
    }

    void checkUserSession();
  }, [checkUserSession]);

  if (screen === ('notification' as any)) {
    return <NotificationOverlay />;
  }

  if (screen === 'checking') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#0e070b] px-6 text-center text-white select-none">
        <div className="relative mb-6 flex items-center justify-center">
          <div className="absolute h-28 w-28 rounded-full bg-accent/25 blur-2xl animate-pulse" />
          <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-[#1b0c13] p-3 shadow-2xl border border-white/10">
            <AppLogoMark className="h-10 w-10" />
          </div>
        </div>

        <h1 className="mb-1 text-lg font-bold tracking-tight text-white">Flex<span className="text-accent">hubs</span></h1>

        {isCheckingOffline ? (
          <div className="mt-4 flex max-w-sm flex-col items-center gap-4 rounded-2xl bg-white/5 p-5 border border-white/10 backdrop-blur-md">
            <div className="flex items-center gap-2 text-xs font-medium text-amber-400">
              <FiAlertCircle className="h-4 w-4 shrink-0" />
              <span>Unable to connect to Flexhubs servers</span>
            </div>
            <p className="text-xs text-zinc-400">
              Please check your internet connection or try again.
            </p>
            <div className="flex items-center gap-3 w-full pt-1">
              <button
                type="button"
                onClick={() => void checkUserSession()}
                disabled={isRetrying}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent py-2.5 text-xs font-semibold text-white hover:bg-accent-hover transition-all shadow-md shadow-accent/20 disabled:opacity-50"
              >
                <FiRefreshCw className={`h-3.5 w-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
                <span>Retry Connection</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  clearAuth();
                  setScreen('login');
                }}
                className="rounded-xl bg-white/10 px-3.5 py-2.5 text-xs font-medium text-zinc-300 hover:bg-white/20 transition-colors"
              >
                Sign In Again
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-3 flex flex-col items-center gap-2">
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <div className="h-3.5 w-3.5 rounded-full border-2 border-accent border-t-transparent animate-spin" />
              <span>Opening your workspace...</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (screen === 'login') {
    return (
      <LoginPage
        onLoggedIn={() => setScreen('chat')}
        onCreatePersonalAccount={() => setScreen('personal-register')}
        onCreateWorkspace={() => setScreen('register')}
        onForgotPassword={() => setScreen('forgot')}
      />
    );
  }

  if (screen === 'signup') {
    return (
      <RegisterPage
        onBack={() => setScreen('login')}
        onCreatePersonalAccount={() => setScreen('personal-register')}
        onCreateWorkspace={() => setScreen('register')}
      />
    );
  }

  if (screen === 'forgot') {
    return (
      <ForgotPasswordPage
        initialEmail={forgotEmail}
        initialStep={forgotStep}
        onBack={() => setScreen('login')}
        onDone={() => setScreen('login')}
      />
    );
  }

  if (screen === 'reset') {
    return (
      <ForgotPasswordPage
        onBack={() => setScreen('login')}
        onDone={() => setScreen('login')}
      />
    );
  }

  if (screen === 'invite') {
    return (
      <InviteRegisterPage
        inviteToken={inviteToken}
        onBack={() => setScreen('login')}
        onRegistered={() => setScreen('chat')}
      />
    );
  }

  if (screen === 'personal-register') {
    return (
      <PersonalRegisterPage
        onBack={() => setScreen('login')}
        onRegistered={() => setScreen('chat')}
      />
    );
  }

  if (screen === 'register') {
    return (
      <RegisterWorkspacePage 
        onBackToLogin={() => setScreen('login')}
        onWorkspaceCreated={() => setScreen('chat')}
      />
    );
  }

  return (
    <ChatPage
      onSessionExpired={() => {
        void performLogout().finally(() => {
          setScreen('login');
        });
      }}
    />
  );
}

export default App;
