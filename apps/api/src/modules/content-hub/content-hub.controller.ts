/**
 * Content Hub — controllers.
 *
 * REQUEST/RESPONSE TRANSLATION ONLY. No business logic, no Prisma. Errors thrown by services are
 * mapped once, here, onto the project's standard envelope.
 */

import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  auditClusterValidation,
  publishCluster,
  validateCluster,
} from './content-hub.cluster.service';
import { isContentHubError, mapPrismaTransactionUnavailable } from './content-hub.errors';
import {
  evaluateChecklist,
  setApprovalGate,
  transitionContent,
  type TransitionAction,
} from './content-hub.publish.service';
import {
  resolvePreviewContent,
  resolvePublishedContent,
  resolvePublishedList,
  resolvePublishedRelated,
} from './content-hub.read.service';
import { cancelSchedule, setSchedule } from './content-hub.schedule.service';
import {
  createContent,
  deleteContent,
  duplicateContent,
  getContent,
  getInboundLinks,
  getLinks,
  getRevision,
  listContent,
  listRevisions,
  replaceLinks,
  restoreRevision,
  updateContent,
  type Actor,
  type AdminRole,
} from './content-hub.service';
import prisma from '../../lib/prisma';

/** The auth plugin attaches `appRole` and `sub` after verifying the JWT. */
function actorFrom(request: FastifyRequest): Actor {
  const user = request.user as { sub?: string; appRole?: string } | undefined;
  return { id: String(user?.sub ?? ''), role: (user?.appRole ?? 'team_admin') as AdminRole };
}

/**
 * One error mapper for the whole module.
 *
 * Domain errors already carry the right status and a safe message. Everything else is re-thrown
 * so the global handler logs it and returns a generic 500 — an unexpected failure must not leak
 * its detail through this module.
 */
function sendError(request: FastifyRequest, reply: FastifyReply, error: unknown) {
  /**
   * A starved connection pool is not an unexpected failure, and it is not a corrupted write —
   * the transaction never started. Translating it here, before the generic re-throw, turns the
   * opaque 500 that draft → in_review was returning into an accurate, retryable 503.
   */
  const busy = mapPrismaTransactionUnavailable(error);
  if (busy) {
    request.log.warn(
      { code: busy.code, route: request.routeOptions?.url ?? request.url },
      'Content Hub transaction could not start; nothing was written'
    );
    error = busy;
  }

  if (isContentHubError(error)) {
    request.log.info(
      { code: error.code, route: request.routeOptions?.url ?? request.url },
      'Content Hub domain error'
    );
    return reply.code(error.statusCode).send({
      statusCode: error.statusCode,
      error: error.statusCode >= 500 ? 'Internal Server Error' : 'Request failed',
      code: error.code,
      message: error.message,
      ...(error.details ? { details: error.details } : {}),
    });
  }
  throw error;
}

// ─── Admin: CRUD ─────────────────────────────────────────────────────────────

export async function listContentHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    return reply.send(await listContent(request.query as never));
  } catch (error) {
    return sendError(request, reply, error);
  }
}

export async function createContentHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    return reply.code(201).send(await createContent(request.body as never, actorFrom(request)));
  } catch (error) {
    return sendError(request, reply, error);
  }
}

export async function getContentHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id } = request.params as { id: string };
    return reply.send(await getContent(id));
  } catch (error) {
    return sendError(request, reply, error);
  }
}

export async function updateContentHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id } = request.params as { id: string };
    return reply.send(await updateContent(id, request.body as never, actorFrom(request)));
  } catch (error) {
    return sendError(request, reply, error);
  }
}

export async function duplicateContentHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id } = request.params as { id: string };
    return reply.code(201).send(await duplicateContent(id, actorFrom(request)));
  } catch (error) {
    return sendError(request, reply, error);
  }
}

export async function deleteContentHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id } = request.params as { id: string };
    await deleteContent(id, actorFrom(request));
    return reply.code(204).send();
  } catch (error) {
    return sendError(request, reply, error);
  }
}

// ─── Admin: workflow ─────────────────────────────────────────────────────────

export async function checklistHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id } = request.params as { id: string };
    return reply.send(await evaluateChecklist(prisma, id));
  } catch (error) {
    return sendError(request, reply, error);
  }
}

export async function transitionHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id } = request.params as { id: string };
    const { action, reason } = request.body as { action: TransitionAction; reason?: string };
    const result = await transitionContent(id, action, actorFrom(request), reason);
    return reply.send({ status: result.status, revisionNumber: result.revisionNumber });
  } catch (error) {
    return sendError(request, reply, error);
  }
}

export async function setApprovalHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id, gate } = request.params as { id: string; gate: never };
    const { state, note } = request.body as { state: never; note?: string };
    return reply.send(await setApprovalGate(id, gate, state, actorFrom(request), note));
  } catch (error) {
    return sendError(request, reply, error);
  }
}

// ─── Admin: scheduling ───────────────────────────────────────────────────────

export async function setScheduleHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id } = request.params as { id: string };
    const { scheduledFor } = request.body as { scheduledFor: string };
    return reply.send(await setSchedule(id, scheduledFor, actorFrom(request)));
  } catch (error) {
    return sendError(request, reply, error);
  }
}

export async function cancelScheduleHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id } = request.params as { id: string };
    return reply.send(await cancelSchedule(id, actorFrom(request)));
  } catch (error) {
    return sendError(request, reply, error);
  }
}

// ─── Admin: revisions ────────────────────────────────────────────────────────

export async function listRevisionsHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id } = request.params as { id: string };
    const { page, pageSize } = request.query as { page: number; pageSize: number };
    return reply.send(await listRevisions(id, page, pageSize));
  } catch (error) {
    return sendError(request, reply, error);
  }
}

export async function getRevisionHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id, number } = request.params as { id: string; number: number };
    return reply.send(await getRevision(id, number));
  } catch (error) {
    return sendError(request, reply, error);
  }
}

export async function restoreRevisionHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id, number } = request.params as { id: string; number: number };
    const { expectedUpdatedAt } = request.body as { expectedUpdatedAt: string };
    return reply.send(await restoreRevision(id, number, expectedUpdatedAt, actorFrom(request)));
  } catch (error) {
    return sendError(request, reply, error);
  }
}

// ─── Admin: links ────────────────────────────────────────────────────────────

export async function getLinksHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id } = request.params as { id: string };
    return reply.send({ links: await getLinks(id) });
  } catch (error) {
    return sendError(request, reply, error);
  }
}

export async function replaceLinksHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id } = request.params as { id: string };
    const { links } = request.body as { links: never[] };
    return reply.send({ links: await replaceLinks(id, links, actorFrom(request)) });
  } catch (error) {
    return sendError(request, reply, error);
  }
}

export async function getInboundLinksHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id } = request.params as { id: string };
    return reply.send({ links: await getInboundLinks(id) });
  } catch (error) {
    return sendError(request, reply, error);
  }
}

// ─── Admin: clusters ─────────────────────────────────────────────────────────

export async function validateClusterHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { contentIds } = request.body as { contentIds: string[] };
    const result = await validateCluster(contentIds);
    // An explicit validation run is audited; ordinary invalid form submissions are not.
    await auditClusterValidation(contentIds, result.passed, actorFrom(request));
    return reply.send(result);
  } catch (error) {
    return sendError(request, reply, error);
  }
}

export async function publishClusterHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { contentIds } = request.body as { contentIds: string[] };
    const result = await publishCluster(contentIds, actorFrom(request));
    return reply.send({ clusterId: result.clusterId, published: result.published });
  } catch (error) {
    return sendError(request, reply, error);
  }
}

// ─── Admin: preview ──────────────────────────────────────────────────────────

export async function previewHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id } = request.params as { id: string };
    const preview = await resolvePreviewContent(id);
    if (!preview) {
      return reply.code(404).send({ statusCode: 404, error: 'Not Found', message: 'Content not found.' });
    }
    // Never indexable, regardless of the item's stored directive.
    reply.header('X-Robots-Tag', 'noindex, nofollow');
    reply.header('Cache-Control', 'no-store');
    return reply.send({ ...preview, isPreview: true as const, robots: 'noindex,nofollow' as const });
  } catch (error) {
    return sendError(request, reply, error);
  }
}

// ─── Public ──────────────────────────────────────────────────────────────────

/** Short edge cache with a long stale window — editorial content tolerates minutes of staleness. */
function applyPublicCache(reply: FastifyReply) {
  reply.header('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=86400');
}

export async function publicListHandler(request: FastifyRequest, reply: FastifyReply) {
  const result = await resolvePublishedList(request.query as never);
  applyPublicCache(reply);
  return reply.send(result);
}

export async function publicDetailHandler(request: FastifyRequest, reply: FastifyReply) {
  const { slug } = request.params as { slug: string };
  const detail = await resolvePublishedContent(slug);

  // 404, never 403 — a 403 confirms the item exists and leaks the editorial pipeline.
  if (!detail) {
    return reply.code(404).send({ statusCode: 404, error: 'Not Found', message: 'Resource not found.' });
  }

  applyPublicCache(reply);
  return reply.send(detail);
}

export async function publicRelatedHandler(request: FastifyRequest, reply: FastifyReply) {
  const { slug } = request.params as { slug: string };
  const { limit } = request.query as { limit: number };
  const items = await resolvePublishedRelated(slug, limit);

  if (items === null) {
    return reply.code(404).send({ statusCode: 404, error: 'Not Found', message: 'Resource not found.' });
  }

  applyPublicCache(reply);
  return reply.send({ items });
}
