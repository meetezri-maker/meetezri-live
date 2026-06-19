-- ============================================================
-- CRISIS HOTLINES — paste into Supabase → SQL Editor → Run
-- ============================================================

-- 1) Tables + profile column
CREATE TABLE IF NOT EXISTS public.crisis_hotline_countries (
  country_code VARCHAR(2) PRIMARY KEY,
  country_name TEXT NOT NULL,
  dial_code TEXT NOT NULL,
  emergency_phone TEXT,
  region_bucket TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.crisis_hotline_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code VARCHAR(2) NOT NULL REFERENCES public.crisis_hotline_countries(country_code) ON DELETE CASCADE,
  resource_key TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  description TEXT,
  url TEXT,
  availability TEXT NOT NULL DEFAULT '24/7',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (country_code, resource_key)
);

CREATE INDEX IF NOT EXISTS crisis_hotline_resources_country_code_idx
  ON public.crisis_hotline_resources(country_code);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS crisis_country_code VARCHAR(2);

-- 2) Countries
INSERT INTO public.crisis_hotline_countries (country_code, country_name, dial_code, emergency_phone, region_bucket)
VALUES ('US', 'United States', '+1', '911', 'US')
ON CONFLICT (country_code) DO UPDATE SET
  country_name = EXCLUDED.country_name,
  dial_code = EXCLUDED.dial_code,
  emergency_phone = EXCLUDED.emergency_phone,
  region_bucket = EXCLUDED.region_bucket,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_countries (country_code, country_name, dial_code, emergency_phone, region_bucket)
VALUES ('CA', 'Canada', '+1', '911', 'CA')
ON CONFLICT (country_code) DO UPDATE SET
  country_name = EXCLUDED.country_name,
  dial_code = EXCLUDED.dial_code,
  emergency_phone = EXCLUDED.emergency_phone,
  region_bucket = EXCLUDED.region_bucket,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_countries (country_code, country_name, dial_code, emergency_phone, region_bucket)
VALUES ('GB', 'United Kingdom', '+44', '999', 'UK')
ON CONFLICT (country_code) DO UPDATE SET
  country_name = EXCLUDED.country_name,
  dial_code = EXCLUDED.dial_code,
  emergency_phone = EXCLUDED.emergency_phone,
  region_bucket = EXCLUDED.region_bucket,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_countries (country_code, country_name, dial_code, emergency_phone, region_bucket)
VALUES ('IE', 'Ireland', '+353', '112', 'EU')
ON CONFLICT (country_code) DO UPDATE SET
  country_name = EXCLUDED.country_name,
  dial_code = EXCLUDED.dial_code,
  emergency_phone = EXCLUDED.emergency_phone,
  region_bucket = EXCLUDED.region_bucket,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_countries (country_code, country_name, dial_code, emergency_phone, region_bucket)
VALUES ('AU', 'Australia', '+61', '000', 'AU')
ON CONFLICT (country_code) DO UPDATE SET
  country_name = EXCLUDED.country_name,
  dial_code = EXCLUDED.dial_code,
  emergency_phone = EXCLUDED.emergency_phone,
  region_bucket = EXCLUDED.region_bucket,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_countries (country_code, country_name, dial_code, emergency_phone, region_bucket)
VALUES ('NZ', 'New Zealand', '+64', '111', 'GLOBAL')
ON CONFLICT (country_code) DO UPDATE SET
  country_name = EXCLUDED.country_name,
  dial_code = EXCLUDED.dial_code,
  emergency_phone = EXCLUDED.emergency_phone,
  region_bucket = EXCLUDED.region_bucket,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_countries (country_code, country_name, dial_code, emergency_phone, region_bucket)
VALUES ('FR', 'France', '+33', '112', 'EU')
ON CONFLICT (country_code) DO UPDATE SET
  country_name = EXCLUDED.country_name,
  dial_code = EXCLUDED.dial_code,
  emergency_phone = EXCLUDED.emergency_phone,
  region_bucket = EXCLUDED.region_bucket,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_countries (country_code, country_name, dial_code, emergency_phone, region_bucket)
VALUES ('DE', 'Germany', '+49', '112', 'EU')
ON CONFLICT (country_code) DO UPDATE SET
  country_name = EXCLUDED.country_name,
  dial_code = EXCLUDED.dial_code,
  emergency_phone = EXCLUDED.emergency_phone,
  region_bucket = EXCLUDED.region_bucket,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_countries (country_code, country_name, dial_code, emergency_phone, region_bucket)
VALUES ('NL', 'Netherlands', '+31', '112', 'EU')
ON CONFLICT (country_code) DO UPDATE SET
  country_name = EXCLUDED.country_name,
  dial_code = EXCLUDED.dial_code,
  emergency_phone = EXCLUDED.emergency_phone,
  region_bucket = EXCLUDED.region_bucket,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_countries (country_code, country_name, dial_code, emergency_phone, region_bucket)
VALUES ('ES', 'Spain', '+34', '112', 'EU')
ON CONFLICT (country_code) DO UPDATE SET
  country_name = EXCLUDED.country_name,
  dial_code = EXCLUDED.dial_code,
  emergency_phone = EXCLUDED.emergency_phone,
  region_bucket = EXCLUDED.region_bucket,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_countries (country_code, country_name, dial_code, emergency_phone, region_bucket)
VALUES ('BE', 'Belgium', '+32', '112', 'EU')
ON CONFLICT (country_code) DO UPDATE SET
  country_name = EXCLUDED.country_name,
  dial_code = EXCLUDED.dial_code,
  emergency_phone = EXCLUDED.emergency_phone,
  region_bucket = EXCLUDED.region_bucket,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_countries (country_code, country_name, dial_code, emergency_phone, region_bucket)
VALUES ('CH', 'Switzerland', '+41', '112', 'EU')
ON CONFLICT (country_code) DO UPDATE SET
  country_name = EXCLUDED.country_name,
  dial_code = EXCLUDED.dial_code,
  emergency_phone = EXCLUDED.emergency_phone,
  region_bucket = EXCLUDED.region_bucket,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_countries (country_code, country_name, dial_code, emergency_phone, region_bucket)
VALUES ('AT', 'Austria', '+43', '112', 'EU')
ON CONFLICT (country_code) DO UPDATE SET
  country_name = EXCLUDED.country_name,
  dial_code = EXCLUDED.dial_code,
  emergency_phone = EXCLUDED.emergency_phone,
  region_bucket = EXCLUDED.region_bucket,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_countries (country_code, country_name, dial_code, emergency_phone, region_bucket)
VALUES ('IT', 'Italy', '+39', '112', 'EU')
ON CONFLICT (country_code) DO UPDATE SET
  country_name = EXCLUDED.country_name,
  dial_code = EXCLUDED.dial_code,
  emergency_phone = EXCLUDED.emergency_phone,
  region_bucket = EXCLUDED.region_bucket,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_countries (country_code, country_name, dial_code, emergency_phone, region_bucket)
VALUES ('SE', 'Sweden', '+46', '112', 'EU')
ON CONFLICT (country_code) DO UPDATE SET
  country_name = EXCLUDED.country_name,
  dial_code = EXCLUDED.dial_code,
  emergency_phone = EXCLUDED.emergency_phone,
  region_bucket = EXCLUDED.region_bucket,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_countries (country_code, country_name, dial_code, emergency_phone, region_bucket)
VALUES ('NO', 'Norway', '+47', '112', 'EU')
ON CONFLICT (country_code) DO UPDATE SET
  country_name = EXCLUDED.country_name,
  dial_code = EXCLUDED.dial_code,
  emergency_phone = EXCLUDED.emergency_phone,
  region_bucket = EXCLUDED.region_bucket,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_countries (country_code, country_name, dial_code, emergency_phone, region_bucket)
VALUES ('DK', 'Denmark', '+45', '112', 'EU')
ON CONFLICT (country_code) DO UPDATE SET
  country_name = EXCLUDED.country_name,
  dial_code = EXCLUDED.dial_code,
  emergency_phone = EXCLUDED.emergency_phone,
  region_bucket = EXCLUDED.region_bucket,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_countries (country_code, country_name, dial_code, emergency_phone, region_bucket)
VALUES ('FI', 'Finland', '+358', '112', 'EU')
ON CONFLICT (country_code) DO UPDATE SET
  country_name = EXCLUDED.country_name,
  dial_code = EXCLUDED.dial_code,
  emergency_phone = EXCLUDED.emergency_phone,
  region_bucket = EXCLUDED.region_bucket,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_countries (country_code, country_name, dial_code, emergency_phone, region_bucket)
VALUES ('PT', 'Portugal', '+351', '112', 'EU')
ON CONFLICT (country_code) DO UPDATE SET
  country_name = EXCLUDED.country_name,
  dial_code = EXCLUDED.dial_code,
  emergency_phone = EXCLUDED.emergency_phone,
  region_bucket = EXCLUDED.region_bucket,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_countries (country_code, country_name, dial_code, emergency_phone, region_bucket)
VALUES ('PL', 'Poland', '+48', '112', 'EU')
ON CONFLICT (country_code) DO UPDATE SET
  country_name = EXCLUDED.country_name,
  dial_code = EXCLUDED.dial_code,
  emergency_phone = EXCLUDED.emergency_phone,
  region_bucket = EXCLUDED.region_bucket,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_countries (country_code, country_name, dial_code, emergency_phone, region_bucket)
VALUES ('HU', 'Hungary', '+36', '112', 'EU')
ON CONFLICT (country_code) DO UPDATE SET
  country_name = EXCLUDED.country_name,
  dial_code = EXCLUDED.dial_code,
  emergency_phone = EXCLUDED.emergency_phone,
  region_bucket = EXCLUDED.region_bucket,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_countries (country_code, country_name, dial_code, emergency_phone, region_bucket)
VALUES ('GR', 'Greece', '+30', '112', 'EU')
ON CONFLICT (country_code) DO UPDATE SET
  country_name = EXCLUDED.country_name,
  dial_code = EXCLUDED.dial_code,
  emergency_phone = EXCLUDED.emergency_phone,
  region_bucket = EXCLUDED.region_bucket,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_countries (country_code, country_name, dial_code, emergency_phone, region_bucket)
VALUES ('RO', 'Romania', '+40', '112', 'EU')
ON CONFLICT (country_code) DO UPDATE SET
  country_name = EXCLUDED.country_name,
  dial_code = EXCLUDED.dial_code,
  emergency_phone = EXCLUDED.emergency_phone,
  region_bucket = EXCLUDED.region_bucket,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_countries (country_code, country_name, dial_code, emergency_phone, region_bucket)
VALUES ('RU', 'Russia', '+7', '112', 'GLOBAL')
ON CONFLICT (country_code) DO UPDATE SET
  country_name = EXCLUDED.country_name,
  dial_code = EXCLUDED.dial_code,
  emergency_phone = EXCLUDED.emergency_phone,
  region_bucket = EXCLUDED.region_bucket,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_countries (country_code, country_name, dial_code, emergency_phone, region_bucket)
VALUES ('TR', 'Turkey', '+90', '112', 'GLOBAL')
ON CONFLICT (country_code) DO UPDATE SET
  country_name = EXCLUDED.country_name,
  dial_code = EXCLUDED.dial_code,
  emergency_phone = EXCLUDED.emergency_phone,
  region_bucket = EXCLUDED.region_bucket,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_countries (country_code, country_name, dial_code, emergency_phone, region_bucket)
VALUES ('IL', 'Israel', '+972', '100', 'GLOBAL')
ON CONFLICT (country_code) DO UPDATE SET
  country_name = EXCLUDED.country_name,
  dial_code = EXCLUDED.dial_code,
  emergency_phone = EXCLUDED.emergency_phone,
  region_bucket = EXCLUDED.region_bucket,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_countries (country_code, country_name, dial_code, emergency_phone, region_bucket)
VALUES ('AE', 'United Arab Emirates', '+971', '999', 'GLOBAL')
ON CONFLICT (country_code) DO UPDATE SET
  country_name = EXCLUDED.country_name,
  dial_code = EXCLUDED.dial_code,
  emergency_phone = EXCLUDED.emergency_phone,
  region_bucket = EXCLUDED.region_bucket,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_countries (country_code, country_name, dial_code, emergency_phone, region_bucket)
VALUES ('SA', 'Saudi Arabia', '+966', '911', 'GLOBAL')
ON CONFLICT (country_code) DO UPDATE SET
  country_name = EXCLUDED.country_name,
  dial_code = EXCLUDED.dial_code,
  emergency_phone = EXCLUDED.emergency_phone,
  region_bucket = EXCLUDED.region_bucket,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_countries (country_code, country_name, dial_code, emergency_phone, region_bucket)
VALUES ('QA', 'Qatar', '+974', '999', 'GLOBAL')
ON CONFLICT (country_code) DO UPDATE SET
  country_name = EXCLUDED.country_name,
  dial_code = EXCLUDED.dial_code,
  emergency_phone = EXCLUDED.emergency_phone,
  region_bucket = EXCLUDED.region_bucket,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_countries (country_code, country_name, dial_code, emergency_phone, region_bucket)
VALUES ('KW', 'Kuwait', '+965', '112', 'GLOBAL')
ON CONFLICT (country_code) DO UPDATE SET
  country_name = EXCLUDED.country_name,
  dial_code = EXCLUDED.dial_code,
  emergency_phone = EXCLUDED.emergency_phone,
  region_bucket = EXCLUDED.region_bucket,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_countries (country_code, country_name, dial_code, emergency_phone, region_bucket)
VALUES ('JO', 'Jordan', '+962', '911', 'GLOBAL')
ON CONFLICT (country_code) DO UPDATE SET
  country_name = EXCLUDED.country_name,
  dial_code = EXCLUDED.dial_code,
  emergency_phone = EXCLUDED.emergency_phone,
  region_bucket = EXCLUDED.region_bucket,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_countries (country_code, country_name, dial_code, emergency_phone, region_bucket)
VALUES ('LB', 'Lebanon', '+961', '112', 'GLOBAL')
ON CONFLICT (country_code) DO UPDATE SET
  country_name = EXCLUDED.country_name,
  dial_code = EXCLUDED.dial_code,
  emergency_phone = EXCLUDED.emergency_phone,
  region_bucket = EXCLUDED.region_bucket,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_countries (country_code, country_name, dial_code, emergency_phone, region_bucket)
VALUES ('EG', 'Egypt', '+20', '122', 'GLOBAL')
ON CONFLICT (country_code) DO UPDATE SET
  country_name = EXCLUDED.country_name,
  dial_code = EXCLUDED.dial_code,
  emergency_phone = EXCLUDED.emergency_phone,
  region_bucket = EXCLUDED.region_bucket,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_countries (country_code, country_name, dial_code, emergency_phone, region_bucket)
VALUES ('ZA', 'South Africa', '+27', '10111', 'GLOBAL')
ON CONFLICT (country_code) DO UPDATE SET
  country_name = EXCLUDED.country_name,
  dial_code = EXCLUDED.dial_code,
  emergency_phone = EXCLUDED.emergency_phone,
  region_bucket = EXCLUDED.region_bucket,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_countries (country_code, country_name, dial_code, emergency_phone, region_bucket)
VALUES ('KE', 'Kenya', '+254', '999', 'GLOBAL')
ON CONFLICT (country_code) DO UPDATE SET
  country_name = EXCLUDED.country_name,
  dial_code = EXCLUDED.dial_code,
  emergency_phone = EXCLUDED.emergency_phone,
  region_bucket = EXCLUDED.region_bucket,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_countries (country_code, country_name, dial_code, emergency_phone, region_bucket)
VALUES ('NG', 'Nigeria', '+234', '112', 'GLOBAL')
ON CONFLICT (country_code) DO UPDATE SET
  country_name = EXCLUDED.country_name,
  dial_code = EXCLUDED.dial_code,
  emergency_phone = EXCLUDED.emergency_phone,
  region_bucket = EXCLUDED.region_bucket,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_countries (country_code, country_name, dial_code, emergency_phone, region_bucket)
VALUES ('UG', 'Uganda', '+256', '112', 'GLOBAL')
ON CONFLICT (country_code) DO UPDATE SET
  country_name = EXCLUDED.country_name,
  dial_code = EXCLUDED.dial_code,
  emergency_phone = EXCLUDED.emergency_phone,
  region_bucket = EXCLUDED.region_bucket,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_countries (country_code, country_name, dial_code, emergency_phone, region_bucket)
VALUES ('IN', 'India', '+91', '112', 'GLOBAL')
ON CONFLICT (country_code) DO UPDATE SET
  country_name = EXCLUDED.country_name,
  dial_code = EXCLUDED.dial_code,
  emergency_phone = EXCLUDED.emergency_phone,
  region_bucket = EXCLUDED.region_bucket,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_countries (country_code, country_name, dial_code, emergency_phone, region_bucket)
VALUES ('PK', 'Pakistan', '+92', '15', 'PK')
ON CONFLICT (country_code) DO UPDATE SET
  country_name = EXCLUDED.country_name,
  dial_code = EXCLUDED.dial_code,
  emergency_phone = EXCLUDED.emergency_phone,
  region_bucket = EXCLUDED.region_bucket,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_countries (country_code, country_name, dial_code, emergency_phone, region_bucket)
VALUES ('BD', 'Bangladesh', '+880', '999', 'GLOBAL')
ON CONFLICT (country_code) DO UPDATE SET
  country_name = EXCLUDED.country_name,
  dial_code = EXCLUDED.dial_code,
  emergency_phone = EXCLUDED.emergency_phone,
  region_bucket = EXCLUDED.region_bucket,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_countries (country_code, country_name, dial_code, emergency_phone, region_bucket)
VALUES ('LK', 'Sri Lanka', '+94', '119', 'GLOBAL')
ON CONFLICT (country_code) DO UPDATE SET
  country_name = EXCLUDED.country_name,
  dial_code = EXCLUDED.dial_code,
  emergency_phone = EXCLUDED.emergency_phone,
  region_bucket = EXCLUDED.region_bucket,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_countries (country_code, country_name, dial_code, emergency_phone, region_bucket)
VALUES ('SG', 'Singapore', '+65', '995', 'GLOBAL')
ON CONFLICT (country_code) DO UPDATE SET
  country_name = EXCLUDED.country_name,
  dial_code = EXCLUDED.dial_code,
  emergency_phone = EXCLUDED.emergency_phone,
  region_bucket = EXCLUDED.region_bucket,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_countries (country_code, country_name, dial_code, emergency_phone, region_bucket)
VALUES ('MY', 'Malaysia', '+60', '999', 'GLOBAL')
ON CONFLICT (country_code) DO UPDATE SET
  country_name = EXCLUDED.country_name,
  dial_code = EXCLUDED.dial_code,
  emergency_phone = EXCLUDED.emergency_phone,
  region_bucket = EXCLUDED.region_bucket,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_countries (country_code, country_name, dial_code, emergency_phone, region_bucket)
VALUES ('HK', 'Hong Kong', '+852', '999', 'GLOBAL')
ON CONFLICT (country_code) DO UPDATE SET
  country_name = EXCLUDED.country_name,
  dial_code = EXCLUDED.dial_code,
  emergency_phone = EXCLUDED.emergency_phone,
  region_bucket = EXCLUDED.region_bucket,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_countries (country_code, country_name, dial_code, emergency_phone, region_bucket)
VALUES ('JP', 'Japan', '+81', '110', 'GLOBAL')
ON CONFLICT (country_code) DO UPDATE SET
  country_name = EXCLUDED.country_name,
  dial_code = EXCLUDED.dial_code,
  emergency_phone = EXCLUDED.emergency_phone,
  region_bucket = EXCLUDED.region_bucket,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_countries (country_code, country_name, dial_code, emergency_phone, region_bucket)
VALUES ('KR', 'South Korea', '+82', '119', 'GLOBAL')
ON CONFLICT (country_code) DO UPDATE SET
  country_name = EXCLUDED.country_name,
  dial_code = EXCLUDED.dial_code,
  emergency_phone = EXCLUDED.emergency_phone,
  region_bucket = EXCLUDED.region_bucket,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_countries (country_code, country_name, dial_code, emergency_phone, region_bucket)
VALUES ('CN', 'China', '+86', '120', 'GLOBAL')
ON CONFLICT (country_code) DO UPDATE SET
  country_name = EXCLUDED.country_name,
  dial_code = EXCLUDED.dial_code,
  emergency_phone = EXCLUDED.emergency_phone,
  region_bucket = EXCLUDED.region_bucket,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_countries (country_code, country_name, dial_code, emergency_phone, region_bucket)
VALUES ('PH', 'Philippines', '+63', '911', 'GLOBAL')
ON CONFLICT (country_code) DO UPDATE SET
  country_name = EXCLUDED.country_name,
  dial_code = EXCLUDED.dial_code,
  emergency_phone = EXCLUDED.emergency_phone,
  region_bucket = EXCLUDED.region_bucket,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_countries (country_code, country_name, dial_code, emergency_phone, region_bucket)
VALUES ('TH', 'Thailand', '+66', '191', 'GLOBAL')
ON CONFLICT (country_code) DO UPDATE SET
  country_name = EXCLUDED.country_name,
  dial_code = EXCLUDED.dial_code,
  emergency_phone = EXCLUDED.emergency_phone,
  region_bucket = EXCLUDED.region_bucket,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_countries (country_code, country_name, dial_code, emergency_phone, region_bucket)
VALUES ('ID', 'Indonesia', '+62', '119', 'GLOBAL')
ON CONFLICT (country_code) DO UPDATE SET
  country_name = EXCLUDED.country_name,
  dial_code = EXCLUDED.dial_code,
  emergency_phone = EXCLUDED.emergency_phone,
  region_bucket = EXCLUDED.region_bucket,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_countries (country_code, country_name, dial_code, emergency_phone, region_bucket)
VALUES ('BR', 'Brazil', '+55', '192', 'GLOBAL')
ON CONFLICT (country_code) DO UPDATE SET
  country_name = EXCLUDED.country_name,
  dial_code = EXCLUDED.dial_code,
  emergency_phone = EXCLUDED.emergency_phone,
  region_bucket = EXCLUDED.region_bucket,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_countries (country_code, country_name, dial_code, emergency_phone, region_bucket)
VALUES ('MX', 'Mexico', '+52', '911', 'GLOBAL')
ON CONFLICT (country_code) DO UPDATE SET
  country_name = EXCLUDED.country_name,
  dial_code = EXCLUDED.dial_code,
  emergency_phone = EXCLUDED.emergency_phone,
  region_bucket = EXCLUDED.region_bucket,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_countries (country_code, country_name, dial_code, emergency_phone, region_bucket)
VALUES ('AR', 'Argentina', '+54', '911', 'GLOBAL')
ON CONFLICT (country_code) DO UPDATE SET
  country_name = EXCLUDED.country_name,
  dial_code = EXCLUDED.dial_code,
  emergency_phone = EXCLUDED.emergency_phone,
  region_bucket = EXCLUDED.region_bucket,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_countries (country_code, country_name, dial_code, emergency_phone, region_bucket)
VALUES ('CL', 'Chile', '+56', '131', 'GLOBAL')
ON CONFLICT (country_code) DO UPDATE SET
  country_name = EXCLUDED.country_name,
  dial_code = EXCLUDED.dial_code,
  emergency_phone = EXCLUDED.emergency_phone,
  region_bucket = EXCLUDED.region_bucket,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_countries (country_code, country_name, dial_code, emergency_phone, region_bucket)
VALUES ('CO', 'Colombia', '+57', '123', 'GLOBAL')
ON CONFLICT (country_code) DO UPDATE SET
  country_name = EXCLUDED.country_name,
  dial_code = EXCLUDED.dial_code,
  emergency_phone = EXCLUDED.emergency_phone,
  region_bucket = EXCLUDED.region_bucket,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_countries (country_code, country_name, dial_code, emergency_phone, region_bucket)
VALUES ('PE', 'Peru', '+51', '105', 'GLOBAL')
ON CONFLICT (country_code) DO UPDATE SET
  country_name = EXCLUDED.country_name,
  dial_code = EXCLUDED.dial_code,
  emergency_phone = EXCLUDED.emergency_phone,
  region_bucket = EXCLUDED.region_bucket,
  updated_at = timezone('utc', now());

-- 3) Resources
INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('US', 'us_emergency', 'emergency', 'Emergency Services', '911', 'For immediate life-threatening emergencies', NULL, '24/7', 0)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('US', 'us_crisis', 'crisis_line', '988 Suicide & Crisis Lifeline', '988', '24/7 confidential support for people in distress', 'https://988lifeline.org', '24/7', 1)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('US', 'us_crisis_text', 'text_line', 'Crisis Text Line', '741741', 'Text HOME to 741741 to connect with a Crisis Counselor', 'https://www.crisistextline.org', '24/7', 2)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('US', 'us_veterans', 'crisis_line', 'Veterans Crisis Line', '988 then press 1', 'Support for veterans — call 988 then press 1', 'https://www.veteranscrisisline.net', '24/7', 3)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('CA', 'ca_emergency', 'emergency', 'Emergency Services', '911', 'For immediate life-threatening emergencies', NULL, '24/7', 0)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('CA', 'ca_crisis', 'crisis_line', '988 Suicide & Crisis Lifeline', '988', '24/7 suicide prevention and crisis support', 'https://988.ca', '24/7', 1)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('CA', 'ca_crisis_text', 'text_line', 'Crisis Text Line', '686868', 'Text CONNECT to 686868', 'https://www.crisistextline.ca', '24/7', 2)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('CA', 'ca_kids_help', 'crisis_line', 'Kids Help Phone', '1-800-668-6868', 'Support for young people under 30', 'https://kidshelpphone.ca', '24/7', 3)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('GB', 'gb_emergency', 'emergency', 'Emergency Services', '999', 'For immediate life-threatening emergencies', NULL, '24/7', 0)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('GB', 'gb_crisis', 'crisis_line', 'Samaritans', '116 123', '24/7 confidential emotional support', 'https://www.samaritans.org', '24/7', 1)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('GB', 'uk_shout', 'text_line', 'Shout Crisis Text Line', '85258', 'Text SHOUT to 85258', 'https://www.giveusashout.org', '24/7', 2)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('IE', 'ie_emergency', 'emergency', 'Emergency Services', '112', 'For immediate life-threatening emergencies', NULL, '24/7', 0)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('IE', 'ie_crisis', 'crisis_line', 'Samaritans Ireland', '116 123', '24/7 crisis and suicide prevention support', 'https://www.samaritans.org', '24/7', 1)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('AU', 'au_emergency', 'emergency', 'Emergency Services', '000', 'For immediate life-threatening emergencies', NULL, '24/7', 0)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('AU', 'au_crisis', 'crisis_line', 'Lifeline Australia', '13 11 14', '24/7 crisis support and suicide prevention', 'https://www.lifeline.org.au', '24/7', 1)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('AU', 'au_beyond_blue', 'crisis_line', 'Beyond Blue', '1300 22 4636', 'Support for anxiety, depression and suicide prevention', 'https://www.beyondblue.org.au', '24/7', 2)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('NZ', 'nz_emergency', 'emergency', 'Emergency Services', '111', 'For immediate life-threatening emergencies', NULL, '24/7', 0)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('NZ', 'nz_crisis', 'crisis_line', 'Need to Talk?', '1737', 'Free call or text — trained counsellors', 'https://www.mentalhealth.org.nz', '24/7', 1)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('FR', 'fr_emergency', 'emergency', 'Emergency Services', '112', 'For immediate life-threatening emergencies', NULL, '24/7', 0)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('FR', 'fr_crisis', 'crisis_line', 'Numéro national de prévention du suicide', '3114', '24/7 suicide prevention', NULL, '24/7', 1)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('DE', 'de_emergency', 'emergency', 'Emergency Services', '112', 'For immediate life-threatening emergencies', NULL, '24/7', 0)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('DE', 'de_crisis', 'crisis_line', 'TelefonSeelsorge', '0800 111 0 111', '24/7 crisis support in German', 'https://www.telefonseelsorge.de', '24/7', 1)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('NL', 'nl_emergency', 'emergency', 'Emergency Services', '112', 'For immediate life-threatening emergencies', NULL, '24/7', 0)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('NL', 'nl_crisis', 'crisis_line', '113 Zelfmoordpreventie', '113', '24/7 crisis and suicide prevention support', 'https://www.113.nl', '24/7', 1)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('ES', 'es_emergency', 'emergency', 'Emergency Services', '112', 'For immediate life-threatening emergencies', NULL, '24/7', 0)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('ES', 'es_crisis', 'crisis_line', 'Línea 024', '024', 'Atención a la conducta suicida', NULL, '24/7', 1)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('BE', 'be_emergency', 'emergency', 'Emergency Services', '112', 'For immediate life-threatening emergencies', NULL, '24/7', 0)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('BE', 'be_crisis', 'crisis_line', 'Centre de Prévention du Suicide', '1813', '24/7 crisis and suicide prevention support', NULL, '24/7', 1)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('CH', 'ch_emergency', 'emergency', 'Emergency Services', '112', 'For immediate life-threatening emergencies', NULL, '24/7', 0)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('CH', 'ch_crisis', 'crisis_line', 'Die Dargebotene Hand', '143', '24/7 crisis and suicide prevention support', 'https://www.143.ch', '24/7', 1)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('AT', 'at_emergency', 'emergency', 'Emergency Services', '112', 'For immediate life-threatening emergencies', NULL, '24/7', 0)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('AT', 'at_crisis', 'crisis_line', 'TelefonSeelsorge Österreich', '142', '24/7 crisis and suicide prevention support', NULL, '24/7', 1)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('IT', 'it_emergency', 'emergency', 'Emergency Services', '112', 'For immediate life-threatening emergencies', NULL, '24/7', 0)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('IT', 'it_crisis', 'crisis_line', 'Telefono Amico', '800 860 022', '24/7 crisis and suicide prevention support', NULL, '24/7', 1)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('SE', 'se_emergency', 'emergency', 'Emergency Services', '112', 'For immediate life-threatening emergencies', NULL, '24/7', 0)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('SE', 'se_crisis', 'crisis_line', 'Mind Självmordslinjen', '031 711 24 00', '24/7 crisis and suicide prevention support', NULL, '24/7', 1)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('NO', 'no_emergency', 'emergency', 'Emergency Services', '112', 'For immediate life-threatening emergencies', NULL, '24/7', 0)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('NO', 'no_crisis', 'crisis_line', 'Mental Helse Hjelpetelefonen', '815 33 300', '24/7 crisis and suicide prevention support', NULL, '24/7', 1)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('DK', 'dk_emergency', 'emergency', 'Emergency Services', '112', 'For immediate life-threatening emergencies', NULL, '24/7', 0)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('DK', 'dk_crisis', 'crisis_line', 'Livslinien', '70 20 12 01', '24/7 crisis and suicide prevention support', NULL, '24/7', 1)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('FI', 'fi_emergency', 'emergency', 'Emergency Services', '112', 'For immediate life-threatening emergencies', NULL, '24/7', 0)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('FI', 'fi_crisis', 'crisis_line', 'Suomen Mielenterveysseura', '010 195 202', '24/7 crisis and suicide prevention support', NULL, '24/7', 1)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('PT', 'pt_emergency', 'emergency', 'Emergency Services', '112', 'For immediate life-threatening emergencies', NULL, '24/7', 0)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('PT', 'pt_crisis', 'crisis_line', 'SOS Voz Amiga', '21 854 07 40', '24/7 crisis and suicide prevention support', NULL, '24/7', 1)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('PL', 'pl_emergency', 'emergency', 'Emergency Services', '112', 'For immediate life-threatening emergencies', NULL, '24/7', 0)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('PL', 'pl_crisis', 'crisis_line', 'Telefon Zaufania', '52 70 00 00', '24/7 crisis and suicide prevention support', NULL, '24/7', 1)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('HU', 'hu_emergency', 'emergency', 'Emergency Services', '112', 'For immediate life-threatening emergencies', NULL, '24/7', 0)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('HU', 'hu_crisis', 'crisis_line', 'Emotional Support Line', '116 123', '24/7 crisis and suicide prevention support', NULL, '24/7', 1)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('GR', 'gr_emergency', 'emergency', 'Emergency Services', '112', 'For immediate life-threatening emergencies', NULL, '24/7', 0)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('GR', 'gr_crisis', 'crisis_line', '1018 Suicide Prevention', '1018', '24/7 crisis and suicide prevention support', NULL, '24/7', 1)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('RO', 'ro_emergency', 'emergency', 'Emergency Services', '112', 'For immediate life-threatening emergencies', NULL, '24/7', 0)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('RO', 'ro_crisis', 'crisis_line', 'Telefonul Sufletului', '0800 801 200', '24/7 crisis and suicide prevention support', NULL, '24/7', 1)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('RU', 'ru_emergency', 'emergency', 'Emergency Services', '112', 'For immediate life-threatening emergencies', NULL, '24/7', 0)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('RU', 'ru_crisis', 'crisis_line', 'Psychological Support Line', '0078202577577', '24/7 crisis and suicide prevention support', NULL, '24/7', 1)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('TR', 'tr_emergency', 'emergency', 'Emergency Services', '112', 'For immediate life-threatening emergencies', NULL, '24/7', 0)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('TR', 'tr_crisis', 'crisis_line', 'Emergency Mental Health Support', '112', 'Dial 112 for emergency support services', NULL, '24/7', 1)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('IL', 'il_emergency', 'emergency', 'Emergency Services', '100', 'For immediate life-threatening emergencies', NULL, '24/7', 0)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('IL', 'il_crisis', 'crisis_line', 'Eran Emotional First Aid', '1201', '24/7 crisis and suicide prevention support', 'https://www.eran.org.il', '24/7', 1)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('AE', 'ae_emergency', 'emergency', 'Emergency Services', '999', 'For immediate life-threatening emergencies', NULL, '24/7', 0)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('AE', 'ae_crisis', 'crisis_line', 'UAE Mental Health Support', '800 46342', '24/7 crisis and suicide prevention support', NULL, '24/7', 1)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('SA', 'sa_emergency', 'emergency', 'Emergency Services', '911', 'For immediate life-threatening emergencies', NULL, '24/7', 0)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('SA', 'sa_crisis', 'crisis_line', 'National Mental Health Services', '937', 'Emergency support services — call 937 for mental health crisis', NULL, '24/7', 1)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('QA', 'qa_emergency', 'emergency', 'Emergency Services', '999', 'For immediate life-threatening emergencies', NULL, '24/7', 0)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('QA', 'qa_crisis', 'crisis_line', 'Mental Health Support', '16000', 'National healthcare mental health services', NULL, '24/7', 1)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('KW', 'kw_emergency', 'emergency', 'Emergency Services', '112', 'For immediate life-threatening emergencies', NULL, '24/7', 0)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('KW', 'kw_crisis', 'crisis_line', 'Mental Health Helpline', '94069304', '24/7 crisis and suicide prevention support', NULL, '24/7', 1)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('JO', 'jo_emergency', 'emergency', 'Emergency Services', '911', 'For immediate life-threatening emergencies', NULL, '24/7', 0)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('JO', 'jo_crisis', 'crisis_line', 'Jordan Mental Health Helpline', '110', '24/7 crisis and suicide prevention support', NULL, '24/7', 1)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('LB', 'lb_emergency', 'emergency', 'Emergency Services', '112', 'For immediate life-threatening emergencies', NULL, '24/7', 0)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('LB', 'lb_crisis', 'crisis_line', 'Embrace Lifeline', '1564', '24/7 crisis and suicide prevention support', 'https://www.embracelebanon.org', '24/7', 1)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('EG', 'eg_emergency', 'emergency', 'Emergency Services', '122', 'For immediate life-threatening emergencies', NULL, '24/7', 0)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('EG', 'eg_crisis', 'crisis_line', 'Befrienders Cairo', '16328', '24/7 crisis and suicide prevention support', NULL, '24/7', 1)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('ZA', 'za_emergency', 'emergency', 'Emergency Services', '10111', 'For immediate life-threatening emergencies', NULL, '24/7', 0)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('ZA', 'za_crisis', 'crisis_line', 'SADAG Suicide Crisis Line', '051 444 5691', '24/7 crisis and suicide prevention support', 'https://www.sadag.org', '24/7', 1)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('KE', 'ke_emergency', 'emergency', 'Emergency Services', '999', 'For immediate life-threatening emergencies', NULL, '24/7', 0)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('KE', 'ke_crisis', 'crisis_line', 'Befrienders Kenya', '722178177', '24/7 crisis and suicide prevention support', NULL, '24/7', 1)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('NG', 'ng_emergency', 'emergency', 'Emergency Services', '112', 'For immediate life-threatening emergencies', NULL, '24/7', 0)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('NG', 'ng_crisis', 'crisis_line', 'Nigeria Suicide Prevention Initiative', '08092106493', '24/7 crisis and suicide prevention support', NULL, '24/7', 1)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('UG', 'ug_emergency', 'emergency', 'Emergency Services', '112', 'For immediate life-threatening emergencies', NULL, '24/7', 0)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('UG', 'ug_crisis', 'crisis_line', 'Mental Health Uganda', '0800 21 21 21', '24/7 crisis and suicide prevention support', NULL, '24/7', 1)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('IN', 'in_emergency', 'emergency', 'Emergency Services', '112', 'For immediate life-threatening emergencies', NULL, '24/7', 0)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('IN', 'in_crisis', 'crisis_line', 'Tele-MANAS', '14416', 'National tele-mental health helpline', 'https://telemanas.mohfw.gov.in', '24/7', 1)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('PK', 'pk_emergency', 'emergency', 'Emergency Services', '15', 'For immediate life-threatening emergencies', NULL, '24/7', 0)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('PK', 'pk_crisis', 'crisis_line', 'Umang Mental Health Helpline', '0311 7786264', '24/7 mental health support', NULL, '24/7', 1)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('PK', 'pk_rozan', 'crisis_line', 'Rozan Counseling Helpline', '0800-22444', 'Counseling and emotional support', NULL, '24/7', 2)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('PK', 'pk_rescue', 'emergency', 'Rescue Services', '1122', 'Emergency rescue assistance', NULL, '24/7', 3)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('BD', 'bd_emergency', 'emergency', 'Emergency Services', '999', 'For immediate life-threatening emergencies', NULL, '24/7', 0)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('BD', 'bd_crisis', 'crisis_line', 'Kaan Pete Roi', '01779554391', 'Emotional support — regional services also available', 'https://www.kaanpeteroi.com', '24/7', 1)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('LK', 'lk_emergency', 'emergency', 'Emergency Services', '119', 'For immediate life-threatening emergencies', NULL, '24/7', 0)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('LK', 'lk_crisis', 'crisis_line', 'Sumithrayo', '011 057 2222662', '24/7 crisis and suicide prevention support', 'https://www.sumithrayo.org', '24/7', 1)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('SG', 'sg_emergency', 'emergency', 'Emergency Services', '995', 'For immediate life-threatening emergencies', NULL, '24/7', 0)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('SG', 'sg_crisis', 'crisis_line', 'Samaritans of Singapore', '1767', '24/7 crisis and suicide prevention support', 'https://www.sos.org.sg', '24/7', 1)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('MY', 'my_emergency', 'emergency', 'Emergency Services', '999', 'For immediate life-threatening emergencies', NULL, '24/7', 0)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('MY', 'my_crisis', 'crisis_line', 'Befrienders KL', '03-7627 2929', 'Various Befrienders lines nationwide', 'https://www.befrienders.org.my', '24/7', 1)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('HK', 'hk_emergency', 'emergency', 'Emergency Services', '999', 'For immediate life-threatening emergencies', NULL, '24/7', 0)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('HK', 'hk_crisis', 'crisis_line', 'Samaritan Befrienders Hong Kong', '2382 0000', '24/7 crisis and suicide prevention support', 'https://www.sbhk.org.hk', '24/7', 1)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('JP', 'jp_emergency', 'emergency', 'Emergency Services', '110', 'For immediate life-threatening emergencies', NULL, '24/7', 0)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('JP', 'jp_crisis', 'crisis_line', 'TELL Lifeline', '0570-783-556', '24/7 crisis and suicide prevention support', 'https://telljp.com', '24/7', 1)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('KR', 'kr_emergency', 'emergency', 'Emergency Services', '119', 'For immediate life-threatening emergencies', NULL, '24/7', 0)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('KR', 'kr_crisis', 'crisis_line', 'Suicide Prevention Hotline', '109', '24/7 crisis and suicide prevention support', NULL, '24/7', 1)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('CN', 'cn_emergency', 'emergency', 'Emergency Services', '120', 'For immediate life-threatening emergencies', NULL, '24/7', 0)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('CN', 'cn_crisis', 'crisis_line', 'Beijing Suicide Research & Prevention', '800-810-1117', '24/7 crisis and suicide prevention support', NULL, '24/7', 1)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('PH', 'ph_emergency', 'emergency', 'Emergency Services', '911', 'For immediate life-threatening emergencies', NULL, '24/7', 0)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('PH', 'ph_crisis', 'crisis_line', 'NCMH Crisis Hotline', '1553', 'National Center for Mental Health crisis line', NULL, '24/7', 1)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('TH', 'th_emergency', 'emergency', 'Emergency Services', '191', 'For immediate life-threatening emergencies', NULL, '24/7', 0)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('TH', 'th_crisis', 'crisis_line', 'Samaritans of Thailand', '(02) 713-6793', '24/7 crisis and suicide prevention support', NULL, '24/7', 1)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('ID', 'id_emergency', 'emergency', 'Emergency Services', '119', 'For immediate life-threatening emergencies', NULL, '24/7', 0)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('ID', 'id_crisis', 'crisis_line', 'Into The Light Indonesia', '119', 'Mental health crisis support — national emergency 119', NULL, '24/7', 1)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('BR', 'br_emergency', 'emergency', 'Emergency Services', '192', 'For immediate life-threatening emergencies', NULL, '24/7', 0)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('BR', 'br_crisis', 'crisis_line', 'CVV — Centro de Valorização da Vida', '188', '24/7 crisis and suicide prevention support', 'https://www.cvv.org.br', '24/7', 1)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('MX', 'mx_emergency', 'emergency', 'Emergency Services', '911', 'For immediate life-threatening emergencies', NULL, '24/7', 0)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('MX', 'mx_crisis', 'crisis_line', 'Línea de la Vida', '55 1025 5050', '24/7 crisis and suicide prevention support', NULL, '24/7', 1)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('AR', 'ar_emergency', 'emergency', 'Emergency Services', '911', 'For immediate life-threatening emergencies', NULL, '24/7', 0)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('AR', 'ar_crisis', 'crisis_line', 'Centro de Asistencia al Suicida', '135', '24/7 crisis and suicide prevention support', NULL, '24/7', 1)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('CL', 'cl_emergency', 'emergency', 'Emergency Services', '131', 'For immediate life-threatening emergencies', NULL, '24/7', 0)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('CL', 'cl_crisis', 'crisis_line', 'Salud Responde', '600 360 7777', 'Verified crisis lines — see national directory for regional options', 'https://www.minsal.cl', '24/7', 1)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('CO', 'co_emergency', 'emergency', 'Emergency Services', '123', 'For immediate life-threatening emergencies', NULL, '24/7', 0)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('CO', 'co_crisis', 'crisis_line', 'Línea 106', '(57-1) 323 24 25', '24/7 crisis and suicide prevention support', NULL, '24/7', 1)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('PE', 'pe_emergency', 'emergency', 'Emergency Services', '105', 'For immediate life-threatening emergencies', NULL, '24/7', 0)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES ('PE', 'pe_crisis', 'crisis_line', 'Línea 100', '381-3695', '24/7 crisis and suicide prevention support', NULL, '24/7', 1)
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

-- 4) Verify (should show 56 countries)
SELECT c.country_code, c.country_name, count(r.id) AS resource_count
FROM public.crisis_hotline_countries c
LEFT JOIN public.crisis_hotline_resources r ON r.country_code = c.country_code
GROUP BY c.country_code, c.country_name
ORDER BY c.country_code;
