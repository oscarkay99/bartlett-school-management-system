#!/usr/bin/env python3
"""
End-to-end check of the school database through the real API path: Supabase Auth login -> JWT -> REST API (PostgREST) -> RLS.

Run ON THE VPS (it talks to the local API on 127.0.0.1:8100 and reads keys from the stack's .env):
    sudo python3 supabase/tests/api_e2e.py           # copies of this file live in /tmp on the server
Creates test users/data, checks each role, then removes everything it created (users, rows, audit entries, counters),
so real invoice / receipt numbering still starts at 0001. Keys are never printed.
"""
import json, os, secrets, subprocess, sys, time, urllib.error, urllib.request

API = "http://127.0.0.1:8100"
ENV = "/opt/supabase-school/app/.env"
env = {}
for line in open(ENV):
    if "=" in line and not line.startswith("#"):
        k, v = line.rstrip("\n").split("=", 1); env[k] = v
ANON, SRV = env["ANON_KEY"], env["SERVICE_ROLE_KEY"]
MARK = "school-test.invalid"           # test users' email domain
STARTED = time.strftime("%Y-%m-%d %H:%M:%S", time.gmtime(time.time() - 5))
results = []

def call(method, path, token=None, body=None, key=None, prefer=None):
    key = key or ANON
    h = {"apikey": key, "Content-Type": "application/json", "Authorization": f"Bearer {token or key}"}
    if prefer: h["Prefer"] = prefer
    path = path.replace(" ", "%20").replace('"', "%22")   # e.g. class names with spaces
    req = urllib.request.Request(API + path, method=method, headers=h, data=None if body is None else json.dumps(body).encode())
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            raw = r.read(); return r.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as e:
        raw = e.read();
        try: return e.code, json.loads(raw)
        except Exception: return e.code, raw.decode()[:200]

def srv(method, path, body=None, prefer="return=representation"): return call(method, path, body=body, key=SRV, token=SRV, prefer=prefer)
def check(name, ok, detail=""): results.append((bool(ok), name, detail))
def psql(sql):
    return subprocess.run(["docker", "exec", "-i", "school-db", "psql", "-U", "supabase_admin", "-d", "postgres", "-tA", "-v", "ON_ERROR_STOP=1", "-c", sql],
                          capture_output=True, text=True)

def cleanup():
    # Test users are removed through Auth's own admin API, so their identities / sessions go with them.
    # (Deleting auth.users directly with triggers off left orphan identities that break Auth's email check.)
    s, users = call("GET", "/auth/v1/admin/users?per_page=200", key=SRV, token=SRV)
    for u in (users or {}).get("users", []) if isinstance(users, dict) else []:
        if u.get("email", "").endswith("@" + MARK): call("DELETE", f"/auth/v1/admin/users/{u['id']}", key=SRV, token=SRV)
    sql = f"""
      set session_replication_role = replica;  -- skip the append-only / no-delete guards for this test clean-up only
      delete from public.payments where student_id in (select id from public.students where admission_no like 'TEST-%');
      delete from public.invoice_lines where invoice_id in (select id from public.invoices where student_id in (select id from public.students where admission_no like 'TEST-%'));
      delete from public.invoices where student_id in (select id from public.students where admission_no like 'TEST-%');
      set session_replication_role = origin;   -- students / staff in normal mode, so their plans, enrolments etc. cascade
      delete from public.students where admission_no like 'TEST-%';
      delete from public.staff where emp_no like 'TEST-%';
      set session_replication_role = replica;
      delete from public.doc_counters;
      delete from public.audit_log where at >= '{STARTED}';
      set session_replication_role = origin;
      select (select count(*) from public.students) || ' students, ' || (select count(*) from auth.users) || ' users, '
          || (select count(*) from public.payments) || ' payments, ' || (select count(*) from public.doc_counters) || ' counters, '
          || (select count(*) from auth.identities) || ' identities, ' || (select count(*) from public.feeding_plans) || ' plans, '
          || (select count(*) from public.student_activities) || ' enrolments left';"""
    r = psql(sql); return (r.stdout.strip().splitlines() or [r.stderr.strip()])[-1]

try:
    # ---------- set-up (service key: bypasses RLS, like an admin script would) ----------
    pw = {r: secrets.token_urlsafe(18) for r in ["owner", "admin", "bursar", "teacher", "storekeeper", "auditor", "norole"]}
    uid = {}
    for r in pw:
        s, u = call("POST", "/auth/v1/admin/users", body={"email": f"{r}@{MARK}", "password": pw[r], "email_confirm": True}, key=SRV, token=SRV)
        assert s in (200, 201), f"create user {r}: {s} {u}"; uid[r] = u["id"]
    _, cls = srv("GET", "/rest/v1/classes?select=id,name&name=in.(\"Primary 3\",\"Primary 4\")", prefer=None)
    cid = {c["name"]: c["id"] for c in cls}
    _, terms = srv("GET", "/rest/v1/terms?select=id,name&is_current=eq.true", prefer=None); term = terms[0]["id"]
    _, staff = srv("POST", "/rest/v1/staff", {"emp_no": "TEST-T1", "name": "Test Teacher", "position": "Class Teacher", "department": "Primary", "employment_type": "Full-time"})
    tid = staff[0]["id"]
    for r in uid:
        if r != "norole": srv("POST", "/rest/v1/staff_accounts", {"user_id": uid[r], "role": r, "display_name": f"Test {r}", "staff_id": tid if r == "teacher" else None})
    srv("POST", "/rest/v1/teaching_assignments", {"staff_id": tid, "class_id": cid["Primary 3"]})
    _, st = srv("POST", "/rest/v1/students", [{"admission_no": "TEST-1", "first_name": "Ama", "last_name": "Test", "class_id": cid["Primary 3"]},
                                              {"admission_no": "TEST-2", "first_name": "Kofi", "last_name": "Test", "class_id": cid["Primary 4"]}])
    s1, s2 = st[0]["id"], st[1]["id"]
    srv("POST", "/rest/v1/student_medical", {"student_id": s1, "alert": "Asthma"})

    # ---------- sign in through Auth, like the app will ----------
    tok = {}
    for r in pw:
        s, t = call("POST", "/auth/v1/token?grant_type=password", body={"email": f"{r}@{MARK}", "password": pw[r]})
        tok[r] = t.get("access_token") if isinstance(t, dict) else None
    check("every role can sign in and gets a login token", all(tok.values()), ", ".join(r for r in tok if not tok[r]))
    s, b = call("POST", "/auth/v1/signup", body={"email": f"stranger@{MARK}", "password": secrets.token_urlsafe(16)})
    check("public sign-up is refused", s == 422 and "signup" in json.dumps(b).lower(), str(s))

    TEST = "admission_no=like.TEST-*"
    def n(role, path):
        s, b = call("GET", path, token=tok.get(role)) if role else call("GET", path)
        return len(b) if s == 200 and isinstance(b, list) else -s

    # ---------- who sees what ----------
    check("no login (anon key only): students are refused", n(None, f"/rest/v1/students?{TEST}") < 0)
    check("signed in but no staff role: sees nothing", n("norole", f"/rest/v1/students?{TEST}") == 0)
    check("owner sees both test students", n("owner", f"/rest/v1/students?{TEST}") == 2)
    check("teacher sees only the student in their own class", n("teacher", f"/rest/v1/students?{TEST}") == 1)
    check("teacher sees medical for own student; bursar and storekeeper see none",
          n("teacher", "/rest/v1/student_medical") == 1 and n("bursar", "/rest/v1/student_medical") == 0 and n("storekeeper", "/rest/v1/student_medical") == 0)
    check("teacher and storekeeper see no invoices or payments",
          all(n(r, p) == 0 for r in ("teacher", "storekeeper") for p in ("/rest/v1/invoices", "/rest/v1/payments")))

    # ---------- invoice lifecycle ----------
    s, inv = call("POST", "/rest/v1/invoices", token=tok["bursar"], body={"account": "fees", "student_id": s1, "term_id": term}, prefer="return=representation")
    check("bursar creates a draft invoice", s == 201, str(s)); iid = inv[0]["id"] if s == 201 else None
    s, _ = call("POST", "/rest/v1/invoice_lines", token=tok["bursar"], body=[{"invoice_id": iid, "label": "Tuition", "amount": 240000}, {"invoice_id": iid, "label": "PTA", "amount": 5000}])
    check("bursar adds invoice lines", s == 201, str(s))
    s, _ = call("POST", "/rest/v1/invoices", token=tok["teacher"], body={"account": "fees", "student_id": s1, "term_id": term})
    check("teacher cannot create an invoice", s >= 400, str(s))
    s, _ = call("POST", "/rest/v1/rpc/submit_invoices", token=tok["bursar"], body={"p_ids": [iid]})
    check("bursar submits it for approval", s == 200, str(s))
    s, _ = call("POST", "/rest/v1/rpc/approve_invoices", token=tok["bursar"], body={"p_ids": [iid]})
    check("bursar cannot approve (Owner only)", s >= 400, str(s))
    s, _ = call("POST", "/rest/v1/rpc/approve_invoices", token=tok["owner"], body={"p_ids": [iid]})
    _, got = srv("GET", f"/rest/v1/invoices?id=eq.{iid}&select=no,status", prefer=None)
    check("owner approves: issued with an invoice number", s == 200 and got[0]["status"] == "issued" and got[0]["no"].startswith("INV-"), f"{got[0]['no']} {got[0]['status']}")
    s, _ = call("PATCH", f"/rest/v1/invoice_lines?invoice_id=eq.{iid}", token=tok["owner"], body={"amount": 1})
    check("issued invoice lines are locked", s >= 400, str(s))

    # ---------- payments ----------
    s, p = call("POST", "/rest/v1/payments", token=tok["bursar"], prefer="return=representation",
                body={"account": "fees", "student_id": s1, "amount": 100000, "method": "Mobile Money", "reference": "TEST-MM-1"})
    check("bursar records a payment; receipt number assigned", s == 201 and p[0]["receipt_no"].startswith("RCT-"), str(s))
    pid = p[0]["id"] if s == 201 else None
    call("PATCH", f"/rest/v1/payments?id=eq.{pid}", token=tok["owner"], body={"amount": 1})
    _, again = srv("GET", f"/rest/v1/payments?id=eq.{pid}&select=amount", prefer=None)
    check("payments cannot be edited (amount unchanged)", again[0]["amount"] == 100000)
    s, _ = call("POST", "/rest/v1/payments", token=tok["auditor"], body={"account": "fees", "student_id": s1, "amount": 5, "method": "Cash"})
    check("auditor cannot record a payment", s >= 400, str(s))
    check("admin sees who owes (balance) but not payments",
          n("admin", "/rest/v1/payments") == 0 and n("admin", f"/rest/v1/student_balances?student_id=eq.{s1}") == 1)
    _, bal = call("GET", f"/rest/v1/student_balances?student_id=eq.{s1}&account=eq.fees", token=tok["owner"])
    check("balance = 2,450 billed - 1,000 paid = 1,450", bal and bal[0]["balance"] == 145000, json.dumps(bal)[:80])

    # ---------- feeding ----------
    s, _ = call("POST", "/rest/v1/feeding_plans", token=tok["bursar"], body={"student_id": s2, "term_id": term, "frequency": "Weekly", "effective_from": terms and srv("GET", f"/rest/v1/terms?id=eq.{term}&select=starts_on", prefer=None)[1][0]["starts_on"]})
    check("bursar puts a student on a weekly feeding plan", s == 201, str(s))
    s, _ = call("POST", "/rest/v1/payments", token=tok["bursar"], body={"account": "fees", "student_id": s2, "amount": 4000, "method": "Cash", "feeding_amount": 4000, "feeding_period": "Weekly"})
    _, fb = call("GET", f"/rest/v1/student_balances?student_id=eq.{s2}", token=tok["owner"])
    check("a weekly feeding payment does not count towards school fees", s == 201 and not any(r["paid"] for r in fb), str(s))
    check("teacher cannot see feeding plans", n("teacher", "/rest/v1/feeding_plans") == 0)
    check("new students were auto-enrolled in extracurricular (Music, STEM)", n("owner", f"/rest/v1/student_activities?student_id=in.({s1},{s2})") >= 2)

    # ---------- audit ----------
    _, au = call("GET", f"/rest/v1/audit_log?select=table_name,actor&actor=eq.{uid['bursar']}", token=tok["owner"])
    check("changes are in the audit log, with who made them", isinstance(au, list) and any(a["table_name"] == "payments" for a in au))
    check("bursar cannot read the audit log", n("bursar", "/rest/v1/audit_log") == 0)
finally:
    left = cleanup()

w = max(len(r[1]) for r in results) if results else 10
for ok, name, d in results: print(f"{'PASS' if ok else 'FAIL'}  {name}{('  — ' + d) if (d and not ok) else ''}")
print(f"\n{sum(r[0] for r in results)} passed, {sum(not r[0] for r in results)} failed")
print("clean-up:", left)
sys.exit(0 if all(r[0] for r in results) else 1)
