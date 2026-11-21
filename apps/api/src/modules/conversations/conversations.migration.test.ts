/**
 * Pins the reviewed chat-tables SQL (no database). The owner runs this SQL by hand, so the
 * properties that matter for safety are asserted on the file itself.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const sql = readFileSync(
  join(__dirname, '..', '..', '..', 'prisma', 'migrations', '20261120120000_chat_conversations', 'migration.sql'),
  'utf8'
);
const statements = sql
  .split('\n')
  .filter((line) => !line.trim().startsWith('--'))
  .join('\n');

describe('chat tables migration', () => {
  it('creates only the two chat tables, idempotently', () => {
    const created = [...statements.matchAll(/CREATE TABLE IF NOT EXISTS "public"\."(\w+)"/g)].map((m) => m[1]);
    expect(created).toEqual(['chat_conversations', 'chat_messages']);
    expect(statements).not.toMatch(/CREATE TABLE (?!IF NOT EXISTS)/);
    expect(statements).not.toMatch(/CREATE (UNIQUE )?INDEX (?!IF NOT EXISTS)/);
  });

  it('never touches voice sessions, billing, or existing tables', () => {
    expect(statements).not.toMatch(/app_sessions|session_messages|credits|subscriptions/);
    // Data-changing / destructive statements (FK clauses like "ON DELETE CASCADE" are fine).
    expect(statements).not.toMatch(/\bDROP\s|\bTRUNCATE\s|\bDELETE\s+FROM\b|\bUPDATE\s+"|\bINSERT\s+INTO\b/i);
    const altered = [...statements.matchAll(/ALTER TABLE "public"\."(\w+)"/g)].map((m) => m[1]);
    expect(new Set(altered)).toEqual(new Set(['chat_conversations', 'chat_messages']));
  });

  it('binds message ownership to conversation ownership with a composite FK', () => {
    expect(statements).toMatch(
      /FOREIGN KEY \("conversation_id", "user_id"\)\s+REFERENCES "public"\."chat_conversations"\("id", "user_id"\) ON DELETE CASCADE/
    );
    expect(statements).toMatch(/UNIQUE INDEX IF NOT EXISTS "chat_conversations_id_user_id_key"/);
    expect(statements).toMatch(/REFERENCES "public"\."profiles"\("id"\) ON DELETE CASCADE/);
  });

  it('enables RLS (no policies) and revokes PostgREST roles on both tables', () => {
    expect(statements).toMatch(/ALTER TABLE "public"\."chat_conversations" ENABLE ROW LEVEL SECURITY;/);
    expect(statements).toMatch(/ALTER TABLE "public"\."chat_messages" ENABLE ROW LEVEL SECURITY;/);
    expect(statements).not.toMatch(/CREATE POLICY/);
    expect(statements).toMatch(/FROM anon;/);
    expect(statements).toMatch(/FROM authenticated;/);
  });

  it('orders messages by a per-statement clock, not the transaction start time', () => {
    expect(statements).toMatch(/"created_at" TIMESTAMPTZ\(6\) NOT NULL DEFAULT clock_timestamp\(\),\s+CONSTRAINT "chat_messages_pkey"/);
  });

  it('owner-run script applies exactly the reviewed migration, inside one guarded transaction', () => {
    const ownerScript = readFileSync(
      join(__dirname, '..', '..', '..', 'prisma', 'manual-sql', '20261120_chat_conversations.owner-run.sql'),
      'utf8'
    );
    const body = sql.slice(sql.indexOf('-- ---------------------------------------------------------------------------------------------\n-- chat_conversations'));
    expect(body.length).toBeGreaterThan(1000);

    const start = ownerScript.indexOf('-- >>> BEGIN reviewed migration body >>>');
    const end = ownerScript.indexOf('-- <<< END reviewed migration body <<<');
    expect(ownerScript.slice(start, end)).toContain(body);

    const before = ownerScript.slice(0, start);
    expect(before).toMatch(/\nBEGIN;\nSET LOCAL lock_timeout = '5s';\nSET LOCAL statement_timeout = '60s';/);
    expect(ownerScript.slice(end)).toMatch(/\nCOMMIT;\n/);
    // Rollback exists only as comments.
    expect(ownerScript.split('\n').filter((l) => /DROP TABLE/.test(l)).every((l) => l.trim().startsWith('--'))).toBe(true);
  });

  it('guards role, status and duplicate-send invariants', () => {
    expect(statements).toMatch(/CHECK \("role" IN \('user', 'assistant'\)\)/);
    expect(statements).toMatch(/CHECK \("status" IN \('pending', 'complete', 'interrupted', 'failed'\)\)/);
    expect(statements).toMatch(/"chat_messages_conversation_id_client_message_id_key"/);
  });
});
