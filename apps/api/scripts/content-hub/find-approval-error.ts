/**
 * Pull the real server error for the failing approval request. READ ONLY.
 *
 * The global error handler in `app.ts` persists every 5xx to `error_logs` with the message, the
 * stack, the endpoint and the request id — so the cause of the "Something went wrong on Server
 * side" toast is recorded, not lost.
 */

import 'dotenv/config';
import prisma from '../../src/lib/prisma';

async function main() {
  const recent = await prisma.error_logs.findMany({
    orderBy: { created_at: 'desc' },
    take: 40,
    select: {
      id: true,
      message: true,
      stack_trace: true,
      context: true,
      severity: true,
      created_at: true,
    },
  });

  console.log(`═══ ${recent.length} most recent server errors ═══\n`);

  for (const row of recent) {
    const ctx = (row.context ?? {}) as Record<string, unknown>;
    const endpoint = String(ctx.endpoint ?? '?');
    const isContentHub = endpoint.includes('/content');
    console.log(
      `${row.created_at.toISOString()}  ${String(ctx.method ?? '?').padEnd(6)} ${endpoint}` +
        `  status=${ctx.status_code ?? '?'}${isContentHub ? '   <<< CONTENT HUB' : ''}`
    );
    console.log(`   title: ${ctx.title ?? '?'}`);
    console.log(`   message: ${row.message}`);
    if (isContentHub && row.stack_trace) {
      console.log('   stack:');
      for (const line of row.stack_trace.split('\n').slice(0, 12)) console.log(`     ${line}`);
    }
    console.log('');
  }

  const approvals = recent.filter((r) =>
    String(((r.context ?? {}) as Record<string, unknown>).endpoint ?? '').includes('approvals')
  );
  console.log(`═══ approval-endpoint errors: ${approvals.length} ═══`);
  for (const row of approvals) {
    console.log(`\n--- ${row.created_at.toISOString()} ---`);
    console.log(row.message);
    console.log(row.stack_trace ?? '(no stack)');
  }

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
