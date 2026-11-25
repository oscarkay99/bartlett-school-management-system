-- =====================================================================================================
-- Foundation: security defaults, staff accounts & roles, helper functions, audit log, settings.
--
-- Security model (applies to every migration that follows):
--   * Row Level Security is ON for every table in `public`. With RLS on and no policy, nobody can read
--     or write a row. Each table then gets explicit policies per role. An event trigger switches RLS on
--     automatically for any table created later, so a new table can never be left open by accident.
--   * The `anon` key (no login) gets NO access to any table. Every user must sign in.
--   * Roles come from `public.staff_accounts` (linked to auth.users), never from the browser.
--   * Helper functions live in the private `app` schema, which the API does not expose.
-- =====================================================================================================

create extension if not exists pgcrypto;

create schema if not exists app;
revoke all on schema app from public, anon;
grant usage on schema app to authenticated, service_role;

-- ---------- Close the default doors ----------
-- Supabase grants anon/authenticated access to new tables by default; RLS is what really protects rows,
-- but anon should not even reach the tables. Authenticated users still go through RLS policies.
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke all on functions from anon;
alter default privileges in schema public revoke execute on functions from public;

-- ---------- RLS is automatic for every new table ----------
create or replace function app.enable_rls_on_new_tables() returns event_trigger
language plpgsql security definer set search_path = pg_catalog as $$
declare obj record;
begin
  for obj in select * from pg_event_trigger_ddl_commands()
             where command_tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO') and schema_name = 'public'
  loop
    execute format('alter table %s enable row level security', obj.object_identity);
  end loop;
end $$;
drop event trigger if exists school_enable_rls;
create event trigger school_enable_rls on ddl_command_end
  when tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
  execute function app.enable_rls_on_new_tables();

-- ---------- Types ----------
create type public.staff_role as enum ('owner', 'admin', 'bursar', 'storekeeper', 'teacher', 'auditor');
create type public.school_level as enum ('Kindergarten', 'Primary', 'JHS');

-- ---------- Settings (one row) ----------
create table public.school_settings (
  id boolean primary key default true check (id),          -- single row
  name text not null,
  short_name text not null,
  city text, phone text, email text,
  currency text not null default 'GHS',
  timezone text not null default 'Africa/Accra',
  logo_path text,                                           -- storage path of the crest
  admission_no_format text not null default 'BMS/{YY}/{SEQ:4}',
  -- Expense approval: up to tier1 by finance officer, up to tier2 by administrator, above by owner (minor units)
  expense_tier1_limit bigint not null default 500000,
  expense_tier2_limit bigint not null default 2500000,
  updated_at timestamptz not null default now()
);

-- ---------- Staff & accounts ----------
create table public.staff (
  id uuid primary key default gen_random_uuid(),
  emp_no text not null unique,
  name text not null,
  position text not null,
  department text not null,
  employment_type text not null check (employment_type in ('Full-time', 'Part-time', 'Contract')),
  phone text, email text, qualification text,
  since date,
  status text not null default 'Active' check (status in ('Active', 'On leave', 'Left')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Who can log in, and with which role. Created by the Owner (sign-ups are disabled).
create table public.staff_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  staff_id uuid references public.staff(id) on delete set null,
  role public.staff_role not null,
  display_name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- Role helpers (SECURITY DEFINER so policies can read staff_accounts without recursion) ----------
create or replace function app.my_role() returns public.staff_role
language sql stable security definer set search_path = public, pg_catalog as $$
  select role from public.staff_accounts where user_id = auth.uid() and active
$$;

create or replace function app.has_role(variadic roles public.staff_role[]) returns boolean
language sql stable security definer set search_path = public, pg_catalog as $$
  select coalesce((select role = any(roles) from public.staff_accounts where user_id = auth.uid() and active), false)
$$;

create or replace function app.current_staff_id() returns uuid
language sql stable security definer set search_path = public, pg_catalog as $$
  select staff_id from public.staff_accounts where user_id = auth.uid() and active
$$;

grant execute on function app.my_role(), app.has_role(public.staff_role[]), app.current_staff_id() to authenticated;

-- ---------- Housekeeping triggers ----------
create or replace function app.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

-- ---------- Audit log (append-only) ----------
create table public.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor uuid default auth.uid(),
  actor_name text,
  table_name text not null,
  row_id text,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  old_row jsonb,
  new_row jsonb
);
create index audit_log_at_idx on public.audit_log (at desc);
create index audit_log_row_idx on public.audit_log (table_name, row_id);

create or replace function app.audit() returns trigger
language plpgsql security definer set search_path = public, pg_catalog as $$
declare r jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
begin
  insert into public.audit_log (actor, actor_name, table_name, row_id, action, old_row, new_row)
  values (auth.uid(),
          (select display_name from public.staff_accounts where user_id = auth.uid()),
          tg_table_name, coalesce(r->>'id', r->>'user_id'), tg_op,
          case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
          case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end);
  return null;
end $$;

-- Attach auditing + updated_at to a table in one call.
create or replace function app.track(t regclass) returns void language plpgsql as $$
begin
  execute format('create trigger audit after insert or update or delete on %s for each row execute function app.audit()', t);
  if exists (select 1 from pg_attribute where attrelid = t and attname = 'updated_at' and not attisdropped) then
    execute format('create trigger touch before update on %s for each row execute function app.touch_updated_at()', t);
  end if;
end $$;

select app.track('public.school_settings'); select app.track('public.staff'); select app.track('public.staff_accounts');

-- ---------- Policies ----------
-- school_settings: everyone signed in reads (name, logo on documents); only the Owner changes it.
create policy settings_read on public.school_settings for select to authenticated using (app.my_role() is not null);
create policy settings_write on public.school_settings for update to authenticated using (app.has_role('owner')) with check (app.has_role('owner'));

-- staff: all staff see the directory; Owner and Admin manage it.
create policy staff_read on public.staff for select to authenticated using (app.my_role() is not null);
create policy staff_write on public.staff for all to authenticated using (app.has_role('owner', 'admin')) with check (app.has_role('owner', 'admin'));

-- staff_accounts: you see your own account; the Owner sees and manages all accounts and roles.
create policy accounts_self on public.staff_accounts for select to authenticated using (user_id = auth.uid() or app.has_role('owner'));
create policy accounts_owner on public.staff_accounts for all to authenticated using (app.has_role('owner')) with check (app.has_role('owner'));

-- audit_log: Owner and Auditor read it. No one can update or delete (no policy grants it; writes come from the trigger).
create policy audit_read on public.audit_log for select to authenticated using (app.has_role('owner', 'auditor'));
