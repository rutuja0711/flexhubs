import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { FiAlertCircle, FiCheckCircle, FiInfo, FiX } from 'react-icons/fi';

type ToastTone = 'success' | 'error' | 'info';

type ToastItem = {
  id: string;
  message: string;
  tone: ToastTone;
};

type ToastApi = {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

function toneStyles(tone: ToastTone): { container: string; icon: ReactNode } {
  if (tone === 'success') {
    return {
      container: 'border-[#3ecf8e]/30 bg-app-elevated',
      icon: <FiCheckCircle className="shrink-0 text-lg text-[#3ecf8e]" aria-hidden="true" />,
    };
  }

  if (tone === 'error') {
    return {
      container: 'border-accent-soft/40 bg-app-elevated',
      icon: <FiAlertCircle className="shrink-0 text-lg text-accent-soft" aria-hidden="true" />,
    };
  }

  return {
    container: 'border-app-border bg-app-elevated',
    icon: <FiInfo className="shrink-0 text-lg text-app-muted" aria-hidden="true" />,
  };
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (message: string, tone: ToastTone) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      setToasts((current) => [{ id, message, tone }, ...current]);

      window.setTimeout(() => {
        dismiss(id);
      }, 3500);
    },
    [dismiss],
  );

  const toast = useMemo<ToastApi>(
    () => ({
      success: (message) => push(message, 'success'),
      error: (message) => push(message, 'error'),
      info: (message) => push(message, 'info'),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div
        className="pointer-events-none fixed top-6 right-6 z-[120] flex w-full max-w-sm flex-col gap-2"
        aria-live="polite"
        aria-relevant="additions"
      >
        {toasts.map((item) => {
          const styles = toneStyles(item.tone);

          return (
            <div
              key={item.id}
              role="status"
              className={`pointer-events-auto flex items-start gap-3 rounded-2xl border px-4 py-3 shadow-app ${styles.container}`}
            >
              {styles.icon}
              <p className="min-w-0 flex-1 text-sm text-app-text">{item.message}</p>
              <button
                type="button"
                aria-label="Dismiss notification"
                className="shrink-0 rounded-lg p-1 text-app-muted transition-colors hover:bg-app-chat-hover hover:text-app-text"
                onClick={() => dismiss(item.id)}
              >
                <FiX />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }

  return context;
}
