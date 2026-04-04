-- Compliance / privacy / legal tables (Supabase / PostgreSQL public schema)
-- Run after 0001_app_features (requires public.profiles, public.organizations, uuid-ossp).

create extension if not exists "uuid-ossp";

-- ==========================================
-- ENUMS (idempotent)
-- ==========================================

DO $$ BEGIN
    CREATE TYPE public.privacy_request_type AS ENUM (
      'data_export',
      'data_deletion',
      'data_correction',
      'data_portability',
      'restrict_processing',
      'other'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.privacy_request_status AS ENUM (
      'pending',
      'in_progress',
      'completed',
      'rejected',
      'cancelled'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.legal_document_event_type AS ENUM ('view', 'accept');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ==========================================
-- TABLES
-- ==========================================

-- DSAR / privacy queue (admin + user-visible own rows)
CREATE TABLE IF NOT EXISTS public.privacy_requests (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  org_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  type public.privacy_request_type NOT NULL,
  status public.privacy_request_status NOT NULL DEFAULT 'pending',
  reason text,
  metadata jsonb,
  due_at timestamp with time zone,
  completed_at timestamp with time zone,
  handled_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS privacy_requests_user_id_created_at_idx
  ON public.privacy_requests (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS privacy_requests_status_due_at_idx
  ON public.privacy_requests (status, due_at);
CREATE INDEX IF NOT EXISTS privacy_requests_org_id_idx
  ON public.privacy_requests (org_id);

-- Current consent flags (one row per user; upsert from settings / signup)
CREATE TABLE IF NOT EXISTS public.user_privacy_consents (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  marketing boolean NOT NULL DEFAULT false,
  analytics boolean NOT NULL DEFAULT false,
  third_party boolean NOT NULL DEFAULT false,
  consent_version text NOT NULL DEFAULT '1',
  source text,
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Append-only history for consent changes (auditable)
CREATE TABLE IF NOT EXISTS public.consent_change_log (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  snapshot jsonb NOT NULL,
  ip_address varchar(64),
  user_agent text,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS consent_change_log_user_id_created_at_idx
  ON public.consent_change_log (user_id, created_at DESC);

-- Legal document catalog
CREATE TABLE IF NOT EXISTS public.legal_documents (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.legal_document_versions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id uuid NOT NULL REFERENCES public.legal_documents(id) ON DELETE CASCADE,
  version text NOT NULL,
  content_url text,
  content text,
  checksum text,
  published_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE (document_id, version)
);

CREATE INDEX IF NOT EXISTS legal_document_versions_document_id_idx
  ON public.legal_document_versions (document_id);

-- Views / acceptances (high volume possible)
CREATE TABLE IF NOT EXISTS public.legal_document_events (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  document_id uuid NOT NULL REFERENCES public.legal_documents(id) ON DELETE CASCADE,
  version_id uuid REFERENCES public.legal_document_versions(id) ON DELETE SET NULL,
  event_type public.legal_document_event_type NOT NULL,
  metadata jsonb,
  ip_address varchar(64),
  user_agent text,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS legal_document_events_doc_created_idx
  ON public.legal_document_events (document_id, created_at DESC);
CREATE INDEX IF NOT EXISTS legal_document_events_user_created_idx
  ON public.legal_document_events (user_id, created_at DESC);

-- External certifications (SOC2, BAA, etc.) — not “derived” dashboard scores
CREATE TABLE IF NOT EXISTS public.compliance_certifications (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  issuer text,
  status text NOT NULL DEFAULT 'active',
  valid_from date,
  valid_until date,
  last_audit_at timestamp with time zone,
  evidence_url text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS compliance_certifications_org_id_idx
  ON public.compliance_certifications (org_id);

-- Optional: human-readable retention policy rows (counts still live in domain tables)
CREATE TABLE IF NOT EXISTS public.data_retention_policies (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  resource_key text NOT NULL,
  retention_description text NOT NULL,
  retention_days integer,
  auto_delete boolean NOT NULL DEFAULT false,
  last_reviewed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE (org_id, resource_key)
);

CREATE INDEX IF NOT EXISTS data_retention_policies_org_id_idx
  ON public.data_retention_policies (org_id);

-- ==========================================
-- ROW LEVEL SECURITY
-- ==========================================

ALTER TABLE public.privacy_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_privacy_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consent_change_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_document_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_certifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_retention_policies ENABLE ROW LEVEL SECURITY;

-- ---------- privacy_requests ----------
DROP POLICY IF EXISTS "Users can view own privacy requests" ON public.privacy_requests;
CREATE POLICY "Users can view own privacy requests" ON public.privacy_requests
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create privacy requests" ON public.privacy_requests;
CREATE POLICY "Users can create privacy requests" ON public.privacy_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own privacy requests" ON public.privacy_requests;
CREATE POLICY "Users can update own privacy requests" ON public.privacy_requests
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can manage privacy requests" ON public.privacy_requests;
CREATE POLICY "Admins can manage privacy requests" ON public.privacy_requests
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN (
          'super_admin',
          'org_admin',
          'support',
          'admin'
        )
    )
  );

-- ---------- user_privacy_consents ----------
DROP POLICY IF EXISTS "Users can view own consent row" ON public.user_privacy_consents;
CREATE POLICY "Users can view own consent row" ON public.user_privacy_consents
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can upsert own consent row" ON public.user_privacy_consents;
CREATE POLICY "Users can upsert own consent row" ON public.user_privacy_consents
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own consent row" ON public.user_privacy_consents;
CREATE POLICY "Users can update own consent row" ON public.user_privacy_consents
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can read all consent rows" ON public.user_privacy_consents;
CREATE POLICY "Admins can read all consent rows" ON public.user_privacy_consents
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('super_admin', 'org_admin', 'admin')
    )
  );

-- ---------- consent_change_log ----------
DROP POLICY IF EXISTS "Users can view own consent history" ON public.consent_change_log;
CREATE POLICY "Users can view own consent history" ON public.consent_change_log
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own consent history" ON public.consent_change_log;
CREATE POLICY "Users can insert own consent history" ON public.consent_change_log
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can read consent history" ON public.consent_change_log;
CREATE POLICY "Admins can read consent history" ON public.consent_change_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('super_admin', 'org_admin', 'admin')
    )
  );

-- ---------- legal_documents & versions (public read for active flows) ----------
DROP POLICY IF EXISTS "Anyone can read active legal documents" ON public.legal_documents;
CREATE POLICY "Anyone can read active legal documents" ON public.legal_documents
  FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Admins can manage legal documents" ON public.legal_documents;
CREATE POLICY "Admins can manage legal documents" ON public.legal_documents
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('super_admin', 'org_admin', 'admin')
    )
  );

DROP POLICY IF EXISTS "Anyone can read legal document versions" ON public.legal_document_versions;
CREATE POLICY "Anyone can read legal document versions" ON public.legal_document_versions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.legal_documents d
      WHERE d.id = legal_document_versions.document_id AND d.is_active = true
    )
  );

DROP POLICY IF EXISTS "Admins can manage legal document versions" ON public.legal_document_versions;
CREATE POLICY "Admins can manage legal document versions" ON public.legal_document_versions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('super_admin', 'org_admin', 'admin')
    )
  );

-- ---------- legal_document_events ----------
DROP POLICY IF EXISTS "Users can record legal events for self" ON public.legal_document_events;
CREATE POLICY "Users can record legal events for self" ON public.legal_document_events
  FOR INSERT WITH CHECK (
    user_id IS NULL OR auth.uid() = user_id
  );

DROP POLICY IF EXISTS "Users can view own legal document events" ON public.legal_document_events;
CREATE POLICY "Users can view own legal document events" ON public.legal_document_events
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can read all legal document events" ON public.legal_document_events;
CREATE POLICY "Admins can read all legal document events" ON public.legal_document_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('super_admin', 'org_admin', 'admin')
    )
  );

-- ---------- compliance_certifications & data_retention_policies (admin) ----------
DROP POLICY IF EXISTS "Admins can read certifications" ON public.compliance_certifications;
CREATE POLICY "Admins can read certifications" ON public.compliance_certifications
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('super_admin', 'org_admin', 'admin')
    )
  );

DROP POLICY IF EXISTS "Admins can manage certifications" ON public.compliance_certifications;
CREATE POLICY "Admins can manage certifications" ON public.compliance_certifications
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('super_admin', 'org_admin', 'admin')
    )
  );

DROP POLICY IF EXISTS "Admins can read retention policies" ON public.data_retention_policies;
CREATE POLICY "Admins can read retention policies" ON public.data_retention_policies
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('super_admin', 'org_admin', 'admin')
    )
  );

DROP POLICY IF EXISTS "Admins can manage retention policies" ON public.data_retention_policies;
CREATE POLICY "Admins can manage retention policies" ON public.data_retention_policies
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('super_admin', 'org_admin', 'admin')
    )
  );
