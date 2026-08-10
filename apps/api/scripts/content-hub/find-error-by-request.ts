/**
 * Look up a persisted server error by its request id. READ ONLY.
 *
 *   npx ts-node-dev --transpile-only --respawn=false \
 *     scripts/content-hub/find-error-by-request.ts --request=req-9y
 *
 * Fastify request ids are per-process counters, not globally unique, so every match is printed
 * with its timestamp and endpoint rather than assuming the newest one is the right one.
 */

import 'dotenv/config';
import prisma from '../../src/lib/prisma';

const REQUEST_ID = process.argv.slice(2).find((a) => a.startsWith('--request='))?.split('=')[1];

async function main() {
  if (!REQUEST_ID) {
    console.log('REFUSED: --request=<id> is required.');
    await prisma.$disconnect();
    process.exit(2);
  }

  const total = await prisma.error_logs.count();
  console.log(`error_logs rows in total: ${total}\n`);

  const matches = await prisma.error_logs.findMany({
    where: { context: { path: ['requestId'], equals: REQUEST_ID } },
    orderBy: { created_at: 'desc' },
    select: {
      id: true,
      message: true,
      stack_trace: true,
      context: true,
      severity: true,
      status: true,
      created_at: true,
    },
  });

  console.log(`═══ matches for requestId="${REQUEST_ID}": ${matches.length} ═══`);

  for (const row of matches) {
    const ctx = (row.context ?? {}) as Record<string, unknown>;
    console.log(`\n─── ${row.created_at.toISOString()} (${row.id}) ───`);
    console.log(`  endpoint : ${ctx.method ?? '?'} ${ctx.endpoint ?? '?'}`);
    console.log(`  status   : ${ctx.status_code ?? '?'}`);
    console.log(`  title    : ${ctx.title ?? '?'}`);
    console.log(`  user_id  : ${ctx.user_id ?? 'null'}`);
    console.log(`  severity : ${row.severity} / ${row.status}`);
    console.log(`  message  : ${row.message}`);
    console.log('  stack:');
    for (const line of (row.stack_trace ?? '(none)').split('\n').slice(0, 30)) {
      console.log(`    ${line}`);
    }
  }

  if (matches.length === 0) {
    console.log('\nNo exact match. Most recent 10 errors for context:\n');
    const recent = await prisma.error_logs.findMany({
      orderBy: { created_at: 'desc' },
      take: 10,
      select: { message: true, context: true, created_at: true },
    });
    for (const row of recent) {
      const ctx = (row.context ?? {}) as Record<string, unknown>;
      console.log(
        `  ${row.created_at.toISOString()}  ${ctx.method ?? '?'} ${ctx.endpoint ?? '?'}  ` +
          `req=${ctx.requestId ?? '?'}  ${String(row.message).slice(0, 120)}`
      );
    }
  }

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
