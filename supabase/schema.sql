-- Scenario Platform — core schema (Phase 1)
-- Run this once in the Supabase SQL editor for a fresh project.
-- Designed to be extensible: `generations.kind` already supports
-- image | voice | music | video | text so Phase 3 (voiceover, music,
-- other AI tools) plugs into the same table instead of new schema churn.
--
-- This file is kept in sync with the live project (hxwkebfpxhqcjohfravt)
-- after the following hardening migrations, folded in here so a fresh
-- install starts from the corrected state instead of needing them again:
--   harden_rls_and_functions, lock_down_trigger_fn_and_add_fk_indexes,
--   fix_anon_execute_grant_on_helper_fns, fix_projects_select_policy_self_reference

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

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

-- Trigger-only — never meant to be called directly via RPC.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

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

-- Helper functions used inside RLS policies below. SECURITY DEFINER so
-- they can read project_members/projects regardless of the caller's own
-- row visibility; search_path pinned per Supabase's linter guidance.
-- EXECUTE is intentionally granted to `authenticated` only (RLS depends
-- on it) and revoked from `anon` — see the grant statements after the
-- policies for why a plain `revoke ... from anon` isn't enough on its own.
create or replace function public.is_project_member(pid uuid)
returns boolean as $$
  select exists (
    select 1 from public.project_members
    where project_id = pid and user_id = (select auth.uid())
  ) or exists (
    select 1 from public.projects where id = pid and owner_id = (select auth.uid())
  );
$$ language sql security definer stable set search_path = public, pg_temp;

create or replace function public.project_role(pid uuid)
returns member_role as $$
  select case
    when exists (select 1 from public.projects where id = pid and owner_id = (select auth.uid()))
      then 'owner'::member_role
    else (select role from public.project_members where project_id = pid and user_id = (select auth.uid()) limit 1)
  end;
$$ language sql security definer stable set search_path = public, pg_temp;

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

-- Non-writers (client/viewer) can update a shot ROW (status, generation
-- link) via the RLS policy below, but RLS can't restrict which COLUMNS
-- change — this trigger blocks them from editing editorial content.
create or replace function public.enforce_shot_update_permissions()
returns trigger as $$
declare
  r public.member_role;
begin
  r := public.project_role(new.project_id);
  if r not in ('owner', 'co_writer') then
    if new.prompt is distinct from old.prompt
       or new.order_index is distinct from old.order_index
       or new.scene_id is distinct from old.scene_id
       or new.line_text is distinct from old.line_text
       or new.emotion_notes is distinct from old.emotion_notes
       or new.editing_notes is distinct from old.editing_notes
       or new.sound_notes is distinct from old.sound_notes
       or new.voiceover_text is distinct from old.voiceover_text
       or new.duration_seconds is distinct from old.duration_seconds
       or new.tags is distinct from old.tags
    then
      raise exception 'insufficient permissions to edit this field';
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

revoke execute on function public.enforce_shot_update_permissions() from public, anon, authenticated;

drop trigger if exists shots_enforce_update_permissions on public.shots;
create trigger shots_enforce_update_permissions
  before update on public.shots
  for each row execute function public.enforce_shot_update_permissions();

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
-- Indexes covering every foreign key (join + cascade performance)
-- ---------------------------------------------------------------------
create index if not exists idx_characters_project_id on public.characters (project_id);
create index if not exists idx_comments_author_id on public.comments (author_id);
create index if not exists idx_comments_parent_id on public.comments (parent_id);
create index if not exists idx_comments_project_id on public.comments (project_id);
create index if not exists idx_exports_created_by on public.exports (created_by);
create index if not exists idx_exports_project_id on public.exports (project_id);
create index if not exists idx_generations_created_by on public.generations (created_by);
create index if not exists idx_generations_project_id on public.generations (project_id);
create index if not exists idx_generations_shot_id on public.generations (shot_id);
create index if not exists idx_project_members_user_id on public.project_members (user_id);
create index if not exists idx_projects_owner_id on public.projects (owner_id);
create index if not exists idx_scenes_project_id on public.scenes (project_id);
create index if not exists idx_scenes_script_id on public.scenes (script_id);
create index if not exists idx_scripts_project_id on public.scripts (project_id);
create index if not exists idx_shots_active_generation_id on public.shots (active_generation_id);
create index if not exists idx_shots_project_id on public.shots (project_id);
create index if not exists idx_shots_scene_id on public.shots (scene_id);

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
create policy "own profile editable" on profiles for update
  to authenticated
  using (id = (select auth.uid()));

-- NOTE: does NOT call is_project_member(id) here. That function itself
-- queries `projects`, so calling it from a policy ON `projects` is a
-- self-reference that reliably breaks `INSERT ... RETURNING` (what
-- PostgREST/supabase-js always issues for `.insert().select()`) — the
-- newly-inserted row fails its own SELECT-policy re-check. Comparing
-- owner_id directly avoids the recursion for the common (owner) case.
create policy "members read projects" on projects for select
  to authenticated
  using (
    owner_id = (select auth.uid())
    or exists (
      select 1 from project_members
      where project_id = projects.id and user_id = (select auth.uid())
    )
  );
create policy "owner creates project" on projects for insert
  to authenticated
  with check (owner_id = (select auth.uid()));
create policy "owner updates project" on projects for update
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "members read membership" on project_members for select
  to authenticated
  using (is_project_member(project_id));
create policy "owner/co_writer insert membership" on project_members for insert
  to authenticated
  with check (project_role(project_id) in ('owner', 'co_writer'));
create policy "owner/co_writer update membership" on project_members for update
  to authenticated
  using (project_role(project_id) in ('owner', 'co_writer'))
  with check (project_role(project_id) in ('owner', 'co_writer'));
create policy "owner/co_writer delete membership" on project_members for delete
  to authenticated
  using (project_role(project_id) in ('owner', 'co_writer'));

create policy "members read script" on scripts for select
  to authenticated
  using (is_project_member(project_id));
create policy "writers insert script" on scripts for insert
  to authenticated
  with check (project_role(project_id) in ('owner', 'co_writer'));
create policy "writers update script" on scripts for update
  to authenticated
  using (project_role(project_id) in ('owner', 'co_writer'))
  with check (project_role(project_id) in ('owner', 'co_writer'));
create policy "writers delete script" on scripts for delete
  to authenticated
  using (project_role(project_id) in ('owner', 'co_writer'));

create policy "members read characters" on characters for select
  to authenticated
  using (is_project_member(project_id));
create policy "writers insert characters" on characters for insert
  to authenticated
  with check (project_role(project_id) in ('owner', 'co_writer'));
create policy "writers update characters" on characters for update
  to authenticated
  using (project_role(project_id) in ('owner', 'co_writer'))
  with check (project_role(project_id) in ('owner', 'co_writer'));
create policy "writers delete characters" on characters for delete
  to authenticated
  using (project_role(project_id) in ('owner', 'co_writer'));

create policy "members read scenes" on scenes for select
  to authenticated
  using (is_project_member(project_id));
create policy "writers insert scenes" on scenes for insert
  to authenticated
  with check (project_role(project_id) in ('owner', 'co_writer'));
create policy "writers update scenes" on scenes for update
  to authenticated
  using (project_role(project_id) in ('owner', 'co_writer'))
  with check (project_role(project_id) in ('owner', 'co_writer'));
create policy "writers delete scenes" on scenes for delete
  to authenticated
  using (project_role(project_id) in ('owner', 'co_writer'));

create policy "members read shots" on shots for select
  to authenticated
  using (is_project_member(project_id));
create policy "writers insert shots" on shots for insert
  to authenticated
  with check (project_role(project_id) in ('owner', 'co_writer'));
-- Row-level: owner/co_writer/client may all update a shot row; the
-- enforce_shot_update_permissions trigger above restricts *which*
-- columns a client is allowed to change.
create policy "members update shots" on shots for update
  to authenticated
  using (project_role(project_id) in ('owner', 'co_writer', 'client'))
  with check (project_role(project_id) in ('owner', 'co_writer', 'client'));
create policy "writers delete shots" on shots for delete
  to authenticated
  using (project_role(project_id) in ('owner', 'co_writer'));

create policy "members read generations" on generations for select
  to authenticated
  using (is_project_member(project_id));
create policy "members request generation" on generations for insert
  to authenticated
  with check (project_role(project_id) in ('owner', 'co_writer', 'client'));
create policy "writers update generations" on generations for update
  to authenticated
  using (project_role(project_id) in ('owner', 'co_writer'))
  with check (project_role(project_id) in ('owner', 'co_writer'));

create policy "members read comments" on comments for select
  to authenticated
  using (is_project_member(project_id));
create policy "members write comments" on comments for insert
  to authenticated
  with check (is_project_member(project_id) and author_id = (select auth.uid()));
create policy "authors edit own comments" on comments for update
  to authenticated
  using (author_id = (select auth.uid()) or project_role(project_id) in ('owner', 'co_writer'))
  with check (author_id = (select auth.uid()) or project_role(project_id) in ('owner', 'co_writer'));

create policy "members read exports" on exports for select
  to authenticated
  using (is_project_member(project_id));
create policy "writers create exports" on exports for insert
  to authenticated
  with check (project_role(project_id) in ('owner', 'co_writer'));

-- Function EXECUTE defaults to PUBLIC on creation, so revoking from just
-- `anon` doesn't override that standing grant — revoke from PUBLIC and
-- re-grant explicitly to `authenticated`, the only role that legitimately
-- needs these (RLS policies above run as `authenticated`).
revoke execute on function public.is_project_member(uuid) from public;
revoke execute on function public.project_role(uuid) from public;
grant execute on function public.is_project_member(uuid) to authenticated;
grant execute on function public.project_role(uuid) to authenticated;

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

create or replace function public.storage_project_id(object_name text)
returns uuid as $$
  select (regexp_match(object_name, '^[a-z]+/([0-9a-fA-F-]{36})/'))[1]::uuid;
$$ language sql immutable set search_path = public, pg_temp;

create policy "public read assets" on storage.objects for select
  using (bucket_id = 'assets');

create policy "members upload assets" on storage.objects for insert
  to authenticated
  with check (bucket_id = 'assets' and is_project_member(storage_project_id(name)));

create policy "members update own assets" on storage.objects for update
  to authenticated
  using (bucket_id = 'assets' and is_project_member(storage_project_id(name)))
  with check (bucket_id = 'assets' and is_project_member(storage_project_id(name)));

create policy "writers delete assets" on storage.objects for delete
  to authenticated
  using (bucket_id = 'assets' and project_role(storage_project_id(name)) in ('owner', 'co_writer'));
