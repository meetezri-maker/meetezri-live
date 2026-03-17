CREATE SCHEMA IF NOT EXISTS "public";

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$ BEGIN
    CREATE TYPE "public"."crisis_status" AS ENUM ('pending', 'contacted', 'in-progress', 'resolved');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "public"."risk_level" AS ENUM ('low', 'medium', 'high', 'critical');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "public"."safety_state" AS ENUM ('NORMAL', 'ELEVATED_CONCERN', 'HIGH_RISK', 'SAFETY_MODE', 'COOLDOWN');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "public"."subscription_tier" AS ENUM ('free', 'core', 'pro');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "public"."ticket_priority" AS ENUM ('low', 'medium', 'high', 'urgent');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "public"."ticket_status" AS ENUM ('open', 'in_progress', 'resolved', 'closed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "public"."ab_tests" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "name" TEXT NOT NULL,
    "description" TEXT,
    "variants" JSONB,
    "start_date" TIMESTAMPTZ(6),
    "end_date" TIMESTAMPTZ(6),
    "status" TEXT DEFAULT 'draft',
    "metrics" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT "ab_tests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."favorite_wellness_tools" (
    "user_id" UUID NOT NULL,
    "tool_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT "favorite_wellness_tools_pkey" PRIMARY KEY ("user_id","tool_id")
);

CREATE TABLE IF NOT EXISTS "public"."achievements" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "icon_url" TEXT,
    "criteria" JSONB,
    "points" INTEGER DEFAULT 0,
    "level" INTEGER DEFAULT 1,
    "max_level" INTEGER DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT "achievements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."activity_events" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "session_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "app_name" TEXT,
    "window_title" TEXT,
    "timestamp" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),
    "metadata" JSONB,

    CONSTRAINT "activity_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."ai_avatars" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "name" TEXT NOT NULL,
    "gender" TEXT,
    "age_range" TEXT,
    "personality" TEXT,
    "specialties" TEXT[],
    "description" TEXT,
    "image_url" TEXT,
    "voice_type" TEXT,
    "accent_type" TEXT,
    "rating" DECIMAL(3,2) DEFAULT 5.0,
    "is_active" BOOLEAN DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT "ai_avatars_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."app_sessions" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "title" TEXT DEFAULT 'New Session',
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "type" TEXT NOT NULL DEFAULT 'instant',
    "scheduled_at" TIMESTAMPTZ(6),
    "started_at" TIMESTAMPTZ(6),
    "ended_at" TIMESTAMPTZ(6),
    "duration_minutes" INTEGER,
    "billed_seconds" INTEGER DEFAULT 0,
    "config" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),
    "recording_url" TEXT,
    "is_favorite" BOOLEAN DEFAULT false,

    CONSTRAINT "app_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."appointments" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "companion_id" UUID,
    "start_time" TIMESTAMPTZ(6) NOT NULL,
    "end_time" TIMESTAMPTZ(6) NOT NULL,
    "status" TEXT DEFAULT 'scheduled',
    "type" TEXT DEFAULT 'video',
    "meeting_link" TEXT,
    "notes" TEXT,
    "sentiment" TEXT,
    "rating" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."audit_logs" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "org_id" UUID,
    "actor_id" UUID,
    "action" TEXT NOT NULL,
    "details" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."community_comments" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "post_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT "community_comments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."community_group_members" (
    "group_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" TEXT DEFAULT 'member',
    "joined_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT "community_group_members_pkey" PRIMARY KEY ("group_id","user_id")
);

CREATE TABLE IF NOT EXISTS "public"."community_groups" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "privacy" TEXT DEFAULT 'public',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT "community_groups_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."community_posts" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "group_id" UUID,
    "user_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "likes_count" INTEGER DEFAULT 0,
    "tags" TEXT[],
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT "community_posts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."companion_profiles" (
    "id" UUID NOT NULL,
    "license_number" TEXT,
    "specializations" TEXT[],
    "availability" JSONB,
    "rating" DECIMAL(3,2) DEFAULT 0,
    "is_verified" BOOLEAN DEFAULT false,
    "joined_date" TIMESTAMPTZ(6) DEFAULT timezone('utc'::text, now()),
    "languages" TEXT[],
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT "companion_profiles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."crisis_events" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "risk_level" "public"."risk_level" NOT NULL,
    "event_type" TEXT,
    "keywords" TEXT[],
    "status" "public"."crisis_status" DEFAULT 'pending',
    "ai_confidence" INTEGER,
    "assigned_to" UUID,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),
    "resolved_at" TIMESTAMPTZ(6),

    CONSTRAINT "crisis_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."email_templates" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "variables" TEXT[],
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT "email_templates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."emergency_contacts" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "relationship" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "is_trusted" BOOLEAN DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT "emergency_contacts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."error_logs" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "message" TEXT NOT NULL,
    "stack_trace" TEXT,
    "context" JSONB,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),
    "resolved_at" TIMESTAMPTZ(6),

    CONSTRAINT "error_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."feature_flags" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_enabled" BOOLEAN DEFAULT false,
    "rules" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."habit_logs" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "habit_id" UUID NOT NULL,
    "completed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT "habit_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."habits" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "frequency" TEXT DEFAULT 'daily',
    "color" TEXT,
    "icon" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),
    "is_archived" BOOLEAN DEFAULT false,

    CONSTRAINT "habits_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."idle_events" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "session_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "start_time" TIMESTAMPTZ(6) NOT NULL,
    "end_time" TIMESTAMPTZ(6),
    "reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT "idle_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."journal_entries" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "title" TEXT,
    "content" TEXT,
    "mood_tags" TEXT[],
    "is_private" BOOLEAN DEFAULT true,
    "location" TEXT,
    "is_favorite" BOOLEAN DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."moderation_queue" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "content_type" TEXT NOT NULL,
    "content_id" UUID NOT NULL,
    "reason" TEXT,
    "status" TEXT DEFAULT 'pending',
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT "moderation_queue_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."mood_entries" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),
    "activities" TEXT[],
    "intensity" INTEGER NOT NULL,
    "mood" TEXT NOT NULL,

    CONSTRAINT "mood_entries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT,
    "message" TEXT,
    "is_read" BOOLEAN DEFAULT false,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."nudge_templates" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "variables" TEXT[],
    "usage" INTEGER NOT NULL DEFAULT 0,
    "rating" DECIMAL(3,2),
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_by" UUID,
    "last_used" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT "nudge_templates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."nudges" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "target_audience" JSONB,
    "schedule_time" TIMESTAMPTZ(6),
    "is_recurring" BOOLEAN DEFAULT false,
    "status" TEXT DEFAULT 'draft',
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT "nudges_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."org_members" (
    "org_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" TEXT DEFAULT 'member',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT "org_members_pkey" PRIMARY KEY ("org_id","user_id")
);

CREATE TABLE IF NOT EXISTS "public"."organizations" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" UUID NOT NULL,
    "email" TEXT,
    "full_name" TEXT,
    "avatar_url" TEXT,
    "role" TEXT DEFAULT 'user',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),
    "age" TEXT,
    "current_mood" TEXT,
    "pronouns" TEXT,
    "selected_goals" TEXT[],
    "timezone" TEXT,
    "emergency_contact_name" TEXT,
    "emergency_contact_phone" TEXT,
    "emergency_contact_relationship" TEXT,
    "in_therapy" TEXT,
    "notification_preferences" JSONB,
    "on_medication" TEXT,
    "permissions" JSONB,
    "selected_avatar" TEXT,
    "selected_environment" TEXT,
    "selected_triggers" TEXT[],
    "phone" TEXT,
    "selected_voice" TEXT,
    "credits" INTEGER DEFAULT 0,
    "credits_seconds" INTEGER DEFAULT 0,
    "stripe_customer_id" TEXT,
    "purchased_credits" INTEGER DEFAULT 0,
    "purchased_credits_seconds" INTEGER DEFAULT 0,
    "privacy_settings" JSONB,
    "account_status" TEXT DEFAULT 'active',

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."projects" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "org_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."push_campaigns" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "target_segment_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "scheduled_at" TIMESTAMPTZ(6),
    "sent_at" TIMESTAMPTZ(6),
    "metrics" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),
    "created_by" UUID,

    CONSTRAINT "push_campaigns_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."payment_transactions" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "stripe_session_id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "credits_amount" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT "payment_transactions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."reports_daily" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "total_time" INTEGER DEFAULT 0,
    "summary_json" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT "reports_daily_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."safety_plans" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "warning_signs" TEXT[],
    "coping_strategies" TEXT[],
    "social_distractions" TEXT[],
    "trusted_contacts" JSONB,
    "professional_support" JSONB,
    "environment_safety" TEXT[],
    "last_updated" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT "safety_plans_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."session_messages" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "session_id" UUID NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT "session_messages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."sleep_entries" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "bed_time" TIMESTAMPTZ(6) NOT NULL,
    "wake_time" TIMESTAMPTZ(6) NOT NULL,
    "quality_rating" INTEGER,
    "factors" TEXT[],
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT "sleep_entries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."subscriptions" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "org_id" UUID,
    "stripe_sub_id" TEXT,
    "status" TEXT DEFAULT 'active',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),
    "amount" DECIMAL(10,2),
    "billing_cycle" TEXT DEFAULT 'monthly',
    "end_date" TIMESTAMPTZ(6),
    "next_billing_at" TIMESTAMPTZ(6),
    "payment_method" TEXT,
    "plan_type" TEXT DEFAULT 'trial',
    "start_date" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),
    "user_id" UUID NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."support_tickets" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priority" "public"."ticket_priority" DEFAULT 'medium',
    "status" "public"."ticket_status" DEFAULT 'open',
    "assigned_to" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."system_settings" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "description" TEXT,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),
    "updated_by" UUID,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."tasks" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "project_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT DEFAULT 'todo',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."time_entries" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "task_id" UUID,
    "start_time" TIMESTAMPTZ(6) NOT NULL,
    "end_time" TIMESTAMPTZ(6),
    "duration" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT "time_entries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."user_achievements" (
    "user_id" UUID NOT NULL,
    "achievement_id" UUID NOT NULL,
    "earned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),
    "progress" INTEGER DEFAULT 0,

    CONSTRAINT "user_achievements_pkey" PRIMARY KEY ("user_id","achievement_id")
);

CREATE TABLE IF NOT EXISTS "public"."user_challenge_participation" (
    "user_id" UUID NOT NULL,
    "challenge_id" UUID NOT NULL,
    "joined_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),
    "progress" INTEGER DEFAULT 0,
    "is_completed" BOOLEAN DEFAULT false,

    CONSTRAINT "user_challenge_participation_pkey" PRIMARY KEY ("user_id","challenge_id")
);

CREATE TABLE IF NOT EXISTS "public"."user_segments" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "name" TEXT NOT NULL,
    "description" TEXT,
    "criteria" JSONB NOT NULL,
    "user_count" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT "user_segments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."user_wellness_progress" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "tool_id" UUID NOT NULL,
    "completed_at" TIMESTAMPTZ(6) DEFAULT timezone('utc'::text, now()),
    "duration_spent" INTEGER,
    "feedback_rating" INTEGER,

    CONSTRAINT "user_wellness_progress_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."wellness_challenges" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "start_date" TIMESTAMPTZ(6) NOT NULL,
    "end_date" TIMESTAMPTZ(6) NOT NULL,
    "goal_criteria" JSONB,
    "reward_points" INTEGER DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT "wellness_challenges_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."wellness_tools" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "content_url" TEXT,
    "duration_minutes" INTEGER,
    "difficulty" TEXT,
    "is_premium" BOOLEAN DEFAULT false,
    "status" TEXT DEFAULT 'draft',
    "icon" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT "wellness_tools_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "email_templates_name_key" ON "public"."email_templates"("name");
CREATE UNIQUE INDEX IF NOT EXISTS "feature_flags_name_key" ON "public"."feature_flags"("name");
CREATE UNIQUE INDEX IF NOT EXISTS "organizations_slug_key" ON "public"."organizations"("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "payment_transactions_stripe_session_id_key" ON "public"."payment_transactions"("stripe_session_id");
CREATE UNIQUE INDEX IF NOT EXISTS "system_settings_key_key" ON "public"."system_settings"("key");

CREATE INDEX IF NOT EXISTS "activity_events_timestamp_idx" ON "public"."activity_events"("timestamp" DESC);
CREATE INDEX IF NOT EXISTS "activity_events_user_id_idx" ON "public"."activity_events"("user_id");
CREATE INDEX IF NOT EXISTS "app_sessions_user_id_idx" ON "public"."app_sessions"("user_id");
CREATE INDEX IF NOT EXISTS "app_sessions_started_at_idx" ON "public"."app_sessions"("started_at");
CREATE INDEX IF NOT EXISTS "app_sessions_ended_at_idx" ON "public"."app_sessions"("ended_at");
CREATE INDEX IF NOT EXISTS "app_sessions_user_id_ended_at_idx" ON "public"."app_sessions"("user_id", "ended_at");
CREATE INDEX IF NOT EXISTS "app_sessions_user_id_started_at_idx" ON "public"."app_sessions"("user_id", "started_at" DESC);
CREATE INDEX IF NOT EXISTS "appointments_user_id_idx" ON "public"."appointments"("user_id");
CREATE INDEX IF NOT EXISTS "appointments_user_id_start_time_idx" ON "public"."appointments"("user_id", "start_time");
CREATE INDEX IF NOT EXISTS "appointments_created_at_idx" ON "public"."appointments"("created_at" DESC);
CREATE INDEX IF NOT EXISTS "audit_logs_org_id_idx" ON "public"."audit_logs"("org_id");
CREATE INDEX IF NOT EXISTS "audit_logs_actor_id_idx" ON "public"."audit_logs"("actor_id");
CREATE INDEX IF NOT EXISTS "audit_logs_created_at_idx" ON "public"."audit_logs"("created_at" DESC);
CREATE INDEX IF NOT EXISTS "community_comments_user_id_idx" ON "public"."community_comments"("user_id");
CREATE INDEX IF NOT EXISTS "community_group_members_user_id_idx" ON "public"."community_group_members"("user_id");
CREATE INDEX IF NOT EXISTS "community_group_members_group_id_role_idx" ON "public"."community_group_members"("group_id", "role");
CREATE INDEX IF NOT EXISTS "community_posts_user_id_idx" ON "public"."community_posts"("user_id");
CREATE INDEX IF NOT EXISTS "journal_entries_user_id_idx" ON "public"."journal_entries"("user_id");
CREATE INDEX IF NOT EXISTS "journal_entries_user_id_created_at_idx" ON "public"."journal_entries"("user_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "mood_entries_user_id_idx" ON "public"."mood_entries"("user_id");
CREATE INDEX IF NOT EXISTS "mood_entries_user_id_created_at_idx" ON "public"."mood_entries"("user_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "org_members_user_id_idx" ON "public"."org_members"("user_id");
CREATE INDEX IF NOT EXISTS "org_members_org_id_role_idx" ON "public"."org_members"("org_id", "role");
CREATE INDEX IF NOT EXISTS "profiles_created_at_idx" ON "public"."profiles"("created_at" DESC);
CREATE INDEX IF NOT EXISTS "profiles_role_idx" ON "public"."profiles"("role");
CREATE INDEX IF NOT EXISTS "profiles_email_idx" ON "public"."profiles"("email");
CREATE INDEX IF NOT EXISTS "sleep_entries_user_id_created_at_idx" ON "public"."sleep_entries"("user_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "subscriptions_user_id_idx" ON "public"."subscriptions"("user_id");
CREATE INDEX IF NOT EXISTS "subscriptions_user_id_status_idx" ON "public"."subscriptions"("user_id", "status");
CREATE INDEX IF NOT EXISTS "subscriptions_user_id_status_created_at_idx" ON "public"."subscriptions"("user_id", "status", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "subscriptions_created_at_idx" ON "public"."subscriptions"("created_at" DESC);
CREATE INDEX IF NOT EXISTS "user_wellness_progress_user_id_completed_at_duration_spent__idx" ON "public"."user_wellness_progress"("user_id", "completed_at" DESC, "duration_spent", "tool_id");
CREATE INDEX IF NOT EXISTS "user_wellness_progress_tool_id_idx" ON "public"."user_wellness_progress"("tool_id");

ALTER TABLE "public"."favorite_wellness_tools" ADD CONSTRAINT "favorite_wellness_tools_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "public"."favorite_wellness_tools" ADD CONSTRAINT "favorite_wellness_tools_tool_id_fkey" FOREIGN KEY ("tool_id") REFERENCES "public"."wellness_tools"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "public"."activity_events" ADD CONSTRAINT "activity_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "public"."app_sessions" ADD CONSTRAINT "app_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "public"."appointments" ADD CONSTRAINT "appointments_companion_id_fkey" FOREIGN KEY ("companion_id") REFERENCES "public"."profiles"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "public"."appointments" ADD CONSTRAINT "appointments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "public"."audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "public"."audit_logs" ADD CONSTRAINT "audit_logs_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "public"."community_comments" ADD CONSTRAINT "community_comments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."community_posts"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "public"."community_comments" ADD CONSTRAINT "community_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "public"."community_group_members" ADD CONSTRAINT "community_group_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."community_groups"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "public"."community_group_members" ADD CONSTRAINT "community_group_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "public"."community_posts" ADD CONSTRAINT "community_posts_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."community_groups"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "public"."community_posts" ADD CONSTRAINT "community_posts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "public"."companion_profiles" ADD CONSTRAINT "companion_profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "public"."crisis_events" ADD CONSTRAINT "crisis_events_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."profiles"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "public"."crisis_events" ADD CONSTRAINT "crisis_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "public"."emergency_contacts" ADD CONSTRAINT "emergency_contacts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "public"."habit_logs" ADD CONSTRAINT "habit_logs_habit_id_fkey" FOREIGN KEY ("habit_id") REFERENCES "public"."habits"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "public"."habits" ADD CONSTRAINT "habits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "public"."idle_events" ADD CONSTRAINT "idle_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "public"."journal_entries" ADD CONSTRAINT "journal_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "public"."moderation_queue" ADD CONSTRAINT "moderation_queue_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "public"."profiles"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "public"."mood_entries" ADD CONSTRAINT "mood_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "public"."notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "public"."nudges" ADD CONSTRAINT "nudges_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "public"."org_members" ADD CONSTRAINT "org_members_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "public"."org_members" ADD CONSTRAINT "org_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "public"."profiles" ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "public"."projects" ADD CONSTRAINT "projects_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "public"."reports_daily" ADD CONSTRAINT "reports_daily_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "public"."safety_plans" ADD CONSTRAINT "safety_plans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "public"."session_messages" ADD CONSTRAINT "session_messages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."app_sessions"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "public"."sleep_entries" ADD CONSTRAINT "sleep_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "public"."subscriptions" ADD CONSTRAINT "subscriptions_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "public"."subscriptions" ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "public"."support_tickets" ADD CONSTRAINT "support_tickets_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."profiles"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "public"."support_tickets" ADD CONSTRAINT "support_tickets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "public"."system_settings" ADD CONSTRAINT "system_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "public"."tasks" ADD CONSTRAINT "tasks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "public"."time_entries" ADD CONSTRAINT "time_entries_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "public"."time_entries" ADD CONSTRAINT "time_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "public"."user_achievements" ADD CONSTRAINT "user_achievements_achievement_id_fkey" FOREIGN KEY ("achievement_id") REFERENCES "public"."achievements"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "public"."user_achievements" ADD CONSTRAINT "user_achievements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "public"."user_challenge_participation" ADD CONSTRAINT "user_challenge_participation_challenge_id_fkey" FOREIGN KEY ("challenge_id") REFERENCES "public"."wellness_challenges"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "public"."user_challenge_participation" ADD CONSTRAINT "user_challenge_participation_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "public"."user_wellness_progress" ADD CONSTRAINT "user_wellness_progress_tool_id_fkey" FOREIGN KEY ("tool_id") REFERENCES "public"."wellness_tools"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "public"."user_wellness_progress" ADD CONSTRAINT "user_wellness_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "public"."wellness_tools" ADD CONSTRAINT "wellness_tools_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companion_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mood_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.safety_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crisis_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wellness_tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_wellness_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorite_wellness_tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sleep_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Anyone can view verified companions" ON public.companion_profiles;
CREATE POLICY "Anyone can view verified companions" ON public.companion_profiles
  FOR SELECT USING (is_verified = true OR auth.uid() = id);

DROP POLICY IF EXISTS "Companions can update own profile" ON public.companion_profiles;
CREATE POLICY "Companions can update own profile" ON public.companion_profiles
  FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can manage own sessions" ON public.app_sessions;
CREATE POLICY "Users can manage own sessions" ON public.app_sessions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own session messages" ON public.session_messages;
CREATE POLICY "Users can manage own session messages" ON public.session_messages
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.app_sessions s
      WHERE s.id = session_messages.session_id
      AND s.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.app_sessions s
      WHERE s.id = session_messages.session_id
      AND s.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can manage own mood entries" ON public.mood_entries;
CREATE POLICY "Users can manage own mood entries" ON public.mood_entries
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own journal entries" ON public.journal_entries;
CREATE POLICY "Users can manage own journal entries" ON public.journal_entries
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own appointments" ON public.appointments;
CREATE POLICY "Users can view own appointments" ON public.appointments
  FOR SELECT USING (auth.uid() = user_id OR auth.uid() = companion_id);

DROP POLICY IF EXISTS "Users can create own appointments" ON public.appointments;
CREATE POLICY "Users can create own appointments" ON public.appointments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users and companions can update appointments" ON public.appointments;
CREATE POLICY "Users and companions can update appointments" ON public.appointments
  FOR UPDATE USING (auth.uid() = user_id OR auth.uid() = companion_id)
  WITH CHECK (auth.uid() = user_id OR auth.uid() = companion_id);

DROP POLICY IF EXISTS "Users can delete own appointments" ON public.appointments;
CREATE POLICY "Users can delete own appointments" ON public.appointments
  FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own safety plan" ON public.safety_plans;
CREATE POLICY "Users can manage own safety plan" ON public.safety_plans
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Companions can view patient safety plans" ON public.safety_plans;
CREATE POLICY "Companions can view patient safety plans" ON public.safety_plans
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.user_id = safety_plans.user_id
      AND a.companion_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can view own crisis events" ON public.crisis_events;
CREATE POLICY "Users can view own crisis events" ON public.crisis_events
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins and companions can manage crisis events" ON public.crisis_events;
CREATE POLICY "Admins and companions can manage crisis events" ON public.crisis_events
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'super_admin', 'companion', 'org_admin', 'team_admin')
    )
  );

DROP POLICY IF EXISTS "Anyone can view published wellness tools" ON public.wellness_tools;
CREATE POLICY "Anyone can view published wellness tools" ON public.wellness_tools
  FOR SELECT USING (status = 'published');

DROP POLICY IF EXISTS "Admins can manage wellness tools" ON public.wellness_tools;
CREATE POLICY "Admins can manage wellness tools" ON public.wellness_tools
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "Users can manage own wellness progress" ON public.user_wellness_progress;
CREATE POLICY "Users can manage own wellness progress" ON public.user_wellness_progress
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own favorite wellness tools" ON public.favorite_wellness_tools;
CREATE POLICY "Users can manage own favorite wellness tools" ON public.favorite_wellness_tools
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Anyone can view public groups" ON public.community_groups;
CREATE POLICY "Anyone can view public groups" ON public.community_groups
  FOR SELECT USING (
    privacy = 'public'
    OR EXISTS (
      SELECT 1 FROM public.community_group_members m
      WHERE m.group_id = community_groups.id
      AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Members can manage own group membership" ON public.community_group_members;
CREATE POLICY "Members can manage own group membership" ON public.community_group_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.community_groups g
      WHERE g.id = community_group_members.group_id
      AND (
        g.privacy = 'public'
        OR EXISTS (
          SELECT 1 FROM public.community_group_members m2
          WHERE m2.group_id = community_group_members.group_id
          AND m2.user_id = auth.uid()
        )
      )
    )
  )
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own posts" ON public.community_posts;
CREATE POLICY "Users can manage own posts" ON public.community_posts
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view posts in accessible groups" ON public.community_posts;
CREATE POLICY "Users can view posts in accessible groups" ON public.community_posts
  FOR SELECT USING (
    group_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.community_groups g
      WHERE g.id = community_posts.group_id
      AND (
        g.privacy = 'public'
        OR EXISTS (
          SELECT 1 FROM public.community_group_members m
          WHERE m.group_id = g.id
          AND m.user_id = auth.uid()
        )
      )
    )
  );

DROP POLICY IF EXISTS "Users can manage own comments" ON public.community_comments;
CREATE POLICY "Users can manage own comments" ON public.community_comments
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view comments for accessible posts" ON public.community_comments;
CREATE POLICY "Users can view comments for accessible posts" ON public.community_comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.community_posts p
      LEFT JOIN public.community_groups g ON g.id = p.group_id
      WHERE p.id = community_comments.post_id
      AND (
        p.group_id IS NULL
        OR g.privacy = 'public'
        OR EXISTS (
          SELECT 1 FROM public.community_group_members m
          WHERE m.group_id = p.group_id
          AND m.user_id = auth.uid()
        )
      )
    )
  );

DROP POLICY IF EXISTS "Users can manage own habits" ON public.habits;
CREATE POLICY "Users can manage own habits" ON public.habits
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage habit logs for own habits" ON public.habit_logs;
CREATE POLICY "Users can manage habit logs for own habits" ON public.habit_logs
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.habits h
      WHERE h.id = habit_logs.habit_id
      AND h.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.habits h
      WHERE h.id = habit_logs.habit_id
      AND h.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can manage own sleep entries" ON public.sleep_entries;
CREATE POLICY "Users can manage own sleep entries" ON public.sleep_entries
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own notifications" ON public.notifications;
CREATE POLICY "Users can manage own notifications" ON public.notifications
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own reports" ON public.reports_daily;
CREATE POLICY "Users can view own reports" ON public.reports_daily
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own payments" ON public.payment_transactions;
CREATE POLICY "Users can view own payments" ON public.payment_transactions
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own tickets" ON public.support_tickets;
CREATE POLICY "Users can view own tickets" ON public.support_tickets
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create tickets" ON public.support_tickets;
CREATE POLICY "Users can create tickets" ON public.support_tickets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can manage tickets" ON public.support_tickets;
CREATE POLICY "Admins can manage tickets" ON public.support_tickets
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'super_admin', 'support')
    )
  );
