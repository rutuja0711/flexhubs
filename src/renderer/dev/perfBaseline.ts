/** Dev-only rolling stats for before/after comparison (Step 0). */

import { isPerfEnabled, type PerfCounters } from './perfInstrumentation';

const STORAGE_KEY = 'flexhubs:perf-baseline-snapshot';

export type PerfBaselineSnapshot = {
  capturedAt: string;
  counters: PerfCounters;
  note?: string;
};

export function capturePerfBaselineSnapshot(note?: string): PerfBaselineSnapshot | null {
  if (!isPerfEnabled() || !window.__FLEXHUBS_PERF__) {
    return null;
  }

  const snapshot: PerfBaselineSnapshot = {
    capturedAt: new Date().toISOString(),
    counters: window.__FLEXHUBS_PERF__.getCounters(),
    note,
  };

  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // ignore quota
  }

  return snapshot;
}

export function readPerfBaselineSnapshot(): PerfBaselineSnapshot | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }

    return JSON.parse(raw) as PerfBaselineSnapshot;
  } catch {
    return null;
  }
}
