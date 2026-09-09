import { useEffect, useState } from 'react';
import ChatPage from './ChatPage';
import LoginPage from './LoginPage';
import { clearAuth, getCurrentUser, getStoredToken, performLogout } from './authApi';

import RegisterWorkspacePage from './RegisterWorkspacePage';
import PersonalRegisterPage from './PersonalRegisterPage';
import {
  ForgotPasswordPage,
  InviteRegisterPage,
  RegisterPage,
} from './AuthFlowPages';

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

function App() {
  const [screen, setScreen] = useState<Screen>('checking');
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotStep, setForgotStep] = useState<'email' | 'code' | 'password'>('email');
  const [inviteToken, setInviteToken] = useState('');

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

    if (invite) {
      setInviteToken(invite);
      setScreen('invite');
      return;
    }

    const token = getStoredToken();

    if (!token) {
      setScreen('login');
      return;
    }

    let cancelled = false;

    getCurrentUser().then((result) => {
      if (cancelled) {
        return;
      }

      if (!result.ok && result.status === 401) {
        clearAuth();
        setScreen('login');
        return;
      }

      setScreen('chat');
    });

    const timeout = window.setTimeout(() => {
      if (cancelled) {
        return;
      }

      setScreen('chat');
    }, 20000);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, []);

  if (screen === 'checking') {
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-3 bg-app-bg px-6 text-center text-app-muted">
        <p className="text-sm">Opening your workspace...</p>
        <p className="max-w-sm text-xs text-app-muted/80">
          First launch can take a moment. If this stays here, check your internet connection and sign in again.
        </p>
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
