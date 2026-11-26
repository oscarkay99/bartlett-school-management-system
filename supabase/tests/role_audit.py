#!/usr/bin/env python3
"""
Role audit: for every table / function the app uses, what each role can READ, ADD, CHANGE and DELETE, tested
against the live database and compared with the expected access below. Safe on production:
  * test rows are created inside one transaction that is ROLLED BACK at the end;
  * every individual check also undoes itself (it runs in a sub-transaction that is always rolled back).
Nothing is kept: no rows, no counters, no audit entries.

    python3 supabase/tests/role_audit.py            # from the repo root, with `ssh agent-vps` access
Prints one line per difference between expected and actual, then a summary. Exit code 1 if any differ.

Expected values:  "2" exactly 2 rows seen / changed · ">0" some rows · "ok" statement succeeded · "X" refused (error)
"0" for a change means the role's rules hide the row, so nothing changed (also a refusal).
"""
import subprocess, sys

ROLES = ["owner", "admin", "bursar", "teacher", "storekeeper", "auditor"]
O, A, B, T, S, AU = ROLES

def exp(default, **kw):
    """Expected result per role: default for every role, overridden by keyword (o=, a=, b=, t=, s=, au=)."""
    m = {"o": O, "a": A, "b": B, "t": T, "s": S, "au": AU}
    out = {r: default for r in ROLES}
    for k, v in kw.items(): out[m[k]] = v
    return out

# Fixture ids (created inside the transaction). S_IN is in the teacher's class (Primary 3), S_OUT is not (Primary 5).
S_IN, S_OUT = "a0000000-0000-0000-0000-000000000001", "a0000000-0000-0000-0000-000000000002"
S_DEL = "a0000000-0000-0000-0000-000000000003"   # a student with no records at all (deletable)
G_IN, G_OUT = "a0000000-0000-0000-0000-000000000011", "a0000000-0000-0000-0000-000000000012"
I_IN, I_SUB = "a0000000-0000-0000-0000-000000000021", "a0000000-0000-0000-0000-000000000022"
P_IN = "a0000000-0000-0000-0000-000000000031"
B_IN, B_OUT, B_SUB = "a0000000-0000-0000-0000-000000000041", "a0000000-0000-0000-0000-000000000042", "a0000000-0000-0000-0000-000000000043"
IT, IT2 = "a0000000-0000-0000-0000-000000000051", "a0000000-0000-0000-0000-000000000052"
E_SMALL, E_BIG, E_APPR = "a0000000-0000-0000-0000-000000000061", "a0000000-0000-0000-0000-000000000062", "a0000000-0000-0000-0000-000000000063"
M1, AP, ST, EV, TPL, DOC = ("a0000000-0000-0000-0000-000000000071", "a0000000-0000-0000-0000-000000000072", "a0000000-0000-0000-0000-000000000073",
                            "a0000000-0000-0000-0000-000000000074", "a0000000-0000-0000-0000-000000000075", "a0000000-0000-0000-0000-000000000076")
D1 = "2000-01-03"           # fixture date (no real rows on it)
TERM = "(select id from public.terms where is_current)"
P3, P5 = "(select id from public.classes where name = 'Primary 3')", "(select id from public.classes where name = 'Primary 5')"
two = lambda a, b: f"('{a}','{b}')"

FIXTURES = f"""
insert into public.students (id, admission_no, first_name, last_name, class_id) values ('{S_IN}', 'AUD-1', 'Audit', 'Inside', {P3}), ('{S_OUT}', 'AUD-2', 'Audit', 'Outside', {P5}), ('{S_DEL}', 'AUD-3', 'Audit', 'Delete', {P5});
delete from public.student_activities where student_id = '{S_DEL}';
insert into public.guardians (id, name, phone) values ('{G_IN}', 'Audit Parent In', '0240000001'), ('{G_OUT}', 'Audit Parent Out', '0240000002');
insert into public.student_guardians (student_id, guardian_id, relationship, is_primary) values ('{S_IN}', '{G_IN}', 'Father', true), ('{S_OUT}', '{G_OUT}', 'Mother', true);
insert into public.student_medical (student_id, alert) values ('{S_IN}', 'audit'), ('{S_OUT}', 'audit');
insert into public.invoices (id, account, student_id, term_id) values ('{I_IN}', 'fees', '{S_IN}', {TERM}), ('{I_SUB}', 'fees', '{S_OUT}', {TERM});
insert into public.invoice_lines (invoice_id, label, amount, position) values ('{I_IN}', 'Tuition', 100000, 0), ('{I_SUB}', 'Tuition', 100000, 0);
set local app.invoice_fn = 'on';
update public.invoices set status = 'issued', no = 'AUD-INV-1', billed_on = current_date, due_on = current_date + 28 where id = '{I_IN}';
update public.invoices set status = 'submitted' where id = '{I_SUB}';
set local app.invoice_fn = 'off';
insert into public.payments (id, account, student_id, amount, method, paid_on) values ('{P_IN}', 'fees', '{S_IN}', 40000, 'Cash', current_date);
insert into public.invoice_adjustments (invoice_id, amount, reason) values ('{I_IN}', -100, 'audit');
insert into public.feeding_plans (student_id, term_id, frequency, effective_from) select '{S_IN}', id, 'Weekly', starts_on from public.terms where is_current;
insert into public.feeding_exceptions (student_id, term_id, on_feeding, reason) values ('{S_OUT}', {TERM}, false, 'audit');
insert into public.meal_register (on_date, class_id, served) values ('{D1}', {P3}, 1), ('{D1}', {P5}, 1);
insert into public.attendance (student_id, on_date, status) values ('{S_IN}', '{D1}', 'Present'), ('{S_OUT}', '{D1}', 'Present');
insert into public.grade_batches (id, class_id, subject_id, term_id) values
  ('{B_IN}', {P3}, (select id from public.subjects where level = 'Primary' order by name limit 1), {TERM}),
  ('{B_OUT}', {P5}, (select id from public.subjects where level = 'Primary' order by name limit 1), {TERM}),
  ('{B_SUB}', {P3}, (select id from public.subjects where level = 'Primary' order by name offset 1 limit 1), {TERM});
insert into public.grades (batch_id, student_id, ca, exam) values ('{B_IN}', '{S_IN}', 10, 20), ('{B_OUT}', '{S_OUT}', 10, 20), ('{B_SUB}', '{S_IN}', 10, 20);
set local app.grade_fn = 'on'; update public.grade_batches set status = 'Submitted' where id = '{B_SUB}'; set local app.grade_fn = 'off';
insert into public.report_remarks (student_id, term_id, class_teacher_remark) values ('{S_IN}', {TERM}, 'audit'), ('{S_OUT}', {TERM}, 'audit');
insert into public.inventory_items (id, sku, name, category, unit, location, supplier, unit_cost, reorder_level, max_level, kind) values
  ('{IT}', 'AUD-IT-1', 'Audit item', 'Stationery', 'box', 'Store', 'X', 100, 1, 10, 'Consumable'),
  ('{IT2}', 'AUD-IT-2', 'Audit item 2', 'Stationery', 'box', 'Store', 'X', 100, 1, 10, 'Consumable');
insert into public.stock_movements (item_id, on_date, kind, qty, reference) values ('{IT}', '{D1}', 'Received', 5, 'AUD');
insert into public.expenses (id, on_date, category, vendor, description, amount, method, department) values
  ('{E_SMALL}', '{D1}', 'Utilities', 'Audit', 'audit small', 100, 'Cash', 'Operations'),
  ('{E_BIG}', '{D1}', 'Utilities', 'Audit', 'audit big', 99999999999, 'Cash', 'Operations'),
  ('{E_APPR}', '{D1}', 'Utilities', 'Audit', 'audit approved', 100, 'Cash', 'Operations');
set local app.expense_fn = 'on'; update public.expenses set status = 'Approved' where id = '{E_APPR}'; set local app.expense_fn = 'off';
insert into public.budget_lines (year_id, category, amount) select year_id, 'AUDIT', 100 from public.terms where is_current;
insert into public.messages (id, guardian_id, student_ids, channel, template, body, status) values ('{M1}', '{G_IN}', array['{S_IN}']::uuid[], 'SMS', 'audit', 'audit', 'Recorded');
insert into public.applicants (id, name, guardian_name, guardian_phone) values ('{AP}', 'Audit Applicant', 'P', '0240000003');
insert into public.staff (id, emp_no, name, position, department, employment_type) values ('{ST}', 'AUD-ST', 'Audit Staff', 'Class Teacher', 'Primary', 'Full-time');
insert into public.school_events (id, on_date, title, kind) values ('{EV}', '{D1}', 'audit', 'Event');
insert into public.message_templates (id, name, channel, body) values ('{TPL}', 'audit', 'SMS', 'audit');
insert into public.student_documents (id, student_id, kind, storage_path) values ('{DOC}', '{S_IN}', 'audit', 'audit/x');
insert into public.invoice_sheets (term_id, kind, class_id, title, period) values ({TERM}, 'extracurricular', null, 'audit', 'audit') on conflict do nothing;
"""

# (name, sql, expected). SELECTs are counted; other statements report rows changed, or X if refused.
C = []
def t(name, sql, e): C.append((name, sql.strip(), e))

# ---------- READ ----------
t("read students (in, out)", f"select 1 from public.students where id in {two(S_IN, S_OUT)}", exp("2", t="1"))
t("read medical (in, out)", f"select 1 from public.student_medical where student_id in {two(S_IN, S_OUT)}", exp("0", o="2", a="2", t="1"))
t("read guardians (in, out)", f"select 1 from public.guardians where id in {two(G_IN, G_OUT)}", exp("2", t="1", s="0"))
t("read guardian links", f"select 1 from public.student_guardians where student_id in {two(S_IN, S_OUT)}", exp("2", t="1", s="0"))
t("read invoices", f"select 1 from public.invoices where id in {two(I_IN, I_SUB)}", exp("2", t="0", s="0"))
t("read invoice lines", f"select 1 from public.invoice_lines where invoice_id in {two(I_IN, I_SUB)}", exp("2", t="0", s="0"))
t("read payments", f"select 1 from public.payments where id = '{P_IN}'", exp("0", o="1", b="1", au="1"))
t("read invoice adjustments", f"select 1 from public.invoice_adjustments where invoice_id = '{I_IN}'", exp("0", o="1", b="1", au="1"))
t("read school-fee balances", f"select 1 from public.student_balances where student_id = '{S_IN}'", exp(">0", t="0", s="0"))
t("read feeding balances", "select 1 from public.student_feeding_balances", exp("ok", t="0", s="0"))  # rows depend on the real feeding rates; who may see them is checked in rls_test.sql
t("read feeding plans", f"select 1 from public.feeding_plans where student_id = '{S_IN}'", exp("1", t="0", s="0"))
t("read feeding exceptions", f"select 1 from public.feeding_exceptions where student_id = '{S_OUT}'", exp("1", t="0", s="0"))
t("read meal register (P3, P5)", f"select 1 from public.meal_register where on_date = '{D1}'", exp("2", t="1"))
t("read attendance (in, out)", f"select 1 from public.attendance where on_date = '{D1}'", exp("0", o="2", a="2", t="1"))
t("read grade batches (in, out, sub)", f"select 1 from public.grade_batches where id in ('{B_IN}','{B_OUT}','{B_SUB}')", exp("0", o="3", a="3", t="2"))
t("read grades", f"select 1 from public.grades where batch_id in ('{B_IN}','{B_OUT}','{B_SUB}')", exp("0", o="3", a="3", t="2"))
t("read report remarks", f"select 1 from public.report_remarks where student_id in {two(S_IN, S_OUT)}", exp("0", o="2", a="2", t="1"))
t("read inventory items", f"select 1 from public.inventory_items where id in {two(IT, IT2)}", exp("0", o="2", s="2", au="2"))
t("read stock movements", f"select 1 from public.stock_movements where item_id = '{IT}'", exp("0", o="1", s="1", au="1"))
t("read expenses", f"select 1 from public.expenses where id in ('{E_SMALL}','{E_BIG}','{E_APPR}')", exp("3", t="0", s="0"))
t("read budget", "select 1 from public.budget_lines where category = 'AUDIT'", exp("0", o="1", b="1", au="1"))
t("read messages", f"select 1 from public.messages where id = '{M1}'", exp("1", t="0", s="0"))
t("read message templates", f"select 1 from public.message_templates where id = '{TPL}'", exp("0", o="1", a="1", b="1"))
t("read applicants", f"select 1 from public.applicants where id = '{AP}'", exp("0", o="1", a="1"))
t("read student documents", f"select 1 from public.student_documents where id = '{DOC}'", exp("0", o="1", a="1"))
t("read staff", f"select 1 from public.staff where id = '{ST}'", exp("1"))
t("read staff names", "select 1 from public.staff_names", exp(">0"))
t("read staff logins (all)", "select 1 from public.staff_accounts", exp("1", o=">0"))
t("read events", f"select 1 from public.school_events where id = '{EV}'", exp("1"))
t("read school settings", "select 1 from public.school_settings", exp("1"))
t("read calendar / classes / subjects", "select 1 from public.terms union all select 1 from public.classes union all select 1 from public.subjects", exp(">0"))
t("read fee schedule", f"select 1 from public.term_fee_items where term_id = {TERM}", exp(">0", t="0", s="0"))
# (activity prices: none are set yet, so there is nothing to read)
t("read activity enrolments", f"select 1 from public.student_activities where student_id = '{S_IN}'", exp(">0", t="0", s="0"))
t("read invoice sheets", f"select 1 from public.invoice_sheets where term_id = {TERM}", exp(">0", t="0", s="0"))
t("read audit log", "select 1 from public.audit_log", exp("0", o=">0", au=">0"))

# ---------- STUDENTS & PARENTS ----------
t("register student (function)", f"select public.register_student(jsonb_build_object('first_name','A','last_name','B','class_id',{P3},'guardians',jsonb_build_array(jsonb_build_object('name','P Q','phone','0240000009'))))", exp("X", o="ok", a="ok"))
t("add student directly", f"insert into public.students (admission_no, first_name, last_name, class_id) values ('AUD-9','A','B',{P3})", exp("X", o="ok", a="ok"))
t("edit student", f"update public.students set address = 'x' where id = '{S_IN}'", exp("0", o="1", a="1"))
t("delete student (no records)", f"delete from public.students where id = '{S_DEL}'", exp("0", o="1"))
t("delete student with invoices", f"delete from public.students where id = '{S_OUT}'", exp("0", o="X"))
t("edit medical", f"update public.student_medical set alert = 'x' where student_id = '{S_IN}'", exp("0", o="1", a="1"))
t("add parent", "insert into public.guardians (name, phone) values ('Audit New', '0240000004')", exp("X", o="ok", a="ok", b="ok"))
t("edit parent", f"update public.guardians set address = 'x' where id = '{G_IN}'", exp("0", o="1", a="1", b="1"))
t("delete parent", f"delete from public.guardians where id = '{G_OUT}'", exp("0", o="1"))
t("edit guardian link", f"update public.student_guardians set relationship = 'Guardian' where student_id = '{S_IN}'", exp("0", o="1", a="1", b="1"))
t("unlink guardian", f"delete from public.student_guardians where student_id = '{S_IN}'", exp("0", o="1", a="1", b="1"))
t("add applicant", "insert into public.applicants (name, guardian_name, guardian_phone) values ('A','P','0240000005')", exp("X", o="ok", a="ok"))
t("move applicant", f"update public.applicants set stage = 'Assessment' where id = '{AP}'", exp("0", o="1", a="1"))

# ---------- FEES ----------
t("create draft invoice", f"insert into public.invoices (account, student_id, term_id) values ('extra', '{S_IN}', {TERM})", exp("X", o="ok", b="ok"))
t("second fees invoice, same term", f"insert into public.invoices (account, student_id, term_id) values ('fees', '{S_IN}', {TERM})", exp("X"))
t("edit issued invoice", f"update public.invoices set discount = 1 where id = '{I_IN}'", exp("0", o="X", b="X"))
t("delete issued invoice", f"delete from public.invoices where id = '{I_IN}'", exp("0", o="X", b="X"))
t("add line to issued invoice", f"insert into public.invoice_lines (invoice_id, label, amount, position) values ('{I_IN}', 'X', 1, 9)", exp("X"))
t("approve invoice (function)", f"select public.approve_invoices(array['{I_SUB}']::uuid[])", exp("X", o="ok"))
t("return invoice (function)", f"select public.return_invoice('{I_SUB}', 'audit')", exp("X", o="ok"))
t("void invoice (function)", f"select public.void_invoice('{I_IN}', 'audit reason')", exp("X", o="ok"))
t("record payment", f"insert into public.payments (account, student_id, amount, method, paid_on) values ('fees', '{S_IN}', 100, 'Cash', current_date)", exp("X", o="ok", b="ok"))
t("edit payment", f"update public.payments set amount = 1 where id = '{P_IN}'", exp("0"))
t("delete payment", f"delete from public.payments where id = '{P_IN}'", exp("0"))
t("reverse payment (function)", f"select public.reverse_payment('{P_IN}', 'audit reason')", exp("X", o="ok", b="ok"))
t("request adjustment", f"insert into public.invoice_adjustments (invoice_id, amount, reason) values ('{I_IN}', -1, 'audit adjustment')", exp("X", o="ok", b="ok"))
t("enrol / unenrol activity", f"delete from public.student_activities where student_id = '{S_IN}'", exp("0", o=">0", b=">0"))
# This term already has issued invoices: only the Owner can change its fees (and its invoices then follow, see below).
t("change a billed term's fees", f"update public.term_fee_items set amount = amount where term_id = {TERM}", exp("0", o=">0"))
t("bring billed invoices in line with new fees", f"select public.amend_term_invoices({TERM})", exp("X", o="ok"))
t("save invoice sheet", f"update public.invoice_sheets set notes = notes where term_id = {TERM}", exp("0", o=">0", b=">0"))
t("record reminder message", f"insert into public.messages (guardian_id, student_ids, channel, template, body, status) values ('{G_IN}', array['{S_IN}']::uuid[], 'SMS', 'x', 'x', 'Recorded')", exp("X", o="ok", a="ok", b="ok"))

# ---------- FEEDING ----------
t("set feeding plan", f"insert into public.feeding_plans (student_id, term_id, frequency, effective_from) select '{S_OUT}', id, 'Monthly', starts_on from public.terms where is_current", exp("X", o="ok", a="ok", b="ok"))
t("change feeding exception", f"update public.feeding_exceptions set reason = 'audit check' where student_id = '{S_OUT}'", exp("0", o="1", a="1", b="1"))
t("record meals, teacher's class", f"insert into public.meal_register (on_date, class_id, served) values ('2000-01-04', {P3}, 1)", exp("X", o="ok", a="ok", s="ok", t="ok"))
t("record meals, other class", f"insert into public.meal_register (on_date, class_id, served) values ('2000-01-04', {P5}, 1)", exp("X", o="ok", a="ok", s="ok"))

# ---------- ATTENDANCE & ACADEMICS ----------
t("mark attendance, own class", f"insert into public.attendance (student_id, on_date, status) values ('{S_IN}', '2000-01-04', 'Present')", exp("X", o="ok", a="ok", t="ok"))
t("mark attendance, other class", f"insert into public.attendance (student_id, on_date, status) values ('{S_OUT}', '2000-01-04', 'Present')", exp("X", o="ok", a="ok"))
t("enter grades, own class", f"update public.grades set ca = 11 where batch_id = '{B_IN}'", exp("0", o="1", a="1", t="1"))
t("enter grades, other class", f"update public.grades set ca = 11 where batch_id = '{B_OUT}'", exp("0", o="1", a="1"))
t("submit grades, own class", f"select public.submit_grade_batch('{B_IN}')", exp("X", o="ok", a="ok", t="ok"))
t("submit grades, other class", f"select public.submit_grade_batch('{B_OUT}')", exp("X", o="ok", a="ok"))
t("approve grades", f"select public.decide_grade_batch('{B_SUB}', true, '')", exp("X", o="ok", a="ok"))
t("write report remark, own class", f"update public.report_remarks set class_teacher_remark = 'x' where student_id = '{S_IN}'", exp("0", o="1", a="1", t="1"))
t("write report remark, other class", f"update public.report_remarks set class_teacher_remark = 'x' where student_id = '{S_OUT}'", exp("0", o="1", a="1"))

# ---------- INVENTORY & FINANCE ----------
t("add inventory item", "insert into public.inventory_items (sku, name, category, unit, location, supplier, unit_cost, reorder_level, max_level, kind) values ('AUD-IT-9','x','Stationery','box','S','X',1,1,2,'Consumable')", exp("X", o="ok", s="ok"))
t("edit inventory item", f"update public.inventory_items set location = 'x' where id = '{IT}'", exp("0", o="1", s="1"))
t("delete inventory item", f"delete from public.inventory_items where id = '{IT2}'", exp("0", o="1"))
t("record stock movement", f"insert into public.stock_movements (item_id, on_date, kind, qty, reference) values ('{IT}', current_date, 'Issued', 1, 'x')", exp("X", o="ok", s="ok"))
t("edit stock movement", f"update public.stock_movements set qty = 9 where item_id = '{IT}'", exp("0"))
t("request expense", f"insert into public.expenses (on_date, category, vendor, description, amount, method, department) values (current_date, 'Utilities', 'x', 'x', 100, 'Cash', 'Operations')", exp("X", o="ok", b="ok"))
t("edit pending expense", f"update public.expenses set vendor = 'x' where id = '{E_SMALL}'", exp("0", o="1", b="1"))
t("approve small expense", f"select public.decide_expense('{E_SMALL}', true, '')", exp("X", o="ok", a="ok", b="ok"))
t("approve very large expense", f"select public.decide_expense('{E_BIG}', true, '')", exp("X", o="ok"))
t("mark expense paid", f"select public.mark_expense_paid('{E_APPR}')", exp("X", o="ok", b="ok"))
t("set budget", "insert into public.budget_lines (year_id, category, amount) select year_id, 'AUDIT2', 1 from public.terms where is_current", exp("X", o="ok"))

# ---------- STAFF & SETTINGS ----------
t("add staff record", "insert into public.staff (emp_no, name, position, department, employment_type) values ('AUD-ST-9','x','x','x','Full-time')", exp("X", o="ok", a="ok"))
t("edit staff record", f"update public.staff set phone = 'x' where id = '{ST}'", exp("0", o="1", a="1"))
t("assign teacher to class", f"insert into public.teaching_assignments (staff_id, class_id) values ('{ST}', {P5})", exp("X", o="ok", a="ok"))
t("change someone's role", "update public.staff_accounts set display_name = display_name where role = 'teacher'", exp("0", o="1"))
t("edit school profile", "update public.school_settings set phone = phone", exp("0", o="1"))
t("add academic year", "insert into public.academic_years (name, starts_on, ends_on) values ('2099/2100', '2099-09-01', '2100-07-01')", exp("X", o="ok"))
t("add school event", "insert into public.school_events (on_date, title, kind) values (current_date, 'x', 'Event')", exp("X", o="ok", a="ok"))
t("delete audit log", "delete from public.audit_log", exp("0"))

SQL_HEAD = r"""
\set ON_ERROR_STOP 1
begin;
-- Run one statement as a user; always undone (sub-transaction rolled back). Returns rows counted / changed, or X + error.
create function pg_temp.t(uid uuid, q text) returns text language plpgsql as $$
declare c bigint;
begin
  begin
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
    if q ~* '^\s*select 1 ' then execute 'select count(*) from (' || q || ') x' into c;
    else execute q; get diagnostics c = row_count; end if;
    raise exception 'AUDIT_OK:%', c;
  exception when others then
    if sqlerrm like 'AUDIT_OK:%' then return substr(sqlerrm, 10); end if;
    return 'X ' || left(replace(sqlerrm, E'\n', ' '), 70);
  end;
end $$;
"""

def main():
    uids = dict(l.split("|") for l in subprocess.run(["ssh", "-o", "BatchMode=yes", "agent-vps",
        "sudo docker exec school-db psql -U postgres -tA -c \"select role || '|' || user_id from public.staff_accounts where display_name like '%(QA)'\""],
        capture_output=True, text=True, check=True).stdout.split())
    missing = [r for r in ROLES if r not in uids]
    if missing: sys.exit(f"QA role logins missing: {missing}")
    body = [SQL_HEAD, FIXTURES, "\\pset format unaligned\n\\pset tuples_only on\n"]
    for i, (name, sql, _) in enumerate(C):
        q = sql.replace("'", "''")
        for r in ROLES: body.append(f"select '{i}|{r}|' || pg_temp.t('{uids[r]}', '{q}');")
    body.append("select 'ANON|' || has_table_privilege('anon', 'public.students', 'select')::text;")
    body.append("rollback;")
    out = subprocess.run(["ssh", "-o", "BatchMode=yes", "agent-vps", "sudo docker exec -i school-db psql -U postgres -d postgres -X -q"],
                         input="\n".join(body), capture_output=True, text=True)
    if out.returncode: sys.exit("audit failed to run:\n" + out.stderr[-2000:])
    got = {}
    for line in out.stdout.splitlines():
        p = line.split("|", 2)
        if len(p) == 3 and p[0].isdigit(): got[(int(p[0]), p[1])] = p[2]
        if line.startswith("ANON|"): anon = line.split("|")[1]
    bad = 0
    for i, (name, _, e) in enumerate(C):
        for r in ROLES:
            g = got.get((i, r), "?"); want = e[r]
            ok = (want == "X" and g.startswith("X")) or (want == "ok" and not g.startswith("X")) or (want == ">0" and g.isdigit() and int(g) > 0) or g == want
            if not ok: bad += 1; print(f"DIFF  {name:38} {r:12} expected {want:4} got {g}")
    if anon != "false": bad += 1; print("DIFF  anon can read students")
    print(f"\n{len(C)} checks x {len(ROLES)} roles = {len(C) * len(ROLES)} results, {bad} differences. Everything rolled back.")
    sys.exit(1 if bad else 0)

if __name__ == "__main__":
    main()
