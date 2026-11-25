-- =====================================================================================================
-- RLS and business-rule tests. Run inside a transaction that is rolled back, after the migrations:
--   begin; <migrations>; \i rls_test.sql; rollback;
-- Prints one row per check: PASS/FAIL. Any FAIL must be fixed before migrating for real.
-- =====================================================================================================
set client_min_messages = warning;

-- Run SQL as a given user (or anon when uid is null). Returns the row count, or -1 if the statement errored.
create function pg_temp.n(uid uuid, q text) returns bigint language plpgsql as $$
declare c bigint;
begin
  begin
    perform set_config('role', case when uid is null then 'anon' else 'authenticated' end, true);
    perform set_config('request.jwt.claims', case when uid is null then '{"role":"anon"}' else json_build_object('sub', uid, 'role', 'authenticated')::text end, true);
    execute 'select count(*) from (' || q || ') x' into c;
    perform set_config('role', 'none', true);
    return c;
  exception when others then return -1; end;
end $$;
-- Run a statement as a user; returns null on success or the error message.
create function pg_temp.err(uid uuid, q text) returns text language plpgsql as $$
begin
  begin
    perform set_config('role', case when uid is null then 'anon' else 'authenticated' end, true);
    perform set_config('request.jwt.claims', case when uid is null then '{"role":"anon"}' else json_build_object('sub', uid, 'role', 'authenticated')::text end, true);
    execute q;
    perform set_config('role', 'none', true);
    return null;
  exception when others then return sqlerrm; end;
end $$;
create temp table results (n serial, name text, ok boolean, detail text);
create function pg_temp.check(name text, ok boolean, detail text default null) returns void language sql as $$ insert into results (name, ok, detail) values (name, coalesce(ok, false), detail) $$;

-- ---------- Structural ----------
select pg_temp.check('every public table has RLS enabled',
  not exists (select 1 from pg_class c join pg_namespace s on s.oid = c.relnamespace where s.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity),
  (select string_agg(relname, ', ') from pg_class c join pg_namespace s on s.oid = c.relnamespace where s.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity));
select pg_temp.check('anon has no privileges on any public table or view',
  not exists (select 1 from information_schema.role_table_grants where grantee = 'anon' and table_schema = 'public'),
  (select string_agg(distinct table_name, ', ') from information_schema.role_table_grants where grantee = 'anon' and table_schema = 'public'));
create table public._rls_probe (x int);
select pg_temp.check('a table created later gets RLS automatically', (select relrowsecurity from pg_class where oid = 'public._rls_probe'::regclass));
drop table public._rls_probe;

-- ---------- Test data (as the migration owner) ----------
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'owner@t', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000a2', 'admin@t', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000a3', 'bursar@t', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000a4', 'teacher@t', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000a5', 'store@t', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000a6', 'auditor@t', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000a7', 'stranger@t', 'authenticated', 'authenticated');
insert into public.staff (id, emp_no, name, position, department, employment_type) values ('00000000-0000-0000-0000-0000000000b4', 'T1', 'Teacher A', 'Class Teacher', 'Primary', 'Full-time');
insert into public.staff_accounts (user_id, staff_id, role, display_name) values
  ('00000000-0000-0000-0000-0000000000a1', null, 'owner', 'Owner'), ('00000000-0000-0000-0000-0000000000a2', null, 'admin', 'Admin'),
  ('00000000-0000-0000-0000-0000000000a3', null, 'bursar', 'Bursar'), ('00000000-0000-0000-0000-0000000000a4', '00000000-0000-0000-0000-0000000000b4', 'teacher', 'Teacher A'),
  ('00000000-0000-0000-0000-0000000000a5', null, 'storekeeper', 'Store'), ('00000000-0000-0000-0000-0000000000a6', null, 'auditor', 'Auditor');
insert into public.school_settings (name, short_name) values ('Test School', 'TS');
insert into public.academic_years (id, name, starts_on, ends_on) values ('00000000-0000-0000-0000-0000000000c1', '2026/2027', '2026-09-07', '2027-07-23');
insert into public.terms (id, year_id, name, starts_on, ends_on, is_current) values ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000c1', 'Term 1', '2026-09-07', '2026-12-18', true);
insert into public.classes (id, name, level, position, class_teacher_id) values
  ('00000000-0000-0000-0000-0000000000d1', 'Primary 3', 'Primary', 1, '00000000-0000-0000-0000-0000000000b4'),
  ('00000000-0000-0000-0000-0000000000d2', 'Primary 4', 'Primary', 2, null);
insert into public.subjects (id, name, level) values ('00000000-0000-0000-0000-0000000000e1', 'Mathematics', 'Primary');
insert into public.students (id, admission_no, first_name, last_name, class_id) values
  ('00000000-0000-0000-0000-0000000000f1', 'A1', 'Ama', 'Mensah', '00000000-0000-0000-0000-0000000000d1'),
  ('00000000-0000-0000-0000-0000000000f2', 'A2', 'Kofi', 'Owusu', '00000000-0000-0000-0000-0000000000d2');
insert into public.student_medical (student_id, alert) values ('00000000-0000-0000-0000-0000000000f1', 'Asthma'), ('00000000-0000-0000-0000-0000000000f2', 'Allergy');
insert into public.term_fee_levels (term_id, level, feeding) values ('00000000-0000-0000-0000-0000000000c2', 'Primary', 60000);
insert into public.term_fee_items (term_id, level, label, amount) values ('00000000-0000-0000-0000-0000000000c2', 'Primary', 'Tuition', 240000);

\set OWNER '''00000000-0000-0000-0000-0000000000a1'''
\set ADMIN '''00000000-0000-0000-0000-0000000000a2'''
\set BURSAR '''00000000-0000-0000-0000-0000000000a3'''
\set TEACHER '''00000000-0000-0000-0000-0000000000a4'''
\set STORE '''00000000-0000-0000-0000-0000000000a5'''
\set AUDITOR '''00000000-0000-0000-0000-0000000000a6'''
\set STRANGER '''00000000-0000-0000-0000-0000000000a7'''

-- ---------- Who sees what ----------
select pg_temp.check('anon (no login) cannot read students', pg_temp.n(null, 'select * from public.students') = -1);
select pg_temp.check('anon cannot read settings', pg_temp.n(null, 'select * from public.school_settings') = -1);
select pg_temp.check('signed-in user with no staff role sees no students', pg_temp.n(:STRANGER, 'select * from public.students') = 0);
select pg_temp.check('signed-in user with no staff role sees no settings', pg_temp.n(:STRANGER, 'select * from public.school_settings') = 0);
select pg_temp.check('owner sees both students', pg_temp.n(:OWNER, 'select * from public.students') = 2);
select pg_temp.check('teacher sees only students in classes they teach', pg_temp.n(:TEACHER, 'select * from public.students') = 1);
select pg_temp.check('teacher sees medical only for own students', pg_temp.n(:TEACHER, 'select * from public.student_medical') = 1);
select pg_temp.check('bursar cannot see medical details', pg_temp.n(:BURSAR, 'select * from public.student_medical') = 0);
select pg_temp.check('storekeeper sees students (to issue items) but no medical', pg_temp.n(:STORE, 'select * from public.students') = 2 and pg_temp.n(:STORE, 'select * from public.student_medical') = 0);
select pg_temp.check('teacher cannot change a student', pg_temp.n(:TEACHER, $q$ select 1 from (select 1) d $q$) = 1 and
  (pg_temp.err(:TEACHER, $q$ update public.students set first_name = 'X' $q$) is null and (select first_name from public.students where admission_no = 'A1') = 'Ama'));
select pg_temp.check('teacher and storekeeper see no fee schedule', pg_temp.n(:TEACHER, 'select * from public.term_fee_items') = 0 and pg_temp.n(:STORE, 'select * from public.term_fee_items') = 0);
select pg_temp.check('only the owner can set fees', pg_temp.err(:BURSAR, $q$ insert into public.term_fee_items (term_id, level, label, amount) values ('00000000-0000-0000-0000-0000000000c2', 'Primary', 'PTA', 5000) $q$) is not null
  and pg_temp.err(:OWNER, $q$ insert into public.term_fee_items (term_id, level, label, amount) values ('00000000-0000-0000-0000-0000000000c2', 'Primary', 'PTA', 5000) $q$) is null);
select pg_temp.check('teacher cannot create an invoice', pg_temp.err(:TEACHER, $q$ insert into public.invoices (account, student_id, term_id) values ('fees', '00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000c2') $q$) is not null);

-- ---------- Invoice lifecycle: draft -> submitted -> Owner approves -> issued ----------
select pg_temp.check('bursar creates a draft invoice with lines',
  pg_temp.err(:BURSAR, $q$ insert into public.invoices (id, account, student_id, term_id) values ('00000000-0000-0000-0000-000000000101', 'fees', '00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000c2') $q$) is null
  and pg_temp.err(:BURSAR, $q$ insert into public.invoice_lines (invoice_id, label, amount, class_rate) values ('00000000-0000-0000-0000-000000000101', 'Tuition', 240000, 240000), ('00000000-0000-0000-0000-000000000101', 'Feeding', 60000, 60000) $q$) is null);
select pg_temp.check('a draft cannot be marked issued directly', pg_temp.err(:OWNER, $q$ update public.invoices set status = 'issued' where id = '00000000-0000-0000-0000-000000000101' $q$) is not null);
select pg_temp.check('bursar submits the draft', pg_temp.err(:BURSAR, $q$ select public.submit_invoices(array['00000000-0000-0000-0000-000000000101'::uuid]) $q$) is null);
select pg_temp.check('…and it is now submitted', (select status from public.invoices where id = '00000000-0000-0000-0000-000000000101') = 'submitted');
select pg_temp.check('bursar cannot approve (Owner only)', pg_temp.err(:BURSAR, $q$ select public.approve_invoices(array['00000000-0000-0000-0000-000000000101'::uuid]) $q$) is not null);
select pg_temp.check('lines cannot change once submitted', pg_temp.err(:BURSAR, $q$ update public.invoice_lines set amount = 1 where invoice_id = '00000000-0000-0000-0000-000000000101' $q$) is not null);
select pg_temp.check('owner returns it with a note', pg_temp.err(:OWNER, $q$ select public.return_invoice('00000000-0000-0000-0000-000000000101', 'Feeding should be half') $q$) is null);
select pg_temp.check('…and it is a draft again', (select status from public.invoices where id = '00000000-0000-0000-0000-000000000101') = 'draft');
select pg_temp.check('bursar resubmits', pg_temp.err(:BURSAR, $q$ select public.submit_invoices(array['00000000-0000-0000-0000-000000000101'::uuid]) $q$) is null);
select pg_temp.check('owner approves', pg_temp.err(:OWNER, $q$ select public.approve_invoices(array['00000000-0000-0000-0000-000000000101'::uuid]) $q$) is null);
select pg_temp.check('…it is issued as INV-2627-T1-0001', (select status = 'issued' and no = 'INV-2627-T1-0001' from public.invoices where id = '00000000-0000-0000-0000-000000000101'),
  (select coalesce(no, 'no number') || ' ' || status from public.invoices where id = '00000000-0000-0000-0000-000000000101'));
select pg_temp.check('issued invoice lines are locked', pg_temp.err(:OWNER, $q$ update public.invoice_lines set amount = 1 where invoice_id = '00000000-0000-0000-0000-000000000101' $q$) is not null);
select pg_temp.check('issued invoice cannot be deleted', pg_temp.err(:OWNER, $q$ delete from public.invoices where id = '00000000-0000-0000-0000-000000000101' $q$) is not null);
select pg_temp.check('a second live invoice for the same student/term/account is refused',
  pg_temp.err(:BURSAR, $q$ insert into public.invoices (account, student_id, term_id) values ('fees', '00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000c2') $q$) is not null);
select pg_temp.check('fee schedule is locked once the term is billed', pg_temp.err(:OWNER, $q$ update public.term_fee_items set amount = 1 $q$) is not null);
select pg_temp.check('a draft invoice can be deleted (with its lines)',
  pg_temp.err(:BURSAR, $q$ insert into public.invoices (id, account, student_id, term_id) values ('00000000-0000-0000-0000-000000000102', 'extra', '00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000c2') $q$) is null
  and pg_temp.err(:BURSAR, $q$ insert into public.invoice_lines (invoice_id, label, amount) values ('00000000-0000-0000-0000-000000000102', 'STEM', 35000) $q$) is null
  and pg_temp.err(:BURSAR, $q$ delete from public.invoices where id = '00000000-0000-0000-0000-000000000102' $q$) is null);

-- ---------- Payments ----------
select pg_temp.check('bursar records a payment', pg_temp.err(:BURSAR, $q$ insert into public.payments (id, account, student_id, amount, method, reference) values ('00000000-0000-0000-0000-000000000201', 'fees', '00000000-0000-0000-0000-0000000000f1', 100000, 'Mobile Money', 'MM123') $q$) is null);
select pg_temp.check('…receipt RCT-00001 assigned and recorded by the bursar', (select receipt_no = 'RCT-00001' and received_by = '00000000-0000-0000-0000-0000000000a3' from public.payments where id = '00000000-0000-0000-0000-000000000201'));
select pg_temp.check('the same MoMo reference cannot be recorded twice',
  pg_temp.err(:BURSAR, $q$ insert into public.payments (account, student_id, amount, method, reference) values ('fees', '00000000-0000-0000-0000-0000000000f1', 100, 'Mobile Money', 'mm123') $q$) is not null);
select pg_temp.err(:OWNER, $q$ update public.payments set amount = 1 $q$), pg_temp.err(:BURSAR, $q$ delete from public.payments $q$);
select pg_temp.check('payments cannot be edited or deleted (owner edit / bursar delete leave it unchanged)', (select count(*) = 1 and min(amount) = 100000 from public.payments));
select pg_temp.check('admin and teacher cannot see payments; auditor can', pg_temp.n(:ADMIN, 'select * from public.payments') = 0 and pg_temp.n(:TEACHER, 'select * from public.payments') = 0 and pg_temp.n(:AUDITOR, 'select * from public.payments') = 1);
select pg_temp.check('auditor cannot record a payment', pg_temp.err(:AUDITOR, $q$ insert into public.payments (account, student_id, amount, method) values ('fees', '00000000-0000-0000-0000-0000000000f1', 5, 'Cash') $q$) is not null);
select pg_temp.check('balance = issued invoice - payment (3,000 - 1,000 = 2,000)', (select balance from public.student_balances where student_id = '00000000-0000-0000-0000-0000000000f1' and account = 'fees') = 200000);
select pg_temp.check('admin sees balances (who owes) without seeing payments', pg_temp.n(:ADMIN, 'select * from public.student_balances') = 1);
select pg_temp.check('teacher sees no balances', pg_temp.n(:TEACHER, 'select * from public.student_balances') = 0);
select pg_temp.check('reversal without a reason is refused', pg_temp.err(:BURSAR, $q$ select public.reverse_payment('00000000-0000-0000-0000-000000000201', '') $q$) is not null);
select pg_temp.check('reversal with a reason works', pg_temp.err(:BURSAR, $q$ select public.reverse_payment('00000000-0000-0000-0000-000000000201', 'Cheque bounced') $q$) is null);
select pg_temp.check('…balance back to 3,000 and the payment kept as reversed', (select balance from public.student_balances where student_id = '00000000-0000-0000-0000-0000000000f1' and account = 'fees') = 300000
  and (select status = 'reversed' from public.payments where id = '00000000-0000-0000-0000-000000000201'));
select pg_temp.check('bursar requests an adjustment (with reason)', pg_temp.err(:BURSAR, $q$ insert into public.invoice_adjustments (invoice_id, amount, reason) values ('00000000-0000-0000-0000-000000000101', -30000, 'Half-day feeding') $q$) is null);
select pg_temp.check('…a pending adjustment does not change the balance', (select balance from public.student_balances where student_id = '00000000-0000-0000-0000-0000000000f1' and account = 'fees') = 300000);
select pg_temp.check('…bursar cannot approve it', pg_temp.err(:BURSAR, $q$ select public.decide_adjustment((select id from public.invoice_adjustments limit 1), true) $q$) is not null);
select pg_temp.check('…owner approves it', pg_temp.err(:OWNER, $q$ select public.decide_adjustment((select id from public.invoice_adjustments limit 1), true) $q$) is null);
select pg_temp.check('…balance now 2,700', (select balance from public.student_balances where student_id = '00000000-0000-0000-0000-0000000000f1' and account = 'fees') = 270000);

-- ---------- Audit ----------
select pg_temp.check('changes are recorded in the audit log with the actor', exists (select 1 from public.audit_log where table_name = 'payments' and actor = '00000000-0000-0000-0000-0000000000a3'));
select pg_temp.check('only owner/auditor read the audit log', pg_temp.n(:BURSAR, 'select * from public.audit_log') = 0 and pg_temp.n(:OWNER, 'select * from public.audit_log') > 0);
select pg_temp.check('nobody can delete audit entries', (select count(*) from public.audit_log) = (select count(*) from public.audit_log)
  and pg_temp.err(:OWNER, 'delete from public.audit_log') is null and pg_temp.n(:OWNER, 'select * from public.audit_log') > 0);

-- ---------- Grades ----------
select pg_temp.check('teacher creates a grade batch for own class, not for another class',
  pg_temp.err(:TEACHER, $q$ insert into public.grade_batches (id, class_id, subject_id, term_id) values ('00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000c2') $q$) is null
  and pg_temp.err(:TEACHER, $q$ insert into public.grade_batches (class_id, subject_id, term_id) values ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000c2') $q$) is not null);
select pg_temp.check('teacher enters a grade, submits; grades then locked; admin approves',
  pg_temp.err(:TEACHER, $q$ insert into public.grades (batch_id, student_id, ca, exam) values ('00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-0000000000f1', 30, 50) $q$) is null
  and pg_temp.err(:TEACHER, $q$ select public.submit_grade_batch('00000000-0000-0000-0000-000000000301') $q$) is null
  and pg_temp.err(:TEACHER, $q$ update public.grades set ca = 40 $q$) is not null
  and pg_temp.err(:TEACHER, $q$ select public.decide_grade_batch('00000000-0000-0000-0000-000000000301', true) $q$) is not null
  and pg_temp.err(:ADMIN, $q$ select public.decide_grade_batch('00000000-0000-0000-0000-000000000301', true) $q$) is null);

-- ---------- Expenses & inventory ----------
select pg_temp.check('bursar cannot approve an expense above its limit; owner can',
  pg_temp.err(:BURSAR, $q$ insert into public.expenses (id, category, vendor, amount) values ('00000000-0000-0000-0000-000000000401', 'Repairs', 'Roofer', 1000000) $q$) is null
  and pg_temp.err(:BURSAR, $q$ select public.decide_expense('00000000-0000-0000-0000-000000000401', true) $q$) is not null
  and pg_temp.err(:OWNER, $q$ select public.decide_expense('00000000-0000-0000-0000-000000000401', true) $q$) is null);
select pg_temp.check('storekeeper adds an item and receives 10', pg_temp.err(:STORE, $q$ insert into public.inventory_items (id, sku, name, category, unit, kind) values ('00000000-0000-0000-0000-000000000501', 'S1', 'Chalk', 'Supplies', 'box', 'Consumable') $q$) is null
  and pg_temp.err(:STORE, $q$ insert into public.stock_movements (item_id, kind, qty) values ('00000000-0000-0000-0000-000000000501', 'Received', 10) $q$) is null);
select pg_temp.err(:STORE, $q$ update public.stock_movements set qty = 99 $q$), pg_temp.err(:OWNER, $q$ delete from public.stock_movements $q$);
select pg_temp.check('bursar cannot record stock', pg_temp.err(:BURSAR, $q$ insert into public.stock_movements (item_id, kind, qty) values ('00000000-0000-0000-0000-000000000501', 'Issued', 1) $q$) is not null);
select pg_temp.check('…movements unchanged by edit/delete attempts; on hand = 10', (select on_hand from public.inventory_on_hand where item_id = '00000000-0000-0000-0000-000000000501') = 10
  and (select count(*) from public.stock_movements) = 1);

-- ---------- Feeding ----------
select pg_temp.check('everyone is on feeding at the level rate by default', (select app.feeding_rate('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000c2')) = 60000);
select pg_temp.check('teacher cannot change who is on feeding', pg_temp.err(:TEACHER, $q$ insert into public.feeding_exceptions (student_id, term_id, on_feeding, reason) values ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000c2', false, 'Brings lunch') $q$) is not null);
select pg_temp.check('bursar sets a half-day rate and an opt-out',
  pg_temp.err(:BURSAR, $q$ insert into public.feeding_exceptions (student_id, term_id, on_feeding, rate, reason) values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000c2', true, 30000, 'Half-day') $q$) is null
  and pg_temp.err(:BURSAR, $q$ insert into public.feeding_exceptions (student_id, term_id, on_feeding, reason) values ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000c2', false, 'Brings lunch') $q$) is null);
select pg_temp.check('…rates now 300 (half-day) and 0 (opted out)', (select app.feeding_rate('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000c2')) = 30000
  and (select app.feeding_rate('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000c2')) = 0);
select pg_temp.check('an opted-out student cannot also have a rate', pg_temp.err(:OWNER, $q$ update public.feeding_exceptions set rate = 100 where student_id = '00000000-0000-0000-0000-0000000000f2' $q$) is not null);
select pg_temp.check('feeding summary: Primary 3 has 1 on feeding (300), Primary 4 has 1 not on feeding',
  (select on_feeding = 1 and expected = 30000 from public.feeding_summary where class_name = 'Primary 3' and term_id = '00000000-0000-0000-0000-0000000000c2')
  and (select not_on_feeding = 1 from public.feeding_summary where class_name = 'Primary 4' and term_id = '00000000-0000-0000-0000-0000000000c2'));
select pg_temp.check('teacher records meals for own class only',
  pg_temp.err(:TEACHER, $q$ insert into public.meal_register (on_date, class_id, served) values ('2026-10-01', '00000000-0000-0000-0000-0000000000d1', 16) $q$) is null
  and pg_temp.err(:TEACHER, $q$ insert into public.meal_register (on_date, class_id, served) values ('2026-10-01', '00000000-0000-0000-0000-0000000000d2', 16) $q$) is not null);
select pg_temp.check('kitchen (storekeeper) records any class; bursar cannot',
  pg_temp.err(:STORE, $q$ insert into public.meal_register (on_date, class_id, served) values ('2026-10-01', '00000000-0000-0000-0000-0000000000d2', 15) $q$) is null
  and pg_temp.err(:BURSAR, $q$ insert into public.meal_register (on_date, class_id, served) values ('2026-10-02', '00000000-0000-0000-0000-0000000000d2', 15) $q$) is not null);

-- ---------- Invoice sheets ----------
select pg_temp.check('bursar saves a class sheet and the Extra Classes sheet',
  pg_temp.err(:BURSAR, $q$ insert into public.invoice_sheets (term_id, kind, class_id, title, period, lines) values ('00000000-0000-0000-0000-0000000000c2', 'class', '00000000-0000-0000-0000-0000000000d1', 'Primary 3 School Fees', 'Term 1', '[{"description":"Tuition","amount":240000}]') $q$) is null
  and pg_temp.err(:BURSAR, $q$ insert into public.invoice_sheets (term_id, kind, title, period) values ('00000000-0000-0000-0000-0000000000c2', 'extra_classes', 'Extra Classes', 'Term 1') $q$) is null);
select pg_temp.check('only one Extra Classes sheet per term, and it has no class', pg_temp.err(:OWNER, $q$ insert into public.invoice_sheets (term_id, kind, title, period) values ('00000000-0000-0000-0000-0000000000c2', 'extra_classes', 'x', 'x') $q$) is not null
  and pg_temp.err(:OWNER, $q$ insert into public.invoice_sheets (term_id, kind, class_id, title, period) values ('00000000-0000-0000-0000-0000000000c2', 'extra_classes', '00000000-0000-0000-0000-0000000000d2', 'x', 'x') $q$) is not null);
select pg_temp.check('teacher cannot see invoice sheets', pg_temp.n(:TEACHER, 'select * from public.invoice_sheets') = 0);

-- ---------- Extra classes enrolment & feeding payments ----------
insert into public.activities (name, kindergarten_allowed) values ('Music (Piano)', true), ('Extra Classes', false) on conflict (name) do nothing;
insert into public.classes (id, name, level, position) values ('00000000-0000-0000-0000-0000000000d3', 'KG 1', 'Kindergarten', 0);
insert into public.students (id, admission_no, first_name, last_name, class_id) values
  ('00000000-0000-0000-0000-0000000000f3', 'A3', 'Esi', 'KG', '00000000-0000-0000-0000-0000000000d3'),
  ('00000000-0000-0000-0000-0000000000f4', 'A4', 'Yaw', 'P3', '00000000-0000-0000-0000-0000000000d1');
select pg_temp.check('a new KG student is auto-enrolled in Music only', (select array_agg(activity order by activity) from public.student_activities where student_id = '00000000-0000-0000-0000-0000000000f3') = array['Music (Piano)']);
select pg_temp.check('a new Primary student is auto-enrolled in Music and Extra Classes', (select array_agg(activity order by activity) from public.student_activities where student_id = '00000000-0000-0000-0000-0000000000f4') = array['Extra Classes', 'Music (Piano)']);
select pg_temp.check('bursar records a weekly feeding payment', pg_temp.err(:BURSAR, $q$ insert into public.payments (account, student_id, amount, method, feeding_amount, feeding_period) values ('fees', '00000000-0000-0000-0000-0000000000f1', 50000, 'Cash', 50000, 'Weekly') $q$) is null);
select pg_temp.check('a feeding-only payment must be all feeding', pg_temp.err(:BURSAR, $q$ insert into public.payments (account, student_id, amount, method, feeding_amount, feeding_period) values ('fees', '00000000-0000-0000-0000-0000000000f1', 50000, 'Cash', 100, 'Daily') $q$) is not null);
select pg_temp.check('the feeding part cannot exceed the payment', pg_temp.err(:BURSAR, $q$ insert into public.payments (account, student_id, amount, method, feeding_amount) values ('fees', '00000000-0000-0000-0000-0000000000f1', 100, 'Cash', 200) $q$) is not null);
select pg_temp.check('Extra Classes payments cannot carry feeding', pg_temp.err(:BURSAR, $q$ insert into public.payments (account, student_id, amount, method, feeding_amount) values ('extra', '00000000-0000-0000-0000-0000000000f1', 100, 'Cash', 100) $q$) is not null);
select pg_temp.check('feeding balance: billed 600, paid 500 (weekly), owed 100', (select billed = 60000 and paid = 50000 and balance = 10000 from public.student_feeding_balances where student_id = '00000000-0000-0000-0000-0000000000f1'));
select pg_temp.check('admin sees feeding balances; teacher does not', pg_temp.n(:ADMIN, 'select * from public.student_feeding_balances') = 1 and pg_temp.n(:TEACHER, 'select * from public.student_feeding_balances') = 0);

-- ---------- Report ----------
select n, case when ok then 'PASS' else 'FAIL' end as result, name, coalesce(detail, '') as detail from results order by n;
select count(*) filter (where ok) as passed, count(*) filter (where not ok) as failed from results;
