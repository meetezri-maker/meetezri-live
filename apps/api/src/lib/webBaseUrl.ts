import type { FastifyRequest } from 'fastify';

function tryParseHttpOrigin(value?: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.origin;
  } catch {
    return null;
  }
}

function isLocalhostOrigin(origin: string): boolean {
  try {
    const host = new URL(origin).hostname;
    return host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
  } catch {
    return false;
  }
}

export function getWebBaseUrlFromRequest(
  request: FastifyRequest
): { webBaseUrl: string; source: string } {
  const explicit = (request.headers['x-web-base-url'] as string | undefined) ?? null;
  const origin = request.headers.origin;
  const referer = request.headers.referer;

  const fromExplicit = tryParseHttpOrigin(explicit);
  if (fromExplicit) {
    return { webBaseUrl: fromExplicit, source: 'request.x-web-base-url' };
  }

  const fromOrigin = tryParseHttpOrigin(origin);
  if (fromOrigin) {
    return { webBaseUrl: fromOrigin, source: 'request.origin' };
  }

  const fromReferer = tryParseHttpOrigin(referer);
  if (fromReferer) {
    return { webBaseUrl: fromReferer, source: 'request.referer' };
  }

  const envCandidateRaw =
    process.env.WEB_BASE_URL || process.env.APP_URL || process.env.CLIENT_URL || '';
  const envParsed = tryParseHttpOrigin(envCandidateRaw.trim());
  if (envParsed) {
    return { webBaseUrl: envParsed, source: 'env' };
  }

  return { webBaseUrl: 'http://localhost:5173', source: 'fallback.localhost' };
}

/**
 * Base URL for Supabase invite `redirect_to`. External users must land on the deployed app,
 * not localhost when an admin invites from local dev or when API env defaults to localhost.
 */
export function getInviteRedirectBaseUrl(request: FastifyRequest): string {
  const envCandidates = [
    process.env.CLIENT_URL,
    process.env.WEB_BASE_URL,
    process.env.APP_URL,
  ];

  for (const raw of envCandidates) {
    const parsed = tryParseHttpOrigin(raw?.trim());
    if (parsed && !isLocalhostOrigin(parsed)) {
      return parsed;
    }
  }

  return getWebBaseUrlFromRequest(request).webBaseUrl;
}
