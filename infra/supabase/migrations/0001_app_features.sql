-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ==========================================
-- ENUMS
-- ==========================================

DO $$ BEGIN
    CREATE TYPE risk_level AS ENUM ('low', 'medium', 'high', 'critical');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE crisis_status AS ENUM ('pending', 'contacted', 'in-progress', 'resolved');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE safety_state AS ENUM ('NORMAL', 'ELEVATED_CONCERN', 'HIGH_RISK', 'SAFETY_MODE', 'COOLDOWN');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE subscription_tier AS ENUM ('trial', 'core', 'pro');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE ticket_status AS ENUM ('open', 'in_progress', 'resolved', 'closed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE ticket_priority AS ENUM ('low', 'medium', 'high', 'urgent');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ==========================================
-- TABLES
-- ==========================================

-- PROFILES
create table if not exists public.profiles (
  id uuid references auth.users not null primary key,
  email text,
  full_name text,
  avatar_url text,
  role text default 'user',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ORGANIZATIONS
create table if not exists public.organizations (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  slug text unique not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ORG MEMBERS
create table if not exists public.org_members (
  org_id uuid references public.organizations(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  role text default 'member', -- owner, admin, member
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (org_id, user_id)
);

-- PROJECTS
create table if not exists public.projects (
  id uuid default uuid_generate_v4() primary key,
  org_id uuid references public.organizations(id) on delete cascade not null,
  name text not null,
  color text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- TASKS
create table if not exists public.tasks (
  id uuid default uuid_generate_v4() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  name text not null,
  status text default 'todo',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- TIME ENTRIES
create table if not exists public.time_entries (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) not null,
  task_id uuid references public.tasks(id),
  start_time timestamp with time zone not null,
  end_time timestamp with time zone,
  duration int, -- seconds
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ACTIVITY EVENTS
create table if not exists public.activity_events (
  id uuid default uuid_generate_v4() primary key,
  session_id uuid not null, -- Links to a time_entry or logical session
  user_id uuid references public.profiles(id) not null,
  app_name text,
  window_title text,
  timestamp timestamp with time zone default timezone('utc'::text, now()) not null,
  metadata jsonb
);

-- IDLE EVENTS
create table if not exists public.idle_events (
  id uuid default uuid_generate_v4() primary key,
  session_id uuid not null,
  user_id uuid references public.profiles(id) not null,
  start_time timestamp with time zone not null,
  end_time timestamp with time zone,
  reason text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- REPORTS DAILY
create table if not exists public.reports_daily (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) not null,
  date date not null,
  total_time int default 0,
  summary_json jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- SUBSCRIPTIONS
create table if not exists public.subscriptions (
  id uuid default uuid_generate_v4() primary key,
  org_id uuid references public.organizations(id) not null,
  stripe_sub_id text,
  status text,
  plan_id text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- AUDIT LOGS
create table if not exists public.audit_logs (
  id uuid default uuid_generate_v4() primary key,
  org_id uuid references public.organizations(id),
  actor_id uuid references public.profiles(id),
  action text not null,
  details jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- THERAPIST PROFILES
CREATE TABLE IF NOT EXISTS public.therapist_profiles (
  id uuid REFERENCES public.profiles(id) ON DELETE CASCADE PRIMARY KEY,
  license_number text,
  specializations text[],
  availability jsonb,
  rating numeric(3,2) DEFAULT 0,
  is_verified boolean DEFAULT false,
  joined_date timestamp with time zone DEFAULT timezone('utc'::text, now()),
  languages text[],
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- MOOD ENTRIES
CREATE TABLE IF NOT EXISTS public.mood_entries (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  mood_score integer NOT NULL CHECK (mood_score >= 1 AND mood_score <= 10),
  emotions text[],
  notes text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- JOURNAL ENTRIES
CREATE TABLE IF NOT EXISTS public.journal_entries (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  title text,
  content text,
  mood_tags text[],
  is_private boolean DEFAULT true,
  location text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- APPOINTMENTS
CREATE TABLE IF NOT EXISTS public.appointments (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  therapist_id uuid REFERENCES public.profiles(id), 
  start_time timestamp with time zone NOT NULL,
  end_time timestamp with time zone NOT NULL,
  status text DEFAULT 'scheduled', -- scheduled, completed, cancelled
  type text DEFAULT 'video', -- video, chat
  meeting_link text,
  notes text,
  sentiment text, -- positive, neutral, negative
  rating integer,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- SAFETY PLANS
CREATE TABLE IF NOT EXISTS public.safety_plans (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  warning_signs text[],
  coping_strategies text[],
  social_distractions text[],
  trusted_contacts jsonb, -- Array of {name, phone, relation}
  professional_support jsonb,
  environment_safety text[],
  last_updated timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- CRISIS EVENTS
CREATE TABLE IF NOT EXISTS public.crisis_events (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  risk_level risk_level NOT NULL,
  event_type text,
  keywords text[],
  status crisis_status DEFAULT 'pending',
  ai_confidence integer,
  assigned_to uuid REFERENCES public.profiles(id), -- Therapist or Admin
  notes text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  resolved_at timestamp with time zone
);

-- WELLNESS TOOLS
CREATE TABLE IF NOT EXISTS public.wellness_tools (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  title text NOT NULL,
  category text NOT NULL,
  description text,
  content_url text,
  duration_minutes integer,
  difficulty text, -- Beginner, Intermediate, Advanced
  is_premium boolean DEFAULT false,
  status text DEFAULT 'draft', -- draft, published, archived
  icon text,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- USER WELLNESS PROGRESS
CREATE TABLE IF NOT EXISTS public.user_wellness_progress (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  tool_id uuid REFERENCES public.wellness_tools(id) ON DELETE CASCADE NOT NULL,
  completed_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  duration_spent integer,
  feedback_rating integer
);

-- COMMUNITY GROUPS
CREATE TABLE IF NOT EXISTS public.community_groups (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  name text NOT NULL,
  description text,
  category text,
  privacy text DEFAULT 'public', -- public, private
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- COMMUNITY GROUP MEMBERS
CREATE TABLE IF NOT EXISTS public.community_group_members (
  group_id uuid REFERENCES public.community_groups(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  role text DEFAULT 'member', -- member, moderator, admin
  joined_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (group_id, user_id)
);

-- COMMUNITY POSTS
CREATE TABLE IF NOT EXISTS public.community_posts (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  group_id uuid REFERENCES public.community_groups(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  content text NOT NULL,
  likes_count integer DEFAULT 0,
  tags text[],
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- COMMUNITY COMMENTS
CREATE TABLE IF NOT EXISTS public.community_comments (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  post_id uuid REFERENCES public.community_posts(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ACHIEVEMENTS
CREATE TABLE IF NOT EXISTS public.achievements (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  name text NOT NULL,
  description text,
  category text, -- sessions, mood, journal, social, wellness
  icon_url text,
  criteria jsonb,
  points integer DEFAULT 0,
  level integer DEFAULT 1,
  max_level integer DEFAULT 1,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- USER ACHIEVEMENTS
CREATE TABLE IF NOT EXISTS public.user_achievements (
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  achievement_id uuid REFERENCES public.achievements(id) ON DELETE CASCADE NOT NULL,
  earned_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  progress integer DEFAULT 0,
  PRIMARY KEY (user_id, achievement_id)
);

-- NOTIFICATIONS
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  type text NOT NULL, -- mood, session, achievement, reminder, system, message
  title text,
  message text,
  is_read boolean DEFAULT false,
  metadata jsonb,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- HABITS
CREATE TABLE IF NOT EXISTS public.habits (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  category text,
  frequency text DEFAULT 'daily', -- daily, weekly
  color text,
  icon text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  is_archived boolean DEFAULT false
);

-- HABIT LOGS
CREATE TABLE IF NOT EXISTS public.habit_logs (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  habit_id uuid REFERENCES public.habits(id) ON DELETE CASCADE NOT NULL,
  completed_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- SLEEP TRACKER
CREATE TABLE IF NOT EXISTS public.sleep_entries (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  bed_time timestamp with time zone NOT NULL,
  wake_time timestamp with time zone NOT NULL,
  quality_rating integer,
  factors text[], -- caffeine, screen_time, etc.
  notes text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- SYSTEM SETTINGS
CREATE TABLE IF NOT EXISTS public.system_settings (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  key text UNIQUE NOT NULL,
  value jsonb NOT NULL,
  description text,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_by uuid REFERENCES public.profiles(id)
);

-- FEATURE FLAGS
CREATE TABLE IF NOT EXISTS public.feature_flags (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  name text UNIQUE NOT NULL,
  description text,
  is_enabled boolean DEFAULT false,
  rules jsonb, -- For targeting specific users/orgs
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- SUPPORT TICKETS
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  subject text NOT NULL,
  description text NOT NULL,
  priority ticket_priority DEFAULT 'medium',
  status ticket_status DEFAULT 'open',
  assigned_to uuid REFERENCES public.profiles(id),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- NUDGES
CREATE TABLE IF NOT EXISTS public.nudges (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL, -- motivational, reminder, etc.
  target_audience jsonb, -- criteria for who receives it
  schedule_time timestamp with time zone,
  is_recurring boolean DEFAULT false,
  status text DEFAULT 'draft',
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- WELLNESS CHALLENGES
CREATE TABLE IF NOT EXISTS public.wellness_challenges (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  title text NOT NULL,
  description text,
  category text,
  start_date timestamp with time zone NOT NULL,
  end_date timestamp with time zone NOT NULL,
  goal_criteria jsonb,
  reward_points integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- USER CHALLENGE PARTICIPATION
CREATE TABLE IF NOT EXISTS public.user_challenge_participation (
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  challenge_id uuid REFERENCES public.wellness_challenges(id) ON DELETE CASCADE NOT NULL,
  joined_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  progress integer DEFAULT 0,
  is_completed boolean DEFAULT false,
  PRIMARY KEY (user_id, challenge_id)
);

-- MODERATION QUEUE
CREATE TABLE IF NOT EXISTS public.moderation_queue (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  content_type text NOT NULL, -- post, comment, profile
  content_id uuid NOT NULL,
  reason text,
  status text DEFAULT 'pending', -- pending, approved, rejected
  reviewed_by uuid REFERENCES public.profiles(id),
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- AB TESTS
CREATE TABLE IF NOT EXISTS public.ab_tests (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  name text NOT NULL,
  description text,
  variants jsonb, -- { "A": 50, "B": 50 }
  start_date timestamp with time zone,
  end_date timestamp with time zone,
  status text DEFAULT 'draft',
  metrics jsonb, -- results
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==========================================
-- ROW LEVEL SECURITY (ENABLE)
-- ==========================================

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.org_members enable row level security;
alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.time_entries enable row level security;
alter table public.activity_events enable row level security;
alter table public.idle_events enable row level security;
alter table public.reports_daily enable row level security;
alter table public.subscriptions enable row level security;
alter table public.audit_logs enable row level security;
ALTER TABLE public.therapist_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mood_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.safety_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crisis_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wellness_tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_wellness_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sleep_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nudges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wellness_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_challenge_participation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ab_tests ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- POLICIES
-- ==========================================

-- PROFILES
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
create policy "Users can view own profile" on profiles
  for select using (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
create policy "Users can update own profile" on profiles
  for update using (auth.uid() = id);

-- ORG MEMBERS
DROP POLICY IF EXISTS "Members can view other members in same org" ON org_members;
create policy "Members can view other members in same org" on org_members
  for select using (
    exists (
      select 1 from org_members as om
      where om.org_id = org_members.org_id
      and om.user_id = auth.uid()
    )
  );

-- ORGANIZATIONS
DROP POLICY IF EXISTS "Org members can view organization" ON organizations;
create policy "Org members can view organization" on organizations
  for select using (
    exists (
      select 1 from org_members
      where org_members.org_id = organizations.id
      and org_members.user_id = auth.uid()
    )
  );

-- PROJECTS
DROP POLICY IF EXISTS "Org members can view projects" ON projects;
create policy "Org members can view projects" on projects
  for select using (
    exists (
      select 1 from org_members
      where org_members.org_id = projects.org_id
      and org_members.user_id = auth.uid()
    )
  );

-- TASKS
DROP POLICY IF EXISTS "Org members can view tasks" ON tasks;
create policy "Org members can view tasks" on tasks
  for select using (
    exists (
      select 1 from org_members
      join projects on projects.id = tasks.project_id
      where org_members.org_id = projects.org_id
      and org_members.user_id = auth.uid()
    )
  );

-- TIME ENTRIES
DROP POLICY IF EXISTS "Users can view own time entries" ON time_entries;
create policy "Users can view own time entries" on time_entries
  for select using (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own time entries" ON time_entries;
create policy "Users can insert own time entries" on time_entries
  for insert with check (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own time entries" ON time_entries;
create policy "Users can update own time entries" on time_entries
  for update using (auth.uid() = user_id);

-- ACTIVITY EVENTS
DROP POLICY IF EXISTS "Users can view own activity" ON activity_events;
create policy "Users can view own activity" on activity_events
  for select using (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own activity" ON activity_events;
create policy "Users can insert own activity" on activity_events
  for insert with check (auth.uid() = user_id);

-- IDLE EVENTS
DROP POLICY IF EXISTS "Users can view own idle events" ON idle_events;
create policy "Users can view own idle events" on idle_events
  for select using (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own idle events" ON idle_events;
create policy "Users can insert own idle events" on idle_events
  for insert with check (auth.uid() = user_id);

-- REPORTS DAILY
DROP POLICY IF EXISTS "Users can view own reports" ON reports_daily;
create policy "Users can view own reports" on reports_daily
  for select using (auth.uid() = user_id);

-- SUBSCRIPTIONS
DROP POLICY IF EXISTS "Org admins can view subscriptions" ON subscriptions;
create policy "Org admins can view subscriptions" on subscriptions
  for select using (
    exists (
      select 1 from org_members
      where org_members.org_id = subscriptions.org_id
      and org_members.user_id = auth.uid()
      and org_members.role in ('owner', 'admin')
    )
  );

-- AUDIT LOGS
DROP POLICY IF EXISTS "Org admins can view audit logs" ON audit_logs;
create policy "Org admins can view audit logs" on audit_logs
  for select using (
    exists (
      select 1 from org_members
      where org_members.org_id = audit_logs.org_id
      and org_members.user_id = auth.uid()
      and org_members.role in ('owner', 'admin')
    )
  );

-- THERAPIST PROFILES
DROP POLICY IF EXISTS "Therapists can update own profile" ON therapist_profiles;
CREATE POLICY "Therapists can update own profile" ON therapist_profiles
  FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Anyone can view verified therapists" ON therapist_profiles;
CREATE POLICY "Anyone can view verified therapists" ON therapist_profiles
  FOR SELECT USING (is_verified = true);

-- MOOD ENTRIES
DROP POLICY IF EXISTS "Users can manage own mood entries" ON mood_entries;
CREATE POLICY "Users can manage own mood entries" ON mood_entries
  FOR ALL USING (auth.uid() = user_id);

-- JOURNAL ENTRIES
DROP POLICY IF EXISTS "Users can manage own journal entries" ON journal_entries;
CREATE POLICY "Users can manage own journal entries" ON journal_entries
  FOR ALL USING (auth.uid() = user_id);

-- APPOINTMENTS
DROP POLICY IF EXISTS "Users can view own appointments" ON appointments;
CREATE POLICY "Users can view own appointments" ON appointments
  FOR SELECT USING (auth.uid() = user_id OR auth.uid() = therapist_id);

DROP POLICY IF EXISTS "Users can manage own appointments" ON appointments;
CREATE POLICY "Users can manage own appointments" ON appointments
  FOR ALL USING (auth.uid() = user_id);

-- SAFETY PLANS
DROP POLICY IF EXISTS "Users can manage own safety plan" ON safety_plans;
CREATE POLICY "Users can manage own safety plan" ON safety_plans
  FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Therapists can view patient safety plans" ON safety_plans;
CREATE POLICY "Therapists can view patient safety plans" ON safety_plans
  FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM appointments 
        WHERE appointments.user_id = safety_plans.user_id 
        AND appointments.therapist_id = auth.uid()
    )
  );

-- CRISIS EVENTS
DROP POLICY IF EXISTS "Users can view own crisis events" ON crisis_events;
CREATE POLICY "Users can view own crisis events" ON crisis_events
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins and Therapists can manage crisis events" ON crisis_events;
CREATE POLICY "Admins and Therapists can manage crisis events" ON crisis_events
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() 
      AND (profiles.role = 'admin' OR profiles.role = 'therapist')
    )
  );

-- WELLNESS TOOLS
DROP POLICY IF EXISTS "Anyone can view published wellness tools" ON wellness_tools;
CREATE POLICY "Anyone can view published wellness tools" ON wellness_tools
  FOR SELECT USING (status = 'published');

DROP POLICY IF EXISTS "Admins can manage wellness tools" ON wellness_tools;
CREATE POLICY "Admins can manage wellness tools" ON wellness_tools
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() 
      AND (profiles.role = 'admin' OR profiles.role = 'super_admin')
    )
  );

-- USER WELLNESS PROGRESS
DROP POLICY IF EXISTS "Users can manage own wellness progress" ON user_wellness_progress;
CREATE POLICY "Users can manage own wellness progress" ON user_wellness_progress
  FOR ALL USING (auth.uid() = user_id);

-- COMMUNITY GROUPS
DROP POLICY IF EXISTS "Anyone can view public groups" ON community_groups;
CREATE POLICY "Anyone can view public groups" ON community_groups
  FOR SELECT USING (privacy = 'public');

DROP POLICY IF EXISTS "Members can view private groups" ON community_groups;
CREATE POLICY "Members can view private groups" ON community_groups
  FOR SELECT USING (
    privacy = 'public' OR 
    EXISTS (
      SELECT 1 FROM community_group_members 
      WHERE community_group_members.group_id = community_groups.id 
      AND community_group_members.user_id = auth.uid()
    )
  );

-- COMMUNITY GROUP MEMBERS
DROP POLICY IF EXISTS "Members can view group members" ON community_group_members;
CREATE POLICY "Members can view group members" ON community_group_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM community_group_members as cgm
      WHERE cgm.group_id = community_group_members.group_id
      AND cgm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can join public groups" ON community_group_members;
CREATE POLICY "Users can join public groups" ON community_group_members
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
  );

-- COMMUNITY POSTS
DROP POLICY IF EXISTS "Anyone can view public posts" ON community_posts;
CREATE POLICY "Anyone can view public posts" ON community_posts
  FOR SELECT USING (
    group_id IS NULL OR 
    EXISTS (
      SELECT 1 FROM community_groups 
      WHERE community_groups.id = community_posts.group_id 
      AND community_groups.privacy = 'public'
    ) OR
    EXISTS (
      SELECT 1 FROM community_group_members
      WHERE community_group_members.group_id = community_posts.group_id
      AND community_group_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can create posts" ON community_posts;
CREATE POLICY "Users can create posts" ON community_posts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- COMMUNITY COMMENTS
DROP POLICY IF EXISTS "Anyone can view comments on visible posts" ON community_comments;
CREATE POLICY "Anyone can view comments on visible posts" ON community_comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM community_posts
      WHERE community_posts.id = community_comments.post_id
    )
  );

DROP POLICY IF EXISTS "Users can create comments" ON community_comments;
CREATE POLICY "Users can create comments" ON community_comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ACHIEVEMENTS
DROP POLICY IF EXISTS "Anyone can view achievements" ON achievements;
CREATE POLICY "Anyone can view achievements" ON achievements
  FOR SELECT USING (true);

-- USER ACHIEVEMENTS
DROP POLICY IF EXISTS "Users can view own achievements" ON user_achievements;
CREATE POLICY "Users can view own achievements" ON user_achievements
  FOR SELECT USING (auth.uid() = user_id);

-- NOTIFICATIONS
DROP POLICY IF EXISTS "Users can manage own notifications" ON notifications;
CREATE POLICY "Users can manage own notifications" ON notifications
  FOR ALL USING (auth.uid() = user_id);

-- HABITS
DROP POLICY IF EXISTS "Users can manage own habits" ON habits;
CREATE POLICY "Users can manage own habits" ON habits
  FOR ALL USING (auth.uid() = user_id);

-- HABIT LOGS
DROP POLICY IF EXISTS "Users can manage own habit logs" ON habit_logs;
CREATE POLICY "Users can manage own habit logs" ON habit_logs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM habits WHERE habits.id = habit_logs.habit_id AND habits.user_id = auth.uid()
    )
  );

-- SLEEP ENTRIES
DROP POLICY IF EXISTS "Users can manage own sleep entries" ON sleep_entries;
CREATE POLICY "Users can manage own sleep entries" ON sleep_entries
  FOR ALL USING (auth.uid() = user_id);

-- SYSTEM SETTINGS
DROP POLICY IF EXISTS "Super Admins can manage system settings" ON system_settings;
CREATE POLICY "Super Admins can manage system settings" ON system_settings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'
    )
  );

-- FEATURE FLAGS
DROP POLICY IF EXISTS "Super Admins can manage feature flags" ON feature_flags;
CREATE POLICY "Super Admins can manage feature flags" ON feature_flags
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'
    )
  );

DROP POLICY IF EXISTS "Anyone can view feature flags" ON feature_flags;
CREATE POLICY "Anyone can view feature flags" ON feature_flags
  FOR SELECT USING (true);

-- SUPPORT TICKETS
DROP POLICY IF EXISTS "Users can view own tickets" ON support_tickets;
CREATE POLICY "Users can view own tickets" ON support_tickets
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create tickets" ON support_tickets;
CREATE POLICY "Users can create tickets" ON support_tickets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can manage tickets" ON support_tickets;
CREATE POLICY "Admins can manage tickets" ON support_tickets
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.role = 'super_admin' OR profiles.role = 'support')
    )
  );

-- NUDGES
DROP POLICY IF EXISTS "Admins can manage nudges" ON nudges;
CREATE POLICY "Admins can manage nudges" ON nudges
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.role = 'super_admin')
    )
  );

-- WELLNESS CHALLENGES
DROP POLICY IF EXISTS "Anyone can view challenges" ON wellness_challenges;
CREATE POLICY "Anyone can view challenges" ON wellness_challenges
  FOR SELECT USING (true);

-- USER CHALLENGE PARTICIPATION
DROP POLICY IF EXISTS "Users can manage own challenge participation" ON user_challenge_participation;
CREATE POLICY "Users can manage own challenge participation" ON user_challenge_participation
  FOR ALL USING (auth.uid() = user_id);

-- MODERATION QUEUE
DROP POLICY IF EXISTS "Admins can manage moderation queue" ON moderation_queue;
CREATE POLICY "Admins can manage moderation queue" ON moderation_queue
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.role = 'super_admin' OR profiles.role = 'moderator')
    )
  );

-- AB TESTS
DROP POLICY IF EXISTS "Admins can manage AB tests" ON ab_tests;
CREATE POLICY "Admins can manage AB tests" ON ab_tests
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.role = 'super_admin')
    )
  );
