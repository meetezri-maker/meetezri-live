import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { canInitializeAnalytics } from "./config";
import { trackGa4PageView } from "./ga4";
import { trackMetaPageView } from "./meta";
import { getSafePageTitle, sanitizeAnalyticsPath } from "./urlSanitizer";

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

export function AnalyticsRouteTracker() {
  const location = useLocation();
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

