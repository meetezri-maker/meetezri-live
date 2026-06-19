import type { FastifyRequest } from 'fastify';
import { getClientIp, getCountryCodeFromRequest } from '../../lib/client-ip';

export type CrisisRegion = 'US' | 'CA' | 'UK' | 'AU' | 'EU' | 'PK' | 'GLOBAL';

export type GeoRegionSource = 'ip' | 'unknown';

export interface GeoRegionResult {
  region: CrisisRegion;
  countryCode: string | null;
  source: GeoRegionSource;
}

const EU_COUNTRY_CODES = new Set([
  'AT',
  'BE',
  'BG',
  'HR',
  'CY',
  'CZ',
  'DK',
  'EE',
  'FI',
  'FR',
  'DE',
  'GR',
  'HU',
  'IE',
  'IT',
  'LV',
  'LT',
  'LU',
  'MT',
  'NL',
  'PL',
  'PT',
  'RO',
  'SK',
  'SI',
  'ES',
  'SE',
  // EEA partners often share EU emergency patterns
  'IS',
  'LI',
  'NO',
  'CH',
]);

export function countryCodeToCrisisRegion(countryCode: string | null | undefined): CrisisRegion {
  if (!countryCode) return 'GLOBAL';

  const code = countryCode.trim().toUpperCase();
  if (code === 'US') return 'US';
  if (code === 'CA') return 'CA';
  if (code === 'GB' || code === 'UK') return 'UK';
  if (code === 'AU') return 'AU';
  if (code === 'PK') return 'PK';
  if (EU_COUNTRY_CODES.has(code)) return 'EU';

  return 'GLOBAL';
}

export function resolveGeoRegionFromRequest(request: FastifyRequest): GeoRegionResult & { ip: string | null } {
  const countryCode = getCountryCodeFromRequest(request);
  const ip = getClientIp(request);

  if (countryCode) {
    return {
      region: countryCodeToCrisisRegion(countryCode),
      countryCode,
      source: 'ip',
      ip,
    };
  }

  return {
    region: 'GLOBAL',
    countryCode: null,
    source: 'unknown',
    ip,
  };
}
