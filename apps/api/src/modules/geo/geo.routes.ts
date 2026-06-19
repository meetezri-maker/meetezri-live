import { FastifyInstance } from 'fastify';
import { resolveGeoRegionFromRequest } from './geo.service';
import { getHotlinesForCountry } from '../crisis-hotlines/crisis-hotlines.service';

/**
 * Public geo helpers for crisis resource localization.
 * GET /api/geo/region — country from request IP + matching hotlines from DB.
 */
export async function geoRoutes(app: FastifyInstance) {
  app.get('/region', async (request) => {
    const { ip, ...result } = resolveGeoRegionFromRequest(request);
    const countryCode = result.countryCode?.toUpperCase() ?? null;
    const hotlines = countryCode ? await getHotlinesForCountry(countryCode) : null;

    return {
      ...result,
      ip: ip ?? null,
      hotlines: hotlines?.resources ?? [],
      hotlineMeta: hotlines
        ? {
            countryCode: hotlines.countryCode,
            countryName: hotlines.countryName,
            dialCode: hotlines.dialCode,
            emergencyPhone: hotlines.emergencyPhone,
            source: hotlines.source,
          }
        : null,
    };
  });
}
