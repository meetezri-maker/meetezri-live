/**
 * `@meetezri/public-content` — the single implementation of public Content Hub rendering.
 *
 * Consumed by:
 *   - `apps/web` public Resources pages (SPA + hydration)
 *   - `apps/web` admin preview (so the preview shows exactly what a reader will see)
 *   - `apps/api` runtime server renderer
 *
 * Everything exported here is pure, deterministic and SSR-safe. The package tsconfig omits the
 * DOM lib, so a browser global cannot compile.
 */

export type {
  Crumb,
  ResourcesLibraryProps,
} from './components';

export type {
  PublicBlock,
  PublicBody,
  PublicInline,
  PublicLabel,
  PublicPerson,
  PublicResource,
  PublicResourceCard,
  PublicResourceLink,
  PublicResourceList,
  PublicSpan,
  PublicTypeFields,
} from './types';

export { Inline, PublicBlocks, headingAnchorId, inlineText } from './blocks';

export {
  Breadcrumbs,
  ContextualResourceLinks,
  Byline,
  RelatedResources,
  ResourceArticle,
  ResourceCard,
  ResourcesLibrary,
} from './components';

export {
  absoluteUrl,
  anchorFromText,
  formatPublicDate,
  formatReadingTime,
  resourcePath,
  toIsoDate,
} from './format';

export { PUBLIC_CONTENT_CSS } from './styles';

export {
  PublicSiteHeader,
  PublicSiteFooter,
  SsrMobileMenu,
  PUBLIC_BRAND_LOGO_ON_DARK_PATH,
  PUBLIC_BRAND_LOGO_ON_LIGHT_PATH,
  PUBLIC_FAVICON_SVG_PATH,
  PUBLIC_FAVICON_PNG_PATH,
  SITE_NAV_LINKS,
  SITE_NAV_ACTIONS,
  SITE_FOOTER_COLUMNS,
  SITE_FOOTER_TAGLINE,
  SITE_FOOTER_COPYRIGHT_YEAR,
  SITE_FOOTER_DISCLAIMER,
} from './siteShell';

export type {
  ShellLink,
  PublicSiteHeaderProps,
  PublicSiteFooterProps,
} from './siteShell';


export {
  PUBLIC_ROUTE_PATHS,
  PUBLIC_SEO_REGISTRY,
  PUBLIC_SITE_ORIGIN,
  PUBLIC_SOCIAL_IMAGE_PATH,
  getPublicSeo,
  isPublicRoutePath,
  validatePublicSeoRegistry,
} from './publicSeo';

export type {
  PublicRoutePath,
  PublicRobotsPolicy,
  PublicSeoDefinition,
  PublicStructuredDataDescriptor,
} from './publicSeo';

export {
  PUBLIC_ORGANIZATION_ID,
  PUBLIC_WEBSITE_ID,
  buildPublicStructuredData,
  serialisePublicJsonLd,
} from './publicStructuredData';
