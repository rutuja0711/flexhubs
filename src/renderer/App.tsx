import { useEffect, useState } from 'react';
import ChatPage from './ChatPage';
import LoginPage from './LoginPage';
import { getCurrentUser, getStoredToken } from './authApi';

type Screen = 'checking' | 'login' | 'chat';

function App() {
  const [screen, setScreen] = useState<Screen>('checking');

  useEffect(() => {
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

      if (!result.ok) {
        setScreen('login');
        return;
      }

      setScreen('chat');
    });

    return () => {
      cancelled = true;
    };
  }, []);

  if (screen === 'checking') {
    return (
      <div className="flex min-h-full items-center justify-center bg-app-bg text-app-muted">
        Opening your workspace...
      </div>
    );
  }

  if (screen === 'login') {
    return <LoginPage onLoggedIn={() => setScreen('chat')} />;
  }

  return (
    <ChatPage onSessionExpired={() => setScreen('login')} />
  );
}

export default App;
