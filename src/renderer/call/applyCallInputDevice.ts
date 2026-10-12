import type { Room } from 'livekit-client';
import { getPreferredCallInputDeviceId } from '../callInputDevice';

type RoomWithDeviceSwitch = Room & {
  switchActiveDevice?: (kind: MediaDeviceKind, deviceId: string) => Promise<void>;
};

export async function applyPreferredCallInputToLiveKitRoom(room: Room): Promise<void> {
  const preferredId = getPreferredCallInputDeviceId();
  const deviceId = preferredId === 'default' ? '' : preferredId;
  const switchable = room as RoomWithDeviceSwitch;

  if (typeof switchable.switchActiveDevice !== 'function') {
    return;
  }

  try {
    await switchable.switchActiveDevice('audioinput', deviceId);
  } catch {
    // Device may be unavailable; keep the default capture device.
  }
}
