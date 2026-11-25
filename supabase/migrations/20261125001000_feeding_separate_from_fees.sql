-- =====================================================================================================
-- Feeding paid "small small" is NOT part of school fees.
--   * Families who pay feeding WITH the school fees: feeding is a line on the school fees invoice (as before).
--   * Families on a plan (Daily / Weekly / Monthly / Term): no Feeding line on the invoice; their feeding payments
--     (payments.feeding_period set) never count towards the school fees balance. Their feeding is billed at
--     app.feeding_rate(student, term) and tracked in student_feeding_balances.
-- So paying the school fees in full shows "paid", whatever the state of separately-paid feeding.
-- =====================================================================================================

-- School fees balance: separately-paid feeding (feeding_period set) is excluded.
create or replace view public.student_balances with (security_barrier = true) as
with billed as (
  select i.student_id, i.account, sum(app.invoice_total(i.id)) as billed, min(i.due_on) as due_on
  from public.invoices i where i.status = 'issued' group by 1, 2
), adj as (
  select i.student_id, i.account, sum(a.amount) as adjusted
  from public.invoice_adjustments a join public.invoices i on i.id = a.invoice_id where a.status = 'approved' group by 1, 2
), paid as (
  select student_id, account, sum(amount) as paid from public.payments
  where status = 'confirmed' and feeding_period is null group by 1, 2
), keys as (select student_id, account from billed union select student_id, account from paid)
select k.student_id, k.account,
       coalesce(b.billed, 0) + coalesce(a.adjusted, 0) as billed,
       coalesce(p.paid, 0) as paid,
       coalesce(b.billed, 0) + coalesce(a.adjusted, 0) - coalesce(p.paid, 0) as balance,
       b.due_on
from keys k left join billed b using (student_id, account) left join adj a using (student_id, account) left join paid p using (student_id, account)
where app.has_role('owner', 'bursar', 'auditor', 'admin');

-- Feeding per student: billed = Feeding lines on issued school fees invoices, plus (for terms where the student is on a
-- plan, i.e. pays separately) the term's feeding rate; paid = feeding part of confirmed payments (both kinds).
create or replace function app.on_feeding_plan(p_student uuid, p_term uuid) returns boolean
language sql stable security definer set search_path = public, pg_catalog as $$
  select coalesce((select frequency <> 'With school fees' from public.feeding_plans
                   where student_id = p_student and term_id = p_term order by effective_from desc limit 1), false)
$$;
grant execute on function app.on_feeding_plan(uuid, uuid) to authenticated;

create or replace view public.student_feeding_balances with (security_barrier = true) as
with on_invoice as (
  select i.student_id, sum(l.amount) as billed
  from public.invoices i join public.invoice_lines l on l.invoice_id = i.id
  where i.account = 'fees' and i.status = 'issued' and l.label = 'Feeding' group by 1
), on_plan as (
  select distinct fp.student_id, fp.term_id from public.feeding_plans fp where app.on_feeding_plan(fp.student_id, fp.term_id)
), plan_billed as (
  select student_id, sum(app.feeding_rate(student_id, term_id)) as billed from on_plan group by 1
), paid as (
  select student_id, sum(feeding_amount) as paid from public.payments where account = 'fees' and status = 'confirmed' and feeding_amount > 0 group by 1
), keys as (select student_id from on_invoice union select student_id from plan_billed union select student_id from paid)
select k.student_id, coalesce(i.billed, 0) + coalesce(pb.billed, 0) as billed, coalesce(p.paid, 0) as paid,
       coalesce(i.billed, 0) + coalesce(pb.billed, 0) - coalesce(p.paid, 0) as balance
from keys k left join on_invoice i using (student_id) left join plan_billed pb using (student_id) left join paid p using (student_id)
where app.has_role('owner', 'bursar', 'auditor', 'admin');
