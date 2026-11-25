-- =====================================================================================================
-- 1. Extra classes are Music (Piano) and Extra Classes (formerly called STEM). Everyone is enrolled automatically
--    (Kindergarten: Music only).
-- 2. Feeding payments: feeding is billed on the school fees invoice and can be paid with the school fees at once,
--    or on its own daily / weekly / monthly / for the term. Each school fees payment records its feeding part,
--    so we can always see how much feeding has been paid.
-- =====================================================================================================

-- ---------- Extra classes ----------
delete from public.activities where name = 'Extra Classes' and not exists (select 1 from public.student_activities where activity = 'Extra Classes');
update public.activities set name = 'Extra Classes' where name = 'STEM';    -- prices and enrolments follow (on update cascade)
alter table public.activities add column default_enrol boolean not null default true;

-- New students are enrolled in the default extra classes for the current term.
create or replace function app.enrol_extra_classes() returns trigger
language plpgsql security definer set search_path = public, pg_catalog as $$
begin
  insert into public.student_activities (student_id, term_id, activity)
  select new.id, t.id, a.name
  from public.terms t, public.activities a, public.classes c
  where t.is_current and c.id = new.class_id and a.default_enrol and (a.kindergarten_allowed or c.level <> 'Kindergarten')
  on conflict do nothing;
  return null;
end $$;
create trigger enrol_extra_classes after insert on public.students for each row execute function app.enrol_extra_classes();

-- ---------- Feeding part of school fees payments ----------
alter table public.payments add column feeding_amount bigint not null default 0;
alter table public.payments add column feeding_period text;
alter table public.payments add constraint payments_feeding_amount_check check (feeding_amount >= 0 and feeding_amount <= amount);
alter table public.payments add constraint payments_feeding_period_check check (feeding_period is null or feeding_period in ('Daily', 'Weekly', 'Monthly', 'Term'));
-- A feeding-only payment (daily/weekly/monthly/term) is all feeding; feeding only exists on school fees payments.
alter table public.payments add constraint payments_feeding_only_check check (feeding_period is null or feeding_amount = amount);
alter table public.payments add constraint payments_feeding_fees_only_check check (account = 'fees' or (feeding_amount = 0 and feeding_period is null));

-- Feeding per student: billed (Feeding lines on issued school fees invoices), paid (feeding part of confirmed payments), owed.
-- Same visibility as student_balances: roles that may see balances.
create view public.student_feeding_balances with (security_barrier = true) as
with billed as (
  select i.student_id, sum(l.amount) as billed
  from public.invoices i join public.invoice_lines l on l.invoice_id = i.id
  where i.account = 'fees' and i.status = 'issued' and l.label = 'Feeding' group by 1
), paid as (
  select student_id, sum(feeding_amount) as paid from public.payments where account = 'fees' and status = 'confirmed' and feeding_amount > 0 group by 1
)
select coalesce(b.student_id, p.student_id) as student_id, coalesce(b.billed, 0) as billed, coalesce(p.paid, 0) as paid,
       coalesce(b.billed, 0) - coalesce(p.paid, 0) as balance
from billed b full join paid p using (student_id)
where app.has_role('owner', 'bursar', 'auditor', 'admin');
revoke all on public.student_feeding_balances from anon;
grant select on public.student_feeding_balances to authenticated;
