-- =============================================================================================
-- Conversations Module (text chat) — OWNER-RUN SCRIPT for Solace Supabase.
--
-- Run by hand in the Supabase SQL editor, one STEP at a time, reading each result before going on.
-- STEP 2 is the only step that changes anything. It is byte-for-byte the reviewed migration
-- (prisma/migrations/20261120120000_chat_conversations/migration.sql), wrapped in a transaction —
-- a unit test fails if the two ever drift.
--
-- What STEP 2 does: creates two NEW tables (chat_conversations, chat_messages) plus their indexes,
-- enables RLS with no policies, and revokes anon/authenticated. It alters no existing table.
-- Side effect to know about: the FK to public.profiles briefly takes a SHARE ROW EXCLUSIVE lock on
-- profiles (blocks profile writes, not reads, for milliseconds on an idle table). lock_timeout
-- makes it give up after 5s instead of queueing behind a long transaction — if that happens,
-- nothing is applied; just re-run STEP 2 at a quieter moment.
-- =============================================================================================

-- ---------------------------------------------------------------------------------------------
-- STEP 1 — PRE-FLIGHT (read-only). Expected: zero rows from each query.
-- If anything is returned, STOP: an object with one of these names already exists, and the
-- IF NOT EXISTS clauses below would silently keep the old one.
-- ---------------------------------------------------------------------------------------------
SELECT n.nspname AS schema, c.relname AS name, c.relkind AS kind
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND (c.relname IN ('chat_conversations', 'chat_messages') OR c.relname LIKE 'chat\_conversations\_%' OR c.relname LIKE 'chat\_messages\_%');

SELECT conname FROM pg_constraint WHERE conname LIKE 'chat\_conversations\_%' OR conname LIKE 'chat\_messages\_%';

-- Expected: one row, typname = 'uuid' (the FK target exists and is a uuid primary key).
SELECT a.attname, t.typname
FROM pg_index i
JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY (i.indkey)
JOIN pg_type t ON t.oid = a.atttypid
WHERE i.indrelid = 'public.profiles'::regclass AND i.indisprimary;

-- ---------------------------------------------------------------------------------------------
-- STEP 2 — APPLY (the only writing step). All-or-nothing.
-- ---------------------------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- >>> BEGIN reviewed migration body >>>
-- ---------------------------------------------------------------------------------------------
-- chat_conversations
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "public"."chat_conversations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    -- Canonical companion id from DEFAULT_AI_COMPANIONS (e.g. 'Sara Mitchell'), never a display name.
    "companion_key" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'New conversation',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),
    "last_message_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT "chat_conversations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "chat_conversations_user_id_fkey" FOREIGN KEY ("user_id")
        REFERENCES "public"."profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "chat_conversations_companion_key_check"
        CHECK (char_length(btrim("companion_key")) BETWEEN 1 AND 100),
    CONSTRAINT "chat_conversations_title_check"
        CHECK (char_length(btrim("title")) BETWEEN 1 AND 200)
);

-- Target of the composite foreign key below: a message can only point at a conversation owned by
-- the SAME user_id it carries, so ownership cannot drift between the two tables.
CREATE UNIQUE INDEX IF NOT EXISTS "chat_conversations_id_user_id_key"
    ON "public"."chat_conversations"("id", "user_id");

-- Member's list, most recent first, with a stable tie-breaker for cursor pagination.
CREATE INDEX IF NOT EXISTS "chat_conversations_user_id_last_message_at_id_idx"
    ON "public"."chat_conversations"("user_id", "last_message_at" DESC, "id" DESC);

-- ---------------------------------------------------------------------------------------------
-- chat_messages
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "public"."chat_messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "conversation_id" UUID NOT NULL,
    -- Denormalised owner; enforced equal to the conversation's owner by the composite FK.
    "user_id" UUID NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'complete',
    -- Client-generated id for duplicate-send prevention (Phase 2). NULLs are distinct in PostgreSQL,
    -- so rows without one never collide.
    "client_message_id" UUID,
    -- clock_timestamp(), not now(): now() is frozen at transaction start, so a user message and its
    -- reply written in one transaction would share a timestamp and fall back to the random-uuid
    -- tie-breaker, which can show the reply before the question.
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "chat_messages_conversation_id_user_id_fkey" FOREIGN KEY ("conversation_id", "user_id")
        REFERENCES "public"."chat_conversations"("id", "user_id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "chat_messages_role_check" CHECK ("role" IN ('user', 'assistant')),
    -- 'pending': a user message whose reply is in flight. The API uses it (with a staleness window)
    -- to enforce one reply at a time per conversation without in-memory state, which serverless
    -- instances cannot share.
    CONSTRAINT "chat_messages_status_check" CHECK ("status" IN ('pending', 'complete', 'interrupted', 'failed')),
    CONSTRAINT "chat_messages_content_check" CHECK (char_length("content") BETWEEN 1 AND 20000)
);

CREATE UNIQUE INDEX IF NOT EXISTS "chat_messages_conversation_id_client_message_id_key"
    ON "public"."chat_messages"("conversation_id", "client_message_id");

-- Thread read in order (oldest first) with a stable tie-breaker for cursor pagination.
CREATE INDEX IF NOT EXISTS "chat_messages_conversation_id_created_at_id_idx"
    ON "public"."chat_messages"("conversation_id", "created_at", "id");

-- Per-user usage counting (Phase 5 limits).
CREATE INDEX IF NOT EXISTS "chat_messages_user_id_created_at_idx"
    ON "public"."chat_messages"("user_id", "created_at" DESC);

-- ---------------------------------------------------------------------------------------------
-- Security: the API is the only reader/writer.
--
-- Supabase exposes `public` tables through PostgREST to the `anon` and `authenticated` roles. With
-- RLS enabled and NO policies, those roles can read nothing; the Solace API (Prisma, connecting as
-- the table owner / a BYPASSRLS role — the same way it already reads the RLS-enabled tables flagged
-- in schema.prisma) is unaffected. Explicit REVOKEs are defence in depth. The role checks keep this
-- runnable on the plain-PostgreSQL integration database, where those roles do not exist.
-- ---------------------------------------------------------------------------------------------
ALTER TABLE "public"."chat_conversations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."chat_messages" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE "public"."chat_conversations", "public"."chat_messages" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "public"."chat_conversations", "public"."chat_messages" FROM authenticated;
  END IF;
END
$$;
-- <<< END reviewed migration body <<<

COMMIT;

-- ---------------------------------------------------------------------------------------------
-- STEP 3 — VERIFY (read-only).
-- ---------------------------------------------------------------------------------------------
-- Expected: 2 rows, rowsecurity = true. Note tableowner for the next check.
SELECT tablename, tableowner, rowsecurity FROM pg_tables
WHERE schemaname = 'public' AND tablename IN ('chat_conversations', 'chat_messages');

-- Expected: 7 rows (2 primary keys + 2 unique + 3 plain indexes).
SELECT tablename, indexname FROM pg_indexes
WHERE schemaname = 'public' AND tablename IN ('chat_conversations', 'chat_messages') ORDER BY 1, 2;

-- Expected: 9 rows — 2 primary keys (p), 2 foreign keys (f), 5 CHECKs (c). The two unique keys are
-- unique INDEXES (listed above), not constraints.
SELECT conrelid::regclass AS table_name, conname, contype FROM pg_constraint
WHERE conrelid IN ('public.chat_conversations'::regclass, 'public.chat_messages'::regclass) ORDER BY 1, 2;

-- Expected: no rows (anon / authenticated hold no privileges on the chat tables).
SELECT grantee, table_name, privilege_type FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name IN ('chat_conversations', 'chat_messages')
  AND grantee IN ('anon', 'authenticated');

-- API access check: run while connected AS THE API's DATABASE_URL ROLE (e.g. via psql with that URL).
-- It must either own the tables (tableowner above) or have rolbypassrls = true; otherwise RLS will
-- hide every row from the API and it must instead be GRANTed access + given a policy (ask first).
SELECT current_user, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user;

-- ---------------------------------------------------------------------------------------------
-- ROLLBACK — only before release, while the tables hold no member data. Deliberately commented.
-- ---------------------------------------------------------------------------------------------
-- BEGIN;
-- DROP TABLE IF EXISTS "public"."chat_messages";
-- DROP TABLE IF EXISTS "public"."chat_conversations";
-- COMMIT;
