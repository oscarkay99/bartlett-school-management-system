-- =====================================================================================================
-- Feeding payment plans: how a family pays feeding this term — with the school fees (default, no row needed),
-- or on its own Daily / Weekly / Monthly / Term. One row per change, so the history is kept: the plan in force
-- on a date is the latest one starting on or before it. The app works out "expected by today" from the plan,
-- the term dates and the feeding rate, and compares it with feeding paid (payments.feeding_amount).
-- =====================================================================================================
create table public.feeding_plans (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  term_id uuid not null references public.terms(id) on delete cascade,
  frequency text not null check (frequency in ('With school fees', 'Daily', 'Weekly', 'Monthly', 'Term')),
  effective_from date not null,
  note text,
  set_by uuid default auth.uid(), set_at timestamptz not null default now(),
  unique (student_id, term_id, effective_from)
);
create index feeding_plans_lookup on public.feeding_plans (student_id, term_id, effective_from desc);

-- A plan must start within its term.
create or replace function app.check_plan_dates() returns trigger
language plpgsql set search_path = public, pg_catalog as $$
begin
  if not exists (select 1 from public.terms t where t.id = new.term_id and new.effective_from between t.starts_on and t.ends_on) then
    raise exception 'The plan must start within the term';
  end if;
  new.set_by := auth.uid(); new.set_at := now();
  return new;
end $$;
create trigger check_plan_dates before insert or update on public.feeding_plans for each row execute function app.check_plan_dates();

select app.track('public.feeding_plans');

-- Office roles read; Owner / Admin / Bursar set plans (it is part of fee follow-up).
create policy read_office on public.feeding_plans for select to authenticated using (app.has_role('owner', 'admin', 'bursar', 'auditor'));
create policy write_office on public.feeding_plans for all to authenticated using (app.has_role('owner', 'admin', 'bursar')) with check (app.has_role('owner', 'admin', 'bursar'));
