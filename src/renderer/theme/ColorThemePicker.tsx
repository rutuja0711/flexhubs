import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { FiRotateCcw } from 'react-icons/fi';
import {
  ACCENT_PRESETS,
  DEFAULT_ACCENT_COLOR,
  buildAccentPalette,
  hexToHsv,
  hsvToHex,
  isDefaultAccentColor,
  normalizeHexColor,
} from '../../shared/colorTheme';
import { useTheme } from './ThemeProvider';

function pointerFraction(
  event: PointerEvent | ReactPointerEvent,
  element: HTMLElement,
  axis: 'x' | 'y' | 'both',
): { x: number; y: number } {
  const rect = element.getBoundingClientRect();
  const x = rect.width <= 0 ? 0 : Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
  const y = rect.height <= 0 ? 0 : Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));

  if (axis === 'x') {
    return { x, y: 0 };
  }

  if (axis === 'y') {
    return { x: 0, y };
  }

  return { x, y };
}

export function ColorThemePicker() {
  const { theme, accentColor, setAccentColor } = useTheme();
  const palette = buildAccentPalette(accentColor, theme);
  const [hexDraft, setHexDraft] = useState(accentColor);
  const [hue, setHue] = useState(() => hexToHsv(accentColor).h);
  const [saturation, setSaturation] = useState(() => hexToHsv(accentColor).s);
  const [value, setValue] = useState(() => hexToHsv(accentColor).v);
  const squareRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef<'square' | 'hue' | null>(null);
  const hsvRef = useRef({ hue, saturation, value });

  hsvRef.current = { hue, saturation, value };

  useEffect(() => {
    const next = hexToHsv(accentColor);
    if (next.s > 0.01) {
      setHue(next.h);
    }
    setSaturation(next.s);
    setValue(next.v);
    setHexDraft(accentColor);
  }, [accentColor]);

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      if (draggingRef.current === 'square' && squareRef.current) {
        const { x, y } = pointerFraction(event, squareRef.current, 'both');
        const nextSat = x;
        const nextVal = 1 - y;
        setSaturation(nextSat);
        setValue(nextVal);
        setAccentColor(hsvToHex(hsvRef.current.hue, nextSat, nextVal));
      }

      if (draggingRef.current === 'hue' && hueRef.current) {
        const { x } = pointerFraction(event, hueRef.current, 'x');
        const nextHue = x * 360;
        setHue(nextHue);
        setAccentColor(hsvToHex(nextHue, hsvRef.current.saturation, hsvRef.current.value));
      }
    };

    const onUp = () => {
      draggingRef.current = null;
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);

    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [setAccentColor]);

  const commitHex = (raw: string) => {
    const normalized = normalizeHexColor(raw);
    if (!normalized) {
      setHexDraft(accentColor);
      return;
    }

    setAccentColor(normalized);
    setHexDraft(normalized);
  };

  const hueColor = hsvToHex(hue, 1, 1);

  return (
    <div className="rounded-xl border border-app-border bg-app-surface p-4">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-app-text">Color theme</p>
          <p className="mt-1 text-xs text-app-muted">
            Pick any color. Flexhubs generates lighter and darker shades for buttons, hovers, focus rings, borders, and backgrounds.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAccentColor(DEFAULT_ACCENT_COLOR)}
          disabled={isDefaultAccentColor(accentColor)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-app-border px-2.5 py-1.5 text-xs font-semibold text-app-text transition-colors hover:bg-app-chat-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          <FiRotateCcw />
          Reset
        </button>
      </div>

      <div
        ref={squareRef}
        role="slider"
        tabIndex={0}
        aria-label="Color saturation and brightness"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(saturation * 100)}
        className="relative mb-3 h-44 w-full cursor-crosshair touch-none"
        onPointerDown={(event) => {
          event.preventDefault();
          draggingRef.current = 'square';
          event.currentTarget.setPointerCapture(event.pointerId);
          const { x, y } = pointerFraction(event, event.currentTarget, 'both');
          const nextSat = x;
          const nextVal = 1 - y;
          setSaturation(nextSat);
          setValue(nextVal);
          setAccentColor(hsvToHex(hue, nextSat, nextVal));
        }}
        onKeyDown={(event) => {
          let nextSat = saturation;
          let nextVal = value;
          if (event.key === 'ArrowLeft') nextSat = Math.max(0, saturation - 0.02);
          else if (event.key === 'ArrowRight') nextSat = Math.min(1, saturation + 0.02);
          else if (event.key === 'ArrowDown') nextVal = Math.max(0, value - 0.02);
          else if (event.key === 'ArrowUp') nextVal = Math.min(1, value + 0.02);
          else return;
          event.preventDefault();
          setSaturation(nextSat);
          setValue(nextVal);
          setAccentColor(hsvToHex(hue, nextSat, nextVal));
        }}
      >
        <div
          className="pointer-events-none absolute inset-0 rounded-xl border border-app-border"
          style={{
            background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hueColor})`,
          }}
        />
        <span
          className="pointer-events-none absolute z-10 h-4 w-4 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.35)]"
          style={{
            left: `${saturation * 100}%`,
            top: `${(1 - value) * 100}%`,
            backgroundColor: accentColor,
            transform: 'translate(-50%, -50%)',
          }}
        />
      </div>

      <div
        ref={hueRef}
        role="slider"
        tabIndex={0}
        aria-label="Hue"
        aria-valuemin={0}
        aria-valuemax={360}
        aria-valuenow={Math.round(hue)}
        className="relative mb-4 h-3.5 w-full cursor-pointer touch-none rounded-full border border-app-border"
        style={{
          background:
            'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)',
        }}
        onPointerDown={(event) => {
          event.preventDefault();
          draggingRef.current = 'hue';
          event.currentTarget.setPointerCapture(event.pointerId);
          const { x } = pointerFraction(event, event.currentTarget, 'x');
          const nextHue = x * 360;
          setHue(nextHue);
          setAccentColor(hsvToHex(nextHue, saturation, value));
        }}
        onKeyDown={(event) => {
          let nextHue = hue;
          if (event.key === 'ArrowLeft') nextHue = (hue - 3 + 360) % 360;
          else if (event.key === 'ArrowRight') nextHue = (hue + 3) % 360;
          else return;
          event.preventDefault();
          setHue(nextHue);
          setAccentColor(hsvToHex(nextHue, saturation, value));
        }}
      >
        <span
          className="pointer-events-none absolute top-1/2 h-4 w-4 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.35)]"
          style={{
            left: `${(hue / 360) * 100}%`,
            backgroundColor: hueColor,
            transform: 'translate(-50%, -50%)',
          }}
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span
          className="h-10 w-10 shrink-0 rounded-xl border border-app-border shadow-inner"
          style={{ backgroundColor: palette.accent }}
          aria-hidden="true"
        />
        <label className="min-w-0 flex-1">
          <span className="mb-1 block text-[10px] font-bold tracking-wider text-app-muted uppercase">Hex</span>
          <input
            type="text"
            value={hexDraft}
            spellCheck={false}
            onChange={(event) => setHexDraft(event.target.value)}
            onBlur={() => commitHex(hexDraft)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                commitHex(hexDraft);
              }
            }}
            className="w-full rounded-lg border border-app-border bg-app-surface-input px-3 py-2 font-mono text-sm text-app-text outline-none focus:border-accent"
          />
        </label>
      </div>

      <p className="mb-2 text-[10px] font-bold tracking-wider text-app-muted uppercase">Generated shades</p>
      <div className="mb-4 grid grid-cols-5 gap-2">
        {[
          { label: 'Base', color: palette.accent },
          { label: 'Hover', color: palette.hover },
          { label: 'Active', color: palette.active },
          { label: 'Soft', color: palette.soft },
          { label: 'Surface', color: palette.surface },
        ].map((shade) => (
          <div key={shade.label} className="min-w-0 text-center">
            <div
              className="mb-1.5 h-8 rounded-lg border border-app-border"
              style={{ backgroundColor: shade.color }}
            />
            <p className="truncate text-[10px] font-semibold text-app-muted">{shade.label}</p>
          </div>
        ))}
      </div>

      <p className="mb-2 text-[10px] font-bold tracking-wider text-app-muted uppercase">Presets</p>
      <div className="flex flex-wrap gap-2">
        {ACCENT_PRESETS.map((preset) => {
          const selected = accentColor === preset.value;
          return (
            <button
              key={preset.value}
              type="button"
              title={preset.label}
              aria-label={`${preset.label} theme`}
              aria-pressed={selected}
              onClick={() => setAccentColor(preset.value)}
              className={`h-7 w-7 rounded-full border-2 transition-transform ${
                selected ? 'border-app-text scale-110' : 'border-white/20 hover:scale-105'
              }`}
              style={{ backgroundColor: preset.value }}
            />
          );
        })}
      </div>
    </div>
  );
}
