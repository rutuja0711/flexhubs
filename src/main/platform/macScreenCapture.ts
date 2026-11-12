import { app, desktopCapturer, systemPreferences } from 'electron';
import { readMediaAppName } from './macMediaPermissions';

let macScreenCaptureSessionVerified = false;
let macScreenCaptureProbeCompleted = false;

export function buildMacScreenCaptureHint(): string {
  const appName = readMediaAppName();

  return `Enable Screen Recording for ${appName} in System Settings → Privacy & Security, then quit and reopen the app.`;
}

async function probeMacScreenCaptureSources(): Promise<number> {
  const sources = await Promise.race([
    desktopCapturer.getSources({
      types: ['screen', 'window'],
      thumbnailSize: { width: 1, height: 1 },
    }),
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Screen capture probe timed out')), 2500);
    }),
  ]);

  return sources.length;
}

export async function ensureMacScreenCaptureAccess(): Promise<{ ok: true } | { ok: false; error: string }> {
  if (process.platform !== 'darwin') {
    return { ok: true };
  }

  if (macScreenCaptureSessionVerified) {
    return { ok: true };
  }

  const reportedStatus = systemPreferences.getMediaAccessStatus('screen');

  if (reportedStatus === 'granted') {
    macScreenCaptureSessionVerified = true;
    return { ok: true };
  }

  if (macScreenCaptureProbeCompleted) {
    return { ok: true };
  }

  macScreenCaptureProbeCompleted = true;

  console.log(`[ScreenShare] execPath: ${process.execPath}`);
  console.log(`[ScreenShare] getMediaAccessStatus('screen'): ${reportedStatus}`);

  try {
    const sourceCount = await probeMacScreenCaptureSources();
    console.log(`[ScreenShare] Permission probe found ${sourceCount} capture source(s).`);

    if (sourceCount > 0) {
      macScreenCaptureSessionVerified = true;
      return { ok: true };
    }
  } catch (error) {
    console.warn('[ScreenShare] Permission probe inconclusive.', error);
  }

  console.warn('[ScreenShare] Proceeding despite inconclusive permission probe.');
  return { ok: true };
}

export function markMacScreenCaptureSessionVerified(): void {
  macScreenCaptureSessionVerified = true;
  macScreenCaptureProbeCompleted = true;
}

export function describeMacScreenCaptureFailure(): string {
  if (process.platform !== 'darwin') {
    return 'Could not share your screen. Please try again.';
  }

  return buildMacScreenCaptureHint();
}
