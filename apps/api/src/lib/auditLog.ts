/**
 * Audit-log writer for the existing `public.audit_logs` table.
 *
 * CONTEXT WORTH KNOWING: `audit_logs` has existed since the baseline schema and is read by the
 * admin Audit Logs page, but **nothing in this codebase has ever written to it**
 * (CONTENT_HUB_AUDIT.md §3.4). This module is the first writer. It is therefore written to be
 * generally useful rather than Content Hub specific — any module needing an audit trail should
 * use it rather than adding a second one.
 *
 * Phase 1 provides the mechanism only; Content Hub actions (`content.published`,
 * `content.approval_set`, …) are emitted by the services in Phase 2.
 */

import type { FastifyBaseLogger } from 'fastify';
import prisma, { type PrismaClientLike } from './prisma';

/** Structured, JSON-serialisable detail payload. */
export type AuditDetails = Record<string, unknown>;

export interface AuditLogEntry {
  /** `profiles.id` of the acting user. `null` for system-triggered events (e.g. a cron publish). */
  actorId: string | null;
  /** Namespaced, past-tense action, e.g. `content.published`. */
  action: string;
  /** Structured context. Field NAMES, ids and transitions — never content bodies. */
  details?: AuditDetails;
  /** Organisation scope. Content Hub is platform-level, so it passes `null`. */
  orgId?: string | null;
}

export interface WriteAuditLogOptions {
  /**
   * Transaction client. Pass it and the audit row commits or rolls back WITH the change it
   * describes — so a rolled-back publish cannot leave a misleading "published" event behind.
   * Omit it and the row is written independently.
   */
  tx?: PrismaClientLike;
  /** Request logger. Failures are logged here rather than thrown — see below. */
  logger?: Pick<FastifyBaseLogger, 'error'>;
  /**
   * When true (the default OUTSIDE a transaction), a write failure is swallowed and logged:
   * losing an audit row must not fail the user's action.
   *
   * Ignored when `tx` is supplied — inside a transaction the caller has already decided the
   * audit row is part of the atomic unit, and swallowing the error there would abort the
   * transaction anyway while hiding the reason.
   */
  swallowErrors?: boolean;
}

/**
 * Keys whose values are never recorded, whatever a caller passes.
 *
 * Audit logs are widely readable by admins and are retained indefinitely; they are the wrong
 * place for content bodies (large, and the revision table already stores them) or for anything
 * sensitive. Callers should log field NAMES that changed, not their values.
 */
const REDACTED_KEYS = new Set([
  'body',
  'snapshot',
  'content',
  'blocks',
  'editorial',
  'type_fields',
  'typeFields',
  'password',
  'token',
  'accessToken',
  'refreshToken',
  'secret',
  'apiKey',
  'authorization',
]);

/** Depth cap — audit details are metadata, not a document. */
const MAX_DEPTH = 4;
/** Per-string cap, so a stray long value cannot bloat the table. */
const MAX_STRING_LENGTH = 512;
/** Per-array cap. */
const MAX_ARRAY_LENGTH = 50;

/**
 * Strip anything that should not be persisted, and bound the size.
 *
 * Exported for tests and for callers that want to see what will be stored.
 */
export function sanitizeAuditDetails(details: unknown, depth = 0): unknown {
  if (details === null || details === undefined) return details;

  if (typeof details === 'string') {
    return details.length > MAX_STRING_LENGTH
      ? `${details.slice(0, MAX_STRING_LENGTH)}…[truncated]`
      : details;
  }

  if (typeof details === 'number' || typeof details === 'boolean') return details;

  if (details instanceof Date) return details.toISOString();

  if (depth >= MAX_DEPTH) return '[depth-limit]';

  if (Array.isArray(details)) {
    const items = details.slice(0, MAX_ARRAY_LENGTH).map((item) => sanitizeAuditDetails(item, depth + 1));
    return details.length > MAX_ARRAY_LENGTH
      ? [...items, `…and ${details.length - MAX_ARRAY_LENGTH} more`]
      : items;
  }

  if (typeof details === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(details as Record<string, unknown>)) {
      // Prototype-pollution keys never reach the database.
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
      if (REDACTED_KEYS.has(key)) {
        out[key] = '[redacted]';
        continue;
      }
      out[key] = sanitizeAuditDetails(value, depth + 1);
    }
    return out;
  }

  // Functions, symbols, bigint — not JSON-serialisable.
  return undefined;
}

/**
 * Write one audit row.
 *
 * Inside a transaction (`tx` supplied) the write is part of the atomic unit and a failure
 * propagates. Outside one, a failure is logged and swallowed by default: an audit-log outage
 * must never break the action being audited.
 */
export async function writeAuditLog(
  entry: AuditLogEntry,
  options: WriteAuditLogOptions = {}
): Promise<void> {
  const { tx, logger } = options;
  const client: PrismaClientLike = tx ?? prisma;
  const swallowErrors = tx ? false : (options.swallowErrors ?? true);

  const data = {
    actor_id: entry.actorId,
    org_id: entry.orgId ?? null,
    action: entry.action,
    details: (sanitizeAuditDetails(entry.details ?? {}) ?? {}) as object,
  };

  try {
    await client.audit_logs.create({ data });
  } catch (error) {
    if (!swallowErrors) throw error;
    logger?.error({ err: error, action: entry.action }, 'Failed to write audit log');
  }
}

/**
 * Write several audit rows in one call — used by cluster publishing, which emits one event per
 * member plus a summary event.
 *
 * Sequential rather than parallel: inside an interactive transaction Prisma expects serial use of
 * the transaction client, and the counts involved are small.
 */
export async function writeAuditLogs(
  entries: AuditLogEntry[],
  options: WriteAuditLogOptions = {}
): Promise<void> {
  for (const entry of entries) {
    await writeAuditLog(entry, options);
  }
}
