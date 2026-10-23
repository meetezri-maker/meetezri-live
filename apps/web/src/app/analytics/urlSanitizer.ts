import { PUBLIC_ROUTE_PATHS } from "@meetezri/public-content";

export interface AnalyticsLocationLike {
  pathname: string;
  search?: string;
  hash?: string;
}

const APPROVED_MARKETING_PATHS = new Set([
  ...PUBLIC_ROUTE_PATHS,
  "/home",
  "/resources",
  "/login",
  "/signup",
  "/verify-email",
]);

const SAFE_PAGE_TITLES: Record<string, string> = {
  "/": "Solace Early Access",
  "/home": "Solace Home",
  "/how-it-works": "How It Works",
  "/talk-it-out": "Talk It Out",
  "/about": "About Solace",
  "/safety": "Safety and Support",
  "/early-access": "Solace Early Access",
  "/privacy": "Privacy",
  "/terms": "Terms",
  "/pricing": "Pricing",
  "/login": "Login",
  "/resources": "Resources",
  "/signup": "Signup",
  "/verify-email": "Verify Email",
};

const PUBLIC_RESOURCE_PATH = /^\/resources\/([a-z0-9]+(?:-[a-z0-9]+)*)$/;
const SENSITIVE_RESOURCE_SLUG_PARTS =
  /(?:access-token|refresh-token|session-id|conversation-id|user-id|email|transcript)/;
const IDENTIFIER_SHAPED_RESOURCE_SLUG =
  /^(?:\d{6,}|[a-f0-9]{24,}|[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12})$/i;

function isPublicResourcePath(path: string): boolean {
  const match = PUBLIC_RESOURCE_PATH.exec(path);
  if (!match) return false;

  const slug = match[1];
  return !SENSITIVE_RESOURCE_SLUG_PARTS.test(slug)
    && !IDENTIFIER_SHAPED_RESOURCE_SLUG.test(slug);
}

function normalizePathname(pathname: string): string {
  let path = pathname.trim();
  if (!path.startsWith("/")) path = `/${path}`;
  path = path.replace(/\/{2,}/g, "/");
  if (path.length > 1) path = path.replace(/\/+$/, "");
  return path || "/";
}

export function sanitizeAnalyticsPath(location: AnalyticsLocationLike): string | null {
  const safePath = normalizePathname(location.pathname || "/");
  return APPROVED_MARKETING_PATHS.has(safePath) || isPublicResourcePath(safePath)
    ? safePath
    : null;
}

export function isAnalyticsRouteAllowed(location: AnalyticsLocationLike): boolean {
  return sanitizeAnalyticsPath(location) !== null;
}

export function getSafePageTitle(path: string): string | undefined {
  return SAFE_PAGE_TITLES[path] ?? (isPublicResourcePath(path) ? "Resource" : undefined);
}

export function getApprovedMarketingPaths(): readonly string[] {
  return [...APPROVED_MARKETING_PATHS];
}

