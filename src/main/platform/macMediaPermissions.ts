import { app, systemPreferences } from 'electron';

export function readMediaAppName(): string {
  return app.isPackaged ? app.getName() : 'Electron';
}

export async function ensureMacMediaPermissions(
  video: boolean,
): Promise<{ ok: true; appName?: string } | { ok: false; error: string; appName: string }> {
  const appName = app.isPackaged ? app.getName() : 'Electron';

  if (process.platform !== 'darwin') {
    return { ok: true, appName };
  }

  const micStatus = systemPreferences.getMediaAccessStatus('microphone');
  let micGranted = micStatus === 'granted';

  if (!micGranted) {
    micGranted = await systemPreferences.askForMediaAccess('microphone');
  }

  if (!micGranted) {
    return {
      ok: false,
      appName,
      error: `Microphone access is required. Enable ${appName} in System Settings → Privacy & Security → Microphone.`,
    };
  }

  if (!video) {
    return { ok: true, appName };
  }

  const cameraStatus = systemPreferences.getMediaAccessStatus('camera');
  let cameraGranted = cameraStatus === 'granted';

  if (!cameraGranted) {
    cameraGranted = await systemPreferences.askForMediaAccess('camera');
  }

  if (!cameraGranted) {
    return {
      ok: false,
      appName,
      error: `Camera access is required. Enable ${appName} in System Settings → Privacy & Security → Camera.`,
    };
  }

  return { ok: true, appName };
}
