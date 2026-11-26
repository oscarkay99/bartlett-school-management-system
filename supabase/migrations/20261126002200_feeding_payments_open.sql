-- =====================================================================================================
-- Feeding payments are simply recorded (user decision, 2026-11-26): daily, weekly, monthly, for the term or in
-- bits, with no "still owed" limit. School fees, Extracurricular and Extra Classes keep the no-overpayment rule.
-- =====================================================================================================
create or replace function app.guard_payment() returns trigger
language plpgsql set search_path = public, pg_catalog as $$
declare owed bigint; what text;
begin
  if current_setting('app.payment_fn', true) = 'on' then return coalesce(new, old); end if;
  if tg_op = 'INSERT' then
    if new.status = 'reversed' then raise exception 'A new payment cannot be reversed'; end if;
    if new.feeding_period is null then
      -- Never more than is owed (one payment at a time per student, so two can't together go over).
      perform pg_advisory_xact_lock(hashtext('payment:' || new.student_id::text));
      owed := app.amount_owed(new.student_id, new.account, false);
      what := case when new.account = 'fees' then 'school fees' when new.account = 'extra' then 'Extracurricular' else 'Extra Classes' end;
      if new.amount > owed then
        if owed = 0 then raise exception 'Nothing is owed for % — this payment was not recorded.', what using errcode = 'P0001'; end if;
        raise exception 'Only GH₵ % is owed for % — a payment can''t be more than that.', to_char(owed / 100.0, 'FM999,999,990.00'), what using errcode = 'P0001';
      end if;
    end if;
    new.receipt_no := app.next_no(case new.account when 'fees' then 'RCT' when 'extra' then 'XRC' else 'XCR' end, 5);
    new.received_by := auth.uid(); new.received_at := now();
    return new;
  end if;
  raise exception 'Payments cannot be edited or deleted; use confirm_payment() or reverse_payment()';
end $$;
