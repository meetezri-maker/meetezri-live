-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- PROFILES
create table public.profiles (
  id uuid references auth.users not null primary key,
  email text,
  full_name text,
  avatar_url text,
  role text default 'user',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.profiles enable row level security;

create policy "Users can view own profile" on profiles
  for select using (auth.uid() = id);

create policy "Users can update own profile" on profiles
  for update using (auth.uid() = id);

-- ORGANIZATIONS
create table public.organizations (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  slug text unique not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.organizations enable row level security;

-- ORG MEMBERS
create table public.org_members (
  org_id uuid references public.organizations(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  role text default 'member', -- owner, admin, member
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (org_id, user_id)
);

alter table public.org_members enable row level security;

create policy "Members can view other members in same org" on org_members
  for select using (
    exists (
      select 1 from org_members as om
      where om.org_id = org_members.org_id
      and om.user_id = auth.uid()
    )
  );

create policy "Org members can view organization" on organizations
  for select using (
    exists (
      select 1 from org_members
      where org_members.org_id = organizations.id
      and org_members.user_id = auth.uid()
    )
  );

-- PROJECTS
create table public.projects (
  id uuid default uuid_generate_v4() primary key,
  org_id uuid references public.organizations(id) on delete cascade not null,
  name text not null,
  color text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.projects enable row level security;

create policy "Org members can view projects" on projects
  for select using (
    exists (
      select 1 from org_members
      where org_members.org_id = projects.org_id
      and org_members.user_id = auth.uid()
    )
  );

-- TASKS
create table public.tasks (
  id uuid default uuid_generate_v4() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  name text not null,
  status text default 'todo',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.tasks enable row level security;

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
create table public.time_entries (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) not null,
  task_id uuid references public.tasks(id),
  start_time timestamp with time zone not null,
  end_time timestamp with time zone,
  duration int, -- seconds
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.time_entries enable row level security;

create policy "Users can view own time entries" on time_entries
  for select using (auth.uid() = user_id);

create policy "Users can insert own time entries" on time_entries
  for insert with check (auth.uid() = user_id);

create policy "Users can update own time entries" on time_entries
  for update using (auth.uid() = user_id);

-- ACTIVITY EVENTS (Screenshots, app usage, etc.)
create table public.activity_events (
  id uuid default uuid_generate_v4() primary key,
  session_id uuid not null, -- Links to a time_entry or logical session
  user_id uuid references public.profiles(id) not null,
  app_name text,
  window_title text,
  timestamp timestamp with time zone default timezone('utc'::text, now()) not null,
  metadata jsonb
);

alter table public.activity_events enable row level security;

create policy "Users can view own activity" on activity_events
  for select using (auth.uid() = user_id);

create policy "Users can insert own activity" on activity_events
  for insert with check (auth.uid() = user_id);

-- IDLE EVENTS
create table public.idle_events (
  id uuid default uuid_generate_v4() primary key,
  session_id uuid not null,
  user_id uuid references public.profiles(id) not null,
  start_time timestamp with time zone not null,
  end_time timestamp with time zone,
  reason text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.idle_events enable row level security;

create policy "Users can view own idle events" on idle_events
  for select using (auth.uid() = user_id);

create policy "Users can insert own idle events" on idle_events
  for insert with check (auth.uid() = user_id);

-- REPORTS DAILY
create table public.reports_daily (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) not null,
  date date not null,
  total_time int default 0,
  summary_json jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.reports_daily enable row level security;

create policy "Users can view own reports" on reports_daily
  for select using (auth.uid() = user_id);

-- SUBSCRIPTIONS (System managed mostly)
create table public.subscriptions (
  id uuid default uuid_generate_v4() primary key,
  org_id uuid references public.organizations(id) not null,
  stripe_sub_id text,
  status text,
  plan_id text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.subscriptions enable row level security;

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
create table public.audit_logs (
  id uuid default uuid_generate_v4() primary key,
  org_id uuid references public.organizations(id),
  actor_id uuid references public.profiles(id),
  action text not null,
  details jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.audit_logs enable row level security;

create policy "Org admins can view audit logs" on audit_logs
  for select using (
    exists (
      select 1 from org_members
      where org_members.org_id = audit_logs.org_id
      and org_members.user_id = auth.uid()
      and org_members.role in ('owner', 'admin')
    )
  );
