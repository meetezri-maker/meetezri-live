import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';

const dist = path.resolve(import.meta.dirname, '..', 'dist');
const host = process.env.HOST ?? '127.0.0.1';
const port = Number(process.env.PORT ?? 4173);
const publicArtifacts = new Map([
  ['/', '_public/home.html'],
  ['/how-it-works', '_public/how-it-works.html'],
  ['/pricing', '_public/pricing.html'],
  ['/privacy', '_public/privacy.html'],
  ['/terms', '_public/terms.html'],
  ['/early-access', '_public/early-access.html'],
]);
const privateRoute = /^\/(?:login|signup|verify-email|forgot-password|reset-password)(?:\/|$)|^\/(?:auth|invite|onboarding|app|admin|profile|error|dev)(?:\/|$)/;
const mimeTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.woff2', 'font/woff2'],
  ['.mp4', 'video/mp4'],
]);

function safeDistPath(relativePath) {
  const resolved = path.resolve(dist, relativePath);
  if (resolved !== dist && !resolved.startsWith(`${dist}${path.sep}`)) {
    throw new Error('Path escaped the build output');
  }
  return resolved;
}

async function sendFile(request, response, relativePath, extraHeaders = {}) {
  const filePath = safeDistPath(relativePath);
  const file = await stat(filePath);
  const headers = {
    'Content-Type': mimeTypes.get(path.extname(filePath).toLowerCase()) ?? 'application/octet-stream',
    'Content-Length': String(file.size),
    'Cache-Control': relativePath.startsWith('assets/')
      ? 'public, max-age=31536000, immutable'
      : 'no-store, max-age=0',
    ...extraHeaders,
  };
  response.writeHead(200, headers);
  if (request.method === 'HEAD') response.end();
  else createReadStream(filePath).pipe(response);
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? '/', `http://${host}:${port}`);
    const pathname = decodeURIComponent(url.pathname);

    if (pathname === '/home') {
      response.writeHead(308, { Location: '/' });
      response.end();
      return;
    }

    const publicArtifact = publicArtifacts.get(pathname);
    if (publicArtifact) {
      await sendFile(request, response, publicArtifact);
      return;
    }

    if (pathname.startsWith('/_public/')) {
      await sendFile(request, response, pathname.slice(1), {
        'X-Robots-Tag': 'noindex, nofollow, noarchive',
      });
      return;
    }

    const staticPath = pathname.replace(/^\//, '');
    if (staticPath && !privateRoute.test(pathname)) {
      try {
        await sendFile(request, response, staticPath);
        return;
      } catch (error) {
        if (error?.code !== 'ENOENT' && error?.code !== 'EISDIR') throw error;
      }
    }

    await sendFile(request, response, 'spa.html', privateRoute.test(pathname)
      ? { 'X-Robots-Tag': 'noindex, nofollow, noarchive' }
      : {});
  } catch (error) {
    response.writeHead(error?.code === 'ENOENT' ? 404 : 500, {
      'Content-Type': 'text/plain; charset=utf-8',
    });
    response.end(error instanceof Error ? error.message : 'Preview server error');
  }
});

server.listen(port, host, () => {
  console.log(`Prerender preview listening at http://${host}:${port}`);
});
