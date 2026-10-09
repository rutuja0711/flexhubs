import { applyAudioContextSink } from '../audioOutputDevice';

type RingMode = 'incoming' | 'outgoing';

class CallRingtoneController {
  private audioContext: AudioContext | null = null;
  private intervalId: number | null = null;
  private activeNodes: AudioNode[] = [];
  private mode: RingMode | null = null;

  private ensureContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
    }

    void this.audioContext.resume();
    void applyAudioContextSink(this.audioContext);
    return this.audioContext;
  }

  private clearNodes(): void {
    for (const node of this.activeNodes) {
      try {
        if ('stop' in node && typeof node.stop === 'function') {
          node.stop();
        }

        node.disconnect();
      } catch {
        // Ignore teardown errors from already-stopped nodes.
      }
    }

    this.activeNodes = [];
  }

  private playTone(frequency: number, durationMs: number, gainValue = 0.08): void {
    const context = this.ensureContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime;

    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(gainValue, now + 0.02);
    gain.gain.linearRampToValueAtTime(0, now + durationMs / 1000);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + durationMs / 1000 + 0.05);

    this.activeNodes.push(oscillator, gain);
  }

  private playIncomingBurst(): void {
    this.playTone(440, 420, 0.09);
    window.setTimeout(() => {
      this.playTone(480, 420, 0.09);
    }, 480);
  }

  private playOutgoingBurst(): void {
    this.playTone(425, 900, 0.06);
  }

  start(mode: RingMode): void {
    if (this.mode === mode) {
      return;
    }

    this.stop();
    this.mode = mode;

    if (mode === 'incoming') {
      this.playIncomingBurst();
      this.intervalId = window.setInterval(() => {
        this.playIncomingBurst();
      }, 2800);
      return;
    }

    this.playOutgoingBurst();
    this.intervalId = window.setInterval(() => {
      this.playOutgoingBurst();
    }, 3200);
  }

  stop(): void {
    if (this.intervalId != null) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.clearNodes();
    this.mode = null;
  }
}

const controller = new CallRingtoneController();

export function startIncomingCallRing(): void {
  controller.start('incoming');
}

export function startOutgoingCallRing(): void {
  controller.start('outgoing');
}

export function stopCallRing(): void {
  controller.stop();
}
