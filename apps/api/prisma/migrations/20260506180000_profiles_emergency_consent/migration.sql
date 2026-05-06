-- User consent for emergency-contact notification policy (member-facing Emergency Contacts flow).
ALTER TABLE "public"."profiles" ADD COLUMN IF NOT EXISTS "emergency_consent" BOOLEAN NOT NULL DEFAULT false;
