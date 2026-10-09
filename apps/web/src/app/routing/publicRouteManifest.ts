import type { ComponentType } from 'react';
import {
  PUBLIC_ROUTE_PATHS,
  type PublicRoutePath,
} from '@meetezri/public-content';

export interface PublicRouteModule {
  default: ComponentType;
}

const loaders: Record<PublicRoutePath, () => Promise<PublicRouteModule>> = {
  '/': () => import('@/app/pages/Landing').then(({ Landing }) => ({ default: Landing })),
  '/how-it-works': () =>
    import('@/app/pages/HowItWorks').then(({ HowItWorks }) => ({ default: HowItWorks })),
  '/pricing': () => import('@/app/pages/Pricing').then(({ Pricing }) => ({ default: Pricing })),
  '/privacy': () => import('@/app/pages/Privacy').then(({ Privacy }) => ({ default: Privacy })),
  '/terms': () => import('@/app/pages/Terms').then(({ Terms }) => ({ default: Terms })),
  '/early-access': () =>
    import('@/app/pages/EarlyAccess').then(({ EarlyAccess }) => ({ default: EarlyAccess })),
};

export const PUBLIC_ARTIFACT_PATHS: Record<PublicRoutePath, string> = {
  '/': '_public/home.html',
  '/how-it-works': '_public/how-it-works.html',
  '/pricing': '_public/pricing.html',
  '/privacy': '_public/privacy.html',
  '/terms': '_public/terms.html',
  '/early-access': '_public/early-access.html',
};

export const PUBLIC_ROUTE_MANIFEST = PUBLIC_ROUTE_PATHS.map((path) => ({
  path,
  artifact: PUBLIC_ARTIFACT_PATHS[path],
  load: loaders[path],
}));

export function loadPublicRoute(path: PublicRoutePath): Promise<PublicRouteModule> {
  return loaders[path]();
}
