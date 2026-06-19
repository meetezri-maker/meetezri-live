/**
 * Upserts country-keyed crisis hotlines into Postgres.
 *
 * Run (from apps/api, DATABASE_URL must reach Postgres):
 *   pnpm run db:seed-crisis-hotlines
 */
import { PrismaClient } from '@prisma/client';
import {
  CRISIS_HOTLINES_BY_COUNTRY,
  buildCrisisResourcesForCountry,
} from '@meetezri/shared';
import { countryCodeToCrisisRegion } from '../src/modules/geo/geo.service';

const prisma = new PrismaClient();

async function main() {
  let countryCount = 0;
  let resourceCount = 0;

  for (const [countryCode, entry] of Object.entries(CRISIS_HOTLINES_BY_COUNTRY)) {
    const code = countryCode.toUpperCase();
    await prisma.crisis_hotline_countries.upsert({
      where: { country_code: code },
      create: {
        country_code: code,
        country_name: entry.countryName,
        dial_code: entry.dialCode,
        emergency_phone: entry.emergencyPhone ?? null,
        region_bucket: countryCodeToCrisisRegion(code),
        is_active: true,
      },
      update: {
        country_name: entry.countryName,
        dial_code: entry.dialCode,
        emergency_phone: entry.emergencyPhone ?? null,
        region_bucket: countryCodeToCrisisRegion(code),
        is_active: true,
        updated_at: new Date(),
      },
    });
    countryCount += 1;

    const resources = buildCrisisResourcesForCountry(code);
    for (let i = 0; i < resources.length; i++) {
      const resource = resources[i];
      await prisma.crisis_hotline_resources.upsert({
        where: {
          country_code_resource_key: {
            country_code: code,
            resource_key: resource.id,
          },
        },
        create: {
          country_code: code,
          resource_key: resource.id,
          resource_type: resource.type,
          name: resource.name,
          phone: resource.phone ?? null,
          description: resource.description,
          url: resource.url ?? null,
          availability: resource.availability,
          sort_order: i,
          is_active: true,
        },
        update: {
          resource_type: resource.type,
          name: resource.name,
          phone: resource.phone ?? null,
          description: resource.description,
          url: resource.url ?? null,
          availability: resource.availability,
          sort_order: i,
          is_active: true,
          updated_at: new Date(),
        },
      });
      resourceCount += 1;
    }
  }

  console.log(`Seeded ${countryCount} countries and ${resourceCount} crisis hotline resources.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
