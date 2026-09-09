type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: number;
};

export type MediaServerEvent =
  | 'peer-joined'
  | 'peer-left'
  | 'new-producer'
  | 'peer-muted'
  | 'camera-pip'
  | 'room-ended'
  | string;

export class MediaSignalingClient {
  private ws: WebSocket | null = null;
  private pending = new Map<string, PendingRequest>();
  private eventHandlers = new Set<(event: MediaServerEvent, data: unknown) => void>();
  private closeHandlers = new Set<(code: number, reason: string) => void>();

  connect(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => resolve();
      this.ws.onerror = () => reject(new Error('Could not connect to the call media server.'));
      this.ws.onmessage = (event) => this.handleMessage(String(event.data ?? ''));
      this.ws.onclose = (event) => {
        for (const handler of this.closeHandlers) {
          handler(event.code, event.reason);
        }
      };
    });
  }

  onEvent(handler: (event: MediaServerEvent, data: unknown) => void): () => void {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler);
  }

  onClose(handler: (code: number, reason: string) => void): () => void {
    this.closeHandlers.add(handler);
    return () => this.closeHandlers.delete(handler);
  }

  async request<T>(method: string, data: unknown): Promise<T> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Media connection is not open.');
    }

    const id = crypto.randomUUID();

    return new Promise<T>((resolve, reject) => {
      const timer = window.setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Media request timed out: ${method}`));
      }, 30_000);

      this.pending.set(id, {
        resolve: (value) => resolve(value as T),
        reject,
        timer,
      });

      this.ws?.send(JSON.stringify({ id, method, data }));
    });
  }

  close(): void {
    for (const pending of this.pending.values()) {
      window.clearTimeout(pending.timer);
      pending.reject(new Error('Media connection closed.'));
    }

    this.pending.clear();

    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
      this.ws.onclose = null;

      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close();
      }

      this.ws = null;
    }
  }

  private handleMessage(raw: string): void {
    let parsed: Record<string, unknown>;

    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return;
    }

    const id = typeof parsed.id === 'string' ? parsed.id : null;

    if (id && this.pending.has(id)) {
      const pending = this.pending.get(id)!;
      window.clearTimeout(pending.timer);
      this.pending.delete(id);

      if (parsed.ok === false) {
        const error =
          typeof parsed.error === 'string'
            ? parsed.error
            : typeof parsed.message === 'string'
              ? parsed.message
              : 'Media request failed.';
        pending.reject(new Error(error));
        return;
      }

      pending.resolve(parsed.data ?? parsed);
      return;
    }

    const eventName =
      (typeof parsed.event === 'string' && parsed.event) ||
      (typeof parsed.method === 'string' && parsed.method) ||
      null;

    if (!eventName) {
      return;
    }

    const data = parsed.data ?? parsed.payload ?? parsed;

    for (const handler of this.eventHandlers) {
      handler(eventName, data);
    }
  }
}
