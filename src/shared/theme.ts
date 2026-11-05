export type ThemeMode = 'dark' | 'light';

export const THEME_STORAGE_KEY = 'flexhubs-theme';

export function readStoredTheme(): ThemeMode | null {
  const value = localStorage.getItem(THEME_STORAGE_KEY);

  if (value === 'dark' || value === 'light') {
    return value;
  }

  return null;
}

export function storeTheme(mode: ThemeMode): void {
  localStorage.setItem(THEME_STORAGE_KEY, mode);
}

export function resolveInitialTheme(): ThemeMode {
  const stored = readStoredTheme();

  if (stored) {
    return stored;
  }

  if (window.matchMedia('(prefers-color-scheme: light)').matches) {
    return 'light';
  }

  return 'dark';
}

export function applyTheme(mode: ThemeMode): void {
  const root = document.documentElement;
  root.classList.add('theme-switching');
  root.classList.remove('dark', 'light');
  root.classList.add(mode);
  root.style.colorScheme = mode;
  requestAnimationFrame(() => {
    root.classList.remove('theme-switching');
  });
}
