import {
  canInitializeAnalytics,
  type AnalyticsAllowOptions,
} from '@/app/analytics/config';
import { trackGa4PageView } from '@/app/analytics/ga4';
import {
  getSafePageTitle,
  sanitizeAnalyticsPath,
  type AnalyticsLocationLike,
} from '@/app/analytics/urlSanitizer';

const TRACKED_RESOURCE_PATHS_KEY = '__solaceTrackedResourceAnalyticsPaths';

interface ResourceAnalyticsWindow extends Window {
  [TRACKED_RESOURCE_PATHS_KEY]?: Set<string>;
}

export interface ResourceAnalyticsLocation extends AnalyticsLocationLike {
  hostname: string;
  origin: string;
}

export interface ResourceAnalyticsRuntime {
  location?: ResourceAnalyticsLocation;
  referrer?: string;
  navigationType?: PerformanceNavigationTiming['type'];
  allowOptions?: AnalyticsAllowOptions;
}

function currentNavigationType(): PerformanceNavigationTiming['type'] {
  const navigation = performance.getEntriesByType('navigation')[0] as
    | PerformanceNavigationTiming
    | undefined;
  return navigation?.type ?? 'navigate';
}

function isResourcePath(path: string): boolean {
  return path === '/resources' || path.startsWith('/resources/');
}

function isSameSanitizedReferrer(
  safePath: string,
  location: ResourceAnalyticsLocation,
  referrer: string,
): boolean {
  if (!referrer) return false;

  try {
    const referrerUrl = new URL(referrer);
    if (referrerUrl.origin !== location.origin) return false;
    return sanitizeAnalyticsPath(referrerUrl) === safePath;
  } catch {
    return false;
  }
}

function trackedPaths(target: ResourceAnalyticsWindow): Set<string> {
  const existing = target[TRACKED_RESOURCE_PATHS_KEY];
  if (existing) return existing;

  const created = new Set<string>();
  target[TRACKED_RESOURCE_PATHS_KEY] = created;
  return created;
}

/**
 * Adds GA4 to the static Fastify Resources documents without mounting React.
 *
 * Successful Resource responses opt into the tiny browser entry that calls this
 * function. Fastify 404s omit that entry entirely, so draft, unpublished and
 * missing slugs never execute analytics.
 */
export function trackFastifyResourcePageView(
  runtime: ResourceAnalyticsRuntime = {},
): string | null {
  if (typeof window === 'undefined') return null;

  const target = window as ResourceAnalyticsWindow;
  const location = runtime.location ?? window.location;
  const allowOptions = runtime.allowOptions ?? {};
  if (!canInitializeAnalytics({
    ...allowOptions,
    hostname: allowOptions.hostname ?? location.hostname,
  })) {
    return null;
  }

  const safePath = sanitizeAnalyticsPath(location);
  if (!safePath || !isResourcePath(safePath)) return null;

  const seen = trackedPaths(target);
  if (seen.has(safePath)) return null;

  const navigationType = runtime.navigationType ?? currentNavigationType();
  const referrer = runtime.referrer ?? document.referrer;
  if (
    navigationType !== 'reload'
    && isSameSanitizedReferrer(safePath, location, referrer)
  ) {
    seen.add(safePath);
    return null;
  }

  seen.add(safePath);
  trackGa4PageView(safePath, getSafePageTitle(safePath));
  return safePath;
}

export function resetFastifyResourceAnalyticsForTests(): void {
  if (typeof window === 'undefined') return;
  delete (window as ResourceAnalyticsWindow)[TRACKED_RESOURCE_PATHS_KEY];
}
