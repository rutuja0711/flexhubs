import { type ThemeMode } from './theme';

export const ACCENT_STORAGE_KEY = 'flexhubs-accent-color';
export const DEFAULT_ACCENT_COLOR = '#881818';

export const ACCENT_PRESETS = [
  { label: 'Burgundy', value: '#881818' },
  { label: 'Coral', value: '#e85d4c' },
  { label: 'Orange', value: '#e67e22' },
  { label: 'Amber', value: '#d4a017' },
  { label: 'Green', value: '#2f9e6e' },
  { label: 'Teal', value: '#148f85' },
  { label: 'Blue', value: '#3b82f6' },
  { label: 'Indigo', value: '#6366f1' },
  { label: 'Violet', value: '#8b5cf6' },
  { label: 'Magenta', value: '#c026d3' },
] as const;

type RGB = { r: number; g: number; b: number };
type HSL = { h: number; s: number; l: number };
export type HSV = { h: number; s: number; v: number };

export type AccentPalette = {
  accent: string;
  hover: string;
  active: string;
  soft: string;
  focus: string;
  border: string;
  surface: string;
  messageOut: string;
};

const SURFACE_VARS = [
  '--app-bg',
  '--app-bg-login',
  '--app-surface',
  '--app-surface-input',
  '--app-border',
  '--app-border-strong',
  '--app-chat-bg',
  '--app-chat-rail',
  '--app-chat-sidebar',
  '--app-chat-panel',
  '--app-chat-hover',
  '--app-chat-active',
  '--app-elevated',
  '--app-inset',
  '--app-inset-active',
  '--app-avatar-fallback',
  '--app-message-in',
  '--scrollbar-thumb',
  '--scrollbar-thumb-hover',
] as const;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function channelToHex(value: number): string {
  return clamp(Math.round(value), 0, 255).toString(16).padStart(2, '0');
}

function rgbToHex({ r, g, b }: RGB): string {
  return `#${channelToHex(r)}${channelToHex(g)}${channelToHex(b)}`;
}

function rgbToChannels({ r, g, b }: RGB): string {
  return `${Math.round(r)} ${Math.round(g)} ${Math.round(b)}`;
}

export function hexToRgb(hex: string): RGB | null {
  const normalized = normalizeHexColor(hex);
  if (!normalized) {
    return null;
  }

  return {
    r: Number.parseInt(normalized.slice(1, 3), 16),
    g: Number.parseInt(normalized.slice(3, 5), 16),
    b: Number.parseInt(normalized.slice(5, 7), 16),
  };
}

export function normalizeHexColor(value: string): string | null {
  const trimmed = value.trim().replace(/^#/, '');

  if (/^[0-9a-fA-F]{3}$/.test(trimmed)) {
    const [r, g, b] = trimmed;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }

  if (/^[0-9a-fA-F]{6}$/.test(trimmed)) {
    return `#${trimmed.toLowerCase()}`;
  }

  return null;
}

export function isDefaultAccentColor(hex: string): boolean {
  return normalizeHexColor(hex) === DEFAULT_ACCENT_COLOR;
}

function rgbToHsl({ r, g, b }: RGB): HSL {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;
  const delta = max - min;

  if (delta === 0) {
    return { h: 0, s: 0, l: lightness };
  }

  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  let hue = 0;

  if (max === red) {
    hue = ((green - blue) / delta + (green < blue ? 6 : 0)) * 60;
  } else if (max === green) {
    hue = ((blue - red) / delta + 2) * 60;
  } else {
    hue = ((red - green) / delta + 4) * 60;
  }

  return { h: hue, s: saturation, l: lightness };
}

function hslToRgb({ h, s, l }: HSL): RGB {
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const x = chroma * (1 - Math.abs(((h / 60) % 2) - 1));
  const match = l - chroma / 2;
  let red = 0;
  let green = 0;
  let blue = 0;

  if (h < 60) {
    red = chroma;
    green = x;
  } else if (h < 120) {
    red = x;
    green = chroma;
  } else if (h < 180) {
    green = chroma;
    blue = x;
  } else if (h < 240) {
    green = x;
    blue = chroma;
  } else if (h < 300) {
    red = x;
    blue = chroma;
  } else {
    red = chroma;
    blue = x;
  }

  return {
    r: (red + match) * 255,
    g: (green + match) * 255,
    b: (blue + match) * 255,
  };
}

function hslToHex(hsl: HSL): string {
  return rgbToHex(hslToRgb({
    h: ((hsl.h % 360) + 360) % 360,
    s: clamp(hsl.s, 0, 1),
    l: clamp(hsl.l, 0, 1),
  }));
}

export function hexToHsv(hex: string): HSV {
  const rgb = hexToRgb(hex) ?? { r: 136, g: 24, b: 24 };
  const red = rgb.r / 255;
  const green = rgb.g / 255;
  const blue = rgb.b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  let hue = 0;

  if (delta !== 0) {
    if (max === red) {
      hue = ((green - blue) / delta + (green < blue ? 6 : 0)) * 60;
    } else if (max === green) {
      hue = ((blue - red) / delta + 2) * 60;
    } else {
      hue = ((red - green) / delta + 4) * 60;
    }
  }

  return {
    h: hue,
    s: max === 0 ? 0 : delta / max,
    v: max,
  };
}

export function hsvToHex(h: number, s: number, v: number): string {
  const hue = ((h % 360) + 360) % 360;
  const sat = clamp(s, 0, 1);
  const val = clamp(v, 0, 1);
  const chroma = val * sat;
  const x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
  const match = val - chroma;
  let red = 0;
  let green = 0;
  let blue = 0;

  if (hue < 60) {
    red = chroma;
    green = x;
  } else if (hue < 120) {
    red = x;
    green = chroma;
  } else if (hue < 180) {
    green = chroma;
    blue = x;
  } else if (hue < 240) {
    green = x;
    blue = chroma;
  } else if (hue < 300) {
    red = x;
    blue = chroma;
  } else {
    red = chroma;
    blue = x;
  }

  return rgbToHex({
    r: (red + match) * 255,
    g: (green + match) * 255,
    b: (blue + match) * 255,
  });
}

function defaultPalette(mode: ThemeMode): AccentPalette {
  return {
    accent: '#881818',
    hover: '#6f1313',
    active: '#5a0f0f',
    soft: '#c44a4a',
    focus: '#9a1f1f',
    border: '#881818',
    surface: mode === 'dark' ? '#2a1212' : '#f9eded',
    messageOut: mode === 'dark' ? '#6f1313' : '#881818',
  };
}

export function buildAccentPalette(hex: string, mode: ThemeMode): AccentPalette {
  const normalized = normalizeHexColor(hex) ?? DEFAULT_ACCENT_COLOR;

  const rgb = hexToRgb(normalized);
  if (!rgb) {
    return defaultPalette(mode);
  }

  const hsl = rgbToHsl(rgb);
  const usable: HSL = {
    h: hsl.h,
    s: hsl.s,
    l: clamp(hsl.l, 0.32, 0.56),
  };

  const hoverL = clamp(usable.l - 0.07, 0.18, 0.5);
  const activeL = clamp(usable.l - 0.13, 0.14, 0.44);
  const softL = mode === 'dark'
    ? clamp(usable.l + 0.28, 0.64, 0.82)
    : clamp(usable.l + 0.06, 0.4, 0.58);
  const focusL = clamp(usable.l + 0.06, 0.36, 0.62);
  const surfaceL = mode === 'dark'
    ? clamp(usable.l * 0.35, 0.12, 0.22)
    : clamp(0.94 + (1 - usable.s) * 0.03, 0.93, 0.97);
  const messageL = mode === 'dark'
    ? clamp(usable.l - 0.12, 0.22, 0.4)
    : usable.l;

  return {
    accent: hslToHex(usable),
    hover: hslToHex({ ...usable, l: hoverL }),
    active: hslToHex({ ...usable, l: activeL }),
    soft: hslToHex({ ...usable, s: clamp(usable.s * 0.88, 0, 1), l: softL }),
    focus: hslToHex({ ...usable, l: focusL }),
    border: hslToHex({ ...usable, l: mode === 'dark' ? clamp(usable.l - 0.04, 0.28, 0.5) : usable.l }),
    surface: hslToHex({
      h: usable.h,
      s: clamp(usable.s * (mode === 'dark' ? 0.45 : 0.22), 0.04, 0.4),
      l: surfaceL,
    }),
    messageOut: hslToHex({ ...usable, l: messageL }),
  };
}

function themedSurfaces(hex: string, mode: ThemeMode): Record<(typeof SURFACE_VARS)[number], string> {
  const rgb = hexToRgb(hex) ?? { r: 136, g: 24, b: 24 };
  const { h, s } = rgbToHsl(rgb);
  const sat = clamp(s * 0.22, 0.035, 0.16);
  const tone = (lightness: number, saturation = sat) => hslToHex({ h, s: saturation, l: lightness });

  if (mode === 'light') {
    return {
      '--app-bg': tone(0.957, sat * 0.45),
      '--app-bg-login': tone(0.941, sat * 0.5),
      '--app-surface': tone(1, sat * 0.12),
      '--app-surface-input': tone(0.98, sat * 0.35),
      '--app-border': tone(0.902, sat * 0.55),
      '--app-border-strong': tone(0.83, sat * 0.65),
      '--app-chat-bg': tone(0.957, sat * 0.45),
      '--app-chat-rail': tone(1, sat * 0.1),
      '--app-chat-sidebar': tone(1, sat * 0.1),
      '--app-chat-panel': tone(0.98, sat * 0.35),
      '--app-chat-hover': tone(0.957, sat * 0.5),
      '--app-chat-active': tone(0.902, sat * 0.6),
      '--app-elevated': tone(1, sat * 0.08),
      '--app-inset': tone(0.957, sat * 0.45),
      '--app-inset-active': tone(0.902, sat * 0.6),
      '--app-avatar-fallback': tone(0.902, sat * 0.55),
      '--app-message-in': tone(1, sat * 0.1),
      '--scrollbar-thumb': tone(0.78, sat * 0.35),
      '--scrollbar-thumb-hover': tone(0.68, sat * 0.4),
    };
  }

  return {
    '--app-bg': tone(0.051),
    '--app-bg-login': tone(0.039),
    '--app-surface': tone(0.118),
    '--app-surface-input': tone(0.078),
    '--app-border': tone(0.165),
    '--app-border-strong': tone(0.333, sat * 0.7),
    '--app-chat-bg': tone(0.051),
    '--app-chat-rail': tone(0.067),
    '--app-chat-sidebar': tone(0.086),
    '--app-chat-panel': tone(0.102),
    '--app-chat-hover': tone(0.133),
    '--app-chat-active': tone(0.165),
    '--app-elevated': tone(0.173),
    '--app-inset': tone(0.11),
    '--app-inset-active': tone(0.227),
    '--app-avatar-fallback': tone(0.18),
    '--app-message-in': tone(0.165),
    '--scrollbar-thumb': tone(0.227),
    '--scrollbar-thumb-hover': tone(0.31),
  };
}

function clearThemedSurfaces(root: HTMLElement): void {
  for (const name of SURFACE_VARS) {
    root.style.removeProperty(name);
  }
}

export function readStoredAccentColor(): string | null {
  const value = localStorage.getItem(ACCENT_STORAGE_KEY);
  return value ? normalizeHexColor(value) : null;
}

export function storeAccentColor(hex: string): void {
  const normalized = normalizeHexColor(hex) ?? DEFAULT_ACCENT_COLOR;
  localStorage.setItem(ACCENT_STORAGE_KEY, normalized);
}

export function resolveInitialAccentColor(): string {
  // Custom accent picker is disabled for now — always use the brand default.
  return DEFAULT_ACCENT_COLOR;
}

export function applyAccentColor(hex: string, mode: ThemeMode): void {
  const root = document.documentElement;
  const normalized = normalizeHexColor(hex) ?? DEFAULT_ACCENT_COLOR;
  const palette = buildAccentPalette(normalized, mode);
  const accentRgb = hexToRgb(palette.accent);
  const hoverRgb = hexToRgb(palette.hover);
  const activeRgb = hexToRgb(palette.active);
  const softRgb = hexToRgb(palette.soft);

  if (!accentRgb || !hoverRgb || !activeRgb || !softRgb) {
    return;
  }

  root.style.setProperty('--accent-rgb', rgbToChannels(accentRgb));
  root.style.setProperty('--accent-hover-rgb', rgbToChannels(hoverRgb));
  root.style.setProperty('--accent-active-rgb', rgbToChannels(activeRgb));
  root.style.setProperty('--accent-soft-rgb', rgbToChannels(softRgb));
  root.style.setProperty('--app-message-out', palette.messageOut);

  if (normalized === DEFAULT_ACCENT_COLOR) {
    clearThemedSurfaces(root);
    return;
  }

  const surfaces = themedSurfaces(normalized, mode);
  for (const name of SURFACE_VARS) {
    root.style.setProperty(name, surfaces[name]);
  }
}
