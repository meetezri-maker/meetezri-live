/**
 * Audit-log writer.
 *
 * Prisma is mocked so this suite stays in the fast, hermetic unit project. The transaction-client
 * behaviour that matters most (the audit row committing WITH the change it describes) is proven
 * against a real database in `contentHubSchema.integration.test.ts`.
 */

import { sanitizeAuditDetails, writeAuditLog, writeAuditLogs } from './auditLog';

jest.mock('./prisma', () => ({
  __esModule: true,
  default: { audit_logs: { create: jest.fn() } },
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const prisma = require('./prisma').default as { audit_logs: { create: jest.Mock } };

describe('sanitizeAuditDetails', () => {
  it('redacts content bodies and snapshots', () => {
    const result = sanitizeAuditDetails({
      contentId: 'abc',
      body: { version: 1, blocks: [{ id: 'b1' }] },
      snapshot: { title: 'secret draft' },
    }) as Record<string, unknown>;

    expect(result.contentId).toBe('abc');
    expect(result.body).toBe('[redacted]');
    expect(result.snapshot).toBe('[redacted]');
  });

  it('redacts internal editorial and type_fields payloads', () => {
    const result = sanitizeAuditDetails({
      editorial: { purpose: 'internal strategy' },
      type_fields: { core_concept: 'internal' },
      typeFields: { core_concept: 'internal' },
    }) as Record<string, unknown>;

    expect(result.editorial).toBe('[redacted]');
    expect(result.type_fields).toBe('[redacted]');
    expect(result.typeFields).toBe('[redacted]');
  });

  it('redacts credentials', () => {
    const result = sanitizeAuditDetails({
      password: 'hunter2',
      token: 'tok',
      apiKey: 'key',
      secret: 's',
    }) as Record<string, unknown>;

    for (const key of ['password', 'token', 'apiKey', 'secret']) {
      expect(result[key]).toBe('[redacted]');
    }
  });

  it('keeps the metadata a reviewer actually needs', () => {
    const result = sanitizeAuditDetails({
      contentId: 'id-1',
      editorialRef: 'W1-A001',
      from: 'approved',
      to: 'published',
      changedFields: ['title', 'slug'],
      revisionNumber: 3,
      firstPublish: true,
    }) as Record<string, unknown>;

    expect(result).toEqual({
      contentId: 'id-1',
      editorialRef: 'W1-A001',
      from: 'approved',
      to: 'published',
      changedFields: ['title', 'slug'],
      revisionNumber: 3,
      firstPublish: true,
    });
  });

  it('truncates long strings', () => {
    const result = sanitizeAuditDetails({ note: 'x'.repeat(900) }) as Record<string, string>;
    expect(result.note.length).toBeLessThan(900);
    expect(result.note.endsWith('[truncated]')).toBe(true);
  });

  it('caps arrays and says how many were dropped', () => {
    const result = sanitizeAuditDetails({ ids: Array.from({ length: 80 }, (_, i) => `id-${i}`) }) as {
      ids: unknown[];
    };
    expect(result.ids).toHaveLength(51);
    expect(String(result.ids[50])).toContain('30 more');
  });

  it('stops at the depth limit instead of recursing forever', () => {
    const deep = { a: { b: { c: { d: { e: 'too deep' } } } } };
    const result = sanitizeAuditDetails(deep) as any;
    expect(result.a.b.c.d).toBe('[depth-limit]');
  });

  it('drops prototype-pollution keys', () => {
    const payload = JSON.parse('{"safe":1,"__proto__":{"polluted":true},"constructor":{"x":1}}');
    const result = sanitizeAuditDetails(payload) as Record<string, unknown>;
    expect(result.safe).toBe(1);
    expect(Object.keys(result)).not.toContain('__proto__');
    expect(Object.keys(result)).not.toContain('constructor');
  });

  it('serialises dates', () => {
    const when = new Date('2026-08-05T12:00:00.000Z');
    expect(sanitizeAuditDetails({ at: when })).toEqual({ at: '2026-08-05T12:00:00.000Z' });
  });
});

describe('writeAuditLog', () => {
  beforeEach(() => {
    prisma.audit_logs.create.mockReset();
    prisma.audit_logs.create.mockResolvedValue({});
  });

  it('writes actor, action, org and sanitized details', async () => {
    await writeAuditLog({
      actorId: 'actor-1',
      action: 'content.published',
      orgId: null,
      details: { contentId: 'c1', body: { blocks: [] } },
    });

    expect(prisma.audit_logs.create).toHaveBeenCalledTimes(1);
    const arg = prisma.audit_logs.create.mock.calls[0][0];
    expect(arg.data.actor_id).toBe('actor-1');
    expect(arg.data.action).toBe('content.published');
    expect(arg.data.org_id).toBeNull();
    expect(arg.data.details).toEqual({ contentId: 'c1', body: '[redacted]' });
  });

  it('accepts a null actor for system-triggered events', async () => {
    await writeAuditLog({ actorId: null, action: 'content.published' });
    expect(prisma.audit_logs.create.mock.calls[0][0].data.actor_id).toBeNull();
  });

  it('defaults org_id to null', async () => {
    await writeAuditLog({ actorId: 'a', action: 'content.created' });
    expect(prisma.audit_logs.create.mock.calls[0][0].data.org_id).toBeNull();
  });

  it('uses the supplied transaction client instead of the singleton', async () => {
    const tx = { audit_logs: { create: jest.fn().mockResolvedValue({}) } };

    await writeAuditLog({ actorId: 'a', action: 'content.published' }, { tx: tx as any });

    expect(tx.audit_logs.create).toHaveBeenCalledTimes(1);
    expect(prisma.audit_logs.create).not.toHaveBeenCalled();
  });

  it('swallows and logs failures outside a transaction', async () => {
    // Losing an audit row must never fail the user's action.
    prisma.audit_logs.create.mockRejectedValue(new Error('db down'));
    const logger = { error: jest.fn() };

    await expect(
      writeAuditLog({ actorId: 'a', action: 'content.created' }, { logger })
    ).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  it('rethrows inside a transaction so the whole unit rolls back', async () => {
    // A rolled-back publish must not leave a misleading "published" event behind.
    const tx = { audit_logs: { create: jest.fn().mockRejectedValue(new Error('constraint')) } };

    await expect(
      writeAuditLog({ actorId: 'a', action: 'content.published' }, { tx: tx as any })
    ).rejects.toThrow('constraint');
  });

  it('honours swallowErrors: false outside a transaction', async () => {
    prisma.audit_logs.create.mockRejectedValue(new Error('boom'));
    await expect(
      writeAuditLog({ actorId: 'a', action: 'x' }, { swallowErrors: false })
    ).rejects.toThrow('boom');
  });
});

describe('writeAuditLogs', () => {
  beforeEach(() => {
    prisma.audit_logs.create.mockReset();
    prisma.audit_logs.create.mockResolvedValue({});
  });

  it('writes every entry, sequentially', async () => {
    await writeAuditLogs([
      { actorId: 'a', action: 'content.published', details: { contentId: '1' } },
      { actorId: 'a', action: 'content.published', details: { contentId: '2' } },
      { actorId: 'a', action: 'content.cluster_published', details: { clusterSize: 2 } },
    ]);

    expect(prisma.audit_logs.create).toHaveBeenCalledTimes(3);
    expect(prisma.audit_logs.create.mock.calls[2][0].data.action).toBe('content.cluster_published');
  });

  it('does nothing for an empty list', async () => {
    await writeAuditLogs([]);
    expect(prisma.audit_logs.create).not.toHaveBeenCalled();
  });
});
