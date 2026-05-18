-- Align Maya Chen and Alex companion tags and bios with product copy (see @meetezri/shared defaultAiCompanions).

UPDATE "public"."ai_avatars"
SET
  "specialties" = ARRAY['anxiousness', 'Low morale support', 'Stress Management']::text[],
  "description" = 'A compassionate AI companion with a warm presence. Maya specializes in helping with anxiousness, stress, and building emotional resilience through mindfulness.',
  "updated_at" = timezone('utc'::text, now())
WHERE "name" = 'Maya Chen';

UPDATE "public"."ai_avatars"
SET
  "specialties" = ARRAY['Life Transitions']::text[],
  "description" = 'A gentle and patient listener who creates a safe space for healing. Alex focuses on emotional healing and navigating life''s big changes.',
  "updated_at" = timezone('utc'::text, now())
WHERE "name" IN ('Alex', 'Alex Rivera');
