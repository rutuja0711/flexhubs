import type { UserPresenceStatus } from '../shared/profile';
import { saveUserStatus } from './chatApi';

const BACKGROUND_AWAY_MS = 60_000;

type Listener = () => void;

let manualStatus: UserPresenceStatus = 'ONLINE';
let statusMessage = '';
let autoAway = false;
let started = false;
let backgroundTimer: number | undefined;
let pendingStatusRequest: Promise<void> | null = null;
const listeners = new Set<Listener>();

function notify(): void {
  listeners.forEach((listener) => listener());
}

export function subscribePresenceManager(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getEffectivePresenceStatus(): UserPresenceStatus {
  if (autoAway && manualStatus === 'ONLINE') {
    return 'AWAY';
  }

  return manualStatus;
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

export function setPresenceStatusMessage(message: string): void {
  statusMessage = message;
}

function clearBackgroundTimer(): void {
  if (backgroundTimer !== undefined) {
    window.clearTimeout(backgroundTimer);
    backgroundTimer = undefined;
  }
}

function isAppInBackground(): boolean {
  return document.hidden || !document.hasFocus();
}

function scheduleBackgroundAway(): void {
  clearBackgroundTimer();

  if (!started || manualStatus !== 'ONLINE' || !isAppInBackground()) {
    return;
  }

  backgroundTimer = window.setTimeout(() => {
    if (isAppInBackground()) {
      void applyAutoAway();
    }
  }, BACKGROUND_AWAY_MS);
}

async function patchPresenceStatus(status: UserPresenceStatus): Promise<void> {
  if (pendingStatusRequest) {
    await pendingStatusRequest;
  }

  pendingStatusRequest = (async () => {
    await saveUserStatus(status, statusMessage);
  })();

  try {
    await pendingStatusRequest;
  } finally {
    pendingStatusRequest = null;
  }
}

async function applyAutoAway(): Promise<void> {
  if (!started || manualStatus !== 'ONLINE' || autoAway) {
    return;
  }

  autoAway = true;
  notify();
  await patchPresenceStatus('AWAY');
}

async function restoreFromAutoAway(): Promise<void> {
  if (!autoAway || manualStatus !== 'ONLINE') {
    return;
  }

  autoAway = false;
  notify();
  await patchPresenceStatus('ONLINE');
}

function handleForeground(): void {
  clearBackgroundTimer();

  if (autoAway && manualStatus === 'ONLINE') {
    void restoreFromAutoAway();
  }
}

function handleBackground(): void {
  if (isAppInBackground()) {
    scheduleBackgroundAway();
  }
}

function handleVisibilityChange(): void {
  if (isAppInBackground()) {
    handleBackground();
    return;
  }

  handleForeground();
}

export function startPresenceManager(initialStatus: UserPresenceStatus, initialMessage = ''): void {
  manualStatus = initialStatus;
  statusMessage = initialMessage;
  autoAway = false;

  if (started) {
    notify();
    return;
  }

  started = true;

  window.addEventListener('focus', handleForeground);
  window.addEventListener('blur', handleBackground);
  document.addEventListener('visibilitychange', handleVisibilityChange);
}

export function stopPresenceManager(): void {
  started = false;
  autoAway = false;
  clearBackgroundTimer();

  window.removeEventListener('focus', handleForeground);
  window.removeEventListener('blur', handleBackground);
  document.removeEventListener('visibilitychange', handleVisibilityChange);
}
