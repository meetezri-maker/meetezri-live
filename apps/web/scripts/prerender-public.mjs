import { readFile, writeFile, mkdir, copyFile, access } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const webRoot = path.resolve(import.meta.dirname, '..');
const dist = path.join(webRoot, 'dist');
const manifest = JSON.parse(await readFile(path.join(dist, '.vite', 'manifest.json'), 'utf8'));
const renderer = await import(pathToFileURL(path.join(webRoot, '.public-ssr', 'entry-server.js')));

const publicEntryKey = Object.keys(manifest).find(
  (key) => key.endsWith('/public-render/entry-client.tsx') && manifest[key].isEntry
);
if (!publicEntryKey) throw new Error('Public hydration entry is missing from the Vite manifest');

const seen = new Set();
const styles = new Set();
const imports = new Set();
function collect(key) {
  if (seen.has(key)) return;
  seen.add(key);
  const item = manifest[key];
  if (!item) throw new Error(`Missing Vite manifest entry: ${key}`);
  for (const css of item.css ?? []) styles.add(`/${css}`);
  for (const imported of item.imports ?? []) {
    const dependency = manifest[imported];
    if (!dependency?.file) throw new Error(`Missing imported Vite asset: ${imported}`);
    imports.add(`/${dependency.file}`);
    collect(imported);
  }
}
collect(publicEntryKey);

const entry = manifest[publicEntryKey];
const assets = {
  script: `/${entry.file}`,
  styles: [...styles].sort(),
  imports: [...imports].sort(),
};
if (assets.styles.length === 0) throw new Error('Public hydration entry emitted no production CSS');

async function requireAsset(publicPath) {
  await access(path.join(dist, publicPath.replace(/^\//, '')));
}
await requireAsset(assets.script);
for (const href of [...assets.styles, ...assets.imports]) await requireAsset(href);

const imagePath = path.join(dist, 'community', 'hero-lake.jpg');
const image = await readFile(imagePath);
if (image[0] !== 0xff || image[1] !== 0xd8 || image[2] !== 0xff) {
  throw new Error('The configured public social image is not a valid JPEG');
}

await copyFile(path.join(dist, 'index.html'), path.join(dist, 'spa.html'));
const spa = await readFile(path.join(dist, 'spa.html'), 'utf8');
if (!spa.includes('name="robots" content="noindex,nofollow"')) {
  throw new Error('spa.html must be noindex,nofollow');
}
for (const forbidden of ['rel="canonical"', 'property="og:url"', 'application/ld+json']) {
  if (spa.includes(forbidden)) throw new Error(`spa.html contains forbidden public metadata: ${forbidden}`);
}

await mkdir(path.join(dist, '_public'), { recursive: true });
for (const pathname of renderer.prerenderRoutes) {
  const definition = renderer.getPublicSeo(pathname);
  const artifact = renderer.prerenderArtifacts[pathname];
  if (!definition || !artifact) throw new Error(`Incomplete prerender definition for ${pathname}`);
  const html = renderer.renderPublicHtml(pathname, assets);

  const h1Count = (html.match(/<h1(?:\s|>)/g) ?? []).length;
  const linkCount = (html.match(/<a(?:\s|>)/g) ?? []).length;
  const text = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (h1Count !== 1) throw new Error(`${pathname} emitted ${h1Count} H1 elements`);
  if (linkCount < 1 || text.length < 500) throw new Error(`${pathname} lacks meaningful crawlable content`);
  if (!html.includes(assets.script) || !assets.styles.every((href) => html.includes(href))) {
    throw new Error(`${pathname} is missing required fingerprinted assets`);
  }
  if (definition.indexable && /\[(?:LEGAL|BUSINESS|PRIVACY|SUPPORT|INSERT|PERIOD|URL|PATH)/i.test(html)) {
    throw new Error(`${pathname} contains an unresolved placeholder while indexable`);
  }
  if (/access_token|refresh_token|currentUser|billingCustomerId/.test(html)) {
    throw new Error(`${pathname} contains private or session data`);
  }
  await writeFile(path.join(dist, artifact), html, 'utf8');
}

for (const artifact of Object.values(renderer.prerenderArtifacts)) {
  await access(path.join(dist, artifact));
}
console.log(`Prerendered ${renderer.prerenderRoutes.length} public routes with ${assets.styles.length} stylesheet(s).`);
