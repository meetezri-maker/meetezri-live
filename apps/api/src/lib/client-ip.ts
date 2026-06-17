import type { FastifyRequest } from 'fastify';

const IP_HEADER_NAMES = [
  'x-real-ip',
  'x-vercel-proxied-for',
  'x-vercel-forwarded-for',
  'x-forwarded-for',
  'cf-connecting-ip',
  'true-client-ip',
] as const;

function firstIp(value: string | string[] | undefined): string | null {
  if (!value) return null;
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw?.trim()) return null;
  const ip = raw.split(',')[0]?.trim();
  return ip || null;
}

function readHeader(request: FastifyRequest, name: string): string | null {
  const fromFastify = firstIp(request.headers[name] as string | string[] | undefined);
  if (fromFastify) return fromFastify;

  const rawHeaders = (request.raw as { headers?: Record<string, string | string[] | undefined> })
    ?.headers;
  if (!rawHeaders) return null;

  return firstIp(rawHeaders[name] ?? rawHeaders[name.toLowerCase()]);
}

/**
 * Best-effort client IP from proxy headers (Vercel, load balancers) or the socket.
 * Vercel sets `x-real-ip` (primary), plus `x-vercel-forwarded-for` / `x-vercel-proxied-for`.
 */
export function getClientIp(request: FastifyRequest): string | null {
  for (const name of IP_HEADER_NAMES) {
    const ip = readHeader(request, name);
    if (ip) return ip;
  }

  const socketIp = request.ip?.trim();
  if (socketIp && socketIp !== '127.0.0.1' && socketIp !== '::1') {
    return socketIp;
  }

  return null;
}

/**
 * ISO 3166-1 alpha-2 country code from Vercel / common CDN headers.
 */
export function getCountryCodeFromRequest(request: FastifyRequest): string | null {
  const vercelCountry = readHeader(request, 'x-vercel-ip-country');
  if (vercelCountry && vercelCountry !== 'XX') {
    return vercelCountry.toUpperCase();
  }

  const cfCountry = readHeader(request, 'cf-ipcountry');
  if (cfCountry && cfCountry !== 'XX') {
    return cfCountry.toUpperCase();
  }

  return null;
}
