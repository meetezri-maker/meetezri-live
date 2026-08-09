export interface AnalyticsLocationLike {
  pathname: string;
  search?: string;
  hash?: string;
}

const APPROVED_MARKETING_PATHS = new Set([
  "/",
  "/home",
  "/how-it-works",
  "/early-access",
  "/privacy",
  "/terms",
  "/pricing",
  "/login",
  "/signup",
  "/verify-email",
]);

const SAFE_PAGE_TITLES: Record<string, string> = {
  "/": "Solace Early Access",
  "/home": "Solace Home",
  "/how-it-works": "How It Works",
  "/early-access": "Solace Early Access",
  "/privacy": "Privacy",
  "/terms": "Terms",
  "/pricing": "Pricing",
  "/login": "Login",
  "/signup": "Signup",
  "/verify-email": "Verify Email",
};

function normalizePathname(pathname: string): string {
  let path = pathname.trim();
  if (!path.startsWith("/")) path = `/${path}`;
  path = path.replace(/\/{2,}/g, "/");
  if (path.length > 1) path = path.replace(/\/+$/, "");
  return path || "/";
}

export function sanitizeAnalyticsPath(location: AnalyticsLocationLike): string | null {
  const safePath = normalizePathname(location.pathname || "/");
  return APPROVED_MARKETING_PATHS.has(safePath) ? safePath : null;
}

export function isAnalyticsRouteAllowed(location: AnalyticsLocationLike): boolean {
  return sanitizeAnalyticsPath(location) !== null;
}

export function getSafePageTitle(path: string): string | undefined {
  return SAFE_PAGE_TITLES[path];
}

export function getApprovedMarketingPaths(): readonly string[] {
  return [...APPROVED_MARKETING_PATHS];
}

