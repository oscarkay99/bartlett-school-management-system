-- =====================================================================================================
-- Every payment says which term and year it is for (user decision, 2026-11-27), for clearer receipts, ledgers and
-- term reports. Chosen on the payment form (defaults to the term selected at the top); if none is given, the term the
-- payment date falls in (a date between terms counts toward the next term). Existing payments get it the same way.
-- No overpayment now checks that term: a payment can't exceed what is owed for that term's bills of that account.
-- Feeding payments still have no limit; a term's feeding balance counts the feeding payments made for that term.
-- One payment is for one term: to clear two terms, record two payments.
-- =====================================================================================================
alter table public.payments add column if not exists term_id uuid references public.terms(id);

create or replace function app.term_for_date(p_date date) returns uuid
language sql stable security definer set search_path = public, pg_catalog as $$
  select coalesce((select id from public.terms where p_date between starts_on and ends_on order by starts_on limit 1),
                  (select id from public.terms where starts_on > p_date order by starts_on limit 1),
                  (select id from public.terms order by starts_on desc limit 1))
$$;
grant execute on function app.term_for_date(date) to authenticated;

select set_config('app.payment_fn', 'on', true);
update public.payments set term_id = app.term_for_date(paid_on) where term_id is null;
select set_config('app.payment_fn', 'off', true);

-- What is still owed for one term on an account (its issued invoices + approved adjustments − that term's payments).
create or replace function app.amount_owed_term(p_student uuid, p_account public.fee_account, p_term uuid) returns bigint
language sql stable security definer set search_path = public, pg_catalog as $$
  select greatest(0,
      coalesce((select sum(app.invoice_total(i.id)) from public.invoices i where i.student_id = p_student and i.account = p_account and i.term_id = p_term and i.status = 'issued'), 0)
    + coalesce((select sum(a.amount) from public.invoice_adjustments a join public.invoices i on i.id = a.invoice_id
                where i.student_id = p_student and i.account = p_account and i.term_id = p_term and a.status = 'approved'), 0)
    - coalesce((select sum(amount) from public.payments where student_id = p_student and account = p_account and term_id = p_term
                and feeding_period is null and status in ('confirmed', 'pending')), 0))::bigint
$$;
grant execute on function app.amount_owed_term(uuid, public.fee_account, uuid) to authenticated;

create or replace function app.guard_payment() returns trigger
language plpgsql set search_path = public, pg_catalog as $$
declare owed bigint; what text; tname text;
begin
  if current_setting('app.payment_fn', true) = 'on' then return coalesce(new, old); end if;
  if tg_op = 'INSERT' then
    if new.status = 'reversed' then raise exception 'A new payment cannot be reversed'; end if;
    new.term_id := coalesce(new.term_id, app.term_for_date(new.paid_on));
    if new.feeding_period is null then
      -- Never more than is owed for that term (one payment at a time per student, so two can't together go over).
      perform pg_advisory_xact_lock(hashtext('payment:' || new.student_id::text));
      owed := app.amount_owed_term(new.student_id, new.account, new.term_id);
      what := case when new.account = 'fees' then 'school fees' when new.account = 'extra' then 'Extracurricular' else 'Extra Classes' end;
      select t.name || ' ' || y.name into tname from public.terms t join public.academic_years y on y.id = t.year_id where t.id = new.term_id;
      if new.amount > owed then
        if owed = 0 then raise exception 'Nothing is owed for % in % — this payment was not recorded.', what, tname using errcode = 'P0001'; end if;
        raise exception 'Only GH₵ % is owed for % in % — a payment can''t be more than that.', to_char(owed / 100.0, 'FM999,999,990.00'), what, tname using errcode = 'P0001';
      end if;
    end if;
    new.receipt_no := app.next_no(case new.account when 'fees' then 'RCT' when 'extra' then 'XRC' else 'XCR' end, 5);
    new.received_by := auth.uid(); new.received_at := now();
    return new;
  end if;
  raise exception 'Payments cannot be edited or deleted; use confirm_payment() or reverse_payment()';
end $$;

-- This term's feeding balance counts the feeding payments made for this term.
create or replace view public.student_feeding_balances with (security_barrier = true) as
with cur as (
  select t.id as term_id, t.starts_on, t.ends_on from public.terms t where t.is_current and t.starts_on <= current_date
), billed as (
  select s.id as student_id,
         case when e.student_id is null then app.class_feeding(cur.term_id, s.class_id) when e.on_feeding then coalesce(e.rate, app.class_feeding(cur.term_id, s.class_id)) else 0 end as billed
  from public.students s
  join public.classes c on c.id = s.class_id
  cross join cur
  left join public.feeding_exceptions e on e.student_id = s.id and e.term_id = cur.term_id
  where s.status = 'Active' and coalesce(s.admitted_on, s.created_at::date) <= cur.ends_on
), paid as (
  select p.student_id, sum(p.feeding_amount) as paid from public.payments p cross join cur
  where p.account = 'fees' and p.status = 'confirmed' and p.feeding_period is not null and p.term_id = cur.term_id group by 1
), keys as (select student_id from billed where billed > 0 union select student_id from paid)
select k.student_id, coalesce(b.billed, 0)::numeric as billed, coalesce(p.paid, 0)::numeric as paid, (coalesce(b.billed, 0) - coalesce(p.paid, 0))::numeric as balance
from keys k left join billed b using (student_id) left join paid p using (student_id)
where app.has_role('owner', 'bursar', 'auditor', 'admin');
