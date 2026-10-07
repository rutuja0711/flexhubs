import type { CallPanelLayout } from './call/CallFloatingPanel';

export type CallWindowPresentationMode = CallPanelLayout | 'ringing' | 'idle';

export function setCallWindowPresentation(
  active: boolean,
  mode: CallWindowPresentationMode = 'floating',
): void {
  void window.electronAPI?.setCallAlwaysOnTop?.(active, mode);
}

export function setCallWindowAlwaysOnTop(enabled: boolean): void {
  setCallWindowPresentation(enabled, enabled ? 'floating' : 'idle');
}

export function focusCallWindow(): void {
  void window.electronAPI?.focusCallWindow?.();
}

export function ensureMainWindowVisible(): void {
  void window.electronAPI?.ensureMainWindowVisible?.();
}

export function moveCallWindowBy(deltaX: number, deltaY: number): void {
  void window.electronAPI?.moveCallWindowBy?.(deltaX, deltaY);
}

export function subscribeCallWindowPresentation(
  listener: (mode: CallWindowPresentationMode) => void,
): () => void {
  return window.electronAPI?.onCallWindowPresentationChanged?.((mode: string) => listener(mode as CallWindowPresentationMode)) ?? (() => {});
}
