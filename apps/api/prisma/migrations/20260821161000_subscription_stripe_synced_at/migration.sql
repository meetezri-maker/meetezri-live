ALTER TABLE "public"."subscriptions"
ADD COLUMN IF NOT EXISTS "stripe_synced_at" TIMESTAMPTZ(6);

CREATE INDEX IF NOT EXISTS "subscriptions_stripe_synced_at_idx"
ON "public"."subscriptions"("stripe_synced_at");
