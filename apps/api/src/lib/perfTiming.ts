import { AsyncLocalStorage } from "async_hooks";
import { performance } from "perf_hooks";

type TimingStore = {
  metrics: Map<string, { duration: number; description?: string }>;
};

const storage = new AsyncLocalStorage<TimingStore>();

export function isApiTimingEnabled(): boolean {
  return process.env.DEBUG_API_TIMING === "1" || process.env.DEBUG_API_TIMING === "true";
}

export function runWithRequestTiming<T>(operation: () => T): T {
  if (!isApiTimingEnabled()) return operation();
  return storage.run({ metrics: new Map() }, operation);
}

export function recordTiming(name: string, duration: number, description?: string): void {
  if (!isApiTimingEnabled()) return;
  const store = storage.getStore();
  if (!store) return;
  const safeDuration = Math.max(0, duration);
  store.metrics.set(name, {
    duration: safeDuration,
    ...(description ? { description } : {}),
  });
}

export async function timeAsync<T>(
  name: string,
  operation: () => Promise<T>,
  description?: string
): Promise<T> {
  if (!isApiTimingEnabled()) return operation();
  const start = performance.now();
  try {
    return await operation();
  } finally {
    recordTiming(name, performance.now() - start, description);
  }
}

export function timeSync<T>(name: string, operation: () => T, description?: string): T {
  if (!isApiTimingEnabled()) return operation();
  const start = performance.now();
  try {
    return operation();
  } finally {
    recordTiming(name, performance.now() - start, description);
  }
}

function formatMetric(
  name: string,
  metric: { duration: number; description?: string }
): string {
  const dur = Math.round(metric.duration);
  const safeDescription = metric.description
    ? metric.description.split(String.fromCharCode(34)).join("").split(String.fromCharCode(92)).join("")
    : "";
  const desc = safeDescription ? ";desc=" + String.fromCharCode(34) + safeDescription + String.fromCharCode(34) : "";
  return name + ";dur=" + dur + desc;
}

export function buildServerTimingHeader(totalMs: number): string {
  if (!isApiTimingEnabled()) return "";
  const metrics = storage.getStore()?.metrics;
  const parts: string[] = [];
  if (metrics) {
    for (const [name, metric] of metrics.entries()) {
      parts.push(formatMetric(name, metric));
    }
  }
  parts.push(formatMetric("app", { duration: totalMs }));
  return parts.join(", ");
}
