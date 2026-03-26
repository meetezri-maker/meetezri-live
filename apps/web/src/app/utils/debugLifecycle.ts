type DebugPayload = Record<string, unknown>;

function enabled() {
  try {
    return typeof window !== "undefined" && window.localStorage?.getItem("ezri_debug_lifecycle") === "1";
  } catch {
    return false;
  }
}

function ts() {
  try {
    const d = new Date();
    return d.toISOString();
  } catch {
    return String(Date.now());
  }
}

export function dbg(event: string, payload: DebugPayload = {}) {
  if (!enabled()) return;
  // Keep logs greppable and consistent.
  // eslint-disable-next-line no-console
  console.log(`[EZRI_DEBUG ${ts()}] ${event}`, {
    ...payload,
    visibilityState: typeof document !== "undefined" ? document.visibilityState : "unknown",
    hasFocus: typeof document !== "undefined" && typeof document.hasFocus === "function" ? document.hasFocus() : "unknown",
  });
}

function safeWrap<T extends (...args: any[]) => any>(
  label: string,
  fn: T,
  getExtra?: (...args: Parameters<T>) => DebugPayload
): T {
  return ((...args: Parameters<T>) => {
    dbg(label, {
      args,
      ...(getExtra ? getExtra(...args) : {}),
    });
    // eslint-disable-next-line no-console
    console.trace(`[EZRI_DEBUG TRACE] ${label}`);
    return fn(...args);
  }) as T;
}

export function installDebugHooks() {
  if (!enabled()) return;

  dbg("installDebugHooks", {
    url: typeof window !== "undefined" ? window.location.href : "unknown",
    wasDiscarded: (document as any)?.wasDiscarded === true,
  });

  // 1) Browser lifecycle events
  const events: Array<keyof WindowEventMap | "visibilitychange"> = [
    "visibilitychange",
    "focus",
    "blur",
    "pageshow",
    "pagehide",
    "beforeunload",
    "unload",
  ];

  const handler = (e: Event) => {
    const anyE = e as any;
    dbg(`event:${e.type}`, {
      persisted: typeof anyE?.persisted === "boolean" ? anyE.persisted : undefined,
    });
  };

  for (const ev of events) {
    if (ev === "visibilitychange") document.addEventListener(ev, handler, true);
    else window.addEventListener(ev as any, handler, true);
  }

  // 2) Hard refresh triggers — attempt to wrap Location + History
  try {
    const loc: any = window.location;
    if (typeof loc.reload === "function") loc.reload = safeWrap("location.reload", loc.reload.bind(loc));
    if (typeof loc.assign === "function") loc.assign = safeWrap("location.assign", loc.assign.bind(loc));
    if (typeof loc.replace === "function") loc.replace = safeWrap("location.replace", loc.replace.bind(loc));
  } catch (err) {
    dbg("wrap:location.failed", { err: String(err) });
  }

  try {
    history.pushState = safeWrap("history.pushState", history.pushState.bind(history), (_s, _t, url) => ({ url }));
    history.replaceState = safeWrap("history.replaceState", history.replaceState.bind(history), (_s, _t, url) => ({ url }));
  } catch (err) {
    dbg("wrap:history.failed", { err: String(err) });
  }

  // 3) Navigation timing snapshot
  try {
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    dbg("navigation", {
      type: nav?.type ?? "unknown",
      transferSize: nav?.transferSize,
      encodedBodySize: nav?.encodedBodySize,
    });
  } catch {
    // ignore
  }
}

