#!/usr/bin/env python3
"""
Creates (or refreshes) one sign-in per role for the QA site's "tap a role to sign in" page:
owner, admin, bursar, teacher, storekeeper, auditor, each linked to a staff record. The teacher is class
teacher of Primary 3, so the class-only rules can be tried out.

Run ON THE VPS:   sudo python3 role_logins.py            (prints the logins as JSON, for the front-end config)
Remove them:      sudo python3 role_logins.py --remove   (do this, and switch the role buttons off, before real use)

These passwords end up in the public website, so anyone can use them: they are for testing only.
"""
import json, secrets, subprocess, sys, urllib.error, urllib.request

API = "http://127.0.0.1:8100"
env = dict(l.rstrip("\n").split("=", 1) for l in open("/opt/supabase-school/app/.env") if "=" in l and not l.startswith("#"))
SRV = env["SERVICE_ROLE_KEY"]
DOMAIN = "bartlett-qa.invalid"
ROLES = {  # role -> (display name, staff position, department)
    "owner": ("Owner (QA)", "Proprietor", "Administration"), "admin": ("Administrator (QA)", "Administrator", "Administration"),
    "bursar": ("Bursar (QA)", "Bursar", "Administration"), "teacher": ("Teacher (QA)", "Class Teacher", "Primary"),
    "storekeeper": ("Storekeeper (QA)", "Storekeeper", "Administration"), "auditor": ("Auditor (QA)", "Auditor", "Administration"),
}

def call(method, path, body=None):
    req = urllib.request.Request(API + path, method=method, data=None if body is None else json.dumps(body).encode(),
                                 headers={"apikey": SRV, "Authorization": f"Bearer {SRV}", "Content-Type": "application/json", "Prefer": "return=representation"})
    try:
        with urllib.request.urlopen(req, timeout=20) as r: raw = r.read(); return r.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as e: return e.code, e.read().decode()[:300]

def sql(q):
    r = subprocess.run(["docker", "exec", "-i", "school-db", "psql", "-U", "postgres", "-tA", "-v", "ON_ERROR_STOP=1", "-c", q], capture_output=True, text=True)
    if r.returncode: sys.exit(r.stderr)
    return r.stdout.strip()

_, users = call("GET", "/auth/v1/admin/users?per_page=1000")
existing = {u["email"]: u["id"] for u in users.get("users", [])}

if "--remove" in sys.argv:
    for r in ROLES:
        if f"{r}@{DOMAIN}" in existing: call("DELETE", f"/auth/v1/admin/users/{existing[f'{r}@{DOMAIN}']}")
    sql("delete from public.staff where emp_no like 'QA-%'")
    print("QA role logins removed"); sys.exit()

out = {}
for r, (name, position, dept) in ROLES.items():
    email, pw = f"{r}@{DOMAIN}", secrets.token_urlsafe(15)
    if email in existing:
        uid = existing[email]; s, u = call("PUT", f"/auth/v1/admin/users/{uid}", {"password": pw})
    else:
        s, u = call("POST", "/auth/v1/admin/users", {"email": email, "password": pw, "email_confirm": True}); uid = u["id"] if isinstance(u, dict) else None
    if s not in (200, 201) or not uid: sys.exit(f"{r}: {s} {u}")
    emp = f"QA-{r.upper()}"
    sql(f"""insert into public.staff (emp_no, name, position, department, employment_type) values ('{emp}', '{name}', '{position}', '{dept}', 'Full-time')
            on conflict (emp_no) do update set name = excluded.name, position = excluded.position;
            insert into public.staff_accounts (user_id, staff_id, role, display_name) select '{uid}', id, '{r}', '{name}' from public.staff where emp_no = '{emp}'
            on conflict (user_id) do update set role = excluded.role, staff_id = excluded.staff_id, display_name = excluded.display_name, active = true;""")
    out[r] = {"email": email, "password": pw, "name": name}

sql("""insert into public.teaching_assignments (staff_id, class_id) select s.id, c.id from public.staff s, public.classes c
       where s.emp_no = 'QA-TEACHER' and c.name = 'Primary 3' on conflict do nothing""")
print(json.dumps(out))
