import { FastifyInstance } from 'fastify';
import { resolveGeoRegionFromRequest } from './geo.service';

/**
 * Public geo helpers for crisis resource localization.
 * GET /api/geo/region — country from request IP (Vercel headers in production).
 */
export async function geoRoutes(app: FastifyInstance) {
  app.get('/region', async (request) => {
    const { ip, ...result } = resolveGeoRegionFromRequest(request);
    return {
      ...result,
      // Expose IP only for debugging in non-production; omit in prod for privacy.
      ...(process.env.NODE_ENV !== 'production' && ip ? { ip } : {}),
    };
  });
}
