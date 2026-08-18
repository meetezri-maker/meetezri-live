/**
 * Content Hub — ADMIN routes.
 *
 * Registered at `/api/admin/content`. That prefix matters beyond tidiness: `plugins/auth.ts`
 * treats `/api/admin` as privileged and BYPASSES its 5-minute role cache, so an admin whose role
 * changed cannot act on a stale one.
 *
 * ROUTE GUARDS ARE UX. Every `super_admin`-only action re-checks the role inside its service, so
 * a future route refactor cannot silently widen it.
 */

import type { FastifyInstance } from 'fastify';
import {
  checklistHandler,
  createContentHandler,
  cancelScheduleHandler,
  deleteContentHandler,
  duplicateContentHandler,
  getContentHandler,
  getInboundLinksHandler,
  getLinksHandler,
  getRevisionHandler,
  listContentHandler,
  listRevisionsHandler,
  previewHandler,
  publishClusterHandler,
  replaceLinksHandler,
  restoreRevisionHandler,
  setApprovalHandler,
  setScheduleHandler,
  transitionHandler,
  updateContentHandler,
  validateClusterHandler,
} from './content-hub.controller';
import {
  adminContentDetailSchema,
  adminContentListItemSchema,
  approvalBodySchema,
  approvalParamsSchema,
  checklistResponseSchema,
  clusterBodySchema,
  clusterPublishResponseSchema,
  clusterValidationResponseSchema,
  createContentBodySchema,
  inboundLinksResponseSchema,
  linksResponseSchema,
  listContentQuerySchema,
  listContentResponseSchema,
  listRevisionsQuerySchema,
  listRevisionsResponseSchema,
  replaceLinksBodySchema,
  restoreRevisionBodySchema,
  revisionDetailSchema,
  revisionParamsSchema,
  safeErrorResponseSchema,
  scheduleBodySchema,
  transitionBodySchema,
  transitionResponseSchema,
  updateContentBodySchema,
  uuidParamsSchema,
} from './content-hub.schema';
import { previewResponseSchema } from './content-hub.public.schema';

const CONTENT_ADMIN_ROLES = ['super_admin', 'org_admin'] as const;

/** Shared error responses. `team_admin` never reaches these routes at all. */
const errors = {
  400: safeErrorResponseSchema,
  401: safeErrorResponseSchema,
  403: safeErrorResponseSchema,
  404: safeErrorResponseSchema,
  409: safeErrorResponseSchema,
  422: safeErrorResponseSchema,
};

export async function contentHubAdminRoutes(app: FastifyInstance) {
  if (!app.authenticate || !app.authorize) {
    throw new Error('Authentication/authorization decorators are not registered');
  }

  const guard = { preHandler: [app.authenticate, app.authorize([...CONTENT_ADMIN_ROLES])] };

  // ── Clusters ──
  // Declared BEFORE `/:id` so `clusters` is never captured as a uuid param.
  app.post(
    '/clusters/validate',
    {
      ...guard,
      schema: { body: clusterBodySchema, response: { 200: clusterValidationResponseSchema, ...errors } },
    },
    validateClusterHandler
  );

  app.post(
    '/clusters/publish',
    {
      ...guard,
      schema: { body: clusterBodySchema, response: { 200: clusterPublishResponseSchema, ...errors } },
    },
    publishClusterHandler
  );

  // ── CRUD ──
  app.get(
    '/',
    { ...guard, schema: { querystring: listContentQuerySchema, response: { 200: listContentResponseSchema, ...errors } } },
    listContentHandler
  );

  app.post(
    '/',
    { ...guard, schema: { body: createContentBodySchema, response: { 201: adminContentListItemSchema, ...errors } } },
    createContentHandler
  );

  app.get(
    '/:id',
    { ...guard, schema: { params: uuidParamsSchema, response: { 200: adminContentDetailSchema, ...errors } } },
    getContentHandler
  );

  app.patch(
    '/:id',
    {
      ...guard,
      schema: {
        params: uuidParamsSchema,
        body: updateContentBodySchema,
        response: { 200: adminContentDetailSchema, ...errors },
      },
    },
    updateContentHandler
  );

  app.post(
    '/:id/duplicate',
    { ...guard, schema: { params: uuidParamsSchema, response: { 201: adminContentListItemSchema, ...errors } } },
    duplicateContentHandler
  );

  app.delete(
    '/:id',
    { ...guard, schema: { params: uuidParamsSchema, response: { 204: { type: 'null' }, ...errors } } },
    deleteContentHandler
  );

  // ── Workflow ──
  app.get(
    '/:id/checklist',
    { ...guard, schema: { params: uuidParamsSchema, response: { 200: checklistResponseSchema, ...errors } } },
    checklistHandler
  );

  app.post(
    '/:id/transition',
    {
      ...guard,
      schema: {
        params: uuidParamsSchema,
        body: transitionBodySchema,
        response: { 200: transitionResponseSchema, ...errors },
      },
    },
    transitionHandler
  );

  app.put(
    '/:id/approvals/:gate',
    { ...guard, schema: { params: approvalParamsSchema, body: approvalBodySchema, response: errors } },
    setApprovalHandler
  );

  // ── Scheduling ──
  app.put(
    '/:id/schedule',
    { ...guard, schema: { params: uuidParamsSchema, body: scheduleBodySchema, response: errors } },
    setScheduleHandler
  );

  app.delete(
    '/:id/schedule',
    { ...guard, schema: { params: uuidParamsSchema, response: errors } },
    cancelScheduleHandler
  );

  // ── Revisions ──
  app.get(
    '/:id/revisions',
    {
      ...guard,
      schema: {
        params: uuidParamsSchema,
        querystring: listRevisionsQuerySchema,
        response: { 200: listRevisionsResponseSchema, ...errors },
      },
    },
    listRevisionsHandler
  );

  app.get(
    '/:id/revisions/:number',
    { ...guard, schema: { params: revisionParamsSchema, response: { 200: revisionDetailSchema, ...errors } } },
    getRevisionHandler
  );

  app.post(
    '/:id/revisions/:number/restore',
    {
      ...guard,
      schema: {
        params: revisionParamsSchema,
        body: restoreRevisionBodySchema,
        response: { 200: adminContentDetailSchema, ...errors },
      },
    },
    restoreRevisionHandler
  );

  // ── Links ──
  app.get(
    '/:id/links',
    { ...guard, schema: { params: uuidParamsSchema, response: { 200: linksResponseSchema, ...errors } } },
    getLinksHandler
  );

  app.put(
    '/:id/links',
    {
      ...guard,
      schema: {
        params: uuidParamsSchema,
        body: replaceLinksBodySchema,
        response: { 200: linksResponseSchema, ...errors },
      },
    },
    replaceLinksHandler
  );

  app.get(
    '/:id/inbound-links',
    { ...guard, schema: { params: uuidParamsSchema, response: { 200: inboundLinksResponseSchema, ...errors } } },
    getInboundLinksHandler
  );

  // ── Preview ──
  // Runs the REAL public serializer, so previewing also proves nothing internal leaks.
  app.get(
    '/:id/preview',
    { ...guard, schema: { params: uuidParamsSchema, response: { 200: previewResponseSchema, ...errors } } },
    previewHandler
  );
}
