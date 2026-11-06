import {
  PUBLIC_SITE_ORIGIN,
  type PublicSeoDefinition,
  type PublicStructuredDataDescriptor,
} from './publicSeo';
import { PUBLIC_BRAND_LOGO_ON_DARK_PATH } from './siteShell';

type JsonDocument = Record<string, unknown>;

function publicRoot(origin: string): string {
  return new URL('/', origin).toString();
}

export function publicOrganizationId(origin: string = PUBLIC_SITE_ORIGIN): string {
  return new URL('/#organization', publicRoot(origin)).toString();
}

export function publicWebsiteId(origin: string = PUBLIC_SITE_ORIGIN): string {
  return new URL('/#website', publicRoot(origin)).toString();
}

export const PUBLIC_ORGANIZATION_ID = publicOrganizationId();
export const PUBLIC_WEBSITE_ID = publicWebsiteId();

function compact(input: JsonDocument): JsonDocument {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined && value !== null && value !== '')
  );
}

export function buildSolaceOrganization(origin: string = PUBLIC_SITE_ORIGIN): JsonDocument {
  const root = publicRoot(origin);
  return {
    '@type': 'Organization',
    '@id': publicOrganizationId(root),
    name: 'Solace',
    url: root,
    logo: new URL(PUBLIC_BRAND_LOGO_ON_DARK_PATH, root).toString(),
  };
}

export function buildSolaceWebsite(origin: string = PUBLIC_SITE_ORIGIN): JsonDocument {
  const root = publicRoot(origin);
  return {
    '@type': 'WebSite',
    '@id': publicWebsiteId(root),
    name: 'Solace',
    url: root,
    publisher: { '@id': publicOrganizationId(root) },
  };
}

function webPage(
  definition: PublicSeoDefinition,
  descriptor: Extract<PublicStructuredDataDescriptor, { kind: 'web-page' }>
): JsonDocument {
  return compact({
    '@type': descriptor.pageType ?? 'WebPage',
    '@id': `${definition.canonicalUrl}#webpage`,
    name: definition.title,
    description: definition.description,
    url: definition.canonicalUrl,
    inLanguage: 'en',
    isPartOf: { '@id': PUBLIC_WEBSITE_ID },
    about: descriptor.aboutOrganization ? { '@id': PUBLIC_ORGANIZATION_ID } : undefined,
  });
}

function breadcrumb(
  descriptor: Extract<PublicStructuredDataDescriptor, { kind: 'breadcrumb' }>
): JsonDocument {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: descriptor.items.map((item, index) =>
      compact({
        '@type': 'ListItem',
        position: index + 1,
        name: item.name,
        item: item.path ? new URL(item.path, `${PUBLIC_SITE_ORIGIN}/`).toString() : undefined,
      })
    ),
  };
}

export function buildPublicStructuredData(definition: PublicSeoDefinition): JsonDocument[] {
  if (!definition.indexable) return [];
  const graph: JsonDocument[] = [buildSolaceOrganization(), buildSolaceWebsite()];
  for (const descriptor of definition.structuredData) {
    switch (descriptor.kind) {
      // Organization and WebSite are always emitted once for every indexable fixed page.
      case 'organization':
      case 'website':
        break;
      case 'web-page':
        graph.push(webPage(definition, descriptor));
        break;
      case 'breadcrumb':
        graph.push(breadcrumb(descriptor));
        break;
    }
  }
  return graph.length > 0 ? [{ '@context': 'https://schema.org', '@graph': graph }] : [];
}

/** Safe for insertion into an application/ld+json script element. */
export function serialisePublicJsonLd(document: JsonDocument): string {
  return JSON.stringify(document).replace(/</g, '\\u003c');
}
