import prisma from '../../lib/prisma';
import {
  buildCrisisResourcesForCountry,
  countryCodeFromPhoneValue,
  getCountryHotlineEntry,
  isSupportedCrisisCountry,
  type CrisisResourceDto,
} from '@meetezri/shared';
import { countryCodeToCrisisRegion } from '../geo/geo.service';

export interface CrisisHotlinesResponse {
  countryCode: string;
  countryName: string;
  dialCode: string;
  emergencyPhone: string | null;
  region: string;
  resources: CrisisResourceDto[];
  source: 'database' | 'static';
}

function mapDbResource(row: {
  resource_key: string;
  resource_type: string;
  name: string;
  phone: string | null;
  description: string | null;
  url: string | null;
  availability: string;
  country_code: string;
}): CrisisResourceDto {
  return {
    id: row.resource_key,
    type: row.resource_type as CrisisResourceDto['type'],
    name: row.name,
    description: row.description ?? '',
    phone: row.phone ?? undefined,
    url: row.url ?? undefined,
    availability: row.availability,
    region: row.country_code,
  };
}

export async function getHotlinesFromDatabase(
  countryCode: string,
): Promise<CrisisHotlinesResponse | null> {
  const code = countryCode.trim().toUpperCase();
  if (!code) return null;

  const country = await prisma.crisis_hotline_countries.findFirst({
    where: { country_code: code, is_active: true },
    include: {
      resources: {
        where: { is_active: true },
        orderBy: { sort_order: 'asc' },
      },
    },
  });

  if (!country || country.resources.length === 0) return null;

  return {
    countryCode: country.country_code,
    countryName: country.country_name,
    dialCode: country.dial_code,
    emergencyPhone: country.emergency_phone,
    region: country.region_bucket ?? countryCodeToCrisisRegion(country.country_code),
    resources: country.resources.map(mapDbResource),
    source: 'database',
  };
}

export async function getHotlinesForCountry(
  countryCode: string,
): Promise<CrisisHotlinesResponse | null> {
  const code = countryCode.trim().toUpperCase();
  if (!isSupportedCrisisCountry(code)) return null;

  const fromDb = await getHotlinesFromDatabase(code);
  if (fromDb) return fromDb;

  const resources = buildCrisisResourcesForCountry(code);
  if (resources.length === 0) return null;

  const meta = getCountryHotlineEntry(code);
  return {
    countryCode: code,
    countryName: meta?.countryName ?? code,
    dialCode: meta?.dialCode ?? '',
    emergencyPhone: meta?.emergencyPhone ?? resources.find((r) => r.type === 'emergency')?.phone ?? null,
    region: countryCodeToCrisisRegion(code),
    resources,
    source: 'static',
  };
}

export async function resolveUserCrisisCountryCode(
  userId: string | undefined,
  ipCountryCode: string | null,
): Promise<string | null> {
  if (userId) {
    const profile = await prisma.profiles.findUnique({
      where: { id: userId },
      select: { crisis_country_code: true, phone: true },
    });
    if (profile?.crisis_country_code && isSupportedCrisisCountry(profile.crisis_country_code)) {
      return profile.crisis_country_code.toUpperCase();
    }
    if (profile?.phone) {
      const fromPhone = countryCodeFromPhoneValue(profile.phone);
      if (fromPhone && isSupportedCrisisCountry(fromPhone)) {
        return fromPhone;
      }
    }
  }

  if (ipCountryCode && isSupportedCrisisCountry(ipCountryCode)) {
    return ipCountryCode.toUpperCase();
  }

  return null;
}

export async function persistUserCrisisCountryCode(
  userId: string,
  countryCode: string,
): Promise<void> {
  const code = countryCode.trim().toUpperCase();
  if (!code || !isSupportedCrisisCountry(code)) return;
  await prisma.profiles.update({
    where: { id: userId },
    data: { crisis_country_code: code },
  });
}
