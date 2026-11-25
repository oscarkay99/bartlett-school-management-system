-- =====================================================================================================
-- Reference data the app needs to start: school name, calendar, classes, subjects, extra classes, grade scale.
-- Safe to run more than once (existing rows are left alone).
-- NOT included on purpose: fee amounts, phone/email, students, staff. The Owner enters those (Settings, imports).
-- =====================================================================================================

insert into public.school_settings (name, short_name, city) values ('Bartlett Montessori School', 'BMS', 'Kumasi, Ashanti Region')
on conflict (id) do nothing;

-- ---------- Calendar: 2026/2027, Term 1 current ----------
insert into public.academic_years (name, starts_on, ends_on) values ('2026/2027', '2026-09-07', '2027-07-23') on conflict (name) do nothing;
insert into public.terms (year_id, name, starts_on, ends_on, is_current)
select y.id, t.name, t.s::date, t.e::date, t.cur
from public.academic_years y,
     (values ('Term 1', '2026-09-07', '2026-12-18', true), ('Term 2', '2027-01-11', '2027-04-08', false), ('Term 3', '2027-05-03', '2027-07-23', false)) as t(name, s, e, cur)
where y.name = '2026/2027'
on conflict (year_id, name) do nothing;

-- ---------- Classes ----------
insert into public.classes (name, level, position) values
  ('KG 1', 'Kindergarten', 1), ('KG 2', 'Kindergarten', 2),
  ('Primary 1', 'Primary', 3), ('Primary 2', 'Primary', 4), ('Primary 3', 'Primary', 5),
  ('Primary 4', 'Primary', 6), ('Primary 5', 'Primary', 7), ('Primary 6', 'Primary', 8),
  ('JHS 1', 'JHS', 9), ('JHS 2', 'JHS', 10), ('JHS 3', 'JHS', 11)
on conflict (name) do nothing;

-- ---------- Subjects per level ----------
insert into public.subjects (name, level)
select s, 'Kindergarten'::public.school_level from unnest(array['Literacy', 'Numeracy', 'Creative Arts', 'Our World Our People']) s
union all select s, 'Primary' from unnest(array['English Language', 'Mathematics', 'Science', 'Ghanaian Language', 'Computing', 'Creative Arts']) s
union all select s, 'JHS' from unnest(array['English Language', 'Mathematics', 'Integrated Science', 'Social Studies', 'RME', 'Computing', 'French']) s
on conflict (name, level) do nothing;

-- ---------- Extra classes offered (prices are set per term in the fee schedule) ----------
insert into public.activities (name, kindergarten_allowed) values ('Music (Piano)', true), ('STEM', false), ('Extra Classes', false)
on conflict (name) do nothing;

-- ---------- Grade scale (total out of 100: CA /40 + exam /60) ----------
insert into public.grade_scale (grade, min_total, label) values ('A', 80, 'Excellent'), ('B', 70, 'Very Good'), ('C', 60, 'Good'), ('D', 50, 'Credit'), ('E', 0, 'Needs Support')
on conflict (grade) do nothing;
