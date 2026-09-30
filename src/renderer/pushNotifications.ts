const PUSH_ENDPOINT_KEY = 'flexhubs.push.endpoint';
const DESKTOP_NOTIFICATIONS_KEY = 'flexhubs.desktop.notifications.enabled';
const DESKTOP_NOTIFICATIONS_DISABLED_KEY = 'flexhubs.desktop.notifications.disabled';
const DESKTOP_NOTIFICATIONS_USER_OPT_OUT_KEY = 'flexhubs.desktop.notifications.userOptOut';

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

export function isDesktopNotificationsExplicitlyDisabled(): boolean {
  return (
    localStorage.getItem(DESKTOP_NOTIFICATIONS_USER_OPT_OUT_KEY) === 'true' ||
    localStorage.getItem(DESKTOP_NOTIFICATIONS_DISABLED_KEY) === 'true'
  );
}

function setDesktopNotificationsUserOptOut(optOut: boolean): void {
  if (optOut) {
    localStorage.setItem(DESKTOP_NOTIFICATIONS_USER_OPT_OUT_KEY, 'true');
  } else {
    localStorage.removeItem(DESKTOP_NOTIFICATIONS_USER_OPT_OUT_KEY);
  }
}

export function shouldDeliverDesktopNotifications(): boolean {
  if (isDesktopNotificationsExplicitlyDisabled()) {
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
    setDesktopNotificationsUserOptOut(false);
  } else {
    localStorage.removeItem(DESKTOP_NOTIFICATIONS_KEY);
    localStorage.setItem(DESKTOP_NOTIFICATIONS_DISABLED_KEY, 'true');
    setDesktopNotificationsUserOptOut(true);
  }
}

export async function ensureDesktopNotificationsReady(): Promise<void> {
  if (!isElectronShell()) {
    return;
  }

  if (localStorage.getItem(DESKTOP_NOTIFICATIONS_USER_OPT_OUT_KEY) === 'true') {
    return;
  }

  // Older builds disabled desktop alerts on logout; restore them on startup.
  localStorage.removeItem(DESKTOP_NOTIFICATIONS_DISABLED_KEY);
  setDesktopNotificationsEnabled(true);

  if (!('Notification' in window) || Notification.permission !== 'default') {
    return;
  }

  try {
    await Notification.requestPermission();
  } catch {
    // Native Electron notifications can still work via the main process.
  }
}

export async function enableDesktopPushNotifications(): Promise<{ ok: true } | { ok: false; error: string }> {
  if (isElectronShell()) {
    setDesktopNotificationsEnabled(true);

    if ('Notification' in window && Notification.permission === 'default') {
      try {
        await Notification.requestPermission();
      } catch {
        // Native notifications may still work without renderer permission.
      }
    }

    return { ok: true };
  }

  if (!('Notification' in window)) {
    return { ok: false, error: 'Notifications are not supported on this device.' };
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return { ok: false, error: 'Notification permission was denied.' };
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
        applicationServerKey: urlBase64ToUint8Array(keyResult.data.publicKey) as unknown as BufferSource,
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

export async function clearPushSubscriptionOnLogout(): Promise<void> {
  const endpoint = getStoredPushEndpoint();

  if (!endpoint) {
    return;
  }

  try {
    const { unsubscribePushEndpoint, deletePushSubscriptions } = await import('./extrasApi');
    await unsubscribePushEndpoint(endpoint);
    await deletePushSubscriptions();
  } catch {
    // Best-effort cleanup during logout.
  }

  clearStoredPushEndpoint();
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
