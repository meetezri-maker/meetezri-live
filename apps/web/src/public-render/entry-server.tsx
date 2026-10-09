import type { ComponentType } from 'react';
import { renderToString } from 'react-dom/server';
import {
  PUBLIC_ROUTE_PATHS,
  getPublicSeo,
  isPublicRoutePath,
  type PublicRoutePath,
} from '@meetezri/public-content';
import { PUBLIC_ARTIFACT_PATHS } from '@/app/routing/publicRouteManifest';
import { Landing } from '@/app/pages/Landing';
import { HowItWorks } from '@/app/pages/HowItWorks';
import { Pricing } from '@/app/pages/Pricing';
import { Privacy } from '@/app/pages/Privacy';
import { Terms } from '@/app/pages/Terms';
import { EarlyAccess } from '@/app/pages/EarlyAccess';
import { PublicMarketingApp } from './PublicMarketingApp';
import { renderPublicDocument, type PublicAssets } from './renderDocument';

const pages = {
  '/': Landing,
  '/how-it-works': HowItWorks,
  '/pricing': Pricing,
  '/privacy': Privacy,
  '/terms': Terms,
  '/early-access': EarlyAccess,
} satisfies Record<PublicRoutePath, ComponentType>;

export const prerenderRoutes = PUBLIC_ROUTE_PATHS;
export const prerenderArtifacts = PUBLIC_ARTIFACT_PATHS;
export { getPublicSeo };

export function renderPublicRoute(pathname: string): string {
  if (!isPublicRoutePath(pathname)) throw new Error(`Cannot prerender unknown public path: ${pathname}`);
  if (!getPublicSeo(pathname)) throw new Error(`Missing public metadata for: ${pathname}`);
  const Page = pages[pathname];
  return renderToString(<PublicMarketingApp Page={Page} pathname={pathname} mode="server" />);
}

export function renderPublicHtml(pathname: string, assets: PublicAssets): string {
  const definition = getPublicSeo(pathname);
  if (!definition) throw new Error(`Missing public metadata for: ${pathname}`);
  return renderPublicDocument(definition, renderPublicRoute(pathname), assets);
}
