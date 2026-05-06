-- Align stored category strings with WELLNESS_TOOL_CATEGORIES (apps/api + web).
UPDATE "wellness_tools"
SET "category" = 'Anxiousness',
    "updated_at" = timezone('utc'::text, now())
WHERE "category" = 'Anxiety Management';

UPDATE "wellness_tools"
SET "category" = 'Low morale support',
    "updated_at" = timezone('utc'::text, now())
WHERE "category" = 'Depression Support';

UPDATE "wellness_challenges"
SET "category" = 'Anxiousness'
WHERE "category" = 'Anxiety Management';

UPDATE "wellness_challenges"
SET "category" = 'Low morale support'
WHERE "category" = 'Depression Support';
