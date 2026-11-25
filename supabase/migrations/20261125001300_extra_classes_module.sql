-- =====================================================================================================
-- Extra Classes module, step 2.
--   fees    = school fees invoice (INV- / RCT-), feeding included for families paying it with the fees
--   extra   = Extracurricular invoice (EXC- / XRC-): Music (Piano), STEM
--   classes = Extra Classes invoice (XCL- / XCR-): Extra Classes (Primary and JHS)
-- Extracurricular and Extra Classes are standalone: never added to school fees or to each other.
-- =====================================================================================================

-- Which account bills each activity.
alter table public.activities add column account public.fee_account not null default 'extra' check (account <> 'fees');
insert into public.activities (name, kindergarten_allowed, account) values ('Extra Classes', false, 'classes')
  on conflict (name) do update set account = 'classes', kindergarten_allowed = false;

comment on column public.invoices.account is
  'fees = school fees (feeding included for families paying it with the fees); extra = Extracurricular (Music (Piano), STEM); classes = Extra Classes';

-- Invoice numbers per account.
create or replace function public.approve_invoices(p_ids uuid[]) returns int
language plpgsql security definer set search_path = public, pg_catalog as $$
declare r record; n int := 0;
begin
  if not app.has_role('owner') then raise exception 'Only the Owner can approve invoices' using errcode = '42501'; end if;
  perform set_config('app.invoice_fn', 'on', true);
  for r in select i.id, i.account, i.term_id from public.invoices i where i.id = any(p_ids) and i.status = 'submitted' order by i.submitted_at, i.id loop
    update public.invoices set status = 'issued', approved_by = auth.uid(), approved_at = now(),
           no = app.next_no(case r.account when 'fees' then 'INV-' when 'extra' then 'EXC-' else 'XCL-' end || app.term_code(r.term_id), 4),
           billed_on = coalesce(billed_on, current_date), due_on = coalesce(due_on, current_date + 28)
     where id = r.id;
    n := n + 1;
  end loop;
  perform set_config('app.invoice_fn', 'off', true); return n;
end $$;

-- Receipt numbers per account.
create or replace function app.guard_payment() returns trigger
language plpgsql set search_path = public, pg_catalog as $$
begin
  if current_setting('app.payment_fn', true) = 'on' then return coalesce(new, old); end if;
  if tg_op = 'INSERT' then
    if new.status = 'reversed' then raise exception 'A new payment cannot be reversed'; end if;
    new.receipt_no := app.next_no(case new.account when 'fees' then 'RCT' when 'extra' then 'XRC' else 'XCR' end, 5);
    new.received_by := auth.uid(); new.received_at := now();
    return new;
  end if;
  raise exception 'Payments cannot be edited or deleted; use confirm_payment() or reverse_payment()';
end $$;

-- Invoices page: one small sheet per standalone account (Extracurricular, Extra Classes), plus the class sheets.
alter table public.invoice_sheets drop constraint invoice_sheets_kind_check;
update public.invoice_sheets set kind = 'extracurricular' where kind = 'extra_classes';
alter table public.invoice_sheets add constraint invoice_sheets_kind_check check (kind in ('class', 'extracurricular', 'extra_classes'));
