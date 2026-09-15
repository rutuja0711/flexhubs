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
            className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-md animate-fade-in"
            onClick={() => close(false)}
          />
          <div className="fixed inset-0 z-[201] flex items-center justify-center pointer-events-none p-4">
            <div
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="confirm-dialog-title"
              aria-describedby="confirm-dialog-message"
              className="pointer-events-auto relative w-full max-w-[440px] overflow-hidden rounded-3xl border border-app-border/80 bg-app-surface/95 backdrop-blur-2xl p-6 shadow-2xl animate-pop-in origin-center"
            >
              {/* Top ambient highlight */}
              <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />

              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
                      isDanger ? 'bg-accent/15 text-accent-soft shadow-xs' : 'bg-app-inset text-app-text'
                    }`}
                  >
                    <FiAlertTriangle className="text-xl" aria-hidden="true" />
                  </div>
                  <h2 id="confirm-dialog-title" className="min-w-0 text-base font-semibold text-app-text tracking-tight">
                    {request.title}
                  </h2>
                </div>
                <button
                  type="button"
                  aria-label="Close"
                  className="flex h-8 w-8 items-center justify-center rounded-xl text-app-muted transition-colors hover:bg-app-inset hover:text-app-text"
                  onClick={() => close(false)}
                >
                  <FiX className="text-base" />
                </button>
              </div>

              <p id="confirm-dialog-message" className="mb-6 text-xs leading-relaxed text-app-muted">
                {request.message}
              </p>

              <div className="flex justify-end gap-2.5">
                <button
                  type="button"
                  className="rounded-xl border border-app-border/80 bg-app-card px-4 py-2 text-xs font-semibold text-app-text transition-colors hover:bg-app-inset"
                  onClick={() => close(false)}
                >
                  {cancelLabel}
                </button>
                <button
                  type="button"
                  autoFocus
                  className={`rounded-xl px-4 py-2 text-xs font-semibold transition-all duration-150 active:scale-95 shadow-md ${
                    isDanger
                      ? 'bg-gradient-to-r from-accent to-[#632a38] text-white shadow-accent/20 hover:brightness-110'
                      : 'bg-app-card text-app-text border border-app-border'
                  }`}
                  onClick={() => close(true)}
                >
                  {confirmLabel}
                </button>
              </div>
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
