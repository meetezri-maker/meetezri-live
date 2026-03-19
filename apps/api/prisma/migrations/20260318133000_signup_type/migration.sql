-- Persist which signup flow the user entered:
-- trial vs plan buyer.

ALTER TABLE public.profiles
ADD COLUMN signup_type TEXT;

