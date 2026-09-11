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
        className={`pointer-events-none absolute top-1/2 flex -translate-y-1/2 items-center justify-center text-app-muted ${
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
        className={`w-full text-sm text-app-text outline-none transition-all duration-200 placeholder:text-app-placeholder ${
          isInline
            ? `rounded-[12px] border bg-app-surface-input py-3 pr-28 pl-12 ${
                error ? 'border-accent' : 'border-accent/80 focus:border-accent'
              }`
            : isModal
              ? `rounded-[10px] border bg-app-surface-input py-3 pr-3 pl-10 ${
                  error ? 'border-accent' : 'border-accent focus:border-accent'
                }`
              : `rounded-[10px] border bg-app-surface-input py-2.5 pr-3 pl-10 ${
                  error ? 'border-accent' : 'border-app-border focus:border-accent/70'
                } focus:ring-1 focus:ring-accent/30`
        }`}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
