-- AlterTable
ALTER TABLE "public"."profiles" ADD COLUMN IF NOT EXISTS "brain_health_settings" JSONB;
