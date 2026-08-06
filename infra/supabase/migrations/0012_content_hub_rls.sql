-- Content Hub — row-level security and grants.
--
-- Run against the Supabase project (Dashboard -> SQL -> New query), following the same manual
-- process as 0009/0010. Table DDL lives in the Prisma migration
-- `20260805120000_content_hub_foundation`; this file contains ONLY RLS and grants, matching this
-- repository's two-migration-system split.
--
-- ============================================================================
-- SECURITY POSTURE: DENY BY DEFAULT. NO DIRECT TABLE ACCESS FOR anon OR authenticated.
-- ============================================================================
--
-- Unlike `personal_goals` or `safety_plans` — which the browser reads directly through PostgREST
-- and which therefore need permissive per-user policies — the Content Hub tables are reached
-- ONLY through the Fastify API:
--
--   * admin   -> /api/admin/content/*  (authenticate + authorize, super_admin / org_admin)
--   * public  -> /api/content/*        (unauthenticated, published-only, public serializer)
--
-- Granting anon or authenticated any direct SELECT here would create a second read path that
-- bypasses the public serializer. That matters more than usual, because:
--
--   RLS FILTERS ROWS, NOT FIELDS.
--
-- A policy can restrict which rows are visible; it cannot hide the `editorial` column or the
-- internal keys inside `type_fields` and `geo_statement` blocks. An anon SELECT on a *published*
-- row would still return every internal editorial field — the exact disclosure the serializer
-- exists to prevent. So the serializer remains mandatory, and this file makes sure nothing can
-- route around it.
--
-- NOTE ON ENFORCEMENT LAYERING: the API connects via Prisma using a privileged role that BYPASSES
-- RLS. RLS here is therefore defence-in-depth against accidental PostgREST/anon-key exposure, not
-- the primary control. The primary controls are:
--   1. API route guards      (app.authenticate + app.authorize)  — authorization
--   2. The public serializer (field-level allow-lists)           — disclosure
--   3. These policies/grants (deny by default)                   — blast-radius containment

-- Required so the API roles can resolve objects in `public` at all (idempotent; already granted
-- by 0009, repeated here so this file is self-contained).
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- Enable RLS
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.content_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_links ENABLE ROW LEVEL SECURITY;

-- Force RLS for the table owner too, so a mistakenly-owned connection cannot silently read
-- everything. The service_role grants below are what the API relies on.
ALTER TABLE public.content_items FORCE ROW LEVEL SECURITY;
ALTER TABLE public.content_revisions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.content_links FORCE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- Remove any inherited privileges
-- ─────────────────────────────────────────────────────────────────────────────
-- Deliberately NO policies are created for `anon` or `authenticated`. With RLS enabled and no
-- permissive policy, every statement from those roles returns zero rows / is rejected. The
-- explicit REVOKEs below mean the tables are also unreadable if a future migration adds a
-- blanket `GRANT ... ON ALL TABLES IN SCHEMA public`.

REVOKE ALL ON TABLE public.content_items FROM anon, authenticated;
REVOKE ALL ON TABLE public.content_revisions FROM anon, authenticated;
REVOKE ALL ON TABLE public.content_links FROM anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Service role — the only principal with access
-- ─────────────────────────────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.content_items TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.content_links TO service_role;

-- APPEND-ONLY: revisions may be created and read, never modified or removed.
-- Restore writes a NEW revision rather than rewriting history, so nothing legitimate needs
-- UPDATE or DELETE here. Enforced at the application level too (no such code path exists);
-- withholding the privilege makes an accidental one fail loudly.
GRANT SELECT, INSERT ON TABLE public.content_revisions TO service_role;

DROP POLICY IF EXISTS "Service role manages content items" ON public.content_items;
CREATE POLICY "Service role manages content items" ON public.content_items
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role manages content links" ON public.content_links;
CREATE POLICY "Service role manages content links" ON public.content_links
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role reads content revisions" ON public.content_revisions;
CREATE POLICY "Service role reads content revisions" ON public.content_revisions
  FOR SELECT
  TO service_role
  USING (true);

DROP POLICY IF EXISTS "Service role appends content revisions" ON public.content_revisions;
CREATE POLICY "Service role appends content revisions" ON public.content_revisions
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- Consequences, stated explicitly
-- ─────────────────────────────────────────────────────────────────────────────
--
--   * Ordinary members (authenticated) cannot read drafts        — no policy, no grant
--   * Ordinary members cannot create or edit content             — no policy, no grant
--   * Anonymous visitors cannot read the tables at all           — no policy, no grant
--   * Published content reaches the public ONLY via /api/content, through the serializer
--   * Admin authorization stays in the API (role checks), not in RLS
--   * `editorial` and internal `type_fields` are unreachable by any non-service principal
--   * Revisions cannot be updated or deleted by any principal
--
-- IF A FUTURE PHASE NEEDS DIRECT PUBLIC READS (it should not): do not grant SELECT on
-- `content_items`. Expose a view that projects only public columns and excludes `editorial`,
-- then grant on the view. A row-level policy alone would leak every internal field.
