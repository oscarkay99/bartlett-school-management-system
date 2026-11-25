-- =====================================================================================================
-- School records: calendar, classes, subjects, teaching assignments, students, guardians, admissions, events.
-- RLS is switched on automatically for every table here (see foundation); policies are at the bottom.
-- =====================================================================================================

-- ---------- Academic calendar ----------
create table public.academic_years (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (name ~ '^\d{4}/\d{4}$'),
  starts_on date not null, ends_on date not null check (ends_on > starts_on),
  created_at timestamptz not null default now()
);
create table public.terms (
  id uuid primary key default gen_random_uuid(),
  year_id uuid not null references public.academic_years(id) on delete restrict,
  name text not null,
  starts_on date not null, ends_on date not null check (ends_on > starts_on),
  is_current boolean not null default false,
  unique (year_id, name)
);
create unique index terms_one_current on public.terms (is_current) where is_current;

-- ---------- Classes, subjects, who teaches what ----------
create table public.classes (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,                 -- e.g. "KG 1", "Primary 3", "JHS 2"
  level public.school_level not null,
  position int not null,                     -- display order
  class_teacher_id uuid references public.staff(id) on delete set null
);
create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  level public.school_level not null,
  unique (name, level)
);
create table public.teaching_assignments (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete cascade,   -- null = class teacher for all subjects
  unique nulls not distinct (staff_id, class_id, subject_id)
);

-- Does the signed-in teacher teach this class?
create or replace function app.teaches(p_class uuid) returns boolean
language sql stable security definer set search_path = public, pg_catalog as $$
  select exists (select 1 from public.teaching_assignments ta where ta.class_id = p_class and ta.staff_id = app.current_staff_id())
      or exists (select 1 from public.classes c where c.id = p_class and c.class_teacher_id = app.current_staff_id())
$$;
grant execute on function app.teaches(uuid) to authenticated;

-- ---------- Guardians & students ----------
create table public.guardians (
  id uuid primary key default gen_random_uuid(),
  title text, name text not null,
  phone text not null, whatsapp text, email text,
  address text, occupation text,
  preferred_channel text not null default 'SMS' check (preferred_channel in ('SMS', 'WhatsApp', 'Email')),
  language text not null default 'English',
  consent_sms boolean not null default false, consent_whatsapp boolean not null default false, consent_email boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.students (
  id uuid primary key default gen_random_uuid(),
  admission_no text not null unique,
  first_name text not null, middle_name text, last_name text not null,
  date_of_birth date, gender text check (gender in ('Male', 'Female')),
  class_id uuid not null references public.classes(id) on delete restrict,
  category text not null default 'Day' check (category in ('Day', 'Boarding')),
  house text,
  status text not null default 'Active' check (status in ('Active', 'Withdrawn', 'Graduated', 'Suspended')),
  admitted_on date, nationality text default 'Ghanaian', address text, previous_school text,
  scholarship text,                                  -- e.g. "Merit Scholarship (25%)"
  scholarship_percent numeric(5,2) not null default 0 check (scholarship_percent between 0 and 100),  -- of tuition
  photo_path text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index students_class_idx on public.students (class_id) where status = 'Active';

-- Medical details are restricted further than the student record (see policies).
create table public.student_medical (
  student_id uuid primary key references public.students(id) on delete cascade,
  alert text, allergies text, emergency_instructions text,
  updated_at timestamptz not null default now()
);

create table public.student_guardians (
  student_id uuid not null references public.students(id) on delete cascade,
  guardian_id uuid not null references public.guardians(id) on delete cascade,
  relationship text not null,
  is_primary boolean not null default false, is_legal boolean not null default false,
  is_emergency boolean not null default false, can_pickup boolean not null default false,
  is_financial boolean not null default false, financial_share numeric(5,2) check (financial_share between 0 and 100),
  gets_fee_reminders boolean not null default false, gets_academic boolean not null default false,
  verified boolean not null default false,
  restriction text,
  primary key (student_id, guardian_id)
);
create unique index student_one_primary_guardian on public.student_guardians (student_id) where is_primary;

create table public.student_documents (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  kind text not null,                               -- Birth certificate, Admission form, ...
  storage_path text,                                -- file in Storage (private bucket)
  received boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------- Admissions ----------
create table public.applicants (
  id uuid primary key default gen_random_uuid(),
  name text not null, class_applied_id uuid references public.classes(id),
  guardian_name text, guardian_phone text,
  stage text not null default 'Submitted' check (stage in ('Submitted', 'Documents Reviewed', 'Assessment', 'Accepted', 'Registered', 'Enrolled', 'Declined')),
  applied_on date not null default current_date,
  student_id uuid references public.students(id),   -- set once enrolled
  notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

-- ---------- School events ----------
create table public.school_events (
  id uuid primary key default gen_random_uuid(),
  on_date date not null, title text not null,
  kind text not null check (kind in ('Exam', 'Holiday', 'Meeting', 'Event'))
);

select app.track(t) from unnest(array['public.academic_years', 'public.terms', 'public.classes', 'public.subjects', 'public.teaching_assignments',
  'public.guardians', 'public.students', 'public.student_medical', 'public.student_guardians', 'public.student_documents',
  'public.applicants', 'public.school_events']::regclass[]) t;

-- =====================================================================================================
-- Policies
-- =====================================================================================================
-- Calendar, classes, subjects, events: every signed-in staff member reads; Owner (calendar) / Owner+Admin (rest) write.
create policy read_all on public.academic_years for select to authenticated using (app.my_role() is not null);
create policy write_owner on public.academic_years for all to authenticated using (app.has_role('owner')) with check (app.has_role('owner'));
create policy read_all on public.terms for select to authenticated using (app.my_role() is not null);
create policy write_owner on public.terms for all to authenticated using (app.has_role('owner')) with check (app.has_role('owner'));
create policy read_all on public.classes for select to authenticated using (app.my_role() is not null);
create policy write_admin on public.classes for all to authenticated using (app.has_role('owner', 'admin')) with check (app.has_role('owner', 'admin'));
create policy read_all on public.subjects for select to authenticated using (app.my_role() is not null);
create policy write_admin on public.subjects for all to authenticated using (app.has_role('owner', 'admin')) with check (app.has_role('owner', 'admin'));
create policy read_all on public.teaching_assignments for select to authenticated using (app.my_role() is not null);
create policy write_admin on public.teaching_assignments for all to authenticated using (app.has_role('owner', 'admin')) with check (app.has_role('owner', 'admin'));
create policy read_all on public.school_events for select to authenticated using (app.my_role() is not null);
create policy write_admin on public.school_events for all to authenticated using (app.has_role('owner', 'admin')) with check (app.has_role('owner', 'admin'));

-- Students: office roles read all; a teacher reads only students in classes they teach; Owner/Admin write.
create policy read_office on public.students for select to authenticated using (app.has_role('owner', 'admin', 'bursar', 'auditor', 'storekeeper'));
create policy read_teacher on public.students for select to authenticated using (app.has_role('teacher') and app.teaches(class_id));
create policy write_admin on public.students for all to authenticated using (app.has_role('owner', 'admin')) with check (app.has_role('owner', 'admin'));

-- Medical: Owner, Admin, and the student's own teachers only (not finance, stores or audit).
create policy read_medical on public.student_medical for select to authenticated using (
  app.has_role('owner', 'admin') or (app.has_role('teacher') and app.teaches((select class_id from public.students s where s.id = student_id))));
create policy write_medical on public.student_medical for all to authenticated using (app.has_role('owner', 'admin')) with check (app.has_role('owner', 'admin'));

-- Guardians and links: office roles read; teachers read those of their students; Owner/Admin/Bursar maintain contacts.
create policy read_office on public.guardians for select to authenticated using (app.has_role('owner', 'admin', 'bursar', 'auditor'));
create policy read_teacher on public.guardians for select to authenticated using (app.has_role('teacher') and exists (
  select 1 from public.student_guardians sg join public.students s on s.id = sg.student_id where sg.guardian_id = guardians.id and app.teaches(s.class_id)));
create policy write_office on public.guardians for all to authenticated using (app.has_role('owner', 'admin', 'bursar')) with check (app.has_role('owner', 'admin', 'bursar'));
create policy read_office on public.student_guardians for select to authenticated using (app.has_role('owner', 'admin', 'bursar', 'auditor'));
create policy read_teacher on public.student_guardians for select to authenticated using (app.has_role('teacher') and app.teaches((select class_id from public.students s where s.id = student_id)));
create policy write_office on public.student_guardians for all to authenticated using (app.has_role('owner', 'admin', 'bursar')) with check (app.has_role('owner', 'admin', 'bursar'));

-- Documents and admissions: Owner and Admin only.
create policy office on public.student_documents for all to authenticated using (app.has_role('owner', 'admin')) with check (app.has_role('owner', 'admin'));
create policy office on public.applicants for all to authenticated using (app.has_role('owner', 'admin')) with check (app.has_role('owner', 'admin'));
