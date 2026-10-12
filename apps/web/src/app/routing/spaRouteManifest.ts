import manifest from './spaRouteManifest.json';

export const SPA_ROUTE_MANIFEST = manifest;

function dynamicRoutePattern(route: string): RegExp {
  const source = route
    .split('/')
    .map((segment) =>
      segment.startsWith(':')
        ? '[^/]+'
        : segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    )
    .join('/');
  return new RegExp(`^${source}$`);
}

const exactRoutes = new Set<string>(manifest.exactRoutes);
const dynamicRoutes = manifest.dynamicRoutes.map(dynamicRoutePattern);

export function isSpaRoute(pathname: string): boolean {
  return exactRoutes.has(pathname)
    || manifest.prefixRoutes.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    )
    || dynamicRoutes.some((pattern) => pattern.test(pathname));
}
