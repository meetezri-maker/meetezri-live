const PRODUCTION_HOSTNAMES = new Set([
  "sub.talktosolace2.ai",
  "talktosolace2.ai",
  "www.talktosolace2.ai",
]);

export interface AnalyticsRuntimeConfig {
  gaMeasurementId: string;
  metaPixelId: string;
  productionHostnames: readonly string[];
}

export interface AnalyticsAllowOptions {
  hostname?: string;
  isProd?: boolean;
  analyticsAllowed?: boolean;
}

function cleanEnv(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function getAnalyticsConfig(): AnalyticsRuntimeConfig {
  return {
    gaMeasurementId: cleanEnv(import.meta.env.VITE_GA_MEASUREMENT_ID),
    metaPixelId: cleanEnv(import.meta.env.VITE_META_PIXEL_ID),
    productionHostnames: [...PRODUCTION_HOSTNAMES],
  };
}

export function isProductionAnalyticsHost(hostname: string): boolean {
  return PRODUCTION_HOSTNAMES.has(hostname.toLowerCase());
}

/**
 * Phase 1 temporary consent behavior:
 * analytics may initialize only in production, only on the public Solace host
 * allowlist, and only when IDs are configured. A future consent manager should
 * feed `analyticsAllowed: false` here before scripts load.
 */
export function canInitializeAnalytics(options: AnalyticsAllowOptions = {}): boolean {
  const config = getAnalyticsConfig();
  if (!config.gaMeasurementId || !config.metaPixelId) return false;
  if (options.analyticsAllowed === false) return false;

  const isProd = options.isProd ?? import.meta.env.PROD;
  if (!isProd) return false;

  const hostname =
    options.hostname ??
    (typeof window !== "undefined" ? window.location.hostname : "");

  return hostname ? isProductionAnalyticsHost(hostname) : false;
}

