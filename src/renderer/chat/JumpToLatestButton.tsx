import { FiChevronDown } from 'react-icons/fi';

type JumpToLatestButtonProps = {
  newMessageCount: number;
  onClick: () => void;
};

function buttonLabel(count: number): string {
  if (count <= 0) {
    return 'Jump to latest';
  }

  if (count === 1) {
    return '1 new message';
  }

  return `${count} new messages`;
}

export function JumpToLatestButton({ newMessageCount, onClick }: JumpToLatestButtonProps) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-3 z-20 flex justify-center px-4">
      <button
        type="button"
        onClick={onClick}
        className="pointer-events-auto inline-flex max-w-[min(100%,300px)] items-center gap-2 rounded-full border border-accent/35 bg-[#140a0d] px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-black/40 transition hover:border-accent/55 hover:bg-[#1c1015] active:scale-[0.98] dark:bg-[#0f0a0c]"
        aria-live="polite"
      >
        <FiChevronDown className="shrink-0 text-base text-accent-soft" aria-hidden />
        <span className="truncate">{buttonLabel(newMessageCount)}</span>
      </button>
    </div>
  );
}
