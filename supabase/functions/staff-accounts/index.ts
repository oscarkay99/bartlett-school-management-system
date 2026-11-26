// Staff logins, managed by the Owner from Settings → Staff logins.
// Creating or changing a login needs the server's admin key, which never leaves the server: the browser sends the
// Owner's own sign-in token, this function checks it belongs to an active Owner, then acts with the admin key.
//
// POST { action: "list" }
// POST { action: "create", email, password, role, name, staffId? }
// POST { action: "update", userId, role?, name?, active? }
// POST { action: "password", userId, password }
const URL_ = Deno.env.get("SUPABASE_URL")!;                    // internal API gateway
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const ADMIN = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ORIGINS = ["https://oscarkay99.github.io", "http://localhost:8765"];
const ROLES = ["owner", "admin", "bursar", "teacher", "storekeeper", "auditor"];

const cors = (req: Request) => {
  const o = req.headers.get("origin") ?? "";
  return { "Access-Control-Allow-Origin": ORIGINS.includes(o) ? o : ORIGINS[0], "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS", "Vary": "Origin" };
};
const admin = (path: string, init: RequestInit = {}) => fetch(URL_ + path, { ...init, headers: { apikey: ADMIN, Authorization: `Bearer ${ADMIN}`, "Content-Type": "application/json", Prefer: "return=representation", ...(init.headers ?? {}) } });

Deno.serve(async (req) => {
  const h = cors(req);
  const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: h });
  if (req.method === "OPTIONS") return new Response(null, { headers: h });
  if (req.method !== "POST") return reply({ error: "POST only" }, 405);

  // 1. Who is calling? (their own sign-in token, checked by the sign-in service)
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const me = await fetch(URL_ + "/auth/v1/user", { headers: { apikey: ANON, Authorization: `Bearer ${token}` } });
  if (!token || !me.ok) return reply({ error: "Please sign in again." }, 401);
  const { id: callerId } = await me.json();
  const acc = await (await admin(`/rest/v1/staff_accounts?user_id=eq.${callerId}&select=role,active`)).json();
  if (!Array.isArray(acc) || acc[0]?.role !== "owner" || !acc[0]?.active) return reply({ error: "Only the Owner can manage staff logins." }, 403);

  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return reply({ error: "Bad request" }, 400); }
  const str = (k: string) => (typeof b[k] === "string" ? (b[k] as string).trim() : "");
  const owners = async () => (await (await admin("/rest/v1/staff_accounts?role=eq.owner&active=is.true&select=user_id")).json() as { user_id: string }[]).map((x) => x.user_id);

  if (b.action === "list") {
    const [u, a] = await Promise.all([admin("/auth/v1/admin/users?per_page=1000").then((r) => r.json()), admin("/rest/v1/staff_accounts?select=*").then((r) => r.json())]);
    const users = new Map(((u.users ?? []) as { id: string; email: string; last_sign_in_at?: string }[]).map((x) => [x.id, x]));
    return reply({ accounts: (a as Record<string, unknown>[]).map((x) => ({ userId: x.user_id, email: users.get(x.user_id as string)?.email ?? "", role: x.role, name: x.display_name, active: x.active,
      staffId: x.staff_id, lastSignIn: users.get(x.user_id as string)?.last_sign_in_at ?? null })) });
  }

  if (b.action === "create") {
    const email = str("email").toLowerCase(), password = str("password"), role = str("role"), name = str("name"), staffId = str("staffId") || null;
    if (!/^\S+@\S+\.\S+$/.test(email)) return reply({ error: "Enter a valid email address." }, 400);
    if (password.length < 10) return reply({ error: "The password must be at least 10 characters." }, 400);
    if (!ROLES.includes(role)) return reply({ error: "Choose a role." }, 400);
    if (!name) return reply({ error: "Enter the person's name." }, 400);
    const r = await admin("/auth/v1/admin/users", { method: "POST", body: JSON.stringify({ email, password, email_confirm: true }) });
    const u = await r.json();
    if (!r.ok) return reply({ error: /already/i.test(JSON.stringify(u)) ? "That email already has a login." : (u.msg ?? u.message ?? "Could not create the login.") }, 400);
    const s = await admin("/rest/v1/staff_accounts", { method: "POST", body: JSON.stringify({ user_id: u.id, role, display_name: name, staff_id: staffId, active: true }) });
    if (!s.ok) { await admin(`/auth/v1/admin/users/${u.id}`, { method: "DELETE" }); return reply({ error: "Could not save the role." }, 400); }
    return reply({ ok: true, userId: u.id });
  }

  if (b.action === "update") {
    const userId = str("userId"); const patch: Record<string, unknown> = {};
    if (str("role")) { if (!ROLES.includes(str("role"))) return reply({ error: "Unknown role." }, 400); patch.role = str("role"); }
    if (str("name")) patch.display_name = str("name");
    if (typeof b.active === "boolean") patch.active = b.active;
    // Never leave the school without an active Owner.
    const o = await owners();
    if (o.includes(userId) && o.length === 1 && (patch.active === false || (patch.role && patch.role !== "owner"))) return reply({ error: "This is the only active Owner. Add another Owner first." }, 400);
    const r = await admin(`/rest/v1/staff_accounts?user_id=eq.${userId}`, { method: "PATCH", body: JSON.stringify(patch) });
    if (!r.ok) return reply({ error: "Could not update the login." }, 400);
    // A deactivated login is also signed out of the sign-in service (banned until reactivated).
    if (typeof patch.active === "boolean") await admin(`/auth/v1/admin/users/${userId}`, { method: "PUT", body: JSON.stringify({ ban_duration: patch.active ? "none" : "876000h" }) });
    return reply({ ok: true });
  }

  if (b.action === "password") {
    const userId = str("userId"), password = str("password");
    if (password.length < 10) return reply({ error: "The password must be at least 10 characters." }, 400);
    const r = await admin(`/auth/v1/admin/users/${userId}`, { method: "PUT", body: JSON.stringify({ password }) });
    return r.ok ? reply({ ok: true }) : reply({ error: "Could not set the password." }, 400);
  }
  return reply({ error: "Unknown action" }, 400);
});
