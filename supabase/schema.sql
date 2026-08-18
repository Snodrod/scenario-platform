-- Scenario Platform — core schema (Phase 1)
-- Run this once in the Supabase SQL editor for a fresh project.
-- Designed to be extensible: `generations.kind` already supports
-- image | voice | music | video | text so Phase 3 (voiceover, music,
-- other AI tools) plugs into the same table instead of new schema churn.

create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------------------
-- Profiles (1:1 mirror of auth.users, filled by trigger below)
-- ---------------------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  created_at timestamptz not null default now()
);

create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ---------------------------------------------------------------------
-- Projects & membership
-- ---------------------------------------------------------------------
create type member_role as enum ('owner', 'co_writer', 'client', 'viewer');

create table if not exists projects (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text,
  format text not null default 'long', -- 'long' | 'short'
  owner_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists project_members (
  project_id uuid not null references projects(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  invited_email text, -- the email the invite was sent to, kept for display
  role member_role not null default 'viewer',
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create or replace function is_project_member(pid uuid)
returns boolean as $$
  select exists (
    select 1 from project_members
    where project_id = pid and user_id = auth.uid()
  ) or exists (
    select 1 from projects where id = pid and owner_id = auth.uid()
  );
$$ language sql security definer stable;

create or replace function project_role(pid uuid)
returns member_role as $$
  select case
    when exists (select 1 from projects where id = pid and owner_id = auth.uid())
      then 'owner'::member_role
    else (select role from project_members where project_id = pid and user_id = auth.uid() limit 1)
  end;
$$ language sql security definer stable;

-- ---------------------------------------------------------------------
-- Script + scenes + shots
-- ---------------------------------------------------------------------
create table if not exists scripts (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references projects(id) on delete cascade,
  content text not null default '',
  version int not null default 1,
  updated_at timestamptz not null default now()
);

create table if not exists characters (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  description text,
  prompt_token text, -- short tag inserted into shot prompts, e.g. "@anna"
  reference_asset_urls text[] not null default '{}',
  voice_id text, -- reserved: ElevenLabs/other TTS voice, wired up in Phase 3
  created_at timestamptz not null default now()
);

create table if not exists scenes (
  id uuid primary key default uuid_generate_v4(),
  script_id uuid not null references scripts(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  order_index int not null,
  title text,
  summary text,
  source_text text,
  created_at timestamptz not null default now()
);

create type shot_status as enum ('draft', 'generating', 'needs_review', 'approved', 'needs_regen');

create table if not exists shots (
  id uuid primary key default uuid_generate_v4(),
  scene_id uuid not null references scenes(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  order_index int not null,
  prompt text not null default '', -- image-generation prompt
  status shot_status not null default 'draft',
  active_generation_id uuid,
  -- Editorial fields shown on the shot card (see design reference):
  duration_seconds numeric,
  line_text text,          -- on-screen quote / dialogue line for this shot
  emotion_notes text,      -- "ЭМОЦИЯ И ПОДАЧА"
  editing_notes text,      -- "ТЗ К МОНТАЖУ"
  sound_notes text,        -- "ЗВУК"
  voiceover_text text,     -- VO script — feeds ElevenLabs in Phase 3
  tags text[] not null default '{}',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Generations — one shared table for every AI tool (image today,
-- voice/music/video plug in later without a schema change)
-- ---------------------------------------------------------------------
create type generation_kind as enum ('image', 'voice', 'music', 'video', 'text');
create type generation_status as enum ('pending', 'running', 'completed', 'failed');

create table if not exists generations (
  id uuid primary key default uuid_generate_v4(),
  shot_id uuid not null references shots(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  kind generation_kind not null default 'image',
  provider text not null, -- 'openai' | 'gemini' | 'elevenlabs' | ...
  prompt_used text,
  asset_url text,
  status generation_status not null default 'pending',
  error text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

alter table shots
  drop constraint if exists shots_active_generation_fk;
alter table shots
  add constraint shots_active_generation_fk
  foreign key (active_generation_id) references generations(id) on delete set null;

-- ---------------------------------------------------------------------
-- Comments (threaded, attached to a shot or a scene)
-- ---------------------------------------------------------------------
create type comment_target as enum ('shot', 'scene');

create table if not exists comments (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references projects(id) on delete cascade,
  target_type comment_target not null,
  target_id uuid not null,
  author_id uuid references profiles(id),
  body text not null,
  resolved boolean not null default false,
  parent_id uuid references comments(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Exports
-- ---------------------------------------------------------------------
create table if not exists exports (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references projects(id) on delete cascade,
  type text not null, -- 'pdf' | 'gdoc'
  url text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table profiles enable row level security;
alter table projects enable row level security;
alter table project_members enable row level security;
alter table scripts enable row level security;
alter table characters enable row level security;
alter table scenes enable row level security;
alter table shots enable row level security;
alter table generations enable row level security;
alter table comments enable row level security;
alter table exports enable row level security;

create policy "own profile visible" on profiles for select using (true);
create policy "own profile editable" on profiles for update using (id = auth.uid());

create policy "members read projects" on projects for select using (is_project_member(id));
create policy "owner creates project" on projects for insert with check (owner_id = auth.uid());
create policy "owner updates project" on projects for update using (owner_id = auth.uid());

create policy "members read membership" on project_members for select using (is_project_member(project_id));
create policy "owner/co_writer manage membership" on project_members for all
  using (project_role(project_id) in ('owner', 'co_writer'))
  with check (project_role(project_id) in ('owner', 'co_writer'));

create policy "members read script" on scripts for select using (is_project_member(project_id));
create policy "writers edit script" on scripts for all
  using (project_role(project_id) in ('owner', 'co_writer'))
  with check (project_role(project_id) in ('owner', 'co_writer'));

create policy "members read characters" on characters for select using (is_project_member(project_id));
create policy "writers edit characters" on characters for all
  using (project_role(project_id) in ('owner', 'co_writer'))
  with check (project_role(project_id) in ('owner', 'co_writer'));

create policy "members read scenes" on scenes for select using (is_project_member(project_id));
create policy "writers edit scenes" on scenes for all
  using (project_role(project_id) in ('owner', 'co_writer'))
  with check (project_role(project_id) in ('owner', 'co_writer'));

create policy "members read shots" on shots for select using (is_project_member(project_id));
create policy "writers edit shots" on shots for all
  using (project_role(project_id) in ('owner', 'co_writer'))
  with check (project_role(project_id) in ('owner', 'co_writer'));
create policy "clients update shot status" on shots for update
  using (project_role(project_id) in ('owner', 'co_writer', 'client'))
  with check (project_role(project_id) in ('owner', 'co_writer', 'client'));

create policy "members read generations" on generations for select using (is_project_member(project_id));
create policy "members request generation" on generations for insert
  with check (project_role(project_id) in ('owner', 'co_writer', 'client'));
create policy "writers update generations" on generations for update
  using (project_role(project_id) in ('owner', 'co_writer'));

create policy "members read comments" on comments for select using (is_project_member(project_id));
create policy "members write comments" on comments for insert
  with check (is_project_member(project_id) and author_id = auth.uid());
create policy "authors edit own comments" on comments for update
  using (author_id = auth.uid() or project_role(project_id) in ('owner', 'co_writer'));

create policy "members read exports" on exports for select using (is_project_member(project_id));
create policy "writers create exports" on exports for insert
  with check (project_role(project_id) in ('owner', 'co_writer'));

-- ---------------------------------------------------------------------
-- Storage: one public bucket, path convention enforces project scoping.
--   characters/{project_id}/{file}   — character reference images
--   shots/{project_id}/{file}        — generated storyboard frames
--   exports/{project_id}/{file}      — rendered PDFs
-- The bucket is public-read (so <img> tags and PDF export work without
-- signed URLs); writes are restricted to project members.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('assets', 'assets', true)
on conflict (id) do nothing;

create or replace function storage_project_id(object_name text)
returns uuid as $$
  select (regexp_match(object_name, '^[a-z]+/([0-9a-fA-F-]{36})/'))[1]::uuid;
$$ language sql immutable;

create policy "public read assets" on storage.objects for select
  using (bucket_id = 'assets');

create policy "members upload assets" on storage.objects for insert
  with check (
    bucket_id = 'assets'
    and is_project_member(storage_project_id(name))
  );

create policy "members update own assets" on storage.objects for update
  using (
    bucket_id = 'assets'
    and is_project_member(storage_project_id(name))
  );

create policy "writers delete assets" on storage.objects for delete
  using (
    bucket_id = 'assets'
    and project_role(storage_project_id(name)) in ('owner', 'co_writer')
  );
