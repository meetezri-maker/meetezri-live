-- Pre-launch Founding Circle lead capture (public landing page, no account created).
-- `email` always stores the normalized value (trimmed + lowercased) so the unique
-- index below prevents duplicates at the database level, not just in application code.
CREATE TABLE "public"."founding_members" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "first_name" TEXT,
    "status" TEXT NOT NULL DEFAULT 'waiting',
    "source" TEXT NOT NULL DEFAULT 'prelaunch_landing_page',
    "campaign" TEXT,
    "utm_source" TEXT,
    "utm_medium" TEXT,
    "utm_campaign" TEXT,
    "utm_content" TEXT,
    "utm_term" TEXT,
    "referrer" TEXT,
    "landing_page" TEXT,
    "discount_percentage" INTEGER NOT NULL DEFAULT 20,
    "founding_member" BOOLEAN NOT NULL DEFAULT true,
    "consent_source" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT "founding_members_pkey" PRIMARY KEY ("id")
);

-- Race-safe duplicate protection: concurrent submissions of the same address collide here.
CREATE UNIQUE INDEX "founding_members_email_key" ON "public"."founding_members"("email");

CREATE INDEX "founding_members_created_at_idx" ON "public"."founding_members"("created_at");

CREATE INDEX "founding_members_status_created_at_idx"
    ON "public"."founding_members"("status", "created_at");

ALTER TABLE "public"."founding_members"
    ADD CONSTRAINT "founding_members_status_check"
    CHECK ("status" IN ('waiting', 'invited', 'converted', 'unsubscribed'));

ALTER TABLE "public"."founding_members"
    ADD CONSTRAINT "founding_members_discount_percentage_check"
    CHECK ("discount_percentage" >= 0 AND "discount_percentage" <= 100);

COMMENT ON TABLE "public"."founding_members" IS
    'Pre-launch Founding Circle leads captured from the public /early-access landing page. Not application accounts.';

COMMENT ON COLUMN "public"."founding_members"."email" IS
    'Normalized (trimmed + lowercased) email address. Unique.';

COMMENT ON COLUMN "public"."founding_members"."discount_percentage" IS
    'Approved Founding Member lifetime discount to honour at launch (default 20).';
