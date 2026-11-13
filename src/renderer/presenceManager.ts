import type { ApiResult } from '../shared/api';
import type { UserPresenceStatus } from '../shared/profile';
import { saveUserStatus } from './chatApi';

const BACKGROUND_AWAY_MS = 60_000;

type Listener = () => void;
type PublishedPresenceMode = 'visible' | 'hidden' | null;

let manualStatus: UserPresenceStatus = 'ONLINE';
let statusMessage = '';
let autoAway = false;
let sharePresenceWithOthers = true;
let started = false;
let backgroundTimer: number | undefined;
let pendingStatusRequest: Promise<void> | null = null;
let lastPublishedMode: PublishedPresenceMode = null;
const listeners = new Set<Listener>();

function notify(): void {
  listeners.forEach((listener) => listener());
}

function pushHeartbeatStatus(status: UserPresenceStatus): void {
  window.electronAPI?.setRealtimeHeartbeatStatus?.(status);
}

export function subscribePresenceManager(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Local status for your own UI (nav dot, profile). */
export function getEffectivePresenceStatus(): UserPresenceStatus {
  if (autoAway && manualStatus === 'ONLINE') {
    return 'AWAY';
  }

  return manualStatus;
}

/** What we publish to the API / Redis (OFFLINE when presence sharing is disabled). */
export function getPublishedPresenceStatus(): UserPresenceStatus {
  if (!sharePresenceWithOthers) {
    return 'OFFLINE';
  }

  return getEffectivePresenceStatus();
}

export function isPresenceManagerStarted(): boolean {
  return started;
}

/** When false, peers must see us as offline (mirrors web `sharePresence` / SocketProvider). */
export function setPresenceSharingEnabled(enabled: boolean): void {
  const wasEnabled = sharePresenceWithOthers;
  sharePresenceWithOthers = enabled;

  if (!enabled) {
    autoAway = false;
    clearBackgroundTimer();
    if (wasEnabled) {
      lastPublishedMode = null;
    }
  } else if (!wasEnabled) {
    lastPublishedMode = null;
  }

  pushHeartbeatStatus(enabled ? getPublishedPresenceStatus() : 'OFFLINE');
  notify();

  if (started && enabled) {
    void syncPresenceToServer();
  }
}

export function isPresenceSharingEnabled(): boolean {
  return sharePresenceWithOthers;
}

/** Server/redis may still say OFFLINE while this device is actively sharing presence. */
export function shouldKeepLocalPresenceOverRemote(remote: UserPresenceStatus): boolean {
  return (
    sharePresenceWithOthers &&
    remote === 'OFFLINE' &&
    manualStatus !== 'OFFLINE' &&
    started
  );
}

function resolvePublishedPresenceStatus(): UserPresenceStatus {
  return getPublishedPresenceStatus();
}

export function setManualPresenceStatus(status: UserPresenceStatus, message?: string): void {
  manualStatus = status;

  if (message !== undefined) {
    statusMessage = message;
  }

  if (status !== 'ONLINE') {
    autoAway = false;
  }

  clearBackgroundTimer();
  notify();
}

export function applyRemotePresenceBootstrap(
  initialStatus: UserPresenceStatus,
  initialMessage = '',
): void {
  manualStatus = initialStatus;
  statusMessage = initialMessage;
  autoAway = false;
  notify();

  if (sharePresenceWithOthers) {
    lastPublishedMode = null;
    void syncPresenceToServer();
  }
}

export function setPresenceStatusMessage(message: string): void {
  statusMessage = message;
}

export function getPresenceStatusMessage(): string {
  return statusMessage;
}

function clearBackgroundTimer(): void {
  if (backgroundTimer !== undefined) {
    window.clearTimeout(backgroundTimer);
    backgroundTimer = undefined;
  }
}

function isAppInBackground(): boolean {
  return document.hidden;
}

function scheduleBackgroundAway(): void {
  clearBackgroundTimer();

  if (!sharePresenceWithOthers || !started || manualStatus !== 'ONLINE' || !isAppInBackground()) {
    return;
  }

  backgroundTimer = window.setTimeout(() => {
    if (isAppInBackground()) {
      void applyAutoAway();
    }
  }, BACKGROUND_AWAY_MS);
}

async function publishHiddenPresenceToServer(): Promise<ApiResult<{ ok: true }>> {
  pushHeartbeatStatus('OFFLINE');

  if (lastPublishedMode === 'hidden') {
    return { ok: true, data: { ok: true } };
  }

  const request = saveUserStatus('OFFLINE', statusMessage);
  pendingStatusRequest = request.then(() => undefined);

  try {
    const result = await request;
    if (result.ok) {
      lastPublishedMode = 'hidden';
    }
    return result;
  } finally {
    pendingStatusRequest = null;
  }
}

async function patchPresenceStatus(_status: UserPresenceStatus): Promise<ApiResult<{ ok: true }>> {
  if (pendingStatusRequest) {
    await pendingStatusRequest;
  }

  if (!sharePresenceWithOthers) {
    return publishHiddenPresenceToServer();
  }

  const publishedStatus = resolvePublishedPresenceStatus();
  pushHeartbeatStatus(publishedStatus);

  const request = saveUserStatus(publishedStatus, statusMessage);
  pendingStatusRequest = request.then(() => undefined);

  try {
    const result = await request;
    if (result.ok) {
      lastPublishedMode = 'visible';
    }
    return result;
  } finally {
    pendingStatusRequest = null;
  }
}

async function applyAutoAway(): Promise<void> {
  if (!sharePresenceWithOthers || !started || manualStatus !== 'ONLINE' || autoAway) {
    return;
  }

  autoAway = true;
  notify();
  await patchPresenceStatus('AWAY');
}

async function restoreFromAutoAway(): Promise<void> {
  if (!sharePresenceWithOthers || !autoAway || manualStatus !== 'ONLINE') {
    return;
  }

  autoAway = false;
  notify();
  await patchPresenceStatus('ONLINE');
}

function handleForeground(): void {
  if (!sharePresenceWithOthers) {
    clearBackgroundTimer();
    return;
  }

  clearBackgroundTimer();

  if (autoAway && manualStatus === 'ONLINE') {
    void restoreFromAutoAway();
  }
}

function handleBackground(): void {
  if (!sharePresenceWithOthers) {
    return;
  }

  if (isAppInBackground()) {
    scheduleBackgroundAway();
  }
}

function handleVisibilityChange(): void {
  if (!sharePresenceWithOthers) {
    clearBackgroundTimer();
    return;
  }

  if (isAppInBackground()) {
    handleBackground();
    return;
  }

  handleForeground();
}

export async function syncPresenceToServer(): Promise<ApiResult<{ ok: true }>> {
  if (!started) {
    return { ok: true, data: { ok: true } };
  }

  return patchPresenceStatus(resolvePublishedPresenceStatus());
}

export function startPresenceManager(initialStatus: UserPresenceStatus, initialMessage = ''): void {
  manualStatus = initialStatus;
  statusMessage = initialMessage;
  autoAway = false;

  if (started) {
    applyRemotePresenceBootstrap(initialStatus, initialMessage);
    return;
  }

  started = true;
  void syncPresenceToServer();

  window.addEventListener('focus', handleForeground);
  window.addEventListener('blur', handleBackground);
  document.addEventListener('visibilitychange', handleVisibilityChange);
}

export function stopPresenceManager(): void {
  started = false;
  autoAway = false;
  lastPublishedMode = null;
  clearBackgroundTimer();

  window.removeEventListener('focus', handleForeground);
  window.removeEventListener('blur', handleBackground);
  document.removeEventListener('visibilitychange', handleVisibilityChange);
}
