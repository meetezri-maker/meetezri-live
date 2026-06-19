-- Crisis hotline directory (country-keyed emergency resources)
CREATE TABLE "public"."crisis_hotline_countries" (
    "country_code" VARCHAR(2) NOT NULL,
    "country_name" TEXT NOT NULL,
    "dial_code" TEXT NOT NULL,
    "emergency_phone" TEXT,
    "region_bucket" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT "crisis_hotline_countries_pkey" PRIMARY KEY ("country_code")
);

CREATE TABLE "public"."crisis_hotline_resources" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "country_code" VARCHAR(2) NOT NULL,
    "resource_key" TEXT NOT NULL,
    "resource_type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "description" TEXT,
    "url" TEXT,
    "availability" TEXT NOT NULL DEFAULT '24/7',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT "crisis_hotline_resources_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "crisis_hotline_resources_country_code_resource_key_key"
    ON "public"."crisis_hotline_resources"("country_code", "resource_key");

CREATE INDEX "crisis_hotline_resources_country_code_idx"
    ON "public"."crisis_hotline_resources"("country_code");

ALTER TABLE "public"."crisis_hotline_resources"
    ADD CONSTRAINT "crisis_hotline_resources_country_code_fkey"
    FOREIGN KEY ("country_code") REFERENCES "public"."crisis_hotline_countries"("country_code")
    ON DELETE CASCADE ON UPDATE NO ACTION;

-- Persist user crisis country (phone picker / IP / manual)
ALTER TABLE "public"."profiles"
    ADD COLUMN IF NOT EXISTS "crisis_country_code" VARCHAR(2);
