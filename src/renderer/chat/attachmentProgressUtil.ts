/** Clamp and sanitize progress values for UI (never NaN / >100). */
export function sanitizeProgressPercent(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) {
    return null;
  }

  return Math.max(0, Math.min(100, Math.round(value)));
}

/** True when upload is in the network phase (IPC) where byte progress is unavailable. */
export function isUploadIndeterminatePhase(progress: number | null | undefined): boolean {
  const value = sanitizeProgressPercent(progress);
  if (value == null) {
    return true;
  }

  return value > 40 && value < 100;
}

export function formatUploadStatusLine(progress: number | null | undefined): string {
  const value = sanitizeProgressPercent(progress);
  if (value == null || isUploadIndeterminatePhase(value)) {
    return 'Uploading…';
  }

  if (value >= 100) {
    return 'Uploaded';
  }

  if (value <= 40) {
    return `Uploading… ${value}%`;
  }

  return 'Uploading…';
}

export function formatDownloadStatusLine(progress: number | null | undefined): string {
  const value = sanitizeProgressPercent(progress);
  if (value == null) {
    return 'Downloading…';
  }

  if (value >= 100) {
    return 'Downloaded';
  }

  return `Downloading… ${value}%`;
}
