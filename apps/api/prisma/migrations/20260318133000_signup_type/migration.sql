-- Persist which signup flow the user entered:
-- trial vs plan buyer.

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS signup_type TEXT;

