/**
 * The HTML document shell for server-rendered public pages.
 *
 * `renderToStaticMarkup` rather than `renderToString`: this is a complete, self-describing
 * document, not a hydration root the API owns. The SPA takes over on the client by mounting into
 * `#root` — see `assetManifest.ts` for how it finds the current bundle and why the page is
 * correct without it.
 *
 * The stylesheet is inlined from `@meetezri/public-content`, so the page paints correctly on the
 * first byte with no render-blocking fetch and no flash of unstyled content. It is also the same
 * string the SPA injects, so server and client markup match exactly.
 */

import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactNode } from 'react';
import { PUBLIC_CONTENT_CSS } from '@meetezri/public-content';
import type { PageMetadata } from './metadata';
import { serialiseJsonLd } from './structuredData';
import type { AssetLinks } from './assetManifest';

export interface DocumentInput {
  metadata: PageMetadata;
  structuredData: Array<Record<string, unknown>>;
  assets: AssetLinks;
  children: ReactNode;
}

function MetaTags({ metadata }: { metadata: PageMetadata }) {
  return (
    <>
      {metadata.tags.map((tag, index) => {
        if (tag.kind === 'link') {
          return <link key={index} rel={tag.key} href={tag.value} />;
        }
        if (tag.kind === 'property') {
          return <meta key={index} property={tag.key} content={tag.value} />;
        }
        return <meta key={index} name={tag.key} content={tag.value} />;
      })}
    </>
  );
}

export function renderDocument({
  metadata,
  structuredData,
  assets,
  children,
}: DocumentInput): string {
  const markup = renderToStaticMarkup(
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{metadata.title}</title>
        <MetaTags metadata={metadata} />

        {assets.styles.map((href) => (
          <link key={href} rel="stylesheet" href={href} />
        ))}
        <style
          // Not user content: a constant exported by `@meetezri/public-content`. It is the only
          // `dangerouslySetInnerHTML` in the public render path, and it exists because a <style>
          // element's children must not be React-escaped.
          dangerouslySetInnerHTML={{ __html: PUBLIC_CONTENT_CSS }}
        />

        {structuredData.map((document, index) => (
          <script
            key={index}
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: serialiseJsonLd(document) }}
          />
        ))}
      </head>
      <body>
        <div id="root">{children}</div>
        {assets.scripts.map((src) => (
          <script key={src} type="module" src={src} defer />
        ))}
      </body>
    </html>
  );

  return `<!doctype html>${markup}`;
}
