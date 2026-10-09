/** Framework-neutral metadata for the fixed public marketing and legal routes. */
export const PUBLIC_SITE_ORIGIN = 'https://www.talktosolace2.ai' as const;
export const PUBLIC_SOCIAL_IMAGE_PATH = '/community/hero-lake.jpg' as const;

export const PUBLIC_ROUTE_PATHS = [
  '/', '/how-it-works', '/pricing', '/privacy', '/terms', '/early-access',
] as const;
export type PublicRoutePath = (typeof PUBLIC_ROUTE_PATHS)[number];
export type PublicRobotsPolicy = 'index,follow' | 'noindex,follow';
export type PublicStructuredDataDescriptor =
  | { kind: 'web-page' }
  | { kind: 'breadcrumb'; items: readonly { name: string; path?: PublicRoutePath }[] };

export interface PublicSeoDefinition {
  path: PublicRoutePath;
  title: string;
  description: string;
  canonicalPath: PublicRoutePath;
  canonicalUrl: string;
  indexable: boolean;
  robots: PublicRobotsPolicy;
  openGraph: {
    title: string;
    description: string;
    url: string;
    type: 'website';
    image?: string;
  };
  twitter: {
    card: 'summary' | 'summary_large_image';
    title: string;
    description: string;
    image?: string;
  };
  structuredData: readonly PublicStructuredDataDescriptor[];
  sitemap?: { changeFrequency: 'weekly' | 'monthly'; priority: string };
}

type Input = Pick<PublicSeoDefinition,
  'path' | 'title' | 'description' | 'indexable' | 'robots' | 'structuredData' | 'sitemap'>;

function absolute(path: PublicRoutePath | typeof PUBLIC_SOCIAL_IMAGE_PATH): string {
  return new URL(path, `${PUBLIC_SITE_ORIGIN}/`).toString();
}

function define(input: Input): PublicSeoDefinition {
  const canonicalUrl = absolute(input.path);
  const image = absolute(PUBLIC_SOCIAL_IMAGE_PATH);
  return {
    ...input,
    canonicalPath: input.path,
    canonicalUrl,
    openGraph: {
      title: input.title, description: input.description, url: canonicalUrl, type: 'website', image,
    },
    twitter: {
      card: 'summary_large_image', title: input.title, description: input.description, image,
    },
  };
}

/** Privacy remains noindex until its visible legal placeholders are resolved. */
export const PUBLIC_SEO_REGISTRY: readonly PublicSeoDefinition[] = [
  define({
    path: '/',
    title: 'A Place to Talk Through What You’re Carrying | Solace',
    description: 'Solace is a place where people can talk through what they’re carrying, express what is on their mind, and reflect at their own pace.',
    indexable: true,
    robots: 'index,follow',
    structuredData: [{ kind: 'web-page' }],
    sitemap: { changeFrequency: 'weekly', priority: '1.0' },
  }),
  define({
    path: '/how-it-works',
    title: 'How Solace Gives You Somewhere to Start | Solace',
    description: 'You do not need the perfect words. See how Solace gives you somewhere to start, talk naturally, and reflect at your own pace.',
    indexable: true,
    robots: 'index,follow',
    structuredData: [
      { kind: 'web-page' },
      { kind: 'breadcrumb', items: [{ name: 'Home', path: '/' }, { name: 'How It Works' }] },
    ],
    sitemap: { changeFrequency: 'monthly', priority: '0.8' },
  }),
  define({
    path: '/pricing',
    title: 'Membership and Pricing | Solace',
    description: 'Explore Solace membership options, included conversation time, and the plan that best fits how you want to use Solace.',
    indexable: true,
    robots: 'index,follow',
    structuredData: [
      { kind: 'web-page' },
      { kind: 'breadcrumb', items: [{ name: 'Home', path: '/' }, { name: 'Pricing' }] },
    ],
    sitemap: { changeFrequency: 'monthly', priority: '0.8' },
  }),
  define({
    path: '/privacy',
    title: 'Privacy Policy | Solace',
    description: 'Read the Solace Privacy Policy for information about how the Services collect, use, store, process, disclose, protect, and handle information.',
    indexable: false,
    robots: 'noindex,follow',
    structuredData: [],
  }),
  define({
    path: '/terms',
    title: 'Terms and Conditions | Solace',
    description: 'Read the terms governing access to and use of Solace, including account responsibilities, subscriptions, privacy, and service limitations.',
    indexable: true,
    robots: 'index,follow',
    structuredData: [
      { kind: 'web-page' },
      { kind: 'breadcrumb', items: [{ name: 'Home', path: '/' }, { name: 'Terms and Conditions' }] },
    ],
    sitemap: { changeFrequency: 'monthly', priority: '0.3' },
  }),
  define({
    path: '/early-access',
    title: 'Join the Solace Founding Circle | Early Access',
    description: 'Join the Solace Founding Circle and be among the first to experience a place for meaningful conversation and everyday reflection.',
    indexable: false,
    robots: 'noindex,follow',
    structuredData: [],
  }),
] as const;

const byPath = new Map<PublicRoutePath, PublicSeoDefinition>(
  PUBLIC_SEO_REGISTRY.map((definition) => [definition.path, definition])
);

export function isPublicRoutePath(pathname: string): pathname is PublicRoutePath {
  return byPath.has(pathname as PublicRoutePath);
}

/** Exact lookup only. Unknown paths return undefined, never homepage metadata. */
export function getPublicSeo(pathname: string): PublicSeoDefinition | undefined {
  return byPath.get(pathname as PublicRoutePath);
}

export function validatePublicSeoRegistry(
  registry: readonly PublicSeoDefinition[] = PUBLIC_SEO_REGISTRY
): void {
  const unique = (values: readonly string[], label: string) => {
    if (new Set(values).size !== values.length) throw new Error(`Duplicate public SEO ${label}`);
  };
  unique(registry.map((entry) => entry.path), 'path');
  unique(registry.map((entry) => entry.canonicalUrl), 'canonical ownership');
  const indexable = registry.filter((entry) => entry.indexable);
  unique(indexable.map((entry) => entry.title), 'title');
  unique(indexable.map((entry) => entry.description), 'description');
  for (const entry of registry) {
    if (entry.canonicalUrl !== absolute(entry.canonicalPath)) {
      throw new Error(`Untrusted canonical for ${entry.path}`);
    }
    if (!entry.indexable && !entry.robots.startsWith('noindex')) {
      throw new Error(`Non-indexable route ${entry.path} must use noindex`);
    }
  }
  const earlyAccess = registry.find((entry) => entry.path === '/early-access');
  if (!earlyAccess || earlyAccess.indexable || earlyAccess.robots !== 'noindex,follow') {
    throw new Error('Early Access must remain noindex,follow');
  }
}

validatePublicSeoRegistry();
