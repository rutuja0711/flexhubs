import { useCallback, useEffect, useState } from 'react';
import {
  getPreferredAudioOutputDeviceId,
  labelForAudioOutputDevice,
  listAudioOutputDevices,
  setPreferredAudioOutputDeviceId,
} from '../audioOutputDevice';
import {
  getPreferredCallInputDeviceId,
  labelForAudioInputDevice,
  listAudioInputDevices,
  setPreferredCallInputDeviceId,
} from '../callInputDevice';

export type CallMicAccessState = 'unknown' | 'ready' | 'denied';

async function readMicrophonePermissionState(): Promise<CallMicAccessState> {
  if (!navigator.permissions?.query) {
    return 'unknown';
  }

  try {
    const status = await navigator.permissions.query({ name: 'microphone' as PermissionName });

    if (status.state === 'granted') {
      return 'ready';
    }

    if (status.state === 'denied') {
      return 'denied';
    }

    return 'unknown';
  } catch {
    return 'unknown';
  }
}

export function useCallRingingDevices(active: boolean) {
  const [micAccess, setMicAccess] = useState<CallMicAccessState>('unknown');
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[]>([]);
  const [selectedInputId, setSelectedInputId] = useState(getPreferredCallInputDeviceId);
  const [selectedOutputId, setSelectedOutputId] = useState(getPreferredAudioOutputDeviceId);

  const refreshDevices = useCallback(async () => {
    const [inputs, outputs] = await Promise.all([listAudioInputDevices(), listAudioOutputDevices()]);
    setAudioInputs(inputs);
    setAudioOutputs(outputs);
  }, []);

  const syncMicAccessFromSystem = useCallback(async () => {
    const permissionState = await readMicrophonePermissionState();
    setMicAccess(permissionState);
    await refreshDevices();
  }, [refreshDevices]);

  useEffect(() => {
    if (!active) {
      return;
    }

    void syncMicAccessFromSystem();

    const mediaDevices = navigator.mediaDevices;

    if (!mediaDevices?.addEventListener) {
      return;
    }

    const onDeviceChange = () => {
      void refreshDevices();
    };

    mediaDevices.addEventListener('devicechange', onDeviceChange);
    return () => mediaDevices.removeEventListener('devicechange', onDeviceChange);
  }, [active, refreshDevices, syncMicAccessFromSystem]);

  const onInputChange = useCallback((deviceId: string) => {
    const normalized = deviceId.trim() || 'default';
    setSelectedInputId(normalized);
    setPreferredCallInputDeviceId(normalized);
  }, []);

  const onOutputChange = useCallback((deviceId: string) => {
    const normalized = deviceId.trim() || 'default';
    setSelectedOutputId(normalized);
    setPreferredAudioOutputDeviceId(normalized);
  }, []);

  return {
    micAccess,
    audioInputs,
    audioOutputs,
    selectedInputId,
    selectedOutputId,
    onInputChange,
    onOutputChange,
    labelForAudioInputDevice,
    labelForAudioOutputDevice,
  };
}
