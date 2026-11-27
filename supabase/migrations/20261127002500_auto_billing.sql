-- =====================================================================================================
-- Client, 2026-11-27. Everything a student owes is billed automatically, from the fees in Settings:
--   * when a student is registered, and for every active student once a term has started;
--   * school fees (the level's lines, never feeding), Extracurricular (Music: KG 1 – Class 6, STEM: Class 1 – JHS 3)
--     and Extra Classes (everyone), each on its own invoice, issued and numbered straight away;
--   * feeding is compulsory again: everyone owes their level's feeding cost unless set otherwise in the Feeding
--     module (not on feeding / a different amount). It is billed and paid in the Feeding module, never on an invoice;
--   * sibling discount on tuition only, per parent: 1st and 2nd child pay full, 3rd pays half, 4th and later are free
--     (children ordered by when they were admitted). A scholarship applies instead if it is bigger.
-- Idempotent: nobody is billed twice for the same account and term.
-- =====================================================================================================

-- ---------- Classes: Creche, Nursery 1–2 before KG; Primary N is called Class N ----------
update public.classes set position = position + 100;
insert into public.classes (name, level, position) values ('Creche', 'Creche', 101), ('Nursery 1', 'Nursery', 102), ('Nursery 2', 'Nursery', 103)
  on conflict (name) do nothing;
update public.classes set position = case name when 'Creche' then 1 when 'Nursery 1' then 2 when 'Nursery 2' then 3 else position - 97 end;
update public.classes set name = replace(name, 'Primary ', 'Class ') where name like 'Primary %';

-- ---------- Which levels take which activity ----------
alter table public.activities add column if not exists levels public.school_level[] not null default '{}';
update public.activities set levels = '{Kindergarten,Primary}' where name = 'Music (Piano)';
update public.activities set levels = '{Primary,JHS}' where name = 'STEM';
update public.activities set levels = '{Creche,Nursery,Kindergarten,Primary,JHS}' where name = 'Extra Classes';

create or replace function app.enrol_extra_classes() returns trigger
language plpgsql security definer set search_path = public, pg_catalog as $$
begin
  insert into public.student_activities (student_id, term_id, activity)
  select new.id, t.id, a.name from public.terms t, public.activities a, public.classes c
  where t.is_current and c.id = new.class_id and a.default_enrol and c.level = any(a.levels)
  on conflict do nothing;
  return null;
end $$;

-- ---------- Feeding is compulsory: no exception row = on feeding at the level's cost ----------
create or replace function app.feeding_rate(p_student uuid, p_term uuid) returns bigint
language sql stable security definer set search_path = public, pg_catalog as $$
  select case when fe.student_id is null then coalesce(tl.feeding, 0)
              when not fe.on_feeding then 0
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

-- ---------- Sibling discount ----------
-- A student's family: their primary guardian (else the financial one, else any linked guardian).
create or replace function app.family_of(p_student uuid) returns uuid
language sql stable security definer set search_path = public, pg_catalog as $$
  select guardian_id from public.student_guardians where student_id = p_student order by is_primary desc, is_financial desc, guardian_id limit 1
$$;
-- 3rd child 50 %, 4th and later 100 % (of tuition), counting the family's active children in order of admission.
create or replace function app.sibling_percent(p_student uuid) returns int
language sql stable security definer set search_path = public, pg_catalog as $$
  with fam as (select app.family_of(p_student) as g),
  kids as (select s.id, row_number() over (order by s.admitted_on nulls last, s.admission_no, s.id) as rn
           from public.students s, fam where fam.g is not null and s.status = 'Active' and app.family_of(s.id) = fam.g)
  select coalesce((select case when rn >= 4 then 100 when rn = 3 then 50 else 0 end from kids where id = p_student), 0)
$$;
-- The tuition discount: the bigger of the scholarship and the sibling discount.
create or replace function app.tuition_discount_percent(p_student uuid) returns numeric
language sql stable security definer set search_path = public, pg_catalog as $$
  select greatest(coalesce(scholarship_percent, 0), app.sibling_percent(id)) from public.students where id = p_student
$$;
grant execute on function app.family_of(uuid), app.sibling_percent(uuid), app.tuition_discount_percent(uuid) to authenticated;

-- ---------- Billing one student for one term ----------
create or replace function app.bill_student(p_student uuid, p_term uuid) returns int
language plpgsql security definer set search_path = public, pg_catalog as $$
declare t record; s record; inv uuid; tuition bigint; n int := 0; billed date; acc public.fee_account;
begin
  select * into t from public.terms where id = p_term; if not found then return 0; end if;
  select st.id, st.class_id, st.admitted_on, st.status, c.level into s from public.students st join public.classes c on c.id = st.class_id where st.id = p_student;
  if not found or s.status <> 'Active' then return 0; end if;
  billed := greatest(t.starts_on, least(coalesce(s.admitted_on, current_date), current_date));

  -- Compulsory activities for the student's level.
  insert into public.student_activities (student_id, term_id, activity)
  select s.id, t.id, a.name from public.activities a where a.default_enrol and s.level = any(a.levels)
  on conflict do nothing;

  perform set_config('app.invoice_fn', 'on', true);
  -- School fees: the level's lines (class exceptions replace by name, or are added); never feeding; 0 lines left off.
  if not exists (select 1 from public.invoices where student_id = s.id and term_id = t.id and account = 'fees' and status <> 'void')
     and exists (select 1 from public.term_fee_items where term_id = t.id and level = s.level and amount > 0 and label <> 'Feeding'
                 union all select 1 from public.class_fee_overrides where term_id = t.id and class_id = s.class_id and amount > 0 and label <> 'Feeding') then
    insert into public.invoices (account, student_id, term_id, billed_on, due_on) values ('fees', s.id, t.id, billed, billed + 28) returning id into inv;
    insert into public.invoice_lines (invoice_id, label, amount, position)
    select inv, x.label, x.amount, row_number() over (order by x.pos, x.label) - 1
    from (
      select i.label, coalesce(o.amount, i.amount) as amount, i.position as pos
      from public.term_fee_items i left join public.class_fee_overrides o on o.term_id = t.id and o.class_id = s.class_id and o.label = i.label
      where i.term_id = t.id and i.level = s.level
      union all
      select o.label, o.amount, 1000 from public.class_fee_overrides o
      where o.term_id = t.id and o.class_id = s.class_id and not exists (select 1 from public.term_fee_items i where i.term_id = t.id and i.level = s.level and i.label = o.label)
    ) x where x.amount > 0 and x.label <> 'Feeding';
    select coalesce(sum(amount), 0) into tuition from public.invoice_lines where invoice_id = inv and label = 'Tuition';
    update public.invoices set status = 'issued', no = app.next_no('INV-' || app.term_code(t.id), 4), approved_at = now(),
           discount = round(tuition * app.tuition_discount_percent(s.id) / 100) where id = inv;
    n := n + 1;
  end if;

  -- Extracurricular and Extra Classes: one bill each, for the activities the student is enrolled in this term.
  foreach acc in array array['extra', 'classes']::public.fee_account[] loop
    if not exists (select 1 from public.invoices where student_id = s.id and term_id = t.id and account = acc and status <> 'void')
       and exists (select 1 from public.student_activities sa join public.activities a on a.name = sa.activity and a.account = acc
                   join public.activity_prices p on p.term_id = t.id and p.activity = sa.activity and p.amount > 0
                   where sa.student_id = s.id and sa.term_id = t.id) then
      insert into public.invoices (account, student_id, term_id, billed_on, due_on) values (acc, s.id, t.id, billed, billed + 28) returning id into inv;
      insert into public.invoice_lines (invoice_id, label, amount, position)
      select inv, sa.activity, p.amount, row_number() over (order by sa.activity) - 1
      from public.student_activities sa join public.activities a on a.name = sa.activity and a.account = acc
      join public.activity_prices p on p.term_id = t.id and p.activity = sa.activity and p.amount > 0
      where sa.student_id = s.id and sa.term_id = t.id;
      update public.invoices set status = 'issued', approved_at = now(),
             no = app.next_no(case acc when 'extra' then 'EXC-' else 'XCL-' end || app.term_code(t.id), 4) where id = inv;
      n := n + 1;
    end if;
  end loop;
  perform set_config('app.invoice_fn', 'off', true);
  return n;
end $$;
revoke all on function app.bill_student(uuid, uuid) from public, anon;
grant execute on function app.bill_student(uuid, uuid) to authenticated;

-- Every active student, once the current term has started (the app calls this whenever staff load the system,
-- and after fees are saved). Returns the number of bills issued.
create or replace function public.bill_current_term() returns int
language plpgsql security definer set search_path = public, pg_catalog as $$
declare t record; s record; n int := 0;
begin
  if app.my_role() is null then raise exception 'Sign in first' using errcode = '42501'; end if;
  select * into t from public.terms where is_current and starts_on <= current_date and ends_on >= current_date;
  if not found then return 0; end if;
  perform pg_advisory_xact_lock(hashtext('bill_current_term'));
  for s in select st.id from public.students st join public.classes c on c.id = st.class_id where st.status = 'Active' order by c.position, st.admitted_on, st.admission_no loop
    n := n + app.bill_student(s.id, t.id);
  end loop;
  return n;
end $$;
revoke all on function public.bill_current_term() from public, anon;
grant execute on function public.bill_current_term() to authenticated;

-- Fee changes after billing: discounts follow the same rule (scholarship or sibling discount).
create or replace function public.amend_term_invoices(p_term uuid) returns int
language plpgsql security definer set search_path = public, pg_catalog as $$
declare r record; before bigint; after bigint; tuition bigint; n int := 0;
begin
  if not app.has_role('owner') then raise exception 'Only the Owner can change billed fees' using errcode = '42501'; end if;
  perform set_config('app.invoice_fn', 'on', true);
  for r in select i.id, i.student_id, s.class_id, c.level from public.invoices i join public.students s on s.id = i.student_id join public.classes c on c.id = s.class_id
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
    update public.invoices set discount = round(tuition * app.tuition_discount_percent(r.student_id) / 100), updated_at = now() where id = r.id;
    after := app.invoice_total(r.id);
    if after <> before then n := n + 1; end if;
  end loop;
  for r in select i.id from public.invoices i where i.term_id = p_term and i.account in ('extra', 'classes') and i.status = 'issued' loop
    before := app.invoice_total(r.id);
    update public.invoice_lines l set amount = p.amount from public.activity_prices p
     where l.invoice_id = r.id and p.term_id = p_term and p.activity = l.label and p.amount > 0 and l.amount <> p.amount;
    if app.invoice_total(r.id) <> before then n := n + 1; end if;
  end loop;
  perform set_config('app.invoice_fn', 'off', true);
  return n;
end $$;

-- ---------- Registration bills the new student at once ----------
create or replace function public.register_student(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_catalog'
AS $function$
declare sid uuid; adm text; g jsonb; gid uuid; t text;
begin
  if not app.has_role('owner', 'admin') then
    raise exception 'Only the Owner or an Administrator can register students' using errcode = '42501';
  end if;
  if coalesce(trim(p->>'first_name'), '') = '' or coalesce(trim(p->>'last_name'), '') = '' then raise exception 'First and last name are required'; end if;
  if nullif(p->>'class_id', '') is null then raise exception 'Choose the class'; end if;
  if (p->>'date_of_birth')::date > current_date then raise exception 'Date of birth cannot be in the future'; end if;
  if jsonb_array_length(coalesce(p->'guardians', '[]')) = 0 and coalesce(trim(p->>'no_guardian_reason'), '') = '' then
    raise exception 'Link at least one guardian, or give the reason for the exception';
  end if;

  adm := app.next_admission_no(nullif(p->>'admitted_on', '')::date);
  insert into public.students (admission_no, first_name, middle_name, last_name, date_of_birth, gender, class_id, admitted_on, nationality,
                               address, previous_school, place_of_birth, emergency_contact_name, emergency_contact_phone, student_code, entry_assessment)
  values (adm, trim(p->>'first_name'), nullif(trim(p->>'middle_name'), ''), trim(p->>'last_name'), nullif(p->>'date_of_birth', '')::date,
          nullif(p->>'gender', ''), (p->>'class_id')::uuid, coalesce(nullif(p->>'admitted_on', '')::date, current_date), nullif(trim(p->>'nationality'), ''),
          nullif(trim(p->>'address'), ''), nullif(trim(p->>'previous_school'), ''), nullif(trim(p->>'place_of_birth'), ''),
          nullif(trim(p->>'emergency_contact_name'), ''), nullif(trim(p->>'emergency_contact_phone'), ''), nullif(trim(p->>'student_code'), ''),
          nullif(trim(p->>'entry_assessment'), ''))
  returning id into sid;

  if coalesce(p->>'allergies', '') <> '' or coalesce(p->>'medical_alert', '') <> '' or coalesce(p->>'emergency_instructions', '') <> '' then
    insert into public.student_medical (student_id, alert, allergies, emergency_instructions)
    values (sid, nullif(trim(p->>'medical_alert'), ''), nullif(trim(p->>'allergies'), ''), nullif(trim(p->>'emergency_instructions'), ''));
  end if;

  for g in select * from jsonb_array_elements(coalesce(p->'guardians', '[]')) loop
    gid := nullif(g->>'id', '')::uuid;
    if gid is null then
      t := trim(coalesce(g->>'name', ''));
      if t = '' or length(regexp_replace(coalesce(g->>'phone', ''), '\D', '', 'g')) < 9 then raise exception 'New guardians need a name and a valid phone number'; end if;
      insert into public.guardians (name, phone, email) values (t, trim(g->>'phone'), nullif(trim(g->>'email'), '')) returning id into gid;
    end if;
    insert into public.student_guardians (student_id, guardian_id, relationship, is_primary, is_legal, is_emergency, can_pickup, is_financial, gets_fee_reminders, gets_academic)
    values (sid, gid, coalesce(nullif(g->>'relationship', ''), 'Parent'), coalesce((g->>'primary')::boolean, false), coalesce((g->>'legal')::boolean, false),
            coalesce((g->>'emergency')::boolean, false), coalesce((g->>'pickup')::boolean, false), coalesce((g->>'financial')::boolean, false),
            coalesce((g->>'reminders')::boolean, false), coalesce((g->>'academic')::boolean, false));
  end loop;

  -- Bill everything for the current term straight away (school fees, Extracurricular, Extra Classes).
  perform app.bill_student(sid, (select id from public.terms where is_current));
  return jsonb_build_object('id', sid, 'admission_no', adm);
end $function$;
