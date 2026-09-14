-- Scout Reel: accounts, team workspaces and private scouting reports.
--
-- Run once in the Supabase SQL Editor. Every table has row level security, and clients
-- (the anon and authenticated roles) get only the grants written below. Anything a
-- client should not do directly, such as joining a workspace or rotating an invite
-- code, goes through a function that checks the caller first.
--
-- Tested by supabase/tests/rls.test.ts.

create extension if not exists pgcrypto with schema extensions;

-- Helpers used by policies live outside the API-exposed public schema.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

-- Tables -------------------------------------------------------------------------------

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (name ~ '^[^[:cntrl:]]{1,60}$' and btrim(name) <> ''),
  team_label text check (team_label ~ '^[0-9A-Z]{1,8}$'),
  -- sha256 of the 16 random bytes behind the invite code. The code itself is never stored.
  invite_token_hash bytea not null unique,
  invite_rotated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index workspaces_created_by_idx on public.workspaces (created_by);

create table public.memberships (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index memberships_user_idx on public.memberships (user_id);

-- Join attempts, for rate limiting. Clients have no access to this table at all.
create table public.join_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  success boolean not null,
  attempted_at timestamptz not null default now()
);
create index join_attempts_user_time_idx on public.join_attempts (user_id, attempted_at);
create index join_attempts_time_idx on public.join_attempts (attempted_at);

-- One current card per workspace, team and season.
create table public.scouting_reports (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  team_id integer not null check (team_id > 0),
  season_id integer not null check (season_id > 0),
  team_number text not null check (team_number ~ '^[0-9A-Za-z]{1,8}$'),
  driving smallint check (driving between 1 and 10),
  consistency smallint check (consistency between 1 and 10),
  field_sense smallint check (field_sense between 1 and 10),
  autonomous smallint check (autonomous between 1 and 10),
  notes text not null default '' check (char_length(notes) <= 4000),
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (workspace_id, team_id, season_id)
);

-- A copy of the card after every save. Written only by a trigger.
create table public.report_revisions (
  id bigint generated always as identity primary key,
  report_id uuid not null references public.scouting_reports (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  driving smallint,
  consistency smallint,
  field_sense smallint,
  autonomous smallint,
  notes text not null default '',
  author_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index report_revisions_report_idx on public.report_revisions (report_id, id desc);
create index report_revisions_workspace_idx on public.report_revisions (workspace_id);

-- Grants -------------------------------------------------------------------------------
-- Supabase grants everything on new tables to anon and authenticated by default.
-- Take it all back, then give authenticated users only what they need.

revoke all on public.workspaces, public.memberships, public.join_attempts, public.scouting_reports, public.report_revisions
  from public, anon, authenticated;

grant select (id, name, team_label, invite_rotated_at, created_by, created_at) on public.workspaces to authenticated;
grant update (name, team_label) on public.workspaces to authenticated;

grant select, delete on public.memberships to authenticated;

grant select (id, workspace_id, team_id, season_id, team_number, driving, consistency, field_sense, autonomous, notes, updated_by, updated_at, created_at)
  on public.scouting_reports to authenticated;
grant insert (workspace_id, team_id, season_id, team_number, driving, consistency, field_sense, autonomous, notes)
  on public.scouting_reports to authenticated;
grant update (driving, consistency, field_sense, autonomous, notes) on public.scouting_reports to authenticated;
grant delete on public.scouting_reports to authenticated;

grant select on public.report_revisions to authenticated;

-- Policy helpers -----------------------------------------------------------------------
-- SECURITY DEFINER so policies on memberships do not recurse into memberships' own policies.

create function private.is_member(p_workspace uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships m
    where m.workspace_id = p_workspace and m.user_id = (select auth.uid())
  )
$$;

create function private.is_owner(p_workspace uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships m
    where m.workspace_id = p_workspace and m.user_id = (select auth.uid()) and m.role = 'owner'
  )
$$;

-- Shows owners enough to tell members apart ("ma...@school.org") without the full address.
create function private.mask_email(p_email text) returns text
language sql immutable set search_path = '' as $$
  select case
    when p_email is null or position('@' in p_email) = 0 then 'Teammate'
    else left(split_part(p_email, '@', 1), 2) || '...@' || split_part(p_email, '@', 2)
  end
$$;

-- Row level security -------------------------------------------------------------------

alter table public.workspaces enable row level security;
alter table public.memberships enable row level security;
alter table public.join_attempts enable row level security;
alter table public.scouting_reports enable row level security;
alter table public.report_revisions enable row level security;

create policy "Members read their workspaces" on public.workspaces
  for select to authenticated using (private.is_member(id));
create policy "Owners rename their workspaces" on public.workspaces
  for update to authenticated using (private.is_owner(id)) with check (private.is_owner(id));

create policy "Members see who is in their workspaces" on public.memberships
  for select to authenticated using (private.is_member(workspace_id));
-- A member can leave, and an owner can remove a member. Nobody can remove an owner this way,
-- and there is no insert or update policy: joining goes through join_workspace.
create policy "Members leave and owners remove members" on public.memberships
  for delete to authenticated
  using (role = 'member' and (user_id = (select auth.uid()) or private.is_owner(workspace_id)));

-- join_attempts has row level security on and no policies, so clients can never read it.

create policy "Members read reports" on public.scouting_reports
  for select to authenticated using (private.is_member(workspace_id));
create policy "Members add reports" on public.scouting_reports
  for insert to authenticated with check (private.is_member(workspace_id));
create policy "Members edit reports" on public.scouting_reports
  for update to authenticated using (private.is_member(workspace_id)) with check (private.is_member(workspace_id));
create policy "Owners delete reports" on public.scouting_reports
  for delete to authenticated using (private.is_owner(workspace_id));

create policy "Members read report history" on public.report_revisions
  for select to authenticated using (private.is_member(workspace_id));

-- Report triggers ----------------------------------------------------------------------

-- The database, not the client, records who saved a card and when, and a card never
-- changes workspace, team or season after it is created.
create function private.stamp_report() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_by := auth.uid();
  new.updated_at := now();
  if tg_op = 'UPDATE' then
    new.id := old.id;
    new.workspace_id := old.workspace_id;
    new.team_id := old.team_id;
    new.season_id := old.season_id;
    new.created_at := old.created_at;
  end if;
  return new;
end
$$;

-- Only real edits count. When a deleted account's id is cleared from updated_by by the
-- foreign key, nothing is stamped and no revision is written.
create trigger scouting_reports_stamp_insert
  before insert on public.scouting_reports
  for each row execute function private.stamp_report();
create trigger scouting_reports_stamp_update
  before update on public.scouting_reports
  for each row
  when ((old.driving, old.consistency, old.field_sense, old.autonomous, old.notes)
    is distinct from (new.driving, new.consistency, new.field_sense, new.autonomous, new.notes))
  execute function private.stamp_report();

create function private.record_revision() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.report_revisions (report_id, workspace_id, driving, consistency, field_sense, autonomous, notes, author_id)
  values (new.id, new.workspace_id, new.driving, new.consistency, new.field_sense, new.autonomous, new.notes, new.updated_by);
  -- Keep the 50 most recent revisions of each card.
  delete from public.report_revisions r
  where r.report_id = new.id
    and r.id < (
      select min(recent.id) from (
        select r2.id from public.report_revisions r2 where r2.report_id = new.id order by r2.id desc limit 50
      ) recent
    );
  return null;
end
$$;

create trigger scouting_reports_revision_insert
  after insert on public.scouting_reports
  for each row execute function private.record_revision();
create trigger scouting_reports_revision_update
  after update on public.scouting_reports
  for each row
  when ((old.driving, old.consistency, old.field_sense, old.autonomous, old.notes)
    is distinct from (new.driving, new.consistency, new.field_sense, new.autonomous, new.notes))
  execute function private.record_revision();

-- Functions clients call ---------------------------------------------------------------

create function public.create_workspace(p_name text, p_team_label text default null)
returns table (workspace_id uuid, invite_code text)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_user uuid := auth.uid();
  v_code bytea := extensions.gen_random_bytes(16);
  v_id uuid;
begin
  if v_user is null then
    raise exception 'Sign in first' using errcode = '42501';
  end if;
  if (select count(*) from public.workspaces w where w.created_by = v_user) >= 5 then
    raise exception 'You can create at most 5 workspaces' using errcode = 'P0001';
  end if;
  insert into public.workspaces (name, team_label, invite_token_hash, created_by)
  values (btrim(p_name), nullif(upper(btrim(coalesce(p_team_label, ''))), ''), sha256(v_code), v_user)
  returning id into v_id;
  insert into public.memberships (workspace_id, user_id, role) values (v_id, v_user, 'owner');
  return query select v_id, encode(v_code, 'hex');
end
$$;

-- Returns a status instead of raising, so a failed attempt is still recorded for rate limiting.
create function public.join_workspace(p_code text)
returns table (status text, workspace_id uuid)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_user uuid := auth.uid();
  v_clean text := lower(regexp_replace(left(coalesce(p_code, ''), 200), '[^0-9A-Fa-f]', '', 'g'));
  v_workspace uuid;
begin
  if v_user is null then
    raise exception 'Sign in first' using errcode = '42501';
  end if;
  -- One join at a time per user, so parallel requests cannot all pass the limit check.
  perform pg_advisory_xact_lock(hashtext('scout-reel-join:' || v_user::text));
  -- Old attempts are no longer needed once they are outside the longest window below.
  delete from public.join_attempts a
  where a.id in (select a2.id from public.join_attempts a2 where a2.attempted_at < now() - interval '2 days' limit 200);
  -- Per user only. A 128-bit code cannot be guessed, and a shared limit would let one
  -- person with a few accounts lock everyone else out.
  if (select count(*) from public.join_attempts a
      where a.user_id = v_user and not a.success and a.attempted_at > now() - interval '10 minutes') >= 5
    or (select count(*) from public.join_attempts a
      where a.user_id = v_user and not a.success and a.attempted_at > now() - interval '1 day') >= 20 then
    return query select 'rate_limited'::text, null::uuid;
    return;
  end if;

  if length(v_clean) = 32 then
    select w.id into v_workspace from public.workspaces w where w.invite_token_hash = sha256(decode(v_clean, 'hex'));
  end if;
  insert into public.join_attempts (user_id, success) values (v_user, v_workspace is not null);

  if v_workspace is null then
    return query select 'invalid'::text, null::uuid;
    return;
  end if;
  if exists (select 1 from public.memberships m where m.workspace_id = v_workspace and m.user_id = v_user) then
    return query select 'already_member'::text, v_workspace;
    return;
  end if;
  if (select count(*) from public.memberships m where m.user_id = v_user) >= 20 then
    return query select 'too_many'::text, null::uuid;
    return;
  end if;
  -- Always a member. Owners are only ever made by create_workspace.
  insert into public.memberships (workspace_id, user_id, role) values (v_workspace, v_user, 'member')
  on conflict do nothing;
  if not found then
    return query select 'already_member'::text, v_workspace;
    return;
  end if;
  return query select 'joined'::text, v_workspace;
end
$$;

create function public.rotate_invite(p_workspace uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_code bytea := extensions.gen_random_bytes(16);
begin
  if not private.is_owner(p_workspace) then
    raise exception 'Only the workspace owner can do that' using errcode = '42501';
  end if;
  update public.workspaces set invite_token_hash = sha256(v_code), invite_rotated_at = now() where id = p_workspace;
  return encode(v_code, 'hex');
end
$$;

create function public.workspace_members(p_workspace uuid)
returns table (user_id uuid, role text, joined_at timestamptz, label text)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_user uuid := auth.uid();
  v_owner boolean;
begin
  if not private.is_member(p_workspace) then
    raise exception 'Not a member of that workspace' using errcode = '42501';
  end if;
  v_owner := private.is_owner(p_workspace);
  return query
    select m.user_id, m.role, m.created_at,
      case
        when m.user_id = v_user then 'You'
        when v_owner then private.mask_email(u.email::text)
        else 'Teammate'
      end
    from public.memberships m
    left join auth.users u on u.id = m.user_id
    where m.workspace_id = p_workspace
    order by m.created_at;
end
$$;

create function public.delete_workspace(p_workspace uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_owner(p_workspace) then
    raise exception 'Only the workspace owner can do that' using errcode = '42501';
  end if;
  delete from public.workspaces where id = p_workspace;
end
$$;

-- Deletes the caller's login and everything tied to it. An owner must delete their
-- workspaces first, so a team's scouting is never removed by accident.
create function public.delete_my_account() returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'Sign in first' using errcode = '42501';
  end if;
  if exists (select 1 from public.memberships m where m.user_id = v_user and m.role = 'owner') then
    return 'owns_workspace';
  end if;
  begin
    delete from auth.users where id = v_user;
  exception when insufficient_privilege then
    -- The project does not let this function remove logins; the app explains what to do.
    return 'not_allowed';
  end;
  return 'deleted';
end
$$;

-- Runs with the caller's rights, so row level security decides whether the save is allowed.
create function public.save_scouting_report(
  p_workspace uuid,
  p_team_id integer,
  p_season_id integer,
  p_team_number text,
  p_driving smallint,
  p_consistency smallint,
  p_field_sense smallint,
  p_autonomous smallint,
  p_notes text
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  v_id uuid;
begin
  insert into public.scouting_reports as r
    (workspace_id, team_id, season_id, team_number, driving, consistency, field_sense, autonomous, notes)
  values
    (p_workspace, p_team_id, p_season_id, p_team_number, p_driving, p_consistency, p_field_sense, p_autonomous, coalesce(p_notes, ''))
  on conflict (workspace_id, team_id, season_id) do update
    set driving = excluded.driving,
        consistency = excluded.consistency,
        field_sense = excluded.field_sense,
        autonomous = excluded.autonomous,
        notes = excluded.notes
  returning r.id into v_id;
  return v_id;
end
$$;

-- Function privileges ------------------------------------------------------------------
-- Postgres lets everyone execute new functions, and Supabase adds anon. Remove that for
-- every function here, then allow signed-in users to call only the ones they need.

do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as signature
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private')
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f.signature);
  end loop;
end
$$;

grant execute on function
  public.create_workspace(text, text),
  public.join_workspace(text),
  public.rotate_invite(uuid),
  public.workspace_members(uuid),
  public.delete_workspace(uuid),
  public.delete_my_account(),
  public.save_scouting_report(uuid, integer, integer, text, smallint, smallint, smallint, smallint, text),
  private.is_member(uuid),
  private.is_owner(uuid)
to authenticated;
