const STORAGE_KEY = 'flexhubs:audio-output-device-id';

export const AUDIO_OUTPUT_CHANGED_EVENT = 'flexhubs:audio-output-changed';

type MediaElementWithSink = HTMLMediaElement & {
  setSinkId?: (sinkId: string) => Promise<void>;
};

type AudioContextWithSink = AudioContext & {
  setSinkId?: (sinkId: string) => Promise<void>;
};

export function getPreferredAudioOutputDeviceId(): string {
  if (typeof window === 'undefined') {
    return 'default';
  }

  try {
    return window.localStorage.getItem(STORAGE_KEY)?.trim() || 'default';
  } catch {
    return 'default';
  }
}

export function setPreferredAudioOutputDeviceId(deviceId: string): void {
  const normalized = deviceId.trim() || 'default';

  try {
    window.localStorage.setItem(STORAGE_KEY, normalized);
  } catch {
    // Ignore storage failures.
  }

  void reapplyAudioOutputToAllMediaElements();
  window.dispatchEvent(
    new CustomEvent(AUDIO_OUTPUT_CHANGED_EVENT, { detail: { deviceId: normalized } }),
  );
}

export async function listAudioOutputDevices(): Promise<MediaDeviceInfo[]> {
  if (!navigator.mediaDevices?.enumerateDevices) {
    return [];
  }

  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter((device) => device.kind === 'audiooutput');
}

export function labelForAudioOutputDevice(device: MediaDeviceInfo, index: number): string {
  const label = device.label?.trim();
  if (label) {
    return label;
  }

  return `Output ${index + 1}`;
}

export async function applyAudioElementSink(element: HTMLMediaElement): Promise<void> {
  const deviceId = getPreferredAudioOutputDeviceId();
  const sinkElement = element as MediaElementWithSink;

  if (deviceId === 'default') {
    if (typeof sinkElement.setSinkId === 'function') {
      try {
        await sinkElement.setSinkId('');
      } catch {
        // Ignore reset failures.
      }
    }
    return;
  }

  if (typeof sinkElement.setSinkId !== 'function') {
    return;
  }

  try {
    await sinkElement.setSinkId(deviceId);
  } catch {
    // Device may have been unplugged; keep system default.
  }
}

export async function applyAudioContextSink(context: AudioContext): Promise<void> {
  const deviceId = getPreferredAudioOutputDeviceId();
  const sinkContext = context as AudioContextWithSink;

  if (deviceId === 'default') {
    if (typeof sinkContext.setSinkId === 'function') {
      try {
        await sinkContext.setSinkId('');
      } catch {
        // Ignore reset failures.
      }
    }
    return;
  }

  if (typeof sinkContext.setSinkId !== 'function') {
    return;
  }

  try {
    await sinkContext.setSinkId(deviceId);
  } catch {
    // Ignore unavailable sink.
  }
}

export async function reapplyAudioOutputToAllMediaElements(): Promise<void> {
  if (typeof document === 'undefined') {
    return;
  }

  const elements = document.querySelectorAll('audio, video');

  await Promise.all(
    Array.from(elements).map((node) => {
      if (node instanceof HTMLMediaElement) {
        return applyAudioElementSink(node);
      }
      return Promise.resolve();
    }),
  );
}

export function subscribeAudioOutputChanges(listener: () => void): () => void {
  const handler = () => listener();
  window.addEventListener(AUDIO_OUTPUT_CHANGED_EVENT, handler);
  return () => window.removeEventListener(AUDIO_OUTPUT_CHANGED_EVENT, handler);
}
