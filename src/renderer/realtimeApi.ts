import type { RealtimeConnectionStatus } from '../shared/realtime';
import { getStoredToken } from './authApi';

export async function startRealtime(): Promise<void> {
  const token = getStoredToken();

  if (!token || !window.electronAPI?.startRealtime) {
    return;
  }

  await window.electronAPI.startRealtime(token);
}

export async function stopRealtime(): Promise<void> {
  if (!window.electronAPI?.stopRealtime) {
    return;
  }

  await window.electronAPI.stopRealtime();
}

export function subscribeRealtimeEvent(callback: (event: unknown) => void): () => void {
  if (!window.electronAPI?.onRealtimeEvent) {
    return () => undefined;
  }

  return window.electronAPI.onRealtimeEvent(callback);
}

export function subscribeRealtimeStatus(
  callback: (status: RealtimeConnectionStatus) => void,
): () => void {
  if (!window.electronAPI?.onRealtimeStatus) {
    return () => undefined;
  }

  return window.electronAPI.onRealtimeStatus(callback);
}
