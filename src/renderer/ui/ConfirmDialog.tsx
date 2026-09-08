import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { FiAlertTriangle, FiX } from 'react-icons/fi';

export type ConfirmOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'default';
};

type ConfirmRequest = ConfirmOptions & {
  resolve: (confirmed: boolean) => void;
};

type ConfirmApi = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmApi | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);

  const confirm = useCallback<ConfirmApi>((options) => {
    return new Promise<boolean>((resolve) => {
      setRequest({ ...options, resolve });
    });
  }, []);

  const close = useCallback(
    (confirmed: boolean) => {
      request?.resolve(confirmed);
      setRequest(null);
    },
    [request],
  );

  useEffect(() => {
    if (!request) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        close(false);
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [close, request]);

  const confirmLabel = request?.confirmLabel ?? 'Confirm';
  const cancelLabel = request?.cancelLabel ?? 'Cancel';
  const isDanger = request?.tone !== 'default';

  const api = useMemo(() => confirm, [confirm]);

  return (
    <ConfirmContext.Provider value={api}>
      {children}
      {request ? (
        <>
          <button
            type="button"
            aria-label="Close confirmation dialog"
            className="fixed inset-0 z-[200] bg-black/55 backdrop-blur-sm"
            onClick={() => close(false)}
          />
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            aria-describedby="confirm-dialog-message"
            className="fixed top-1/2 left-1/2 z-[201] w-full max-w-[440px] -translate-x-1/2 -translate-y-1/2 rounded-[20px] border border-app-border bg-app-elevated p-6 shadow-app"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                    isDanger ? 'bg-accent/15 text-accent-soft' : 'bg-app-chat-hover text-app-text'
                  }`}
                >
                  <FiAlertTriangle className="text-xl" aria-hidden="true" />
                </div>
                <h2 id="confirm-dialog-title" className="min-w-0 text-lg leading-none font-semibold text-app-text">
                  {request.title}
                </h2>
              </div>
              <button
                type="button"
                aria-label="Close"
                className="rounded-lg p-1.5 text-app-muted transition-colors hover:bg-app-chat-hover hover:text-app-text"
                onClick={() => close(false)}
              >
                <FiX className="text-lg" />
              </button>
            </div>

            <p id="confirm-dialog-message" className="mb-6 text-sm leading-relaxed text-app-muted">
              {request.message}
            </p>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                className="rounded-xl border border-app-border bg-app-inset px-4 py-2.5 text-sm font-medium text-app-text transition-colors hover:bg-app-inset-active"
                onClick={() => close(false)}
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                autoFocus
                className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90 ${
                  isDanger ? 'bg-accent text-white' : 'bg-app-inset-active text-app-text'
                }`}
                onClick={() => close(true)}
              >
                {confirmLabel}
              </button>
            </div>
          </div>
        </>
      ) : null}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmApi {
  const context = useContext(ConfirmContext);

  if (!context) {
    throw new Error('useConfirm must be used within ConfirmProvider');
  }

  return context;
}
