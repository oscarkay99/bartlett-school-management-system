-- =====================================================================================================
-- The Owner can change a term's fees even after it has been billed. The term's issued invoices are then brought in
-- line with the new fees by amend_term_invoices (Owner only, recorded in the audit trail):
--   * school fees invoices: their lines are rebuilt from the schedule (the class's fee lines, never feeding) and the
--     scholarship discount is recalculated on the new tuition;
--   * Extracurricular / Extra Classes invoices: each activity line takes the term's new price for that activity.
-- Payments are never changed. If a student has now paid more than the new amount, it shows as a credit.
-- Everyone else still cannot touch the schedule (row-level security: the Owner writes it).
-- =====================================================================================================
create or replace function app.guard_schedule() returns trigger
language plpgsql set search_path = public, pg_catalog as $$
declare t uuid := coalesce(new.term_id, old.term_id);
begin
  if not app.has_role('owner') and exists (select 1 from public.invoices where term_id = t and status in ('issued', 'void')) then
    raise exception 'This term has issued invoices, so only the Owner can change its fees.';
  end if;
  return coalesce(new, old);
end $$;

-- Invoice lines change only on drafts, or inside the invoice functions (e.g. amend_term_invoices).
create or replace function app.lines_only_in_draft() returns trigger
language plpgsql set search_path = public, pg_catalog as $$
declare st public.invoice_status;
begin
  if current_setting('app.invoice_fn', true) = 'on' then return coalesce(new, old); end if;
  select status into st from public.invoices where id = coalesce(new.invoice_id, old.invoice_id);
  if not found and tg_op = 'DELETE' then return old; end if;   -- the draft invoice itself is being deleted (cascade)
  if st is distinct from 'draft' then raise exception 'Invoice lines can only change while the invoice is a draft (it is %)', st using errcode = 'P0001'; end if;
  return coalesce(new, old);
end $$;

create or replace function public.amend_term_invoices(p_term uuid) returns int
language plpgsql security definer set search_path = public, pg_catalog as $$
declare r record; before bigint; after bigint; tuition bigint; n int := 0;
begin
  if not app.has_role('owner') then raise exception 'Only the Owner can change billed fees' using errcode = '42501'; end if;
  perform set_config('app.invoice_fn', 'on', true);
  -- School fees invoices: rebuild the lines from the schedule.
  for r in select i.id, s.class_id, c.level, s.scholarship_percent from public.invoices i join public.students s on s.id = i.student_id join public.classes c on c.id = s.class_id
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
    update public.invoices set discount = round(tuition * coalesce(r.scholarship_percent, 0) / 100), updated_at = now() where id = r.id;
    after := app.invoice_total(r.id);
    if after <> before then n := n + 1; end if;
  end loop;
  -- Activity bills: each activity line takes the new price.
  for r in select i.id from public.invoices i where i.term_id = p_term and i.account in ('extra', 'classes') and i.status = 'issued' loop
    before := app.invoice_total(r.id);
    update public.invoice_lines l set amount = p.amount from public.activity_prices p
     where l.invoice_id = r.id and p.term_id = p_term and p.activity = l.label and p.amount > 0 and l.amount <> p.amount;
    if app.invoice_total(r.id) <> before then n := n + 1; end if;
  end loop;
  perform set_config('app.invoice_fn', 'off', true);
  return n;
end $$;
revoke all on function public.amend_term_invoices(uuid) from public, anon;
grant execute on function public.amend_term_invoices(uuid) to authenticated;
