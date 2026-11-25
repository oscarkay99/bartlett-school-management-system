-- =====================================================================================================
-- Extra Classes is its own account again, separate from Extracurricular (Music (Piano), STEM) and from
-- school fees. Step 1: the new account value. (Postgres only lets a new enum value be used after the
-- transaction that adds it commits, so everything that uses it is in the next migration.)
-- =====================================================================================================
alter type public.fee_account add value if not exists 'classes';
