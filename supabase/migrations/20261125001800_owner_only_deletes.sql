-- =====================================================================================================
-- Role audit fix: deleting a student, a parent or an inventory item is Owner-only, matching the app.
-- Everyone else who manages them can still add and change them (and students are archived, not deleted).
-- =====================================================================================================
drop policy write_admin on public.students;
create policy add_admin on public.students for insert to authenticated with check (app.has_role('owner', 'admin'));
create policy edit_admin on public.students for update to authenticated using (app.has_role('owner', 'admin')) with check (app.has_role('owner', 'admin'));
create policy delete_owner on public.students for delete to authenticated using (app.has_role('owner'));

drop policy write_office on public.guardians;
create policy add_office on public.guardians for insert to authenticated with check (app.has_role('owner', 'admin', 'bursar'));
create policy edit_office on public.guardians for update to authenticated using (app.has_role('owner', 'admin', 'bursar')) with check (app.has_role('owner', 'admin', 'bursar'));
create policy delete_owner on public.guardians for delete to authenticated using (app.has_role('owner'));

drop policy write on public.inventory_items;
create policy add_store on public.inventory_items for insert to authenticated with check (app.has_role('owner', 'storekeeper'));
create policy edit_store on public.inventory_items for update to authenticated using (app.has_role('owner', 'storekeeper')) with check (app.has_role('owner', 'storekeeper'));
create policy delete_owner on public.inventory_items for delete to authenticated using (app.has_role('owner'));
