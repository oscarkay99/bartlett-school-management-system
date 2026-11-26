-- =====================================================================================================
-- Feeding is opt-in (client decision, 2026-11-26): a student is billed feeding only once enrolled for it in the
-- Feeding module. Enrolment is a feeding_exceptions row with on_feeding = true: rate null = the level's feeding
-- cost from Settings (Kindergarten / Primary / JHS), or a different amount. No row = not on feeding.
-- =====================================================================================================
create or replace function app.feeding_rate(p_student uuid, p_term uuid) returns bigint
language sql stable security definer set search_path = public, pg_catalog as $$
  select case when fe.student_id is null or not fe.on_feeding then 0
              else coalesce(fe.rate, tl.feeding, 0) end
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
         case when e.student_id is null or not e.on_feeding then 0 else coalesce(e.rate, l.feeding, 0) end as billed
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
