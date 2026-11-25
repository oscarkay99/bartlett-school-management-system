-- =====================================================================================================
-- Feeding module. Feeding is BILLED on the school fees invoice (as the school does); this module runs it:
--   * who is on feeding each term (everyone by default; exceptions per student, e.g. opted out or half-day rate)
--   * the daily meal register (meals served per class per day)
--   * a per-class summary for the term
-- The feeding RATE per level lives in the fee schedule (term_fee_levels.feeding). Kitchen stock lives in Inventory.
-- =====================================================================================================

-- Exceptions only: a student with no row here is on feeding at their level's rate.
create table public.feeding_exceptions (
  student_id uuid not null references public.students(id) on delete cascade,
  term_id uuid not null references public.terms(id) on delete cascade,
  on_feeding boolean not null default false,       -- false = not on feeding this term (no feeding line on the invoice)
  rate bigint check (rate >= 0),                    -- when on feeding at a different rate (e.g. half-day); null = level rate
  reason text not null check (length(trim(reason)) >= 3),
  updated_at timestamptz not null default now(),
  primary key (student_id, term_id),
  check (on_feeding or rate is null)
);

-- What a student is charged for feeding this term (0 = not on feeding). Used when generating invoices.
create or replace function app.feeding_rate(p_student uuid, p_term uuid) returns bigint
language sql stable security definer set search_path = public, pg_catalog as $$
  select case when fe.student_id is null then coalesce(tl.feeding, 0)
              when not fe.on_feeding then 0
              else coalesce(fe.rate, tl.feeding, 0) end
  from public.students s
  join public.classes c on c.id = s.class_id
  left join public.term_fee_levels tl on tl.term_id = p_term and tl.level = c.level
  left join public.feeding_exceptions fe on fe.student_id = s.id and fe.term_id = p_term
  where s.id = p_student
$$;
grant execute on function app.feeding_rate(uuid, uuid) to authenticated;

-- Daily meal register: one count per class per day.
create table public.meal_register (
  on_date date not null,
  class_id uuid not null references public.classes(id) on delete cascade,
  served int not null check (served >= 0),
  note text,
  recorded_by uuid default auth.uid(), recorded_at timestamptz not null default now(),
  primary key (on_date, class_id)
);

-- Per class, per term: students on feeding and the feeding expected to be billed.
create view public.feeding_summary with (security_invoker = true) as
select t.id as term_id, c.id as class_id, c.name as class_name,
       count(s.id) filter (where app.feeding_rate(s.id, t.id) > 0) as on_feeding,
       count(s.id) filter (where app.feeding_rate(s.id, t.id) = 0) as not_on_feeding,
       coalesce(sum(app.feeding_rate(s.id, t.id)), 0) as expected
from public.terms t cross join public.classes c
left join public.students s on s.class_id = c.id and s.status = 'Active'
group by t.id, c.id, c.name;
revoke all on public.feeding_summary from anon;
grant select on public.feeding_summary to authenticated;

select app.track(t) from unnest(array['public.feeding_exceptions', 'public.meal_register']::regclass[]) t;

-- ---------- Policies ----------
-- Who is on feeding: office roles read; Owner/Admin/Bursar maintain (it changes what is billed).
create policy read_office on public.feeding_exceptions for select to authenticated using (app.has_role('owner', 'admin', 'bursar', 'auditor'));
create policy write_office on public.feeding_exceptions for all to authenticated using (app.has_role('owner', 'admin', 'bursar')) with check (app.has_role('owner', 'admin', 'bursar'));

-- Meal register: kitchen (Storekeeper), Owner/Admin, and teachers for their own classes record it; office + auditor read.
create policy read on public.meal_register for select to authenticated using (app.has_role('owner', 'admin', 'bursar', 'auditor', 'storekeeper') or (app.has_role('teacher') and app.teaches(class_id)));
create policy record_office on public.meal_register for all to authenticated using (app.has_role('owner', 'admin', 'storekeeper')) with check (app.has_role('owner', 'admin', 'storekeeper'));
create policy record_teacher on public.meal_register for all to authenticated using (app.has_role('teacher') and app.teaches(class_id)) with check (app.has_role('teacher') and app.teaches(class_id));
