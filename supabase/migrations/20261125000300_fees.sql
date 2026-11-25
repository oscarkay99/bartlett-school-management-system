-- =====================================================================================================
-- Fees: fee schedule, Extra Classes enrolment, invoices (draft -> submitted -> Owner approves -> issued),
-- adjustments, payments & receipts, document numbering, balances, class invoice sheets.
--
-- Money is integer minor units (pesewas). Two accounts, as parents receive them:
--   'fees'  = school fees invoice (tuition, books, levies, PTA, exams, boarding, feeding)
--   'extra' = Extra Classes invoice (music, STEM, extra classes): standalone, never added to school fees
--
-- Rules enforced here, not just in the screens:
--   * Invoice lines can only change while the invoice is a draft.
--   * Status only moves through the functions below: submit (Bursar/Owner), approve or return (Owner), void (Owner).
--   * Issued invoices never change; corrections are adjustments with a reason, approved by the Owner.
--   * Payments are never edited or deleted; they are reversed with a reason.
--   * Invoice and receipt numbers come from the database, so they never clash.
--   * A term's fee schedule is locked once any invoice for that term is issued.
-- =====================================================================================================

create type public.fee_account as enum ('fees', 'extra');
create type public.invoice_status as enum ('draft', 'submitted', 'issued', 'void');
create type public.pay_method as enum ('Cash', 'Mobile Money', 'Bank Transfer', 'Card', 'Cheque', 'Sponsor');
create type public.payment_status as enum ('confirmed', 'pending', 'reversed');
create type public.approval_status as enum ('pending', 'approved', 'rejected');

-- ---------- Fee schedule (per term, per level, with class exceptions) ----------
create table public.term_fee_levels (
  term_id uuid not null references public.terms(id) on delete cascade,
  level public.school_level not null,
  boarding bigint not null default 0 check (boarding >= 0),
  feeding bigint not null default 0 check (feeding >= 0),
  primary key (term_id, level)
);
create table public.term_fee_items (
  id uuid primary key default gen_random_uuid(),
  term_id uuid not null references public.terms(id) on delete cascade,
  level public.school_level not null,
  label text not null check (length(trim(label)) > 0 and lower(label) <> 'boarding'),
  amount bigint not null default 0 check (amount >= 0),     -- 0 = listed but not charged (prints as "—")
  position int not null default 0,
  unique (term_id, level, label)
);
create table public.class_fee_overrides (
  term_id uuid not null references public.terms(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  label text not null check (length(trim(label)) > 0),
  amount bigint not null check (amount >= 0),                -- replaces the level line with this label, or adds one; 0 removes it
  primary key (term_id, class_id, label)
);
create table public.activities (
  name text primary key,
  kindergarten_allowed boolean not null default false
);
create table public.activity_prices (
  term_id uuid not null references public.terms(id) on delete cascade,
  activity text not null references public.activities(name) on update cascade,
  amount bigint not null check (amount >= 0),
  primary key (term_id, activity)
);
create table public.student_activities (
  student_id uuid not null references public.students(id) on delete cascade,
  term_id uuid not null references public.terms(id) on delete cascade,
  activity text not null references public.activities(name) on update cascade,
  enrolled_at timestamptz not null default now(),
  primary key (student_id, term_id, activity)
);

-- ---------- Document numbering ----------
create table public.doc_counters (
  stem text primary key,            -- e.g. INV-2627-T1, RCT
  last_no int not null default 0
);
-- Next number for a stem, e.g. ('INV-2627-T1', 4) -> 'INV-2627-T1-0005'. Row lock makes it safe under concurrency.
create or replace function app.next_no(p_stem text, p_width int) returns text
language plpgsql security definer set search_path = public, pg_catalog as $$
declare n int;
begin
  insert into public.doc_counters (stem, last_no) values (p_stem, 1)
  on conflict (stem) do update set last_no = doc_counters.last_no + 1
  returning last_no into n;
  return p_stem || '-' || lpad(n::text, p_width, '0');
end $$;

-- "2026/2027" + "Term 2" -> "2627-T2"
create or replace function app.term_code(p_term uuid) returns text
language sql stable security definer set search_path = public, pg_catalog as $$
  select substr(y.name, 3, 2) || substr(y.name, 8, 2) || '-T' || coalesce(substring(t.name from '\d+'), upper(left(regexp_replace(t.name, '\W', '', 'g'), 3)))
  from public.terms t join public.academic_years y on y.id = t.year_id where t.id = p_term
$$;

-- ---------- Invoices ----------
create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  no text unique,                                   -- assigned when issued
  account public.fee_account not null,
  student_id uuid not null references public.students(id) on delete restrict,
  term_id uuid not null references public.terms(id) on delete restrict,
  status public.invoice_status not null default 'draft',
  discount bigint not null default 0 check (discount >= 0),    -- scholarship on tuition
  billed_on date, due_on date,
  return_note text,                                 -- why the Owner sent it back
  void_reason text,
  created_by uuid default auth.uid(), created_at timestamptz not null default now(),
  submitted_by uuid, submitted_at timestamptz,
  approved_by uuid, approved_at timestamptz,
  updated_at timestamptz not null default now()
);
-- One live invoice per student, term and account.
create unique index invoices_one_per_term on public.invoices (student_id, term_id, account) where status <> 'void';
create index invoices_status_idx on public.invoices (status);

create table public.invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  label text not null check (length(trim(label)) > 0),
  amount bigint not null,                           -- may be negative for a discount line (e.g. sibling discount)
  class_rate bigint,                                -- what the fee schedule says for this line; differs => "edited"
  position int not null default 0
);
create index invoice_lines_invoice_idx on public.invoice_lines (invoice_id);

-- Lines only change while the invoice is a draft.
create or replace function app.lines_only_in_draft() returns trigger
language plpgsql set search_path = public, pg_catalog as $$
declare st public.invoice_status;
begin
  select status into st from public.invoices where id = coalesce(new.invoice_id, old.invoice_id);
  if not found and tg_op = 'DELETE' then return old; end if;   -- the draft invoice itself is being deleted (cascade)
  if st is distinct from 'draft' then raise exception 'Invoice lines can only change while the invoice is a draft (it is %)', st using errcode = 'P0001'; end if;
  return coalesce(new, old);
end $$;
create trigger lines_only_in_draft before insert or update or delete on public.invoice_lines for each row execute function app.lines_only_in_draft();

-- Invoice header: drafts are editable; status and numbers only change through the functions below.
create or replace function app.guard_invoice() returns trigger
language plpgsql set search_path = public, pg_catalog as $$
begin
  if current_setting('app.invoice_fn', true) = 'on' then return new; end if;
  if tg_op = 'INSERT' then
    if new.status <> 'draft' or new.no is not null then raise exception 'New invoices start as drafts without a number'; end if;
    return new;
  end if;
  if tg_op = 'DELETE' then
    if old.status <> 'draft' then raise exception 'Only draft invoices can be deleted; void an issued invoice instead'; end if;
    return old;
  end if;
  if old.status <> 'draft' then raise exception 'Only draft invoices can be edited; use an adjustment for issued invoices'; end if;
  if new.status <> old.status or new.no is distinct from old.no or new.approved_by is distinct from old.approved_by then
    raise exception 'Use submit / approve / return / void to change an invoice''s status';
  end if;
  return new;
end $$;
create trigger guard_invoice before insert or update or delete on public.invoices for each row execute function app.guard_invoice();

-- Total of an invoice (lines minus discount).
create or replace function app.invoice_total(p_invoice uuid) returns bigint
language sql stable security definer set search_path = public, pg_catalog as $$
  select coalesce((select sum(amount) from public.invoice_lines where invoice_id = p_invoice), 0) - (select discount from public.invoices where id = p_invoice)
$$;

-- Bursar/Owner: send drafts to the Owner for approval.
create or replace function public.submit_invoices(p_ids uuid[]) returns int
language plpgsql security definer set search_path = public, pg_catalog as $$
declare n int;
begin
  if not app.has_role('owner', 'bursar') then raise exception 'Only the Bursar or Owner can submit invoices' using errcode = '42501'; end if;
  if exists (select 1 from unnest(p_ids) i where app.invoice_total(i) < 0) then raise exception 'An invoice cannot total less than zero'; end if;
  perform set_config('app.invoice_fn', 'on', true);
  update public.invoices set status = 'submitted', submitted_by = auth.uid(), submitted_at = now(), return_note = null
   where id = any(p_ids) and status = 'draft';
  get diagnostics n = row_count;
  perform set_config('app.invoice_fn', 'off', true); return n;
end $$;

-- Owner: approve submitted invoices. Each gets its number and is issued.
create or replace function public.approve_invoices(p_ids uuid[]) returns int
language plpgsql security definer set search_path = public, pg_catalog as $$
declare r record; n int := 0;
begin
  if not app.has_role('owner') then raise exception 'Only the Owner can approve invoices' using errcode = '42501'; end if;
  perform set_config('app.invoice_fn', 'on', true);
  for r in select i.id, i.account, i.term_id from public.invoices i where i.id = any(p_ids) and i.status = 'submitted' order by i.submitted_at, i.id loop
    update public.invoices set status = 'issued', approved_by = auth.uid(), approved_at = now(),
           no = app.next_no(case r.account when 'fees' then 'INV-' else 'EXC-' end || app.term_code(r.term_id), 4),
           billed_on = coalesce(billed_on, current_date), due_on = coalesce(due_on, current_date + 28)
     where id = r.id;
    n := n + 1;
  end loop;
  perform set_config('app.invoice_fn', 'off', true); return n;
end $$;

-- Owner: send a submitted invoice back to draft with a note.
create or replace function public.return_invoice(p_id uuid, p_note text) returns void
language plpgsql security definer set search_path = public, pg_catalog as $$
begin
  if not app.has_role('owner') then raise exception 'Only the Owner can return invoices' using errcode = '42501'; end if;
  if coalesce(length(trim(p_note)), 0) < 5 then raise exception 'Say why the invoice is being returned'; end if;
  perform set_config('app.invoice_fn', 'on', true);
  update public.invoices set status = 'draft', return_note = p_note where id = p_id and status = 'submitted';
  if not found then raise exception 'Only submitted invoices can be returned'; end if;
  perform set_config('app.invoice_fn', 'off', true);
end $$;

-- Owner: void an issued invoice (e.g. student withdrawn before term). Kept for the record.
create or replace function public.void_invoice(p_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = public, pg_catalog as $$
begin
  if not app.has_role('owner') then raise exception 'Only the Owner can void invoices' using errcode = '42501'; end if;
  if coalesce(length(trim(p_reason)), 0) < 5 then raise exception 'A reason is required'; end if;
  perform set_config('app.invoice_fn', 'on', true);
  update public.invoices set status = 'void', void_reason = p_reason where id = p_id and status = 'issued';
  if not found then raise exception 'Only issued invoices can be voided'; end if;
  perform set_config('app.invoice_fn', 'off', true);
end $$;

-- ---------- Adjustments to issued invoices ----------
create table public.invoice_adjustments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete restrict,
  amount bigint not null check (amount <> 0),       -- negative reduces what is owed
  reason text not null check (length(trim(reason)) >= 5),
  status public.approval_status not null default 'pending',
  requested_by uuid default auth.uid(), requested_at timestamptz not null default now(),
  decided_by uuid, decided_at timestamptz
);
create or replace function app.guard_adjustment() returns trigger
language plpgsql set search_path = public, pg_catalog as $$
begin
  if current_setting('app.invoice_fn', true) = 'on' then return coalesce(new, old); end if;
  if tg_op = 'INSERT' then
    if new.status <> 'pending' then raise exception 'Adjustments start as pending'; end if;
    if (select status from public.invoices where id = new.invoice_id) <> 'issued' then raise exception 'Adjust issued invoices only; edit drafts directly'; end if;
    return new;
  end if;
  raise exception 'Adjustments are decided with decide_adjustment(); they cannot be edited or deleted';
end $$;
create trigger guard_adjustment before insert or update or delete on public.invoice_adjustments for each row execute function app.guard_adjustment();

create or replace function public.decide_adjustment(p_id uuid, p_approve boolean) returns void
language plpgsql security definer set search_path = public, pg_catalog as $$
begin
  if not app.has_role('owner') then raise exception 'Only the Owner can approve adjustments' using errcode = '42501'; end if;
  perform set_config('app.invoice_fn', 'on', true);
  update public.invoice_adjustments set status = case when p_approve then 'approved'::public.approval_status else 'rejected' end,
         decided_by = auth.uid(), decided_at = now()
   where id = p_id and status = 'pending';
  if not found then raise exception 'Adjustment is not pending'; end if;
  perform set_config('app.invoice_fn', 'off', true);
end $$;

-- ---------- Payments & receipts ----------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  receipt_no text unique,                           -- assigned on insert
  account public.fee_account not null,
  student_id uuid not null references public.students(id) on delete restrict,
  guardian_id uuid references public.guardians(id) on delete set null,
  amount bigint not null check (amount > 0),
  method public.pay_method not null,
  paid_on date not null default current_date,
  reference text,                                   -- MoMo / bank / cheque reference
  status public.payment_status not null default 'confirmed',
  note text,
  received_by uuid default auth.uid(), received_at timestamptz not null default now(),
  reversal_reason text, reversed_by uuid, reversed_at timestamptz
);
create index payments_student_idx on public.payments (student_id, account);
-- The same bank/MoMo reference cannot be recorded twice.
create unique index payments_unique_reference on public.payments (method, upper(reference)) where reference is not null and status <> 'reversed';

create or replace function app.guard_payment() returns trigger
language plpgsql set search_path = public, pg_catalog as $$
begin
  if current_setting('app.payment_fn', true) = 'on' then return coalesce(new, old); end if;
  if tg_op = 'INSERT' then
    if new.status = 'reversed' then raise exception 'A new payment cannot be reversed'; end if;
    new.receipt_no := app.next_no(case new.account when 'fees' then 'RCT' else 'XRC' end, 5);
    new.received_by := auth.uid(); new.received_at := now();
    return new;
  end if;
  raise exception 'Payments cannot be edited or deleted; use confirm_payment() or reverse_payment()';
end $$;
create trigger guard_payment before insert or update or delete on public.payments for each row execute function app.guard_payment();

-- Bursar/Owner: confirm a pending (e.g. mobile money) payment once verified.
create or replace function public.confirm_payment(p_id uuid) returns void
language plpgsql security definer set search_path = public, pg_catalog as $$
begin
  if not app.has_role('owner', 'bursar') then raise exception 'Only the Bursar or Owner can confirm payments' using errcode = '42501'; end if;
  perform set_config('app.payment_fn', 'on', true);
  update public.payments set status = 'confirmed' where id = p_id and status = 'pending';
  if not found then raise exception 'Payment is not pending'; end if;
  perform set_config('app.payment_fn', 'off', true);
end $$;

-- Bursar/Owner: reverse a payment (bounced cheque, wrong student...). The original stays on record.
create or replace function public.reverse_payment(p_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = public, pg_catalog as $$
begin
  if not app.has_role('owner', 'bursar') then raise exception 'Only the Bursar or Owner can reverse payments' using errcode = '42501'; end if;
  if coalesce(length(trim(p_reason)), 0) < 5 then raise exception 'A reason is required'; end if;
  perform set_config('app.payment_fn', 'on', true);
  update public.payments set status = 'reversed', reversal_reason = p_reason, reversed_by = auth.uid(), reversed_at = now()
   where id = p_id and status <> 'reversed';
  if not found then raise exception 'Payment is already reversed'; end if;
  perform set_config('app.payment_fn', 'off', true);
end $$;

-- ---------- Fee schedule lock: no changes once a term has issued invoices ----------
create or replace function app.guard_schedule() returns trigger
language plpgsql set search_path = public, pg_catalog as $$
declare t uuid := coalesce(new.term_id, old.term_id);
begin
  if exists (select 1 from public.invoices where term_id = t and status in ('issued', 'void')) then
    raise exception 'This term has issued invoices, so its fees are locked. Request a change through an adjustment.';
  end if;
  return coalesce(new, old);
end $$;
create trigger guard_schedule before insert or update or delete on public.term_fee_levels for each row execute function app.guard_schedule();
create trigger guard_schedule before insert or update or delete on public.term_fee_items for each row execute function app.guard_schedule();
create trigger guard_schedule before insert or update or delete on public.class_fee_overrides for each row execute function app.guard_schedule();
create trigger guard_schedule before insert or update or delete on public.activity_prices for each row execute function app.guard_schedule();

-- ---------- Balances ----------
-- Per student and account: issued invoices (net of discount) + approved adjustments - confirmed payments.
-- Runs with the view owner's rights so the Administrator (who cannot see payments) still sees who owes what;
-- the WHERE clause limits it to the roles allowed to see balances.
create view public.student_balances with (security_barrier = true) as
with billed as (
  select i.student_id, i.account, sum(app.invoice_total(i.id)) as billed, min(i.due_on) as due_on
  from public.invoices i where i.status = 'issued' group by 1, 2
), adj as (
  select i.student_id, i.account, sum(a.amount) as adjusted
  from public.invoice_adjustments a join public.invoices i on i.id = a.invoice_id where a.status = 'approved' group by 1, 2
), paid as (
  select student_id, account, sum(amount) as paid from public.payments where status = 'confirmed' group by 1, 2
), keys as (select student_id, account from billed union select student_id, account from paid)
select k.student_id, k.account,
       coalesce(b.billed, 0) + coalesce(a.adjusted, 0) as billed,
       coalesce(p.paid, 0) as paid,
       coalesce(b.billed, 0) + coalesce(a.adjusted, 0) - coalesce(p.paid, 0) as balance,
       b.due_on
from keys k left join billed b using (student_id, account) left join adj a using (student_id, account) left join paid p using (student_id, account)
where app.has_role('owner', 'bursar', 'auditor', 'admin');
grant execute on function app.invoice_total(uuid) to authenticated;
revoke all on public.student_balances from anon;
grant select on public.student_balances to authenticated;

-- ---------- Invoice sheets (Invoices page: one full invoice per class per term, plus one Extra Classes sheet) ----------
-- Edited freely; standalone documents that change nothing else. The Extra Classes sheet prints 10 per A4.
create table public.invoice_sheets (
  id uuid primary key default gen_random_uuid(),
  term_id uuid not null references public.terms(id) on delete cascade,
  kind text not null check (kind in ('class', 'extra_classes')),
  class_id uuid references public.classes(id) on delete cascade,
  title text not null, period text not null, notes text not null default '',
  lines jsonb not null default '[]',               -- [{description, amount}]; amount 0 prints as "—"
  updated_at timestamptz not null default now(),
  check ((kind = 'class') = (class_id is not null)),
  unique nulls not distinct (term_id, kind, class_id)
);

select app.track(t) from unnest(array['public.term_fee_levels', 'public.term_fee_items', 'public.class_fee_overrides', 'public.activities',
  'public.activity_prices', 'public.student_activities', 'public.invoices', 'public.invoice_lines', 'public.invoice_adjustments',
  'public.payments', 'public.invoice_sheets']::regclass[]) t;

-- =====================================================================================================
-- Policies
-- =====================================================================================================
-- Fee schedule & prices: office roles read; only the Owner sets fees.
do $$ declare t text; begin
  foreach t in array array['term_fee_levels', 'term_fee_items', 'class_fee_overrides', 'activity_prices'] loop
    execute format('create policy read_office on public.%I for select to authenticated using (app.has_role(''owner'', ''admin'', ''bursar'', ''auditor''))', t);
    execute format('create policy write_owner on public.%I for all to authenticated using (app.has_role(''owner'')) with check (app.has_role(''owner''))', t);
  end loop;
end $$;
create policy read_all on public.activities for select to authenticated using (app.my_role() is not null);
create policy write_owner on public.activities for all to authenticated using (app.has_role('owner')) with check (app.has_role('owner'));

-- Enrolment in activities: office reads; Owner/Bursar enrol.
create policy read_office on public.student_activities for select to authenticated using (app.has_role('owner', 'admin', 'bursar', 'auditor'));
create policy write_bursar on public.student_activities for all to authenticated using (app.has_role('owner', 'bursar')) with check (app.has_role('owner', 'bursar'));

-- Invoices & lines: Owner/Bursar/Auditor/Admin read; Owner/Bursar create and edit drafts (triggers block everything else).
create policy read_office on public.invoices for select to authenticated using (app.has_role('owner', 'bursar', 'auditor', 'admin'));
create policy write_bursar on public.invoices for insert to authenticated with check (app.has_role('owner', 'bursar'));
create policy edit_bursar on public.invoices for update to authenticated using (app.has_role('owner', 'bursar')) with check (app.has_role('owner', 'bursar'));
create policy delete_bursar on public.invoices for delete to authenticated using (app.has_role('owner', 'bursar'));
create policy read_office on public.invoice_lines for select to authenticated using (app.has_role('owner', 'bursar', 'auditor', 'admin'));
create policy write_bursar on public.invoice_lines for all to authenticated using (app.has_role('owner', 'bursar')) with check (app.has_role('owner', 'bursar'));

-- Adjustments: Owner/Bursar/Auditor read; Owner/Bursar request (Owner decides via function).
create policy read_finance on public.invoice_adjustments for select to authenticated using (app.has_role('owner', 'bursar', 'auditor'));
create policy request on public.invoice_adjustments for insert to authenticated with check (app.has_role('owner', 'bursar'));

-- Payments: Owner/Bursar/Auditor read (not the Administrator: no view of collections); Owner/Bursar record.
create policy read_finance on public.payments for select to authenticated using (app.has_role('owner', 'bursar', 'auditor'));
create policy record on public.payments for insert to authenticated with check (app.has_role('owner', 'bursar'));

-- Invoice sheets: office reads; Owner/Bursar edit.
create policy read_office on public.invoice_sheets for select to authenticated using (app.has_role('owner', 'admin', 'bursar', 'auditor'));
create policy write_bursar on public.invoice_sheets for all to authenticated using (app.has_role('owner', 'bursar')) with check (app.has_role('owner', 'bursar'));

-- doc_counters: no policies at all; only the numbering function (SECURITY DEFINER) touches it.

-- Functions callable by signed-in staff (each checks the role itself).
grant execute on function public.submit_invoices(uuid[]), public.approve_invoices(uuid[]), public.return_invoice(uuid, text),
  public.void_invoice(uuid, text), public.decide_adjustment(uuid, boolean), public.confirm_payment(uuid), public.reverse_payment(uuid, text) to authenticated;
