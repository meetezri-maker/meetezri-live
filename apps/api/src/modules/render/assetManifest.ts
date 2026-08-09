/**
 * Discovers the web app's current hashed bundle so a server-rendered page can hand off to the SPA.
 *
 * The web app and the API are two separate Vercel projects, so the API cannot read the web build
 * output from disk. Instead it fetches the web origin's `index.html` once, scrapes the entry
 * `<script type="module">` and `<link rel="stylesheet">` tags, and caches the result.
 *
 * THE PAGE IS CORRECT WITHOUT THIS. Every requirement that matters — the H1, body text, links,
 * metadata, canonical, JSON-LD — is already in the server-rendered HTML with its own inlined
 * stylesheet. The bundle only adds client-side navigation. So the failure mode is deliberately
 * chosen: on any error, timeout or non-200, return no assets and serve a fully functional static
 * page rather than blocking the response or emitting a broken script tag.
 *
 * This is why crawlability never depends on a second network hop.
 */

export interface AssetLinks {
  scripts: string[];
  styles: string[];
}

const EMPTY: AssetLinks = { scripts: [], styles: [] };

/** Cached across warm invocations. Short enough that a redeploy is picked up quickly. */
const CACHE_TTL_MS = 5 * 60 * 1000;
const FETCH_TIMEOUT_MS = 1500;

let cached: { at: number; assets: AssetLinks } | null = null;

/** Test seam — resets memoisation between cases. */
export function resetAssetManifestCache(): void {
  cached = null;
}

const SCRIPT_RE = /<script[^>]+type="module"[^>]*src="([^"]+)"[^>]*>/gi;
const STYLE_RE = /<link[^>]+rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/gi;

/** Only same-origin absolute paths are accepted — never a URL the fetched page could redirect to. */
function collect(html: string, pattern: RegExp): string[] {
  const found: string[] = [];
  let match: RegExpExecArray | null;
  pattern.lastIndex = 0;
  while ((match = pattern.exec(html)) !== null) {
    const href = match[1];
    if (href.startsWith('/') && !href.startsWith('//')) found.push(href);
  }
  return found;
}

export function parseAssets(html: string): AssetLinks {
  return { scripts: collect(html, SCRIPT_RE), styles: collect(html, STYLE_RE) };
}

export async function loadAssetManifest(webOrigin: string | undefined): Promise<AssetLinks> {
  if (!webOrigin) return EMPTY;

  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.assets;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let html: string;
    try {
      const response = await fetch(`${webOrigin.replace(/\/+$/, '')}/index.html`, {
        signal: controller.signal,
      });
      if (!response.ok) {
        cached = { at: Date.now(), assets: EMPTY };
        return EMPTY;
      }
      html = await response.text();
    } finally {
      clearTimeout(timer);
    }

    const assets = parseAssets(html);
    cached = { at: Date.now(), assets };
    return assets;
  } catch {
    // Cache the failure briefly too, so a slow or down web origin cannot add 1.5s to every
    // resource request.
    cached = { at: Date.now(), assets: EMPTY };
    return EMPTY;
  }
}
