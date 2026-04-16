-- Personal goals + check-ins

CREATE TABLE IF NOT EXISTS "public"."personal_goals" (
  "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
  "user_id" uuid NOT NULL,
  "goal_title" text NOT NULL,
  "goal_category" text NOT NULL,
  "goal_description" text NOT NULL,
  "why_this_goal_matters" text NOT NULL,
  "target_outcome" text NOT NULL,
  "priority_level" text NOT NULL,
  "status" text NOT NULL DEFAULT 'not_started',
  "start_date" text NOT NULL,
  "target_date" text,
  "progress_percentage" integer NOT NULL DEFAULT 0,
  "check_in_frequency" text NOT NULL DEFAULT 'daily',
  "reminder_enabled" boolean NOT NULL DEFAULT false,
  "reminder_time" text,
  "small_action_steps" text[] NOT NULL DEFAULT ARRAY[]::text[],
  "emotion_tag" text,
  "support_type_needed" text,
  "notes" text,
  "last_check_in_date" text,
  "streak_count" integer NOT NULL DEFAULT 0,
  "ai_suggestions" text[] NOT NULL DEFAULT ARRAY[]::text[],
  "partner_visibility" boolean NOT NULL DEFAULT false,
  "partner_comment_enabled" boolean NOT NULL DEFAULT false,
  "completion_note" text,
  "created_at" timestamptz(6) NOT NULL DEFAULT timezone('utc'::text, now()),
  "updated_at" timestamptz(6) NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT "personal_goals_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "personal_goals_user_id_fkey" FOREIGN KEY ("user_id")
    REFERENCES "public"."profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE TABLE IF NOT EXISTS "public"."goal_check_ins" (
  "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
  "goal_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "progress_percentage" integer NOT NULL,
  "mood" text,
  "reflection" text,
  "challenges_faced" text,
  "wins" text,
  "notes" text,
  "created_at" timestamptz(6) NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT "goal_check_ins_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "goal_check_ins_goal_id_fkey" FOREIGN KEY ("goal_id")
    REFERENCES "public"."personal_goals"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "goal_check_ins_user_id_fkey" FOREIGN KEY ("user_id")
    REFERENCES "public"."profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS "personal_goals_user_id_idx" ON "public"."personal_goals"("user_id");
CREATE INDEX IF NOT EXISTS "personal_goals_user_id_created_at_idx" ON "public"."personal_goals"("user_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "personal_goals_user_id_status_idx" ON "public"."personal_goals"("user_id", "status");
CREATE INDEX IF NOT EXISTS "goal_check_ins_goal_id_created_at_idx" ON "public"."goal_check_ins"("goal_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "goal_check_ins_user_id_created_at_idx" ON "public"."goal_check_ins"("user_id", "created_at" DESC);
