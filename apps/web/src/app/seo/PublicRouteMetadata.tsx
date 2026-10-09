import { useEffect } from 'react';
import { useLocation } from 'react-router';
import {
  buildPublicStructuredData,
  getPublicSeo,
  serialisePublicJsonLd,
  type PublicSeoDefinition,
} from '@meetezri/public-content';

const MARKER = 'data-solace-public-seo';

function upsert(selector: string, tag: 'meta' | 'link', attributes: Record<string, string>) {
  let element = document.head.querySelector<HTMLElement>(selector);
  if (!element) {
    element = document.createElement(tag);
    document.head.appendChild(element);
  }
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  element.setAttribute(MARKER, 'true');
}

function removePublicHead() {
  document.head.querySelectorAll(`[${MARKER}="true"]`).forEach((element) => element.remove());
}

export function applyPrivateMetadata() {
  removePublicHead();
  document.title = 'Solace';
  upsert('meta[name="robots"]', 'meta', { name: 'robots', content: 'noindex,nofollow' });
}

export function applyPublicMetadata(definition: PublicSeoDefinition) {
  removePublicHead();
  document.title = definition.title;
  upsert('meta[name="description"]', 'meta', {
    name: 'description',
    content: definition.description,
  });
  upsert('link[rel="canonical"]', 'link', {
    rel: 'canonical',
    href: definition.canonicalUrl,
  });
  upsert('meta[name="robots"]', 'meta', { name: 'robots', content: definition.robots });
  upsert('meta[property="og:type"]', 'meta', {
    property: 'og:type',
    content: definition.openGraph.type,
  });
  upsert('meta[property="og:title"]', 'meta', {
    property: 'og:title',
    content: definition.openGraph.title,
  });
  upsert('meta[property="og:description"]', 'meta', {
    property: 'og:description',
    content: definition.openGraph.description,
  });
  upsert('meta[property="og:url"]', 'meta', {
    property: 'og:url',
    content: definition.openGraph.url,
  });
  if (definition.openGraph.image) {
    upsert('meta[property="og:image"]', 'meta', {
      property: 'og:image',
      content: definition.openGraph.image,
    });
  }
  upsert('meta[name="twitter:card"]', 'meta', {
    name: 'twitter:card',
    content: definition.twitter.card,
  });
  upsert('meta[name="twitter:title"]', 'meta', {
    name: 'twitter:title',
    content: definition.twitter.title,
  });
  upsert('meta[name="twitter:description"]', 'meta', {
    name: 'twitter:description',
    content: definition.twitter.description,
  });
  if (definition.twitter.image) {
    upsert('meta[name="twitter:image"]', 'meta', {
      name: 'twitter:image',
      content: definition.twitter.image,
    });
  }

  for (const document of buildPublicStructuredData(definition)) {
    const script = window.document.createElement('script');
    script.type = 'application/ld+json';
    script.setAttribute(MARKER, 'true');
    script.textContent = serialisePublicJsonLd(document);
    window.document.head.appendChild(script);
  }
}

export function PublicRouteMetadata() {
  const { pathname } = useLocation();
  useEffect(() => {
    const definition = getPublicSeo(pathname);
    if (definition) applyPublicMetadata(definition);
    else applyPrivateMetadata();
  }, [pathname]);
  return null;
}
