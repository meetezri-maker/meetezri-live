/**
 * Content Hub — ARCHITECTURE GUARD TESTS.
 *
 * These protect DECISIONS rather than behaviour. Each one guards something a later change would
 * otherwise undo silently, and each would be discovered far too late — during the v2 migration,
 * or by a reader on the public site.
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { CONTENT_STATUSES, PUBLIC_CONTENT_LABEL, ROUTE_KEYS, ROUTE_REGISTRY } from '@meetezri/shared';

const MODULE_DIR = join(__dirname, '..');

function moduleFiles(): Array<{ name: string; source: string }> {
  return readdirSync(MODULE_DIR)
    .filter((name) => name.endsWith('.ts'))
    .map((name) => ({ name, source: readFileSync(join(MODULE_DIR, name), 'utf8') }));
}

describe('the public read seam is the only public Prisma reader', () => {
  it('invokes the public serializer from content-hub.read.service.ts alone', () => {
    // WHY: v1 serves published content from the live row; v2 will serve the published revision
    // snapshot. That upgrade happens inside `loadPublishedRow` alone — every bypass is a place
    // the migration would silently keep serving live rows (plan §8.3.2).
    //
    // Asserting on the SERIALIZER rather than on `prisma.content_items` is the sharper test:
    // admin services legitimately read the table for admin output, so a raw-Prisma allow-list
    // would grow until it meant nothing. Only public output goes through `serializeDetail` /
    // `serializeCard`, so those two calls are exactly the public read path.
    const offenders = moduleFiles()
      .filter((file) => file.name !== 'content-hub.read.service.ts')
      .filter((file) => file.name !== 'content-hub.serializer.ts')
      .filter((file) => /\b(serializeDetail|serializeCard)\s*\(/.test(file.source))
      .map((file) => file.name);

    expect(offenders).toEqual([]);
  });

  it('keeps public-facing files free of direct content_items reads', () => {
    const publicFacing = ['content-hub.public.routes.ts', 'content-hub.serializer.ts'];
    const offenders = moduleFiles()
      .filter((file) => publicFacing.includes(file.name))
      .filter((file) => /prisma\./.test(file.source))
      .map((file) => file.name);

    expect(offenders).toEqual([]);
  });

  it('keeps the public routes free of any direct Prisma import', () => {
    const publicRoutes = readFileSync(join(MODULE_DIR, 'content-hub.public.routes.ts'), 'utf8');
    expect(publicRoutes).not.toMatch(/from '\.\.\/\.\.\/lib\/prisma'/);
    expect(publicRoutes).not.toMatch(/prisma\./);
  });

  it('exposes exactly the approved public read functions', () => {
    const source = readFileSync(join(MODULE_DIR, 'content-hub.read.service.ts'), 'utf8');
    for (const fn of ['resolvePublishedContent', 'resolvePublishedList', 'resolvePublishedRelated', 'resolvePreviewContent']) {
      expect(source).toContain(`export async function ${fn}`);
    }
  });
});

describe('the lifecycle has exactly seven statuses', () => {
  it('has seven, in the approved order', () => {
    expect(CONTENT_STATUSES).toHaveLength(7);
    expect([...CONTENT_STATUSES]).toEqual([
      'draft',
      'in_review',
      'changes_requested',
      'approved',
      'published',
      'unpublished',
      'archived',
    ]);
  });

  it('has no "scheduled" status', () => {
    expect(CONTENT_STATUSES).not.toContain('scheduled');
  });

  it('never writes the literal "scheduled" into a status field', () => {
    // Scheduling is derived from `status === 'approved'` + `scheduled_for`. Re-introducing a
    // status would split "editorially ready" across two values that could drift.
    for (const file of moduleFiles()) {
      expect({ file: file.name, bad: /status:\s*'scheduled'/.test(file.source) }).toEqual({
        file: file.name,
        bad: false,
      });
      expect({ file: file.name, bad: /status:\s*"scheduled"/.test(file.source) }).toEqual({
        file: file.name,
        bad: false,
      });
    }
  });
});

describe('internal terminology never becomes public', () => {
  it('maps every internal type to a label free of AEO/GEO/SEO', () => {
    for (const label of Object.values(PUBLIC_CONTENT_LABEL)) {
      expect(label).not.toMatch(/\b(aeo|geo|seo)\b/i);
    }
  });

  it('keeps the internal type string out of the public response schema', () => {
    const source = readFileSync(join(MODULE_DIR, 'content-hub.public.schema.ts'), 'utf8');
    for (const internal of ['aeo_answer', 'geo_article', 'seo_blog']) {
      // The label enum references PUBLIC_CONTENT_LABEL keys, never the raw literals.
      expect(source).not.toContain(`'${internal}'`);
    }
  });

  it('builds the public schema independently of the admin schema', () => {
    // Deriving public shapes from admin shapes makes every future admin field public by
    // default until someone remembers to omit it.
    const source = readFileSync(join(MODULE_DIR, 'content-hub.public.schema.ts'), 'utf8');
    expect(source).not.toContain("from './content-hub.schema'");
  });
});

describe('the serializer uses allow-lists, not deny-lists', () => {
  const source = readFileSync(join(MODULE_DIR, 'content-hub.serializer.ts'), 'utf8');

  it('never spreads a raw block or row into the output', () => {
    // A single `...block` would make every unknown future field public by default.
    expect(source).not.toMatch(/\.\.\.block[,\s}]/);
    expect(source).not.toMatch(/\.\.\.row[,\s}]/);
    expect(source).not.toMatch(/\.\.\.source[,\s}]/);
  });

  it('never references the internal geo fields except to document them', () => {
    const codeLines = source
      .split('\n')
      .filter((line) => !line.trim().startsWith('*') && !line.trim().startsWith('//'));
    const joined = codeLines.join('\n');
    expect(joined).not.toContain('coreMessage');
    expect(joined).not.toContain('citationGoal');
  });
});

describe('the route registry stays public-only', () => {
  it('never points at an authenticated area', () => {
    for (const key of ROUTE_KEYS) {
      expect({ key, href: ROUTE_REGISTRY[key].href }).toEqual({
        key,
        href: expect.not.stringMatching(/^\/(app|admin|onboarding)\b/),
      });
    }
  });
});

describe('public routes carry no authentication', () => {
  it('declares no authenticate or authorize preHandler', () => {
    const source = readFileSync(join(MODULE_DIR, 'content-hub.public.routes.ts'), 'utf8');
    const code = source
      .split('\n')
      .filter((line) => !line.trim().startsWith('*') && !line.trim().startsWith('//'))
      .join('\n');
    expect(code).not.toContain('app.authenticate');
    expect(code).not.toContain('app.authorize');
  });

  it('exposes no status query parameter — published-only is not client-controllable', () => {
    const schema = readFileSync(join(MODULE_DIR, 'content-hub.public.schema.ts'), 'utf8');
    expect(schema).not.toMatch(/status:\s*z\./);
  });
});

describe('sensitive actions re-check the role inside the service', () => {
  it('checks super_admin in the services, not only the routes', () => {
    const publish = readFileSync(join(MODULE_DIR, 'content-hub.publish.service.ts'), 'utf8');
    const schedule = readFileSync(join(MODULE_DIR, 'content-hub.schedule.service.ts'), 'utf8');
    const cluster = readFileSync(join(MODULE_DIR, 'content-hub.cluster.service.ts'), 'utf8');
    const crud = readFileSync(join(MODULE_DIR, 'content-hub.service.ts'), 'utf8');

    expect(publish).toContain("actor.role !== 'super_admin'");
    expect(schedule).toContain("actor.role !== 'super_admin'");
    expect(cluster).toContain("actor.role !== 'super_admin'");
    expect(crud).toContain("actor.role !== 'super_admin'");
  });
});
