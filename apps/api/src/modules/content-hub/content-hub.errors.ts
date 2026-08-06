/**
 * Content Hub — domain errors.
 *
 * Shaped to the project's standard envelope (`{ statusCode, error, code, message }`, see
 * `app.setErrorHandler`) so the global handler renders them without special-casing, exactly like
 * `challenge-limit.error.ts`.
 *
 * WHAT IS DELIBERATELY NOT ON THESE ERRORS: content bodies, snapshots, editorial metadata, and
 * internal `type_fields`. A failed request must not become a disclosure channel for the same
 * fields the serializer strips from successful ones.
 */

export type ContentHubErrorCode =
  | 'CONTENT_NOT_FOUND'
  | 'SLUG_TAKEN'
  | 'SLUG_INVALID'
  | 'SLUG_RESERVED'
  | 'EDITORIAL_REF_TAKEN'
  | 'STALE_UPDATE'
  | 'ILLEGAL_TRANSITION'
  | 'CHECKLIST_FAILED'
  | 'CLUSTER_INVALID'
  | 'FORBIDDEN_ACTION'
  | 'CONTENT_TYPE_IMMUTABLE'
  | 'SCHEDULE_NOT_APPROVED'
  | 'SCHEDULE_IN_PAST'
  | 'INVALID_LINK'
  | 'REVISION_NOT_FOUND'
  | 'SLUG_CHANGE_NOT_CONFIRMED';

export class ContentHubError extends Error {
  readonly statusCode: number;
  readonly code: ContentHubErrorCode;
  /** Extra machine-readable context. Never content. */
  readonly details?: Record<string, unknown>;

  constructor(
    statusCode: number,
    code: ContentHubErrorCode,
    message: string,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ContentHubError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export const contentNotFound = (id?: string) =>
  new ContentHubError(404, 'CONTENT_NOT_FOUND', 'Content not found.', id ? { id } : undefined);

export const slugTaken = (slug: string) =>
  new ContentHubError(409, 'SLUG_TAKEN', `The slug "${slug}" is already in use.`, { slug });

export const slugInvalid = (slug: string) =>
  new ContentHubError(400, 'SLUG_INVALID', 'The slug is empty or malformed.', { slug });

export const slugReserved = (slug: string) =>
  new ContentHubError(400, 'SLUG_RESERVED', `The slug "${slug}" is reserved.`, { slug });

export const editorialRefTaken = (editorialRef: string) =>
  new ContentHubError(409, 'EDITORIAL_REF_TAKEN', 'That editorial reference is already in use.', {
    editorialRef,
  });

export const staleUpdate = (currentUpdatedAt: Date, updatedBy: string | null) =>
  new ContentHubError(
    409,
    'STALE_UPDATE',
    'This content was changed by someone else. Reload before saving.',
    { currentUpdatedAt: currentUpdatedAt.toISOString(), updatedBy }
  );

export const illegalTransition = (from: string, to: string) =>
  new ContentHubError(409, 'ILLEGAL_TRANSITION', `Cannot move content from ${from} to ${to}.`, {
    from,
    to,
  });

export const checklistFailed = (items: unknown[]) =>
  new ContentHubError(422, 'CHECKLIST_FAILED', 'The publish checklist did not pass.', { items });

export const clusterInvalid = (members: unknown[]) =>
  new ContentHubError(422, 'CLUSTER_INVALID', 'The cluster did not pass validation.', { members });

export const forbiddenAction = (action: string) =>
  new ContentHubError(403, 'FORBIDDEN_ACTION', `You are not allowed to ${action}.`, { action });

export const contentTypeImmutable = () =>
  new ContentHubError(
    409,
    'CONTENT_TYPE_IMMUTABLE',
    'Content type cannot be changed after creation.'
  );

export const scheduleNotApproved = (status: string) =>
  new ContentHubError(
    409,
    'SCHEDULE_NOT_APPROVED',
    'Only approved content can be scheduled.',
    { status }
  );

export const scheduleInPast = () =>
  new ContentHubError(
    400,
    'SCHEDULE_IN_PAST',
    'The scheduled time must be at least five minutes in the future.'
  );

export const invalidLink = (reason: string, details?: Record<string, unknown>) =>
  new ContentHubError(400, 'INVALID_LINK', reason, details);

export const revisionNotFound = (revisionNumber: number) =>
  new ContentHubError(404, 'REVISION_NOT_FOUND', 'Revision not found.', { revisionNumber });

export const slugChangeNotConfirmed = () =>
  new ContentHubError(
    400,
    'SLUG_CHANGE_NOT_CONFIRMED',
    'Changing a published URL breaks inbound links and citations. Resend with confirmSlugChange.'
  );

/**
 * Map a Prisma unique-constraint violation onto a stable domain error.
 *
 * Slug and editorial-ref uniqueness are enforced by PARTIAL indexes, which only the database can
 * evaluate — a service-level pre-check cannot win a race between two concurrent creates. So the
 * violation is caught and translated rather than prevented.
 */
export function mapPrismaUniqueViolation(error: unknown, context: { slug?: string; editorialRef?: string }) {
  const err = error as { code?: string; meta?: { target?: unknown } };
  if (err?.code !== 'P2002') return null;

  const target = String(err.meta?.target ?? '');

  if (target.includes('slug') && context.slug) return slugTaken(context.slug);
  if (target.includes('editorial_ref') && context.editorialRef) {
    return editorialRefTaken(context.editorialRef);
  }
  if (target.includes('revision_number')) {
    return new ContentHubError(409, 'STALE_UPDATE', 'A concurrent save created this revision. Retry.');
  }
  if (target.includes('content_links')) {
    return invalidLink('That link already exists.');
  }
  return null;
}

export function isContentHubError(error: unknown): error is ContentHubError {
  return error instanceof ContentHubError;
}
