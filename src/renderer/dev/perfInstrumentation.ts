/** Development-only performance counters (Step 1). No-op in production builds. */

export type PerfCounters = Record<
  string,
  {
    count: number;
    totalMs: number;
    lastMs: number;
    maxMs: number;
  }
>;

type PerfGlobal = {
  getCounters: () => PerfCounters;
  reset: () => void;
  summary: () => void;
  markStart: (label: string) => void;
  markEnd: (label: string) => void;
  increment: (label: string) => void;
  recordRender: (component: string) => void;
  captureBaseline: (note?: string) => void;
  readBaseline: () => unknown;
};

declare global {
  interface Window {
    __FLEXHUBS_PERF__?: PerfGlobal;
  }
}

const counters: PerfCounters = {};
const openMarks = new Map<string, number>();

function ensureBucket(label: string) {
  if (!counters[label]) {
    counters[label] = { count: 0, totalMs: 0, lastMs: 0, maxMs: 0 };
  }

  return counters[label];
}

export function isPerfEnabled(): boolean {
  return import.meta.env.DEV;
}

function markStart(label: string): void {
  if (!isPerfEnabled()) {
    return;
  }

  openMarks.set(label, performance.now());
}

function markEnd(label: string): void {
  if (!isPerfEnabled()) {
    return;
  }

  const start = openMarks.get(label);
  openMarks.delete(label);

  if (start === undefined) {
    return;
  }

  const duration = performance.now() - start;
  const bucket = ensureBucket(label);
  bucket.count += 1;
  bucket.totalMs += duration;
  bucket.lastMs = duration;
  bucket.maxMs = Math.max(bucket.maxMs, duration);
}

function increment(label: string): void {
  if (!isPerfEnabled()) {
    return;
  }

  const bucket = ensureBucket(label);
  bucket.count += 1;
}

function recordRender(component: string): void {
  increment(`render:${component}`);
}

function reset(): void {
  for (const key of Object.keys(counters)) {
    delete counters[key];
  }
  openMarks.clear();
}

function getCounters(): PerfCounters {
  return JSON.parse(JSON.stringify(counters)) as PerfCounters;
}

function summary(): void {
  const rows = Object.entries(counters).map(([label, stats]) => ({
    label,
    count: stats.count,
    avgMs: stats.count > 0 ? Math.round((stats.totalMs / stats.count) * 10) / 10 : 0,
    lastMs: Math.round(stats.lastMs * 10) / 10,
    maxMs: Math.round(stats.maxMs * 10) / 10,
  }));

  // eslint-disable-next-line no-console
  console.table(rows);
}

export function installPerfInstrumentation(): void {
  if (!isPerfEnabled() || window.__FLEXHUBS_PERF__) {
    return;
  }

  void import('./perfBaseline').then(({ capturePerfBaselineSnapshot, readPerfBaselineSnapshot }) => {
    window.__FLEXHUBS_PERF__ = {
      getCounters,
      reset,
      summary,
      markStart,
      markEnd,
      increment,
      recordRender,
      captureBaseline: capturePerfBaselineSnapshot,
      readBaseline: readPerfBaselineSnapshot,
    };

    // eslint-disable-next-line no-console
    console.info(
      '[FlexHubs perf] Dev instrumentation active. Try window.__FLEXHUBS_PERF__.summary()',
    );
  });
}

export function perfMeasure<T>(label: string, fn: () => T): T {
  if (!isPerfEnabled()) {
    return fn();
  }

  markStart(label);
  try {
    return fn();
  } finally {
    markEnd(label);
  }
}

export async function perfMeasureAsync<T>(label: string, fn: () => Promise<T>): Promise<T> {
  if (!isPerfEnabled()) {
    return fn();
  }

  markStart(label);
  try {
    return await fn();
  } finally {
    markEnd(label);
  }
}

export function perfRecordRender(component: string): void {
  recordRender(component);
}
