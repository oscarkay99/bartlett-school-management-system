-- =====================================================================================================
-- Nobody can pay more than they owe.
--   * School fees, Extracurricular, Extra Classes: a payment can't exceed the account's issued invoices
--     (+ approved adjustments) minus what is already paid (confirmed or pending).
--   * Feeding: a feeding payment can't exceed this term's feeding rate (class rate, a different rate, or 0 if
--     not on feeding) minus this term's feeding payments (made from 30 days before the term starts to its end).
-- Enforced when the payment is recorded, with a per-student lock so two payments at the same moment can't
-- together go over. Reversals free the amount up again.
-- =====================================================================================================

-- What the student still owes on an account (p_feeding: feeding, otherwise the account's invoices). Never below 0.
create or replace function app.amount_owed(p_student uuid, p_account public.fee_account, p_feeding boolean) returns bigint
language plpgsql stable security definer set search_path = public, pg_catalog as $$
declare owed bigint; t record;
begin
  if p_feeding then
    select id, starts_on, ends_on into t from public.terms where is_current;
    if not found then return 0; end if;
    owed := coalesce(app.feeding_rate(p_student, t.id), 0)
      - coalesce((select sum(feeding_amount) from public.payments
                  where student_id = p_student and account = 'fees' and feeding_period is not null and status in ('confirmed', 'pending')
                    and paid_on between t.starts_on - 30 and t.ends_on), 0);
  else
    owed := coalesce((select sum(app.invoice_total(i.id)) from public.invoices i where i.student_id = p_student and i.account = p_account and i.status = 'issued'), 0)
      + coalesce((select sum(a.amount) from public.invoice_adjustments a join public.invoices i on i.id = a.invoice_id
                  where i.student_id = p_student and i.account = p_account and a.status = 'approved'), 0)
      - coalesce((select sum(amount) from public.payments
                  where student_id = p_student and account = p_account and feeding_period is null and status in ('confirmed', 'pending')), 0);
  end if;
  return greatest(owed, 0);
end $$;
revoke all on function app.amount_owed(uuid, public.fee_account, boolean) from public;
grant execute on function app.amount_owed(uuid, public.fee_account, boolean) to authenticated;

create or replace function app.guard_payment() returns trigger
language plpgsql set search_path = public, pg_catalog as $$
declare owed bigint; what text;
begin
  if current_setting('app.payment_fn', true) = 'on' then return coalesce(new, old); end if;
  if tg_op = 'INSERT' then
    if new.status = 'reversed' then raise exception 'A new payment cannot be reversed'; end if;
    -- Never more than is owed (one payment at a time per student, so two can't together go over).
    perform pg_advisory_xact_lock(hashtext('payment:' || new.student_id::text));
    owed := app.amount_owed(new.student_id, new.account, new.feeding_period is not null);
    what := case when new.feeding_period is not null then 'feeding this term' when new.account = 'fees' then 'school fees'
                 when new.account = 'extra' then 'Extracurricular' else 'Extra Classes' end;
    if new.amount > owed then
      if owed = 0 then raise exception 'Nothing is owed for % — this payment was not recorded.', what using errcode = 'P0001'; end if;
      raise exception 'Only GH₵ % is owed for % — a payment can''t be more than that.', to_char(owed / 100.0, 'FM999,999,990.00'), what using errcode = 'P0001';
    end if;
    new.receipt_no := app.next_no(case new.account when 'fees' then 'RCT' when 'extra' then 'XRC' else 'XCR' end, 5);
    new.received_by := auth.uid(); new.received_at := now();
    return new;
  end if;
  raise exception 'Payments cannot be edited or deleted; use confirm_payment() or reverse_payment()';
end $$;

-- Feeding balance: this term's feeding payments only (same window as above).
create or replace view public.student_feeding_balances with (security_barrier = true) as
with cur as (
  select t.id as term_id, t.starts_on, t.ends_on from public.terms t where t.is_current and t.starts_on <= current_date
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
  select p.student_id, sum(p.feeding_amount) as paid from public.payments p cross join cur
  where p.account = 'fees' and p.status = 'confirmed' and p.feeding_period is not null and p.paid_on between cur.starts_on - 30 and cur.ends_on group by 1
), keys as (select student_id from billed where billed > 0 union select student_id from paid)
select k.student_id, coalesce(b.billed, 0)::numeric as billed, coalesce(p.paid, 0)::numeric as paid, (coalesce(b.billed, 0) - coalesce(p.paid, 0))::numeric as balance
from keys k left join billed b using (student_id) left join paid p using (student_id)
where app.has_role('owner', 'bursar', 'auditor', 'admin');
