-- Names of staff accounts, so the app can show who recorded a payment, movement or expense ("Received by …").
-- staff_accounts itself stays private (own row / Owner); this view exposes only id -> display name, to signed-in staff.
create or replace view public.staff_names with (security_barrier = true) as
  select a.user_id, a.display_name, a.role from public.staff_accounts a where app.my_role() is not null;
revoke all on public.staff_names from anon;
grant select on public.staff_names to authenticated;
