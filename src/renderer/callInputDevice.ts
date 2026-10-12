const STORAGE_KEY = 'flexhubs:audio-input-device-id';

export function getPreferredCallInputDeviceId(): string {
  if (typeof window === 'undefined') {
    return 'default';
  }

  try {
    return window.localStorage.getItem(STORAGE_KEY)?.trim() || 'default';
  } catch {
    return 'default';
  }
}

export function setPreferredCallInputDeviceId(deviceId: string): void {
  const normalized = deviceId.trim() || 'default';

  try {
    window.localStorage.setItem(STORAGE_KEY, normalized);
  } catch {
    // Ignore storage failures.
  }
}

export async function listAudioInputDevices(): Promise<MediaDeviceInfo[]> {
  if (!navigator.mediaDevices?.enumerateDevices) {
    return [];
  }

  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter((device) => device.kind === 'audioinput');
}

export function labelForAudioInputDevice(device: MediaDeviceInfo, index: number): string {
  const label = device.label?.trim();
  if (label) {
    return label;
  }

  return `Microphone ${index + 1}`;
}

export function buildCallAudioInputConstraint(): boolean | MediaTrackConstraints {
  const deviceId = getPreferredCallInputDeviceId();

  if (deviceId === 'default') {
    return true;
  }

  return {
    deviceId: { ideal: deviceId },
  };
}
