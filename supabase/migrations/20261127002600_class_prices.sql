-- =====================================================================================================
-- Client, 2026-11-27: feeding and activity prices can differ for every class, like school fees.
-- Stored like class fee exceptions: the level's (or term's) common price, plus a per-class price where a class differs.
--   class_feeding_rates:   a class's feeding cost this term (else its level's, term_fee_levels.feeding)
--   class_activity_prices: a class's price for an activity this term (else the term's, activity_prices); 0 = that class
--                          does not pay that activity.
-- Same rules as the other fee tables: office staff read them, only the Owner writes them, audited, guarded once billed.
-- =====================================================================================================
create table if not exists public.class_feeding_rates (
  term_id uuid not null references public.terms(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  feeding bigint not null check (feeding >= 0),
  primary key (term_id, class_id)
);
create table if not exists public.class_activity_prices (
  term_id uuid not null references public.terms(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  activity text not null references public.activities(name) on update cascade,
  amount bigint not null check (amount >= 0),
  primary key (term_id, class_id, activity)
);
alter table public.class_feeding_rates enable row level security;
alter table public.class_activity_prices enable row level security;
create policy read_office on public.class_feeding_rates for select to authenticated using (app.has_role('owner', 'admin', 'bursar', 'auditor'));
create policy write_owner on public.class_feeding_rates for all to authenticated using (app.has_role('owner')) with check (app.has_role('owner'));
create policy read_office on public.class_activity_prices for select to authenticated using (app.has_role('owner', 'admin', 'bursar', 'auditor'));
create policy write_owner on public.class_activity_prices for all to authenticated using (app.has_role('owner')) with check (app.has_role('owner'));
grant select, insert, update, delete on public.class_feeding_rates, public.class_activity_prices to authenticated;
create trigger guard_schedule before insert or update or delete on public.class_feeding_rates for each row execute function app.guard_schedule();
create trigger guard_schedule before insert or update or delete on public.class_activity_prices for each row execute function app.guard_schedule();
select app.track(t) from unnest(array['public.class_feeding_rates', 'public.class_activity_prices']::regclass[]) t;

-- A class's feeding cost and activity price for a term.
create or replace function app.class_feeding(p_term uuid, p_class uuid) returns bigint
language sql stable security definer set search_path = public, pg_catalog as $$
  select coalesce((select feeding from public.class_feeding_rates where term_id = p_term and class_id = p_class),
                  (select l.feeding from public.term_fee_levels l join public.classes c on c.level = l.level where l.term_id = p_term and c.id = p_class), 0)
$$;
create or replace function app.activity_price(p_term uuid, p_class uuid, p_activity text) returns bigint
language sql stable security definer set search_path = public, pg_catalog as $$
  select coalesce((select amount from public.class_activity_prices where term_id = p_term and class_id = p_class and activity = p_activity),
                  (select amount from public.activity_prices where term_id = p_term and activity = p_activity), 0)
$$;
grant execute on function app.class_feeding(uuid, uuid), app.activity_price(uuid, uuid, text) to authenticated;

create or replace function app.feeding_rate(p_student uuid, p_term uuid) returns bigint
language sql stable security definer set search_path = public, pg_catalog as $$
  select case when fe.student_id is null then app.class_feeding(p_term, s.class_id)
              when not fe.on_feeding then 0
              else coalesce(fe.rate, app.class_feeding(p_term, s.class_id)) end
  from public.students s
  join public.classes c on c.id = s.class_id
  left join public.term_fee_levels tl on tl.term_id = p_term and tl.level = c.level
  left join public.feeding_exceptions fe on fe.student_id = s.id and fe.term_id = p_term
  where s.id = p_student
$$;

create or replace view public.student_feeding_balances with (security_barrier = true) as
with cur as (
  select t.id as term_id, t.starts_on, t.ends_on from public.terms t where t.is_current and t.starts_on <= current_date
), billed as (
  select s.id as student_id,
         case when e.student_id is null then app.class_feeding(cur.term_id, s.class_id) when e.on_feeding then coalesce(e.rate, app.class_feeding(cur.term_id, s.class_id)) else 0 end as billed
  from public.students s
  join public.classes c on c.id = s.class_id
  cross join cur
  left join public.term_fee_levels l on l.term_id = cur.term_id and l.level = c.level
  left join public.feeding_exceptions e on e.student_id = s.id and e.term_id = cur.term_id
  where s.status = 'Active' and coalesce(s.admitted_on, s.created_at::date) <= cur.ends_on
), paid as (
  select p.student_id, sum(p.feeding_amount) as paid from public.payments p cross join cur
  where p.account = 'fees' and p.status = 'confirmed' and p.feeding_period is not null and p.paid_on between cur.starts_on - 30 and cur.ends_on group by 1
), keys as (select student_id from billed where billed > 0 union select student_id from paid)
select k.student_id, coalesce(b.billed, 0)::numeric as billed, coalesce(p.paid, 0)::numeric as paid, (coalesce(b.billed, 0) - coalesce(p.paid, 0))::numeric as balance
from keys k left join billed b using (student_id) left join paid p using (student_id)
where app.has_role('owner', 'bursar', 'auditor', 'admin');

create or replace function app.bill_student(p_student uuid, p_term uuid) returns int
language plpgsql security definer set search_path = public, pg_catalog as $$
declare t record; s record; inv uuid; tuition bigint; n int := 0; billed date; acc public.fee_account;
begin
  select * into t from public.terms where id = p_term; if not found then return 0; end if;
  select st.id, st.class_id, st.admitted_on, st.status, c.level into s from public.students st join public.classes c on c.id = st.class_id where st.id = p_student;
  if not found or s.status <> 'Active' then return 0; end if;
  billed := greatest(t.starts_on, least(coalesce(s.admitted_on, current_date), current_date));

  -- Compulsory activities for the student's level.
  insert into public.student_activities (student_id, term_id, activity)
  select s.id, t.id, a.name from public.activities a where a.default_enrol and s.level = any(a.levels)
  on conflict do nothing;

  perform set_config('app.invoice_fn', 'on', true);
  -- School fees: the level's lines (class exceptions replace by name, or are added); never feeding; 0 lines left off.
  if not exists (select 1 from public.invoices where student_id = s.id and term_id = t.id and account = 'fees' and status <> 'void')
     and exists (select 1 from public.term_fee_items where term_id = t.id and level = s.level and amount > 0 and label <> 'Feeding'
                 union all select 1 from public.class_fee_overrides where term_id = t.id and class_id = s.class_id and amount > 0 and label <> 'Feeding') then
    insert into public.invoices (account, student_id, term_id, billed_on, due_on) values ('fees', s.id, t.id, billed, billed + 28) returning id into inv;
    insert into public.invoice_lines (invoice_id, label, amount, position)
    select inv, x.label, x.amount, row_number() over (order by x.pos, x.label) - 1
    from (
      select i.label, coalesce(o.amount, i.amount) as amount, i.position as pos
      from public.term_fee_items i left join public.class_fee_overrides o on o.term_id = t.id and o.class_id = s.class_id and o.label = i.label
      where i.term_id = t.id and i.level = s.level
      union all
      select o.label, o.amount, 1000 from public.class_fee_overrides o
      where o.term_id = t.id and o.class_id = s.class_id and not exists (select 1 from public.term_fee_items i where i.term_id = t.id and i.level = s.level and i.label = o.label)
    ) x where x.amount > 0 and x.label <> 'Feeding';
    select coalesce(sum(amount), 0) into tuition from public.invoice_lines where invoice_id = inv and label = 'Tuition';
    update public.invoices set status = 'issued', no = app.next_no('INV-' || app.term_code(t.id), 4), approved_at = now(),
           discount = round(tuition * app.tuition_discount_percent(s.id) / 100) where id = inv;
    n := n + 1;
  end if;

  -- Extracurricular and Extra Classes: one bill each, for the activities the student is enrolled in this term.
  foreach acc in array array['extra', 'classes']::public.fee_account[] loop
    if not exists (select 1 from public.invoices where student_id = s.id and term_id = t.id and account = acc and status <> 'void')
       and exists (select 1 from public.student_activities sa join public.activities a on a.name = sa.activity and a.account = acc
                   where sa.student_id = s.id and sa.term_id = t.id and app.activity_price(t.id, s.class_id, sa.activity) > 0) then
      insert into public.invoices (account, student_id, term_id, billed_on, due_on) values (acc, s.id, t.id, billed, billed + 28) returning id into inv;
      insert into public.invoice_lines (invoice_id, label, amount, position)
      select inv, sa.activity, app.activity_price(t.id, s.class_id, sa.activity), row_number() over (order by sa.activity) - 1
      from public.student_activities sa join public.activities a on a.name = sa.activity and a.account = acc
      where sa.student_id = s.id and sa.term_id = t.id and app.activity_price(t.id, s.class_id, sa.activity) > 0;
      update public.invoices set status = 'issued', approved_at = now(),
             no = app.next_no(case acc when 'extra' then 'EXC-' else 'XCL-' end || app.term_code(t.id), 4) where id = inv;
      n := n + 1;
    end if;
  end loop;
  perform set_config('app.invoice_fn', 'off', true);
  return n;
end $$;

create or replace function public.amend_term_invoices(p_term uuid) returns int
language plpgsql security definer set search_path = public, pg_catalog as $$
declare r record; before bigint; after bigint; tuition bigint; n int := 0;
begin
  if not app.has_role('owner') then raise exception 'Only the Owner can change billed fees' using errcode = '42501'; end if;
  perform set_config('app.invoice_fn', 'on', true);
  for r in select i.id, i.student_id, s.class_id, c.level from public.invoices i join public.students s on s.id = i.student_id join public.classes c on c.id = s.class_id
           where i.term_id = p_term and i.account = 'fees' and i.status = 'issued' loop
    before := app.invoice_total(r.id);
    delete from public.invoice_lines where invoice_id = r.id;
    insert into public.invoice_lines (invoice_id, label, amount, position)
    select r.id, x.label, x.amount, row_number() over (order by x.pos, x.label) - 1
    from (
      select i.label, coalesce(o.amount, i.amount) as amount, i.position as pos
      from public.term_fee_items i left join public.class_fee_overrides o on o.term_id = p_term and o.class_id = r.class_id and o.label = i.label
      where i.term_id = p_term and i.level = r.level
      union all
      select o.label, o.amount, 1000 from public.class_fee_overrides o
      where o.term_id = p_term and o.class_id = r.class_id and not exists (select 1 from public.term_fee_items i where i.term_id = p_term and i.level = r.level and i.label = o.label)
    ) x where x.amount > 0 and x.label <> 'Feeding';
    select coalesce(sum(amount), 0) into tuition from public.invoice_lines where invoice_id = r.id and label = 'Tuition';
    update public.invoices set discount = round(tuition * app.tuition_discount_percent(r.student_id) / 100), updated_at = now() where id = r.id;
    after := app.invoice_total(r.id);
    if after <> before then n := n + 1; end if;
  end loop;
  for r in select i.id, s.class_id from public.invoices i join public.students s on s.id = i.student_id where i.term_id = p_term and i.account in ('extra', 'classes') and i.status = 'issued' loop
    before := app.invoice_total(r.id);
    update public.invoice_lines l set amount = app.activity_price(p_term, r.class_id, l.label)
     where l.invoice_id = r.id and app.activity_price(p_term, r.class_id, l.label) > 0 and l.amount <> app.activity_price(p_term, r.class_id, l.label);
    if app.invoice_total(r.id) <> before then n := n + 1; end if;
  end loop;
  perform set_config('app.invoice_fn', 'off', true);
  return n;
end $$;
