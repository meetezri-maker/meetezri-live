-- Conversations Module (text chat) — Phase 1 persistence.
--
-- Two NEW tables, fully separate from voice: nothing here references `app_sessions`,
-- `session_messages`, or any billing / credits column, and no existing object is altered.
--
-- PRODUCTION IS NOT MANAGED BY `prisma migrate deploy` (see
-- MEMBERSHIP_ENTITLEMENTS_V1_PHASE2C_CONTINUATION_REPORT.md). The project owner executes this SQL
-- manually after review. This directory exists so the integration suite's blank-database bootstrap
-- (`prisma migrate deploy` against Docker) creates the same tables. Every statement is idempotent,
-- so a later `migrate deploy` against a database where the owner already ran it is a no-op.
--
-- Object names match Prisma's defaults for the models in schema.prisma, so `prisma migrate diff`
-- stays clean. CHECK constraints are not modelled by Prisma; they are database-level guards.

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
