CREATE TABLE IF NOT EXISTS "public"."custom_achievements" (
  "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
  "user_id" uuid NOT NULL,
  "title" text NOT NULL,
  "description" text NOT NULL,
  "icon" text NOT NULL,
  "category" text NOT NULL,
  "progress" integer NOT NULL DEFAULT 0,
  "total" integer NOT NULL DEFAULT 1,
  "unlocked" boolean NOT NULL DEFAULT false,
  "points" integer NOT NULL DEFAULT 0,
  "rarity" text NOT NULL DEFAULT 'common',
  "goal_type" text,
  "last_check_in_date" text,
  "check_in_history" text[] NOT NULL DEFAULT ARRAY[]::text[],
  "check_in_entries" jsonb,
  "goal_category" text,
  "why_it_matters" text,
  "target_outcome" text,
  "start_date" text,
  "target_date" text,
  "priority" text,
  "progress_status" text,
  "check_in_frequency" text,
  "reminder_enabled" boolean,
  "action_steps" text,
  "mood_tag" text,
  "support_type" text,
  "notes" text,
  "linked_goal_id" uuid,
  "created_at" timestamptz(6) NOT NULL DEFAULT timezone('utc'::text, now()),
  "updated_at" timestamptz(6) NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT "custom_achievements_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "custom_achievements_user_id_fkey" FOREIGN KEY ("user_id")
    REFERENCES "public"."profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS "custom_achievements_user_id_created_at_idx"
  ON "public"."custom_achievements"("user_id", "created_at" DESC);
