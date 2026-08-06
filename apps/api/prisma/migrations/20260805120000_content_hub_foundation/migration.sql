-- Content Hub (AEO / GEO / SEO CMS) — Phase 1 data foundation.
--
-- THREE TABLES ONLY. FAQs live inside `body` JSON, approval state lives on the content row, and
-- there is deliberately no taxonomy, media, KPI, FAQ or approval table. See
-- CONTENT_HUB_IMPLEMENTATION_PLAN.md §1 and §10.10.
--
-- DDL ONLY. Row-level security and grants live in `infra/supabase/migrations/0012_content_hub_rls.sql`,
-- following this repository's two-migration-system split.
--
-- NULLABILITY PRINCIPLE: the database models "a draft may be incomplete". Publish-time
-- requirements (meta description, author, safety notice, approvals) are enforced by validation,
-- not by NOT NULL — which would make creating a draft impossible.
--
-- DOMAIN VALUES ARE PLAIN TEXT, validated by Zod at the API boundary. This matches
-- `wellness_tools.status` and 29 of the 30 existing migrations. The one exception below is the
-- `content_links` target XOR, which is a structural invariant Zod cannot protect against direct
-- database writes — see the comment at that constraint.

-- ─────────────────────────────────────────────────────────────────────────────
-- content_items
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE "public"."content_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "editorial_ref" TEXT,
    "content_type" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "meta_description" TEXT,
    "featured_image_url" TEXT,
    "featured_image_alt" TEXT,
    "body" JSONB NOT NULL DEFAULT '{"version": 1, "blocks": []}'::jsonb,
    "type_fields" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "canonical_url_override" TEXT,
    "robots_directive" TEXT NOT NULL DEFAULT 'index,follow',
    "editorial" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "pillar" TEXT,
    "week" INTEGER,
    "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'draft',
    "founder_approval" TEXT NOT NULL DEFAULT 'pending',
    "marketing_approval" TEXT NOT NULL DEFAULT 'pending',
    "seo_approval" TEXT NOT NULL DEFAULT 'pending',
    "scheduled_for" TIMESTAMPTZ(6),
    "author_id" UUID,
    "reviewer_id" UUID,
    "reviewed_at" TIMESTAMPTZ(6),
    "created_by" UUID,
    "updated_by" UUID,
    "first_published_at" TIMESTAMPTZ(6),
    "published_at" TIMESTAMPTZ(6),
    "reading_time_minutes" INTEGER,
    "word_count" INTEGER,
    "current_revision_number" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "content_items_pkey" PRIMARY KEY ("id")
);

-- ─────────────────────────────────────────────────────────────────────────────
-- content_revisions — append-only
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE "public"."content_revisions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "content_id" UUID NOT NULL,
    "revision_number" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "trigger" TEXT NOT NULL,
    "status_at_capture" TEXT NOT NULL,
    "change_summary" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT "content_revisions_pkey" PRIMARY KEY ("id")
);

-- ─────────────────────────────────────────────────────────────────────────────
-- content_links — self-referential, intentionally cyclic
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE "public"."content_links" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "source_id" UUID NOT NULL,
    "target_kind" TEXT NOT NULL,
    "target_content_id" UUID,
    "target_route" TEXT,
    "anchor_text" TEXT,
    "relation" TEXT NOT NULL DEFAULT 'related_content',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT "content_links_pkey" PRIMARY KEY ("id")
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Indexes — content_items
-- ─────────────────────────────────────────────────────────────────────────────

-- PARTIAL UNIQUE: a soft-deleted item releases its slug for reuse. Only the database can win a
-- race between two concurrent creates, so this is enforced here rather than in the service.
CREATE UNIQUE INDEX "content_items_slug_live_key"
    ON "public"."content_items"("slug")
    WHERE "deleted_at" IS NULL;

-- PARTIAL UNIQUE: workbook references are unique among live rows, but many rows have none.
-- (A plain unique index would also permit multiple NULLs, but this additionally frees the
-- reference when an item is soft-deleted.)
CREATE UNIQUE INDEX "content_items_editorial_ref_live_key"
    ON "public"."content_items"("editorial_ref")
    WHERE "editorial_ref" IS NOT NULL AND "deleted_at" IS NULL;

-- The public /resources list — the hottest query in the feature.
CREATE INDEX "content_items_status_published_at_idx"
    ON "public"."content_items"("status", "published_at" DESC);

-- Admin type + status filter.
CREATE INDEX "content_items_content_type_status_idx"
    ON "public"."content_items"("content_type", "status");

-- Pillar cluster view.
CREATE INDEX "content_items_pillar_idx" ON "public"."content_items"("pillar");

-- Admin default sort.
CREATE INDEX "content_items_created_at_idx" ON "public"."content_items"("created_at" DESC);

CREATE INDEX "content_items_author_id_idx" ON "public"."content_items"("author_id");

CREATE INDEX "content_items_deleted_at_idx" ON "public"."content_items"("deleted_at");

-- Due-to-publish view, and the selector the (deferred) scheduled-publish cron will use.
-- Partial because only a small minority of rows ever carry a scheduled date.
CREATE INDEX "content_items_scheduled_for_idx"
    ON "public"."content_items"("scheduled_for")
    WHERE "scheduled_for" IS NOT NULL AND "deleted_at" IS NULL;

-- NO GIN INDEX ON "tags" — deliberate. This repository contains zero GIN indexes and none of its
-- 21 existing array columns is indexed. At v1 volume the planner would choose a sequential scan
-- anyway, and the admin tag filter (Prisma `hasSome` -> `tags && ARRAY[...]`) does not depend on
-- one. Adding it later is a single CREATE INDEX CONCURRENTLY with no schema or code change.
-- See CONTENT_HUB_IMPLEMENTATION_PLAN.md §1.2.2.

-- ─────────────────────────────────────────────────────────────────────────────
-- Indexes — content_revisions
-- ─────────────────────────────────────────────────────────────────────────────

-- Guards the revision counter against concurrent saves. `current_revision_number` on the item
-- lets the transaction increment atomically; this makes a gap or duplicate impossible.
CREATE UNIQUE INDEX "content_revisions_content_id_revision_number_key"
    ON "public"."content_revisions"("content_id", "revision_number");

CREATE INDEX "content_revisions_content_id_created_at_idx"
    ON "public"."content_revisions"("content_id", "created_at" DESC);

-- Makes "show me the revision that was published" a single indexed lookup rather than a scan.
CREATE INDEX "content_revisions_content_id_status_at_capture_idx"
    ON "public"."content_revisions"("content_id", "status_at_capture");

-- ─────────────────────────────────────────────────────────────────────────────
-- Indexes — content_links
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX "content_links_source_id_sort_order_idx"
    ON "public"."content_links"("source_id", "sort_order");

-- THE REVERSE LOOKUP. This index is the reason content_links is a table rather than a JSONB
-- array: "what links to this item?" powers the inbound-links panel and the publish-time
-- referential integrity check.
CREATE INDEX "content_links_target_content_id_idx"
    ON "public"."content_links"("target_content_id");

-- PARTIAL UNIQUE: no duplicate content-to-content edge of the same relation. Partial so that a
-- source may hold several route links sharing one relation.
CREATE UNIQUE INDEX "content_links_source_target_relation_key"
    ON "public"."content_links"("source_id", "target_content_id", "relation")
    WHERE "target_content_id" IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- Foreign keys
-- ─────────────────────────────────────────────────────────────────────────────

-- Attribution FKs use NO ACTION, matching every other profiles reference in this schema.
ALTER TABLE "public"."content_items"
    ADD CONSTRAINT "content_items_author_id_fkey"
    FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id")
    ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "public"."content_items"
    ADD CONSTRAINT "content_items_reviewer_id_fkey"
    FOREIGN KEY ("reviewer_id") REFERENCES "public"."profiles"("id")
    ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "public"."content_items"
    ADD CONSTRAINT "content_items_created_by_fkey"
    FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id")
    ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "public"."content_items"
    ADD CONSTRAINT "content_items_updated_by_fkey"
    FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id")
    ON DELETE NO ACTION ON UPDATE NO ACTION;

-- CASCADE: a hard-deleted item takes its history with it. Soft delete never triggers this.
ALTER TABLE "public"."content_revisions"
    ADD CONSTRAINT "content_revisions_content_id_fkey"
    FOREIGN KEY ("content_id") REFERENCES "public"."content_items"("id")
    ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "public"."content_revisions"
    ADD CONSTRAINT "content_revisions_created_by_fkey"
    FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id")
    ON DELETE NO ACTION ON UPDATE NO ACTION;

-- CASCADE both ways: deleting an item removes both its outbound links and any inbound links
-- pointing at it, so no link can outlive its endpoint.
ALTER TABLE "public"."content_links"
    ADD CONSTRAINT "content_links_source_id_fkey"
    FOREIGN KEY ("source_id") REFERENCES "public"."content_items"("id")
    ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "public"."content_links"
    ADD CONSTRAINT "content_links_target_content_id_fkey"
    FOREIGN KEY ("target_content_id") REFERENCES "public"."content_items"("id")
    ON DELETE CASCADE ON UPDATE NO ACTION;

-- ─────────────────────────────────────────────────────────────────────────────
-- Structural constraint
-- ─────────────────────────────────────────────────────────────────────────────

-- THE ONE CHECK CONSTRAINT IN THIS MIGRATION.
--
-- Exactly one of target_content_id / target_route must be set. This is a structural invariant,
-- not a domain enumeration: a row with both or neither is meaningless and the renderer would
-- have no defined behaviour for it. Zod protects the API boundary but cannot protect a direct
-- database write, a seed script, or a future service bug.
--
-- Precedent: `founding_members` (migration 20260724120000) already uses CHECK constraints, so
-- database-level checks are established practice here. Domain enumerations (status, content_type,
-- approval states) are deliberately NOT checked — those change with product decisions and would
-- each require a migration.
ALTER TABLE "public"."content_links"
    ADD CONSTRAINT "content_links_target_xor_check"
    CHECK (
        ("target_kind" = 'content' AND "target_content_id" IS NOT NULL AND "target_route" IS NULL)
        OR
        ("target_kind" = 'route' AND "target_route" IS NOT NULL AND "target_content_id" IS NULL)
    );

-- ─────────────────────────────────────────────────────────────────────────────
-- Documentation
-- ─────────────────────────────────────────────────────────────────────────────

COMMENT ON TABLE "public"."content_items" IS
    'Content Hub items: Answer (aeo_answer), Insight (geo_article), Article (seo_blog). Public URLs are /resources/<slug>; internal type names must never appear publicly.';

COMMENT ON COLUMN "public"."content_items"."editorial" IS
    'INTERNAL ONLY. Editorial strategy metadata and qualitative KPI targets. Never selected by the public query — this column is the structural public/internal boundary.';

COMMENT ON COLUMN "public"."content_items"."body" IS
    'Structured block document (never HTML). Blocks carry stable ids for React keys, drag-and-drop identity and future block-level revision diffing.';

COMMENT ON COLUMN "public"."content_items"."scheduled_for" IS
    'Planned publish time. Meaningful only while status = ''approved''; cleared automatically when the item leaves approved or any gate is withdrawn. There is no ''scheduled'' status.';

COMMENT ON COLUMN "public"."content_items"."first_published_at" IS
    'Set once on first publication and never moved, so republishing does not reset the page''s age signal. published_at carries the current publication time.';

COMMENT ON COLUMN "public"."content_items"."tags" IS
    'Normalised lowercase-kebab labels, max 10. Internal in v1: no tag routes, no tag pages, no GIN index.';

COMMENT ON TABLE "public"."content_revisions" IS
    'Append-only snapshots. Never updated or deleted; restore writes a NEW revision rather than rewriting history. The revision captured at publish is the provable approved version.';

COMMENT ON TABLE "public"."content_links" IS
    'Outbound editorial links. target_route stores a route-registry KEY, not a URL. The link graph is intentionally cyclic, so any traversal must be depth-limited or visited-set guarded.';
