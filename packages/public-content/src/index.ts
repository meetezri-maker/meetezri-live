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
