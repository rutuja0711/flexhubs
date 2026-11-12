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

export type PerfSummaryRow = {
  label: string;
  count: number;
  avgMs: number;
  lastMs: number;
  maxMs: number;
};

type PerfGlobal = {
  getCounters: () => PerfCounters;
  getSummary: () => PerfSummaryRow[];
  reset: () => void;
  summary: () => void;
  markStart: (label: string) => void;
  markEnd: (label: string) => void;
  increment: (label: string) => void;
  getGauges: () => Record<string, number>;
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
const gauges: Record<string, number> = {};
const openMarks = new Map<string, number>();

let presenceRefreshInFlight = 0;

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

function setGauge(label: string, value: number): void {
  if (!isPerfEnabled()) {
    return;
  }

  gauges[label] = value;
}

function bumpGaugeMax(label: string, value: number): void {
  if (!isPerfEnabled()) {
    return;
  }

  gauges[label] = Math.max(gauges[label] ?? 0, value);
}

function recordRender(component: string): void {
  increment(`render:${component}`);
}

function reset(): void {
  for (const key of Object.keys(counters)) {
    delete counters[key];
  }
  for (const key of Object.keys(gauges)) {
    delete gauges[key];
  }
  openMarks.clear();
  presenceRefreshInFlight = 0;
}

function getCounters(): PerfCounters {
  return JSON.parse(JSON.stringify(counters)) as PerfCounters;
}

function getGauges(): Record<string, number> {
  return { ...gauges };
}

function getSummary(): PerfSummaryRow[] {
  if (!isPerfEnabled()) {
    return [];
  }

  return Object.entries(counters).map(([label, stats]) => ({
    label,
    count: stats.count,
    avgMs: stats.count > 0 ? Math.round((stats.totalMs / stats.count) * 10) / 10 : 0,
    lastMs: Math.round(stats.lastMs * 10) / 10,
    maxMs: Math.round(stats.maxMs * 10) / 10,
  }));
}

function summary(): void {
  const rows = getSummary();

  // eslint-disable-next-line no-console
  console.table(rows);

  if (Object.keys(gauges).length > 0) {
    // eslint-disable-next-line no-console
    console.table(
      Object.entries(gauges).map(([label, value]) => ({
        label,
        value,
      })),
    );
  }
}

export function installPerfInstrumentation(): void {
  if (!isPerfEnabled() || window.__FLEXHUBS_PERF__) {
    return;
  }

  void import('./perfBaseline').then(({ capturePerfBaselineSnapshot, readPerfBaselineSnapshot }) => {
    window.__FLEXHUBS_PERF__ = {
      getCounters,
      getSummary,
      reset,
      summary,
      markStart,
      markEnd,
      increment,
      getGauges,
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

export function perfIncrement(label: string): void {
  increment(label);
}

export function perfSetGauge(label: string, value: number): void {
  setGauge(label, value);
}

/** Dev-only: call when a presence refresh begins (after validating user id list). */
export function perfPresenceRefreshEnter(): void {
  if (!isPerfEnabled()) {
    return;
  }

  increment('chat:refreshPresence:started');
  presenceRefreshInFlight += 1;
  setGauge('chat:refreshPresence:inFlight', presenceRefreshInFlight);
  bumpGaugeMax('chat:refreshPresence:maxConcurrent', presenceRefreshInFlight);
}

/** Dev-only: call when a presence refresh finishes (success, error, or early return after start). */
export function perfPresenceRefreshExit(): void {
  if (!isPerfEnabled()) {
    return;
  }

  increment('chat:refreshPresence:completed');
  presenceRefreshInFlight = Math.max(0, presenceRefreshInFlight - 1);
  setGauge('chat:refreshPresence:inFlight', presenceRefreshInFlight);
}
