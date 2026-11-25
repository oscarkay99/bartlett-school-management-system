-- =====================================================================================================
-- Student registration from the app, in one transaction: the student, any new guardians, the guardian links
-- and medical details either all save or none do. The function runs with the caller's rights (security invoker),
-- so the table rules still decide: only the Owner or an Administrator can register a student.
-- =====================================================================================================

-- Fields the registration form collects.
alter table public.students add column if not exists place_of_birth text;
alter table public.students add column if not exists emergency_contact_name text;
alter table public.students add column if not exists emergency_contact_phone text;
alter table public.students add column if not exists student_code text;
alter table public.students add column if not exists entry_assessment text;

-- Admission numbers: BMS/<yy of admission>/<4-digit sequence per year>, e.g. BMS/26/0001.
create or replace function app.next_admission_no(p_admitted date) returns text
language plpgsql security definer set search_path = public, pg_catalog as $$
declare yy text := to_char(coalesce(p_admitted, current_date), 'YY'); n int;
begin
  insert into public.doc_counters (stem, last_no) values ('ADM/' || yy, 1)
  on conflict (stem) do update set last_no = doc_counters.last_no + 1 returning last_no into n;
  return 'BMS/' || yy || '/' || lpad(n::text, 4, '0');
end $$;
revoke all on function app.next_admission_no(date) from public;
grant execute on function app.next_admission_no(date) to authenticated;   -- callable from SQL only: the app schema is not exposed by the API

create or replace function public.register_student(p jsonb) returns jsonb
language plpgsql security invoker set search_path = public, pg_catalog as $$
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

  return jsonb_build_object('id', sid, 'admission_no', adm);
end $$;
revoke all on function public.register_student(jsonb) from public, anon;
grant execute on function public.register_student(jsonb) to authenticated;
