import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ACCENT_STORAGE_KEY,
  applyAccentColor,
  normalizeHexColor,
  readStoredAccentColor,
  resolveInitialAccentColor,
  storeAccentColor,
} from '../../shared/colorTheme';
import {
  THEME_STORAGE_KEY,
  applyTheme,
  readStoredTheme,
  resolveInitialTheme,
  storeTheme,
  type ThemeMode,
} from '../../shared/theme';

type ThemeContextValue = {
  theme: ThemeMode;
  accentColor: string;
  setTheme: (mode: ThemeMode) => void;
  setAccentColor: (hex: string) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(() => resolveInitialTheme());
  const [accentColor, setAccentColorState] = useState(() => resolveInitialAccentColor());

  useEffect(() => {
    applyTheme(theme);
    storeTheme(theme);
    applyAccentColor(accentColor, theme);
    storeAccentColor(accentColor);
  }, [accentColor, theme]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY) {
        const stored = readStoredTheme();
        if (stored) {
          setThemeState(stored);
        }
        return;
      }

      if (event.key === ACCENT_STORAGE_KEY) {
        const stored = readStoredAccentColor();
        if (stored) {
          setAccentColorState(stored);
        }
      }
    };

    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setAccentColor = useCallback((hex: string) => {
    const normalized = normalizeHexColor(hex);
    if (normalized) {
      setAccentColorState(normalized);
    }
  }, []);

  const value = useMemo(
    () => ({
      theme,
      accentColor,
      setTheme: (mode: ThemeMode) => setThemeState(mode),
      setAccentColor,
      toggleTheme: () => setThemeState((current) => (current === 'dark' ? 'light' : 'dark')),
    }),
    [accentColor, setAccentColor, theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }

  return context;
}

export function ThemeToggleButton({ className = '' }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      className={`rounded-[10px] border border-app-border bg-app-surface px-3 py-2 text-sm font-medium text-app-text transition-colors hover:border-app-border-strong ${className}`}
      onClick={toggleTheme}
    >
      {theme === 'dark' ? 'Light mode' : 'Dark mode'}
    </button>
  );
}
