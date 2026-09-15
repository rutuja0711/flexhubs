import type { ApiResult } from '../shared/api';
import type { ScreenCaptureSource, ScreenCaptureSourceKind } from '../shared/screenShare';

function unavailable(): ApiResult<ScreenCaptureSource[]> {
  return { ok: false, error: 'Screen capture is unavailable in this environment.' };
}

export async function listScreenCaptureSources(
  kind: ScreenCaptureSourceKind,
): Promise<ApiResult<ScreenCaptureSource[]>> {
  if (!window.electronAPI?.listScreenCaptureSources) {
    return unavailable();
  }

  return window.electronAPI.listScreenCaptureSources(kind);
}
