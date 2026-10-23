import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { canInitializeAnalytics } from "./config";
import { trackGa4PageView } from "./ga4";
import { trackMetaPageView } from "./meta";
import { getSafePageTitle, sanitizeAnalyticsPath } from "./urlSanitizer";
import type { AnalyticsLocationLike } from "./urlSanitizer";

export function emitAnalyticsPageViewForLocation(location: {
  pathname: string;
  search?: string;
  hash?: string;
}): string | null {
  if (!canInitializeAnalytics()) return null;

  const safePath = sanitizeAnalyticsPath(location);
  if (!safePath) return null;

  trackGa4PageView(safePath, getSafePageTitle(safePath));
  trackMetaPageView(safePath);
  return safePath;
}

interface AnalyticsRouteTrackerProps {
  location?: AnalyticsLocationLike;
}

function AnalyticsLocationTracker({ location }: { location: AnalyticsLocationLike }) {
  const lastTrackedPathRef = useRef<string | null>(null);

  useEffect(() => {
    if (!canInitializeAnalytics()) return;

    const safePath = sanitizeAnalyticsPath(location);
    if (!safePath || safePath === lastTrackedPathRef.current) return;

    lastTrackedPathRef.current = safePath;
    trackGa4PageView(safePath, getSafePageTitle(safePath));
    trackMetaPageView(safePath);
  }, [location]);

  return null;
}

function RouterAnalyticsRouteTracker() {
  const location = useLocation();
  return <AnalyticsLocationTracker location={location} />;
}

export function AnalyticsRouteTracker({ location }: AnalyticsRouteTrackerProps = {}) {
  return location
    ? <AnalyticsLocationTracker location={location} />
    : <RouterAnalyticsRouteTracker />;
}

