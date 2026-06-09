/** Base64url-decode a JWT segment (handles missing padding). */
function decodeJwtSegment(segment: string): string {
  let base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4;
  if (pad === 2) base64 += '==';
  else if (pad === 3) base64 += '=';
  else if (pad === 1) throw new Error('Invalid base64url segment');
  return atob(base64);
}

/** Decode JWT `exp` (ms since epoch). Returns null if unreadable. */
export function jwtExpiresAtMs(token: string): number | null {
  try {
    const segment = token.split('.')[1];
    if (!segment) return null;
    const payload = JSON.parse(decodeJwtSegment(segment)) as { exp?: number };
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

/** When exp cannot be decoded, treat token as valid (let the API decide). */
export function isJwtExpired(token: string, skewMs = 30_000): boolean {
  const exp = jwtExpiresAtMs(token);
  if (exp == null) return false;
  return exp <= Date.now() + skewMs;
}

/** Grace period after `expires_at` before clearing a Supabase session locally (handles clock skew). */
export const SESSION_LOCAL_EXPIRY_GRACE_MS = 24 * 60 * 60 * 1000;

/** Only treat a Supabase session as expired when well past its expiry (avoids false sign-outs). */
export function isSupabaseSessionExpiredLocally(
  expiresAtSec: number | undefined | null,
  graceMs = SESSION_LOCAL_EXPIRY_GRACE_MS
): boolean {
  if (!expiresAtSec) return false;
  return expiresAtSec * 1000 + graceMs < Date.now();
}
