import { FiX } from 'react-icons/fi';

export function SummaryPanel({
  summary,
  loading,
  onClose,
}: {
  summary: string | null;
  loading: boolean;
  onClose: () => void;
}) {
  return (
    <div className="flex h-full w-[360px] shrink-0 flex-col border-l border-app-border bg-app-surface/95 backdrop-blur-md">
      <div className="flex h-[4.25rem] shrink-0 items-center justify-between border-b border-app-border px-6 relative z-10">
        <div>
          <h2 className="text-[17px] font-semibold tracking-tight text-app-text">Summary</h2>
          <p className="text-[13px] text-app-muted mt-0.5">Recent messages</p>
        </div>
        <button
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-app-surface-hover text-app-muted transition-colors hover:bg-app-border hover:text-app-text"
          aria-label="Close"
        >
          <FiX className="h-5 w-5" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-app-border/40 hover:scrollbar-thumb-app-border/60">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          </div>
        ) : summary ? (
          <div className="rounded-2xl bg-[#f5eef1] p-5 text-[14px] leading-relaxed text-app-text shadow-sm dark:bg-[#2a1d23]">
            {summary.split('\n').map((line, i) => (
              <p key={i} className="mb-2 last:mb-0">
                {line.trim()}
              </p>
            ))}
          </div>
        ) : (
          <div className="text-center text-app-muted py-10">
            No summary available.
          </div>
        )}
      </div>
    </div>
  );
}
