import {
  buildPublicStructuredData,
  serialisePublicJsonLd,
  type PublicSeoDefinition,
} from '@meetezri/public-content';

export interface PublicAssets {
  script: string;
  styles: readonly string[];
  imports: readonly string[];
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function meta(name: string, content: string, property = false): string {
  return `<meta ${property ? 'property' : 'name'}="${escapeHtml(name)}" content="${escapeHtml(content)}" data-solace-public-seo="true">`;
}

export function renderPublicDocument(
  definition: PublicSeoDefinition,
  appMarkup: string,
  assets: PublicAssets
): string {
  const structuredData = buildPublicStructuredData(definition)
    .map((document) => `<script type="application/ld+json" data-solace-public-seo="true">${serialisePublicJsonLd(document)}</script>`)
    .join('');
  const styles = assets.styles.map((href) => `<link rel="stylesheet" href="${escapeHtml(href)}">`).join('');
  const imports = assets.imports.map((href) => `<link rel="modulepreload" href="${escapeHtml(href)}">`).join('');
  const ogImage = definition.openGraph.image
    ? meta('og:image', definition.openGraph.image, true)
    : '';
  const twitterImage = definition.twitter.image
    ? meta('twitter:image', definition.twitter.image)
    : '';

  return `<!doctype html>
<html lang="en" data-ezri-theme="dark" data-theme="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="icon" type="image/svg+xml" href="/favicon/icon.svg" sizes="any">
<link rel="icon" type="image/png" sizes="954x954" href="/favicon/Black.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&display=swap" rel="stylesheet">
<title>${escapeHtml(definition.title)}</title>
${meta('description', definition.description)}
<link rel="canonical" href="${escapeHtml(definition.canonicalUrl)}" data-solace-public-seo="true">
${meta('robots', definition.robots)}
${meta('og:type', definition.openGraph.type, true)}
${meta('og:title', definition.openGraph.title, true)}
${meta('og:description', definition.openGraph.description, true)}
${meta('og:url', definition.openGraph.url, true)}
${ogImage}
${meta('twitter:card', definition.twitter.card)}
${meta('twitter:title', definition.twitter.title)}
${meta('twitter:description', definition.twitter.description)}
${twitterImage}
${structuredData}
${imports}
${styles}
<noscript><style>#root [style*="opacity:0"]{opacity:1!important;transform:none!important}</style></noscript>
</head>
<body>
<div id="root">${appMarkup}</div>
<script type="module" src="${escapeHtml(assets.script)}"></script>
</body>
</html>
`;
}
