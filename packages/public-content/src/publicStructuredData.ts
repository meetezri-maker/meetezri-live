import {
  PUBLIC_SITE_ORIGIN,
  type PublicSeoDefinition,
  type PublicStructuredDataDescriptor,
} from './publicSeo';

type JsonDocument = Record<string, unknown>;

export const PUBLIC_ORGANIZATION_ID = `${PUBLIC_SITE_ORIGIN}/#organization` as const;
export const PUBLIC_WEBSITE_ID = `${PUBLIC_SITE_ORIGIN}/#website` as const;

function compact(input: JsonDocument): JsonDocument {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined && value !== null && value !== '')
  );
}

function organization(): JsonDocument {
  return {
    '@type': 'Organization',
    '@id': PUBLIC_ORGANIZATION_ID,
    name: 'Solace',
    url: `${PUBLIC_SITE_ORIGIN}/`,
  };
}

function website(): JsonDocument {
  return {
    '@type': 'WebSite',
    '@id': PUBLIC_WEBSITE_ID,
    name: 'Solace',
    url: `${PUBLIC_SITE_ORIGIN}/`,
    publisher: { '@id': PUBLIC_ORGANIZATION_ID },
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
  const graph = definition.structuredData.map((descriptor) => {
    switch (descriptor.kind) {
      case 'organization': return organization();
      case 'website': return website();
      case 'web-page': return webPage(definition, descriptor);
      case 'breadcrumb': return breadcrumb(descriptor);
    }
  });
  return graph.length > 0 ? [{ '@context': 'https://schema.org', '@graph': graph }] : [];
}

/** Safe for insertion into an application/ld+json script element. */
export function serialisePublicJsonLd(document: JsonDocument): string {
  return JSON.stringify(document).replace(/</g, '\\u003c');
}
