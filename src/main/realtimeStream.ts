import { API_BASE_URL } from '../shared/api';
import { getUnreachableRemainingMs } from './apiRequest';
import {
  fetchRealtimeStatus,
  fetchRealtimeToken,
  sendRealtimeHeartbeat,
  setUserOnline,
} from './realtimeApi';

const HEARTBEAT_MS = 30_000;
const RECONNECT_BASE_MS = 5_000;
const RECONNECT_MAX_MS = 60_000;

import type { RealtimeConnectionStatus } from '../shared/realtime';

type EventHandler = (event: unknown) => void;
type StatusHandler = (status: RealtimeConnectionStatus) => void;

export type { RealtimeConnectionStatus };

let sessionToken: string | null = null;
let abortController: AbortController | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempt = 0;
let onEventHandler: EventHandler | null = null;
let onStatusHandler: StatusHandler | null = null;
let shouldRun = false;
let connecting = false;
let loggedNetworkWait = false;

function setStatus(status: RealtimeConnectionStatus): void {
  onStatusHandler?.(status);
}

function clearReconnectTimer(): void {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function clearTimers(): void {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }

  clearReconnectTimer();
}

function isNetworkResult(result: { ok: boolean; status?: number }): boolean {
  return !result.ok && (result.status === 0 || result.status === undefined);
}

function scheduleReconnect(reason?: string): void {
  if (!shouldRun || !sessionToken || reconnectTimer) {
    return;
  }

  const cooldownMs = getUnreachableRemainingMs();
  const backoffMs = Math.min(RECONNECT_BASE_MS * 2 ** reconnectAttempt, RECONNECT_MAX_MS);
  const delay = Math.max(cooldownMs, backoffMs);
  reconnectAttempt += 1;
  setStatus('disconnected');

  if (reason && !loggedNetworkWait) {
    loggedNetworkWait = true;
    console.warn(`[Realtime] ${reason}. Retrying in ${Math.round(delay / 1000)}s.`);
  }

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    void connect(sessionToken as string);
  }, delay);
}

function parseSseChunk(chunk: string, onEvent: EventHandler): void {
  for (const block of chunk.split('\n\n')) {
    const dataLines = block
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trim())
      .filter(Boolean);

    for (const data of dataLines) {
      if (data === '[DONE]' || data === 'ping') {
        continue;
      }

      try {
        onEvent(JSON.parse(data));
      } catch {
        onEvent({ type: 'raw', payload: data });
      }
    }
  }
}

async function openEventStream(
  authToken: string,
  streamToken: string,
  signal: AbortSignal,
  onEvent: EventHandler,
): Promise<boolean> {
  const urls = [
    `${API_BASE_URL}/realtime/events?token=${encodeURIComponent(streamToken)}`,
    `${API_BASE_URL}/realtime/events`,
  ];

  for (const url of urls) {
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${authToken}`,
          Accept: 'text/event-stream',
          'Cache-Control': 'no-cache',
        },
        signal,
      });

      if (!response.ok || !response.body) {
        continue;
      }

      console.log('[Realtime] connected');
      loggedNetworkWait = false;
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (!signal.aborted) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });

        let splitIndex = buffer.indexOf('\n\n');

        while (splitIndex >= 0) {
          const chunk = buffer.slice(0, splitIndex);
          buffer = buffer.slice(splitIndex + 2);
          parseSseChunk(`${chunk}\n\n`, onEvent);
          splitIndex = buffer.indexOf('\n\n');
        }
      }

      if (buffer.trim()) {
        parseSseChunk(`${buffer}\n\n`, onEvent);
      }

      return true;
    } catch {
      if (signal.aborted) {
        return false;
      }

      console.warn('[Realtime] stream dropped.');
    }
  }

  return false;
}

async function connect(authToken: string): Promise<void> {
  if (!shouldRun || connecting) {
    return;
  }

  connecting = true;
  abortController?.abort();
  abortController = new AbortController();
  const signal = abortController.signal;

  setStatus('connecting');

  try {
    const statusResult = await fetchRealtimeStatus(authToken);

    if (!statusResult.ok) {
      if (isNetworkResult(statusResult)) {
        scheduleReconnect('Realtime is unreachable');
        return;
      }

      scheduleReconnect();
      return;
    }

    if (!statusResult.data.enabled) {
      setStatus('unavailable');
      return;
    }

    const tokenResult = await fetchRealtimeToken(authToken);

    if (!tokenResult.ok) {
      if (isNetworkResult(tokenResult)) {
        scheduleReconnect('Realtime is unreachable');
        return;
      }

      scheduleReconnect();
      return;
    }

    void setUserOnline(authToken);

    const connected = await openEventStream(authToken, tokenResult.data, signal, (event) => {
      onEventHandler?.(event);
    });

    if (signal.aborted) {
      return;
    }

    if (connected) {
      reconnectAttempt = 0;
      loggedNetworkWait = false;
      setStatus('connected');
      return;
    }

    scheduleReconnect();
  } finally {
    connecting = false;
  }
}

export function setRealtimeHandlers(handlers: {
  onEvent?: EventHandler;
  onStatus?: StatusHandler;
}): void {
  onEventHandler = handlers.onEvent ?? null;
  onStatusHandler = handlers.onStatus ?? null;
}

export async function startRealtimeStream(authToken: string): Promise<void> {
  if (shouldRun && sessionToken === authToken) {
    return;
  }

  shouldRun = true;
  sessionToken = authToken;
  reconnectAttempt = 0;
  loggedNetworkWait = false;
  clearReconnectTimer();
  abortController?.abort();

  if (!heartbeatTimer) {
    heartbeatTimer = setInterval(() => {
      if (sessionToken && getUnreachableRemainingMs() === 0) {
        void sendRealtimeHeartbeat(sessionToken);
      }
    }, HEARTBEAT_MS);
  }

  await connect(authToken);
}

export function stopRealtimeStream(): void {
  shouldRun = false;
  sessionToken = null;
  reconnectAttempt = 0;
  connecting = false;
  loggedNetworkWait = false;
  clearTimers();
  abortController?.abort();
  abortController = null;
  setStatus('idle');
}
