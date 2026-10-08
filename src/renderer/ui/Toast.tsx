import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { FiAlertCircle, FiCheckCircle, FiInfo, FiX } from 'react-icons/fi';

type ToastTone = 'success' | 'error' | 'info';

type ToastAction = {
  label: string;
  onClick: () => void;
};

type ToastItem = {
  id: string;
  message: string;
  tone: ToastTone;
  action?: ToastAction;
};

type ToastOptions = {
  action?: ToastAction;
};

type ToastApi = {
  success: (message: string, options?: ToastOptions) => void;
  error: (message: string, options?: ToastOptions) => void;
  info: (message: string, options?: ToastOptions) => void;
  dismiss: (id: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

function toneStyles(tone: ToastTone): { container: string; icon: ReactNode } {
  if (tone === 'success') {
    return {
      container: 'border-[#3ecf8e]/30 bg-app-surface/95 backdrop-blur-xl shadow-lg shadow-[#3ecf8e]/5',
      icon: <FiCheckCircle className="shrink-0 text-base text-[#3ecf8e] mt-0.5" aria-hidden="true" />,
    };
  }

  if (tone === 'error') {
    return {
      container: 'border-accent-soft/40 bg-app-surface/95 backdrop-blur-xl shadow-lg shadow-accent/10',
      icon: <FiAlertCircle className="shrink-0 text-base text-accent-soft mt-0.5" aria-hidden="true" />,
    };
  }

  return {
    container: 'border-app-border/80 bg-app-surface/95 backdrop-blur-xl shadow-lg',
    icon: <FiInfo className="shrink-0 text-base text-app-muted mt-0.5" aria-hidden="true" />,
  };
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (message: string, tone: ToastTone, options?: ToastOptions) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      setToasts([{ id, message, tone, action: options?.action }]);

      const timeout = options?.action ? 5000 : 3500;
      window.setTimeout(() => {
        dismiss(id);
      }, timeout);

      return id;
    },
    [dismiss],
  );

  const toast = useMemo<ToastApi>(
    () => ({
      success: (message, options) => { push(message, 'success', options); },
      error: (message, options) => { push(message, 'error', options); },
      info: (message, options) => { push(message, 'info', options); },
      dismiss,
    }),
    [push, dismiss],
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
              className={`pointer-events-auto flex items-start gap-3 rounded-2xl border px-4 py-3 shadow-xl animate-pop-in ${styles.container}`}
            >
              {styles.icon}
              <div className="min-w-0 flex-1 flex flex-col items-start">
                <p className="text-xs font-medium text-app-text leading-relaxed">{item.message}</p>
                {item.action && (
                  <button
                    type="button"
                    className="mt-2 rounded bg-app-inset px-2.5 py-1 text-[11px] font-semibold text-app-text hover:bg-app-hover transition-colors"
                    onClick={() => {
                      item.action?.onClick();
                      dismiss(item.id);
                    }}
                  >
                    {item.action.label}
                  </button>
                )}
              </div>
              <button
                type="button"
                aria-label="Dismiss notification"
                className="shrink-0 flex h-6 w-6 items-center justify-center rounded-lg text-app-muted transition-colors hover:bg-app-inset hover:text-app-text"
                onClick={() => dismiss(item.id)}
              >
                <FiX className="text-xs" />
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
