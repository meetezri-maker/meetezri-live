import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import prisma from '../../lib/prisma';
import { countryCodeFromPhoneValue } from '@meetezri/shared';
import { resolveGeoRegionFromRequest } from '../geo/geo.service';
import {
  getHotlinesForCountry,
  persistUserCrisisCountryCode,
} from './crisis-hotlines.service';

const resourceSchema = z.object({
  id: z.string(),
  type: z.enum(['crisis_line', 'text_line', 'emergency', 'support_group']),
  name: z.string(),
  description: z.string(),
  phone: z.string().optional(),
  url: z.string().optional(),
  availability: z.string(),
  region: z.string(),
});

const hotlinesResponseSchema = z.object({
  countryCode: z.string(),
  countryName: z.string(),
  dialCode: z.string(),
  emergencyPhone: z.string().nullable(),
  region: z.string(),
  resources: z.array(resourceSchema),
  source: z.enum(['database', 'static']),
});

/**
 * Public crisis hotline directory (DB-backed, static fallback).
 */
export async function crisisHotlinesRoutes(app: FastifyInstance) {
  app.get('/', {
    schema: {
      tags: ['Crisis hotlines'],
      querystring: z.object({
        countryCode: z.string().min(2).max(2).optional(),
      }),
      response: {
        200: hotlinesResponseSchema,
        404: z.object({ message: z.string() }),
      },
    },
  }, async (request, reply) => {
    const query = (request.query ?? {}) as { countryCode?: string };
    const geo = resolveGeoRegionFromRequest(request);
    const code = query.countryCode?.toUpperCase() ?? geo.countryCode?.toUpperCase() ?? null;

    if (!code) {
      return reply.code(404).send({ message: 'Could not determine country for crisis hotlines' });
    }

    const hotlines = await getHotlinesForCountry(code);
    if (!hotlines) {
      return reply.code(404).send({ message: `No crisis hotlines configured for ${code}` });
    }

    return hotlines;
  });

  app.get('/me', {
    onRequest: app.authenticate,
    schema: {
      tags: ['Crisis hotlines'],
      response: {
        200: hotlinesResponseSchema.extend({
          resolvedFrom: z.enum(['profile', 'phone', 'ip']),
        }),
        404: z.object({ message: z.string() }),
      },
    },
  }, async (request, reply) => {
    const userId = (request as { user: { sub: string } }).user.sub;
    const geo = resolveGeoRegionFromRequest(request);

    const profile = await prisma.profiles.findUnique({
      where: { id: userId },
      select: { crisis_country_code: true, phone: true },
    });

    let resolvedFrom: 'profile' | 'phone' | 'ip' = 'ip';
    let code: string | null = null;

    if (profile?.crisis_country_code) {
      code = profile.crisis_country_code.toUpperCase();
      resolvedFrom = 'profile';
    } else if (profile?.phone) {
      const fromPhone = countryCodeFromPhoneValue(profile.phone);
      if (fromPhone) {
        code = fromPhone;
        resolvedFrom = 'phone';
      }
    }

    if (!code && geo.countryCode) {
      code = geo.countryCode.toUpperCase();
      resolvedFrom = 'ip';
    }

    if (!code) {
      return reply.code(404).send({ message: 'Could not determine your country for crisis hotlines' });
    }

    const hotlines = await getHotlinesForCountry(code);
    if (!hotlines) {
      return reply.code(404).send({ message: `No crisis hotlines configured for ${code}` });
    }

    return { ...hotlines, resolvedFrom };
  });

  app.put('/country', {
    onRequest: app.authenticate,
    schema: {
      tags: ['Crisis hotlines'],
      body: z.object({
        countryCode: z.string().min(2).max(2),
      }),
      response: {
        200: z.object({ countryCode: z.string() }),
      },
    },
  }, async (request) => {
    const userId = (request as { user: { sub: string } }).user.sub;
    const { countryCode } = request.body as { countryCode: string };
    await persistUserCrisisCountryCode(userId, countryCode);
    return { countryCode: countryCode.toUpperCase() };
  });
}
