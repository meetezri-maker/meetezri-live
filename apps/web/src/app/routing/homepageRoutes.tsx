import { lazy, type ReactElement } from "react";
import { Navigate } from "react-router-dom";

const Landing = lazy(() =>
  import("@/app/pages/Landing").then((module) => ({ default: module.Landing })),
);
const EarlyAccess = lazy(() =>
  import("@/app/pages/EarlyAccess").then((module) => ({ default: module.EarlyAccess })),
);

interface HomepageRouteElement {
  path: "/" | "/home" | "/early-access";
  element: ReactElement;
}

/**
 * The public homepage boundary shared by the application router and focused
 * routing tests. The deployment redirect remains authoritative for direct
 * `/home` requests; Navigate is the client-side fallback after the SPA loads.
 */
export const HOMEPAGE_ROUTE_ELEMENTS: readonly HomepageRouteElement[] = [
  { path: "/", element: <Landing /> },
  { path: "/home", element: <Navigate to="/" replace /> },
  { path: "/early-access", element: <EarlyAccess /> },
];
