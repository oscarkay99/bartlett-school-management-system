-- =====================================================================================================
-- Client, 2026-11-27: the school also has Creche and Nursery. Levels are now
-- Creche · Nursery (Nursery 1–2) · Kindergarten (KG 1–2) · Primary (Class 1–6) · JHS (JHS 1–3),
-- each with its own fees. (New enum values must be committed before they are used: see 2500.)
-- =====================================================================================================
alter type public.school_level add value if not exists 'Creche' before 'Kindergarten';
alter type public.school_level add value if not exists 'Nursery' before 'Kindergarten';
