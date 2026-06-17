import type { FastifyRequest } from 'fastify';

/**
 * Best-effort client IP from proxy headers (Vercel, load balancers) or the socket.
 */
export function getClientIp(request: FastifyRequest): string | null {
  const vercelForwarded = request.headers['x-vercel-forwarded-for'];
  if (typeof vercelForwarded === 'string' && vercelForwarded.trim()) {
    return vercelForwarded.split(',')[0].trim();
  }

  const forwarded = request.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded[0]?.trim()) {
    return forwarded[0].split(',')[0].trim();
  }

  const realIp = request.headers['x-real-ip'];
  if (typeof realIp === 'string' && realIp.trim()) {
    return realIp.trim();
  }

  return request.ip ?? null;
}

/**
 * ISO 3166-1 alpha-2 country code from Vercel / common CDN headers.
 */
export function getCountryCodeFromRequest(request: FastifyRequest): string | null {
  const vercelCountry = request.headers['x-vercel-ip-country'];
  if (typeof vercelCountry === 'string' && vercelCountry.trim() && vercelCountry !== 'XX') {
    return vercelCountry.trim().toUpperCase();
  }

  const cfCountry = request.headers['cf-ipcountry'];
  if (typeof cfCountry === 'string' && cfCountry.trim() && cfCountry !== 'XX') {
    return cfCountry.trim().toUpperCase();
  }

  return null;
}
