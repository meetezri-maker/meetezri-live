/**
 * Week 1 preflight — READ ONLY.
 *
 * Issues SELECTs and nothing else. Its job is to answer the questions Phase 5B Task 1 requires
 * before a single byte is written: which database is this, does it already hold Content Hub data,
 * and does anything already claim the three Week 1 editorial references?
 *
 * Run:
 *   npx ts-node --transpile-only scripts/content-hub/inspect-week1.ts
 */

import 'dotenv/config';
import prisma from '../../src/lib/prisma';
import { APPROVAL_GATES, ROUTE_KEYS, ROUTE_REGISTRY } from '@meetezri/shared';

const EDITORIAL_REFS = ['W1-A001', 'W1-G001', 'W1-B001'];
const WEEK1_SLUGS = [
  'what-should-i-do-when-i-have-nobody-to-talk-to',
  'why-talking-through-thoughts-can-make-them-feel-lighter',
  'someone-to-talk-to-at-night',
];

/** Host and database only — never the credentials. */
function describeTarget(): { host: string; database: string; project: string } {
  const raw = process.env.DATABASE_URL ?? '';
  const match = raw.match(/^\w+:\/\/([^:@/]+)(?::[^@]*)?@([^/?]+)\/([^?]*)/);
  if (!match) return { host: '(unparseable)', database: '(unknown)', project: '(unknown)' };
  const [, user, host, database] = match;
  // Supabase encodes the project ref in the pooler username (`postgres.<ref>`) or the direct host.
  const fromUser = user.includes('.') ? user.split('.').slice(1).join('.') : '';
  const fromHost = host.startsWith('db.') ? host.split('.')[1] : '';
  return { host, database, project: fromUser || fromHost || '(unknown)' };
}

async function main() {
  const target = describeTarget();

  console.log('═══ DATABASE TARGET ═══');
  console.log(`  host          : ${target.host}`);
  console.log(`  database      : ${target.database}`);
  console.log(`  supabase ref  : ${target.project}`);
  console.log(`  SUPABASE_URL  : ${process.env.SUPABASE_URL ?? '(unset)'}`);
  console.log(`  WEB_BASE_URL  : ${process.env.WEB_BASE_URL ?? '(unset)'}`);
  console.log(`  PUBLIC_SITE_ORIGIN: ${process.env.PUBLIC_SITE_ORIGIN ?? '(unset)'}`);

  console.log('\n═══ CONTENT HUB TABLES ═══');
  const tables = await prisma.$queryRawUnsafe<Array<{ table_name: string }>>(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_name IN ('content_items','content_revisions','content_links')
     ORDER BY table_name`
  );
  for (const name of ['content_items', 'content_revisions', 'content_links']) {
    console.log(`  ${name.padEnd(20)}: ${tables.some((t) => t.table_name === name) ? 'present' : 'MISSING'}`);
  }

  console.log('\n═══ RLS STATE ═══');
  const rls = await prisma.$queryRawUnsafe<Array<{ relname: string; relrowsecurity: boolean }>>(
    `SELECT c.relname, c.relrowsecurity
     FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relname IN ('content_items','content_revisions','content_links')
     ORDER BY c.relname`
  );
  for (const row of rls) {
    console.log(`  ${row.relname.padEnd(20)}: row security ${row.relrowsecurity ? 'ENABLED' : 'DISABLED'}`);
  }

  console.log('\n═══ EXISTING CONTENT HUB RECORDS ═══');
  const total = await prisma.content_items.count();
  const notDeleted = await prisma.content_items.count({ where: { deleted_at: null } });
  console.log(`  content_items      : ${total} total, ${notDeleted} not deleted`);
  console.log(`  content_links      : ${await prisma.content_links.count()}`);
  console.log(`  content_revisions  : ${await prisma.content_revisions.count()}`);

  const byStatus = await prisma.content_items.groupBy({
    by: ['status'],
    _count: { _all: true },
    where: { deleted_at: null },
  });
  for (const group of byStatus) {
    console.log(`    status ${String(group.status).padEnd(20)}: ${group._count._all}`);
  }

  console.log('\n═══ WEEK 1 EDITORIAL REFS ═══');
  const existing = await prisma.content_items.findMany({
    where: { editorial_ref: { in: EDITORIAL_REFS } },
    select: {
      id: true,
      editorial_ref: true,
      content_type: true,
      title: true,
      slug: true,
      status: true,
      week: true,
      pillar: true,
      author_id: true,
      deleted_at: true,
      created_at: true,
      updated_at: true,
      current_revision_number: true,
    },
  });
  if (existing.length === 0) {
    console.log('  none — this would be a first import');
  }
  for (const row of existing) {
    console.log(
      `  ${row.editorial_ref}: id=${row.id} type=${row.content_type} status=${row.status} ` +
        `slug=${row.slug} revs=${row.current_revision_number} deleted=${!!row.deleted_at}`
    );
  }

  console.log('\n═══ WEEK 1 SLUGS (any owner) ═══');
  const slugOwners = await prisma.content_items.findMany({
    where: { slug: { in: WEEK1_SLUGS } },
    select: { id: true, slug: true, editorial_ref: true, status: true, deleted_at: true },
  });
  if (slugOwners.length === 0) console.log('  none taken');
  for (const row of slugOwners) {
    console.log(`  ${row.slug}: id=${row.id} ref=${row.editorial_ref} status=${row.status}`);
  }

  console.log('\n═══ CANDIDATE AUTHOR / REVIEWER PROFILES ═══');
  const admins = await prisma.profiles.findMany({
    where: { role: { in: ['super_admin', 'org_admin', 'team_admin'] } },
    select: { id: true, full_name: true, role: true, email: true },
    orderBy: { role: 'asc' },
    take: 25,
  });
  if (admins.length === 0) console.log('  no admin profiles found');
  for (const profile of admins) {
    // Email is masked: this output goes into a report.
    const masked = profile.email ? `${profile.email.slice(0, 2)}***@${profile.email.split('@')[1] ?? ''}` : '(none)';
    console.log(`  ${profile.role?.padEnd(12)} ${profile.full_name ?? '(no name)'} <${masked}> id=${profile.id}`);
  }

  console.log('\n═══ APPROVAL GATES CONFIGURED ═══');
  console.log(`  ${APPROVAL_GATES.join(', ')}`);

  console.log('\n═══ ROUTE REGISTRY ═══');
  for (const key of ROUTE_KEYS) {
    const entry = ROUTE_REGISTRY[key] as { href: string; label: string; interim?: boolean };
    console.log(`  ${key.padEnd(22)} -> ${entry.href}${entry.interim ? '   (INTERIM)' : ''}`);
  }

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error('inspect-week1 failed:', error);
  await prisma.$disconnect();
  process.exit(1);
});
