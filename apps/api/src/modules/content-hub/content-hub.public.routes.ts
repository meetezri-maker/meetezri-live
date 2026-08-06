/**
 * Content Hub — PUBLIC routes.
 *
 * Registered at `/api/content`. Deliberately a SEPARATE plugin from the admin routes, for two
 * reasons that are easy to lose in a refactor:
 *
 *   1. There is NO `authenticate` preHandler anywhere in this file. Not "optional auth" — none.
 *   2. The `/api/admin` prefix triggers privileged handling in `plugins/auth.ts`; public content
 *      must not sit under it.
 *
 * Every handler reads through `content-hub.read.service.ts`, which filters to
 * `status = 'published' AND deleted_at IS NULL`. There is deliberately no `status` query
 * parameter on any route here — published-only is a property of the service, never something a
 * crafted query string can widen.
 *
 * Responses are validated against `content-hub.public.schema.ts`. Because Fastify validates
 * responses, a serializer leak becomes a server error rather than a silent disclosure.
 */

import type { FastifyInstance } from 'fastify';
import {
  publicDetailHandler,
  publicListHandler,
  publicRelatedHandler,
} from './content-hub.controller';
import {
  publicDetailSchema,
  publicErrorSchema,
  publicListQuerySchema,
  publicListResponseSchema,
  publicRelatedQuerySchema,
  publicRelatedResponseSchema,
  publicSlugParamsSchema,
} from './content-hub.public.schema';

export async function contentHubPublicRoutes(app: FastifyInstance) {
  /** Index for /resources. Card fields only — never a body. */
  app.get(
    '/',
    {
      schema: {
        querystring: publicListQuerySchema,
        response: { 200: publicListResponseSchema, 400: publicErrorSchema },
      },
    },
    publicListHandler
  );

  /**
   * Detail for /resources/:slug.
   *
   * Anything not published — draft, in_review, approved, unpublished, archived, soft-deleted —
   * returns 404. Never 403: a 403 confirms the item exists and leaks the editorial pipeline.
   */
  app.get(
    '/:slug',
    {
      schema: {
        params: publicSlugParamsSchema,
        response: { 200: publicDetailSchema, 404: publicErrorSchema },
      },
    },
    publicDetailHandler
  );

  /** Related resources. Separate route so the detail payload stays independently cacheable. */
  app.get(
    '/:slug/related',
    {
      schema: {
        params: publicSlugParamsSchema,
        querystring: publicRelatedQuerySchema,
        response: { 200: publicRelatedResponseSchema, 404: publicErrorSchema },
      },
    },
    publicRelatedHandler
  );
}
