-- =====================================================================================================
-- School fees are billed automatically. Once the current term has started and its fees are set in Settings,
-- every active student without a school fees invoice for that term gets one, issued and numbered straight away
-- (INV-2627-T1-0001 …). Students registered later in the term are billed the same way. Idempotent: running it
-- again bills nobody twice. The app calls it whenever a staff member loads the system, and after a student is
-- registered or the term's fees are saved.
--
-- What goes on the invoice (same rules as the app):
--   * the class's level lines, with any class exception replacing the line of the same name (or added);
--     lines at 0 are left off;
--   * Feeding at the level rate, unless the student pays feeding on a plan (Daily / Weekly / Monthly / Term),
--     is marked not on feeding, or has a different rate set in the Feeding module;
--   * a scholarship discount of the student's scholarship % of tuition.
-- Billed on the term's first day (or today, for a student registered after it), due 28 days later.
-- =====================================================================================================
create or replace function public.bill_current_term() returns int
language plpgsql security definer set search_path = public, pg_catalog as $$
declare t record; s record; inv uuid; tuition bigint; feed bigint; ex record; n int := 0; billed date;
begin
  if app.my_role() is null then raise exception 'Sign in first' using errcode = '42501'; end if;
  select * into t from public.terms where is_current and starts_on <= current_date and ends_on >= current_date;
  if not found then return 0; end if;
  -- Nothing to bill from until the term's fees are set.
  if not exists (select 1 from public.term_fee_items where term_id = t.id and amount > 0) then return 0; end if;

  perform set_config('app.invoice_fn', 'off', true);
  for s in
    select st.id, st.class_id, st.scholarship_percent, st.admitted_on, c.level
    from public.students st join public.classes c on c.id = st.class_id
    where st.status = 'Active'
      and not exists (select 1 from public.invoices i where i.student_id = st.id and i.term_id = t.id and i.account = 'fees' and i.status <> 'void')
    order by c.position, st.last_name, st.first_name
  loop
    billed := greatest(t.starts_on, least(coalesce(s.admitted_on, t.starts_on), current_date));
    insert into public.invoices (account, student_id, term_id, discount, billed_on, due_on)
    values ('fees', s.id, t.id, 0, billed, billed + 28) returning id into inv;

    -- Fee lines: level lines (class exceptions replace by name), then class-only extras; zero lines dropped.
    insert into public.invoice_lines (invoice_id, label, amount, position)
    select inv, x.label, x.amount, row_number() over (order by x.pos, x.label) - 1
    from (
      select i.label, coalesce(o.amount, i.amount) as amount, i.position as pos
      from public.term_fee_items i left join public.class_fee_overrides o on o.term_id = t.id and o.class_id = s.class_id and o.label = i.label
      where i.term_id = t.id and i.level = s.level
      union all
      select o.label, o.amount, 1000
      from public.class_fee_overrides o
      where o.term_id = t.id and o.class_id = s.class_id
        and not exists (select 1 from public.term_fee_items i where i.term_id = t.id and i.level = s.level and i.label = o.label)
    ) x where x.amount > 0;

    -- Feeding (only for families paying it with the school fees).
    select feeding into feed from public.term_fee_levels where term_id = t.id and level = s.level;
    select * into ex from public.feeding_exceptions where student_id = s.id and term_id = t.id;
    if found then feed := case when ex.on_feeding then coalesce(ex.rate, feed) else 0 end; end if;
    if app.on_feeding_plan(s.id, t.id) then feed := 0; end if;
    if coalesce(feed, 0) > 0 then
      insert into public.invoice_lines (invoice_id, label, amount, position)
      values (inv, 'Feeding', feed, (select count(*) from public.invoice_lines where invoice_id = inv));
    end if;

    -- No chargeable lines for this class: nothing to bill (the draft is removed).
    if not exists (select 1 from public.invoice_lines where invoice_id = inv) then delete from public.invoices where id = inv; continue; end if;

    -- Issue it: number, scholarship discount on tuition.
    select coalesce(sum(amount), 0) into tuition from public.invoice_lines where invoice_id = inv and label = 'Tuition';
    perform set_config('app.invoice_fn', 'on', true);
    update public.invoices set status = 'issued', no = app.next_no('INV-' || app.term_code(t.id), 4), approved_at = now(),
           discount = round(tuition * coalesce(s.scholarship_percent, 0) / 100)
     where id = inv;
    perform set_config('app.invoice_fn', 'off', true);
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.bill_current_term() from public, anon;
grant execute on function public.bill_current_term() to authenticated;
