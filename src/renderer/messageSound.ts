import { applyAudioContextSink, getPreferredAudioOutputDeviceId } from './audioOutputDevice';

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const AudioContextCtor =
    window.AudioContext ??
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AudioContextCtor) {
    return null;
  }

  if (!audioContext) {
    audioContext = new AudioContextCtor();
  }

  return audioContext;
}

export async function playMessageNotificationSound(): Promise<boolean> {
  const context = getAudioContext();

  if (!context) {
    return false;
  }

  if (context.state === 'suspended') {
    await context.resume();
  }

  const deviceId = getPreferredAudioOutputDeviceId();
  if (deviceId !== 'default') {
    await applyAudioContextSink(context);
  }

  const t0 = context.currentTime;

  const playTone = (frequency: number, start: number, duration: number) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, t0 + start);

    gain.gain.setValueAtTime(0.0001, t0 + start);
    gain.gain.exponentialRampToValueAtTime(0.16, t0 + start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + start + duration);

    oscillator.connect(gain);
    gain.connect(context.destination);

    oscillator.start(t0 + start);
    oscillator.stop(t0 + start + duration + 0.02);
  };

  // Two-tone chime (1.0.32-style message alert).
  playTone(784, 0, 0.11);
  playTone(988, 0.12, 0.14);

  return true;
}
