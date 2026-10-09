import {
  PUBLIC_SITE_ORIGIN,
  type PublicSeoDefinition,
  type PublicStructuredDataDescriptor,
} from './publicSeo';

type JsonDocument = Record<string, unknown>;

function compact(input: JsonDocument): JsonDocument {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined && value !== null && value !== '')
  );
}

function webPage(definition: PublicSeoDefinition): JsonDocument {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: definition.title,
    description: definition.description,
    url: definition.canonicalUrl,
    inLanguage: 'en',
  };
}

function breadcrumb(
  descriptor: Extract<PublicStructuredDataDescriptor, { kind: 'breadcrumb' }>
): JsonDocument {
  return {
    '@context': 'https://schema.org',
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
  return definition.structuredData.map((descriptor) =>
    descriptor.kind === 'web-page' ? webPage(definition) : breadcrumb(descriptor)
  );
}

/** Safe for insertion into an application/ld+json script element. */
export function serialisePublicJsonLd(document: JsonDocument): string {
  return JSON.stringify(document).replace(/</g, '\\u003c');
}
