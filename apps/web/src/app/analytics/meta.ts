import { getAnalyticsConfig } from "./config";

type Fbq = {
  (...args: unknown[]): void;
  callMethod?: (...args: unknown[]) => void;
  queue?: unknown[];
  loaded?: boolean;
  version?: string;
  push?: Fbq;
};

interface MetaWindow extends Window {
  fbq?: Fbq;
  _fbq?: Fbq;
}

let initialized = false;

function getWindow(): MetaWindow | null {
  return typeof window === "undefined" ? null : (window as MetaWindow);
}

export function resetMetaForTests(): void {
  initialized = false;
}

export function initializeMetaPixel(): boolean {
  if (initialized) return true;

  const target = getWindow();
  const { metaPixelId } = getAnalyticsConfig();
  if (!target || !metaPixelId) return false;

  if (!target.fbq) {
    const fbq = function fbq(...args: unknown[]) {
      const currentFbq = target.fbq;
      if (currentFbq?.callMethod) currentFbq.callMethod(...args);
      else currentFbq?.queue?.push(args);
    } as Fbq;
    fbq.push = fbq;
    fbq.loaded = true;
    fbq.version = "2.0";
    fbq.queue = [];
    target.fbq = fbq;
    target._fbq = fbq;
  }

  if (!document.querySelector(`script[data-solace-meta="${metaPixelId}"]`)) {
    const script = document.createElement("script");
    script.async = true;
    script.src = "https://connect.facebook.net/en_US/fbevents.js";
    script.dataset.solaceMeta = metaPixelId;
    document.head.appendChild(script);
  }

  // No advanced matching object is passed here. Keep Pixel identity-less in Phase 1.
  target.fbq("init", metaPixelId, {});
  initialized = true;
  return true;
}

export function trackMetaPageView(pagePath: string): void {
  if (!initializeMetaPixel()) return;
  getWindow()?.fbq?.("track", "PageView", { page_path: pagePath });
}

export function trackMetaEvent(eventName: string, properties: Record<string, unknown>): void {
  if (!initializeMetaPixel()) return;
  getWindow()?.fbq?.("track", eventName, properties);
}

export function trackMetaCustomEvent(eventName: string, properties: Record<string, unknown>): void {
  if (!initializeMetaPixel()) return;
  getWindow()?.fbq?.("trackCustom", eventName, properties);
}
