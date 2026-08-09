import { getAnalyticsConfig } from "./config";

type GtagCommand = "js" | "config" | "event";
type Gtag = (command: GtagCommand, target: string | Date, params?: Record<string, unknown>) => void;

interface GAWindow extends Window {
  dataLayer?: unknown[];
  gtag?: Gtag;
}

let initialized = false;

function getWindow(): GAWindow | null {
  return typeof window === "undefined" ? null : (window as GAWindow);
}

export function resetGa4ForTests(): void {
  initialized = false;
}

export function initializeGa4(): boolean {
  if (initialized) return true;

  const target = getWindow();
  const { gaMeasurementId } = getAnalyticsConfig();
  if (!target || !gaMeasurementId) return false;

  target.dataLayer = Array.isArray(target.dataLayer) ? target.dataLayer : [];
  target.gtag =
    target.gtag ||
    function gtag(...args) {
      target.dataLayer?.push(args);
    };

  if (!document.querySelector(`script[data-solace-ga4="${gaMeasurementId}"]`)) {
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaMeasurementId)}`;
    script.dataset.solaceGa4 = gaMeasurementId;
    document.head.appendChild(script);
  }

  target.gtag("js", new Date());
  target.gtag("config", gaMeasurementId, { send_page_view: false });
  initialized = true;
  return true;
}

export function trackGa4PageView(pagePath: string, pageTitle?: string): void {
  if (!initializeGa4()) return;

  const target = getWindow();
  if (!target?.gtag) return;

  target.gtag("event", "page_view", {
    page_path: pagePath,
    ...(pageTitle ? { page_title: pageTitle } : {}),
  });
}

export function trackGa4Event(eventName: string, properties: Record<string, unknown>): void {
  if (!initializeGa4()) return;
  const target = getWindow();
  target?.gtag?.("event", eventName, properties);
}

