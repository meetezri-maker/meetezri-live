type RequestIdleCallback = (
  callback: () => void,
  options?: { timeout?: number },
) => number;

interface DeferredScriptWindow extends Window {
  requestIdleCallback?: RequestIdleCallback;
}

const DEFERRED_ANALYTICS_TIMEOUT_MS = 2500;

const scheduledScripts = new Set<string>();

function runSafely(callback: () => void): void {
  try {
    callback();
  } catch {
    // Third-party analytics loading must never break Solace page rendering.
  }
}

export function deferAnalyticsScriptAppend(key: string, appendScript: () => void): void {
  if (scheduledScripts.has(key)) return;
  scheduledScripts.add(key);

  if (typeof window === "undefined") return;

  const target = window as DeferredScriptWindow;
  const appendSafely = () => runSafely(appendScript);

  const scheduleDeferredAppend = () => {
    if (typeof target.requestIdleCallback === "function") {
      target.requestIdleCallback(appendSafely, { timeout: DEFERRED_ANALYTICS_TIMEOUT_MS });
      return;
    }
    window.setTimeout(appendSafely, 0);
  };
  if (document.readyState === "complete") {
    scheduleDeferredAppend();
    return;
  }
  window.addEventListener("load", scheduleDeferredAppend, { once: true });
}

export function resetDeferredAnalyticsScriptsForTests(): void {
  scheduledScripts.clear();
}
