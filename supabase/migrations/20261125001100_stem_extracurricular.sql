-- =====================================================================================================
-- The school's wording: the module is "Extracurricular" (standalone, never added to school fees), and its
-- second activity is "STEM" again (it was briefly called "Extra Classes"). Prices and enrolments follow the
-- rename (on update cascade). The account code stays 'extra'.
-- =====================================================================================================
update public.activities set name = 'STEM' where name = 'Extra Classes';
comment on column public.invoices.account is 'fees = school fees invoice (feeding included for families paying it with the fees); extra = Extracurricular invoice (Music (Piano), STEM), standalone';
