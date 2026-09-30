import { SearchIcon } from './ChatIcons';

type SearchFieldProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  error?: string;
  id?: string;
  variant?: 'sidebar' | 'inline' | 'modal';
};

export function SearchField({
  value,
  onChange,
  placeholder,
  error = '',
  id,
  variant = 'sidebar',
}: SearchFieldProps) {
  const isInline = variant === 'inline';
  const isModal = variant === 'modal';

  return (
    <div className={isInline ? 'min-w-0 flex-1' : 'relative min-w-0 flex-1'}>
      <span
        className={`pointer-events-none absolute top-1/2 flex -translate-y-1/2 items-center justify-center text-app-muted transition-colors ${
          isInline ? 'left-4 h-5 w-5' : isModal ? 'left-3.5' : 'left-3.5 h-4 w-4'
        }`}
      >
        <SearchIcon className={isInline ? 'h-[18px] w-[18px] shrink-0' : 'h-4 w-4 shrink-0'} />
      </span>
      <input
        id={id}
        type="text"
        value={value}
        placeholder={placeholder}
        aria-invalid={Boolean(error)}
        className={`w-full text-sm text-app-text outline-none transition-all duration-200 placeholder:text-app-placeholder/70 ${
          isInline
            ? `rounded-2xl border bg-app-surface-input/90 backdrop-blur-sm py-3 pr-28 pl-12 shadow-sm ${
                error
                  ? 'border-accent ring-2 ring-accent'
                  : 'border-app-border focus:border-accent/80 focus:ring-2 focus:ring-accent/20 focus:bg-app-surface-input'
              }`
            : isModal
              ? `rounded-xl border bg-app-inset py-2.5 pr-3.5 pl-10 ${
                  error
                    ? 'border-accent ring-2 ring-accent'
                    : 'border-app-border focus:border-accent focus:ring-2 focus:ring-accent/20 focus:bg-app-surface'
                }`
              : `rounded-xl border bg-app-surface-input/80 h-9 pr-3 pl-9 text-xs shadow-inner shadow-black/5 ${
                  error
                    ? 'border-accent ring-2 ring-accent'
                    : 'border-app-border focus:border-accent/70 focus:ring-1 focus:ring-accent/20 focus:bg-app-surface-input'
                }`
        }`}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
