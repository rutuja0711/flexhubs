import { session } from 'electron';
import { readPersistedAuthSession } from './desktopAuthStorage';

let mediaAuthToken: string | null = null;
let interceptorInstalled = false;

export function setAuthenticatedMediaRequestToken(token: string | null): void {
  mediaAuthToken = token?.trim() || null;
}

export function bootstrapAuthenticatedMediaRequestToken(): void {
  const persisted = readPersistedAuthSession();
  setAuthenticatedMediaRequestToken(persisted?.token ?? null);
}

/**
 * Injects Bearer auth on flexhubs.in requests so <video> / <audio> can stream
 * without downloading the full file into a blob first.
 */
export function installAuthenticatedMediaRequestInterceptor(): void {
  if (interceptorInstalled) {
    return;
  }

  interceptorInstalled = true;

  session.defaultSession.webRequest.onBeforeSendHeaders(
    { urls: ['https://flexhubs.in/*'] },
    (details, callback) => {
      const token = mediaAuthToken;

      if (!token) {
        callback({ requestHeaders: details.requestHeaders });
        return;
      }

      const headers = { ...details.requestHeaders };
      const existing = headers.Authorization ?? headers.authorization;

      if (!existing) {
        headers.Authorization = `Bearer ${token}`;
      }

      callback({ requestHeaders: headers });
    },
  );
}
