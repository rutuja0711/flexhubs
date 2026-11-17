import {
  CHAT_KEYBOARD_SHORTCUTS,
  isMacPlatform,
  isWindowsPlatform,
  platformDisplayName,
} from './keyboardShortcuts';

const CATEGORY_LABELS: Record<string, string> = {
  navigation: 'Navigation',
  messaging: 'Messaging',
  editing: 'Message editing',
  search: 'Search',
  calls: 'Calls',
  general: 'General',
};

type ShortcutKeyProps = {
  keys: string;
  platformLabel: 'macOS' | 'Windows';
  active: boolean;
};

function ShortcutKeys({ keys, platformLabel, active }: ShortcutKeyProps) {
  return (
    <div
      className={`flex min-w-0 flex-col gap-1 sm:items-end ${
        active ? 'opacity-100' : 'opacity-80'
      }`}
    >
      <span
        className={`hidden text-[10px] font-semibold uppercase tracking-wider sm:block ${
          active ? 'text-accent-soft' : 'text-app-muted'
        }`}
      >
        {platformLabel}
      </span>
      <kbd
        className={`shrink-0 rounded-lg border px-2 py-1 font-mono text-xs ${
          active
            ? 'border-accent-soft/40 bg-accent-soft/10 text-app-text'
            : 'border-app-border bg-app-surface text-app-muted'
        }`}
      >
        {keys}
      </kbd>
    </div>
  );
}

export function KeyboardShortcutsReference() {
  const categories = [...new Set(CHAT_KEYBOARD_SHORTCUTS.map((item) => item.category))];
  const onMac = isMacPlatform();
  const onWindows = isWindowsPlatform();
  const currentPlatform = platformDisplayName();

  return (
    <div className="space-y-6">
      <p className="text-sm text-app-muted">
        On macOS, use <kbd className="rounded border border-app-border bg-app-surface px-1.5 py-0.5 font-mono text-xs">⌘</kbd>{' '}
        (Command). On Windows, use{' '}
        <kbd className="rounded border border-app-border bg-app-surface px-1.5 py-0.5 font-mono text-xs">Ctrl</kbd>. Both
        are listed for every shortcut
        {onMac || onWindows ? (
          <>
            {' '}
            — <span className="text-app-text">{currentPlatform}</span> is highlighted for you.
          </>
        ) : (
          '.'
        )}
      </p>

      {categories.map((category) => (
        <section key={category}>
          <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-app-muted">
            {CATEGORY_LABELS[category] ?? category}
          </h3>
          <ul className="divide-y divide-app-border/60 rounded-xl border border-app-border/60 bg-app-elevated/40">
            {CHAT_KEYBOARD_SHORTCUTS.filter((item) => item.category === category).map((item) => (
              <li
                key={item.id}
                className="flex flex-col gap-3 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="text-app-text">{item.label}</span>
                <div className="flex flex-wrap items-stretch gap-3 sm:gap-4">
                  <ShortcutKeys keys={item.macKeys} platformLabel="macOS" active={onMac} />
                  <ShortcutKeys keys={item.winKeys} platformLabel="Windows" active={onWindows} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}