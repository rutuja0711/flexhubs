const PUSH_ENDPOINT_KEY = 'flexhubs.push.endpoint';
const DESKTOP_NOTIFICATIONS_KEY = 'flexhubs.desktop.notifications.enabled';
const DESKTOP_NOTIFICATIONS_DISABLED_KEY = 'flexhubs.desktop.notifications.disabled';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

function isElectronShell(): boolean {
  return Boolean(window.electronAPI);
}

async function withTimeout<T>(promise: Promise<T>, ms: number, errorMessage: string): Promise<T> {
  let timeoutId: number | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(errorMessage)), ms);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId);
    }
  }
}

export function getStoredPushEndpoint(): string | null {
  return localStorage.getItem(PUSH_ENDPOINT_KEY);
}

export function storePushEndpoint(endpoint: string): void {
  localStorage.setItem(PUSH_ENDPOINT_KEY, endpoint);
}

export function clearStoredPushEndpoint(): void {
  localStorage.removeItem(PUSH_ENDPOINT_KEY);
}

export function isDesktopNotificationsEnabled(): boolean {
  if (localStorage.getItem(DESKTOP_NOTIFICATIONS_DISABLED_KEY) === 'true') {
    return false;
  }

  if (localStorage.getItem(DESKTOP_NOTIFICATIONS_KEY) === 'true') {
    return true;
  }

  return Boolean(getStoredPushEndpoint());
}

export function shouldDeliverDesktopNotifications(): boolean {
  if (localStorage.getItem(DESKTOP_NOTIFICATIONS_DISABLED_KEY) === 'true') {
    return false;
  }

  if (isElectronShell()) {
    return true;
  }

  if (typeof Notification === 'undefined') {
    return false;
  }

  if (Notification.permission !== 'granted') {
    return false;
  }

  return isDesktopNotificationsEnabled();
}

function setDesktopNotificationsEnabled(enabled: boolean): void {
  if (enabled) {
    localStorage.setItem(DESKTOP_NOTIFICATIONS_KEY, 'true');
    localStorage.removeItem(DESKTOP_NOTIFICATIONS_DISABLED_KEY);
  } else {
    localStorage.removeItem(DESKTOP_NOTIFICATIONS_KEY);
    localStorage.setItem(DESKTOP_NOTIFICATIONS_DISABLED_KEY, 'true');
  }
}

export async function enableDesktopPushNotifications(): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!('Notification' in window)) {
    return { ok: false, error: 'Notifications are not supported on this device.' };
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return { ok: false, error: 'Notification permission was denied.' };
  }

  if (isElectronShell()) {
    setDesktopNotificationsEnabled(true);
    return { ok: true };
  }

  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    setDesktopNotificationsEnabled(true);
    return { ok: true };
  }

  try {
    const { loadPushVapidPublicKey, subscribePushNotifications } = await import('./extrasApi');
    const keyResult = await loadPushVapidPublicKey();

    if (!keyResult.ok || !keyResult.data.publicKey) {
      setDesktopNotificationsEnabled(true);
      return keyResult.ok
        ? { ok: true }
        : { ok: false, error: keyResult.error };
    }

    const registration = await withTimeout(
      navigator.serviceWorker.register('/sw.js'),
      10_000,
      'Unable to register push service worker.',
    ).catch(() => null);

    if (!registration) {
      setDesktopNotificationsEnabled(true);
      return { ok: true };
    }

    const subscription = await withTimeout(
      registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(keyResult.data.publicKey),
      }),
      10_000,
      'Push subscription timed out.',
    );

    const subscribeResult = await subscribePushNotifications(subscription.toJSON());
    if (!subscribeResult.ok) {
      return { ok: false, error: subscribeResult.error };
    }

    storePushEndpoint(subscription.endpoint);
    setDesktopNotificationsEnabled(true);
    return { ok: true };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to enable push notifications.';

    return { ok: false, error: message };
  }
}

export async function disableDesktopPushNotifications(): Promise<{ ok: true } | { ok: false; error: string }> {
  setDesktopNotificationsEnabled(false);

  const endpoint = getStoredPushEndpoint();
  if (!endpoint) {
    return { ok: true };
  }

  const { unsubscribePushEndpoint, deletePushSubscriptions } = await import('./extrasApi');
  const result = await unsubscribePushEndpoint(endpoint);

  if (!result.ok) {
    clearStoredPushEndpoint();
    return { ok: true };
  }

  const deleteResult = await deletePushSubscriptions();
  if (!deleteResult.ok) {
    clearStoredPushEndpoint();
    return { ok: true };
  }

  clearStoredPushEndpoint();
  return { ok: true };
}
