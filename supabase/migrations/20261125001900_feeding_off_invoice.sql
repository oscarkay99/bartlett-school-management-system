-- =====================================================================================================
-- Feeding is never on the school fees invoice. It is billed and paid only in the Feeding module:
--   * every active student owes the current term's feeding rate for their class level (or the different rate /
--     nothing set in feeding_exceptions), from the term's start, whatever plan they pay it on (termly by default,
--     or daily / weekly / monthly);
--   * it is paid only by feeding payments (payments with a feeding period); a school fees payment never carries feeding.
-- =====================================================================================================

-- A school fees payment can no longer include a feeding part: feeding is always its own payment.
alter table public.payments add constraint payments_feeding_separate check (feeding_amount = 0 or feeding_period is not null);

create or replace view public.student_feeding_balances with (security_barrier = true) as
with cur as (
  select t.id as term_id, t.ends_on from public.terms t where t.is_current and t.starts_on <= current_date
), billed as (
  select s.id as student_id,
         case when e.student_id is null then coalesce(l.feeding, 0) when e.on_feeding then coalesce(e.rate, l.feeding, 0) else 0 end as billed
  from public.students s
  join public.classes c on c.id = s.class_id
  cross join cur
  left join public.term_fee_levels l on l.term_id = cur.term_id and l.level = c.level
  left join public.feeding_exceptions e on e.student_id = s.id and e.term_id = cur.term_id
  where s.status = 'Active' and coalesce(s.admitted_on, s.created_at::date) <= cur.ends_on
), paid as (
  select student_id, sum(feeding_amount) as paid from public.payments
  where account = 'fees' and status = 'confirmed' and feeding_period is not null group by 1
), keys as (select student_id from billed where billed > 0 union select student_id from paid)
select k.student_id, coalesce(b.billed, 0)::numeric as billed, coalesce(p.paid, 0)::numeric as paid, (coalesce(b.billed, 0) - coalesce(p.paid, 0))::numeric as balance
from keys k left join billed b using (student_id) left join paid p using (student_id)
where app.has_role('owner', 'bursar', 'auditor', 'admin');
