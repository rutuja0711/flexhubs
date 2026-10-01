export function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

/** Smoothly animates progress between two values; returns a cancel function. */
export function runSimulatedProgress(
  from: number,
  to: number,
  durationMs: number,
  onProgress: (value: number) => void,
): () => void {
  const start = performance.now();
  let frame = 0;

  onProgress(from);

  const step = (now: number) => {
    const t = Math.min(1, (now - start) / durationMs);
    const value = from + (to - from) * easeOutCubic(t);
    onProgress(Math.round(value));
    if (t < 1) {
      frame = requestAnimationFrame(step);
    } else {
      onProgress(to);
    }
  };

  frame = requestAnimationFrame(step);

  return () => {
    cancelAnimationFrame(frame);
  };
}

export function estimateUploadDurationMs(fileSizeBytes: number): number {
  return Math.min(14_000, Math.max(900, fileSizeBytes / 6_000));
}

export function estimateSendDurationMs(): number {
  return 900;
}
