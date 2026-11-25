-- =====================================================================================================
-- The school has no boarders: remove the Day/Boarding category and the boarding fee add-on.
-- (Applied while the database held no students or fees, so no data is lost.)
-- =====================================================================================================
alter table public.students drop column category;
alter table public.term_fee_levels drop column boarding;
-- "Boarding" no longer needs to be reserved as a fee name.
alter table public.term_fee_items drop constraint term_fee_items_label_check;
alter table public.term_fee_items add constraint term_fee_items_label_check check (length(trim(label)) > 0);
