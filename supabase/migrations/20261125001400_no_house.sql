-- The school does not use houses (or sections / streams): the House field is removed from students.
alter table public.students drop column if exists house;
