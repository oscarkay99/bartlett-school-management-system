"use client";
import { useCallback, useEffect, useState } from "react";
import { Copy, KeyRound, Plus, RefreshCw } from "lucide-react";
import { Badge, Button, Card, CardHeader, Field, inputClass } from "@/components/ui/primitives";
import { Modal, useToast } from "@/components/ui/interactive";
import { db, friendlyError } from "@/lib/live/client";
import { useAuth } from "@/lib/live/auth";
import { ROLES } from "@/lib/permissions";
import * as Q from "@/lib/data/queries";
import { fmtDate } from "@/lib/utils";

interface Acc { userId: string; email: string; role: string; name: string; active: boolean; staffId: string | null; lastSignIn: string | null }
const ROLE_KEYS = ["owner", "admin", "bursar", "teacher", "storekeeper", "auditor"];

/** Calls the server function that manages logins (it checks the caller is the Owner). Returns [data, error]. */
async function call<T>(body: Record<string, unknown>): Promise<[T | null, string]> {
  const { data, error } = await db().functions.invoke("staff-accounts", { body });
  if (error) { let m = error.message; try { m = (await (error as { context?: Response }).context?.json())?.error ?? m; } catch {} return [null, friendlyError({ message: m })]; }
  return [data as T, ""];
}
/** A strong temporary password, shown once for the Owner to pass on. */
const tempPassword = () => { const a = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"; const r = crypto.getRandomValues(new Uint32Array(14)); return Array.from(r, (n) => a[n % a.length]).join(""); };

// Owner only: everyone who can sign in, their role, and switching logins on or off.
export function StaffLogins() {
  const toast = useToast(); const { account } = useAuth();
  const [list, setList] = useState<Acc[] | null>(null); const [err, setErr] = useState(""); const [adding, setAdding] = useState(false); const [shown, setShown] = useState<{ email: string; password: string } | null>(null);
  const load = useCallback(async () => { const [d, e] = await call<{ accounts: Acc[] }>({ action: "list" }); setErr(e); if (d) setList(d.accounts.sort((a, b) => a.name.localeCompare(b.name))); }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);
  const update = async (a: Acc, patch: Record<string, unknown>, ok: string) => { const [, e] = await call({ action: "update", userId: a.userId, ...patch }); if (e) toast(`Not saved: ${e}`, "err"); else { toast(ok); void load(); } };
  const reset = async (a: Acc) => { const password = tempPassword(); const [, e] = await call({ action: "password", userId: a.userId, password }); if (e) toast(`Not saved: ${e}`, "err"); else setShown({ email: a.email, password }); };
  return (
    <Card>
      <CardHeader title="Staff logins" sub="Who can sign in and with which role. What each role can see and do is enforced by the database." action={<div className="flex gap-2"><Button size="sm" variant="ghost" onClick={() => load()}><RefreshCw size={14} /></Button><Button size="sm" variant="primary" onClick={() => setAdding(true)}><Plus size={14} />Add login</Button></div>} />
      {err && <p className="px-4 pb-3 text-sm text-danger">{err}</p>}
      {!list ? <p className="px-4 pb-4 text-sm text-muted">Loading…</p> : (
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-surface-2/60 text-xs uppercase text-muted"><tr><th className="px-4 py-2 text-left">Name</th><th className="px-3 text-left">Email</th><th className="px-3 text-left">Role</th><th className="px-3 text-left">Last sign-in</th><th className="px-3 text-left">Status</th><th className="px-4" /></tr></thead>
          <tbody className="divide-y divide-line">{list.map((a) => <tr key={a.userId} className={a.active ? "" : "opacity-60"}>
            <td className="px-4 py-2.5 font-medium">{a.name}{a.userId === account?.userId && <span className="ml-1 text-xs text-muted">(you)</span>}</td><td className="px-3">{a.email}</td>
            <td className="px-3"><select aria-label={`Role of ${a.name}`} className="h-8 rounded-md border border-line bg-surface px-2" value={a.role} onChange={(e) => update(a, { role: e.target.value }, `${a.name} is now ${ROLES[e.target.value].label}`)}>{ROLE_KEYS.map((r) => <option key={r} value={r}>{ROLES[r].label}</option>)}</select></td>
            <td className="px-3 text-muted">{a.lastSignIn ? fmtDate(a.lastSignIn.slice(0, 10)) : "Never"}</td>
            <td className="px-3">{a.active ? <Badge tone="ok">Active</Badge> : <Badge>Switched off</Badge>}</td>
            <td className="whitespace-nowrap px-4 text-right"><button className="mr-3 text-info hover:underline" onClick={() => reset(a)}><KeyRound size={13} className="mr-1 inline" />New password</button>
              <button className={a.active ? "text-danger hover:underline" : "text-ok hover:underline"} onClick={() => update(a, { active: !a.active }, a.active ? `${a.name} can no longer sign in` : `${a.name} can sign in again`)}>{a.active ? "Switch off" : "Switch on"}</button></td></tr>)}</tbody></table></div>)}
      {adding && <AddLogin onClose={() => setAdding(false)} onDone={(email, password) => { setAdding(false); setShown({ email, password }); void load(); }} />}
      <Modal open={!!shown} onClose={() => setShown(null)} title="Give these sign-in details to the staff member" footer={<Button variant="primary" onClick={() => setShown(null)}>Done</Button>}>
        {shown && <div className="space-y-3 text-sm"><p>This password is shown <b>once</b>. Pass it on in person or by phone, not in a group chat.</p>
          <div className="rounded-lg border border-line bg-surface-2 p-3 font-mono"><div>Email: {shown.email}</div><div>Password: {shown.password}</div></div>
          <Button size="sm" onClick={() => { navigator.clipboard?.writeText(`Email: ${shown.email}\nPassword: ${shown.password}`); toast("Copied"); }}><Copy size={14} />Copy</Button></div>}
      </Modal>
    </Card>
  );
}

function AddLogin({ onClose, onDone }: { onClose: () => void; onDone: (email: string, password: string) => void }) {
  const [v, setV] = useState({ name: "", email: "", role: "teacher", staffId: "" }); const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const submit = async () => { setBusy(true); setErr(""); const password = tempPassword();
    const [, e] = await call({ action: "create", email: v.email, password, role: v.role, name: v.name, staffId: v.staffId || null }); setBusy(false);
    if (e) setErr(e); else onDone(v.email.trim().toLowerCase(), password); };
  return (
    <Modal open onClose={onClose} title="Add a staff login" footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={busy || !v.name.trim() || !/^\S+@\S+\.\S+$/.test(v.email)} onClick={submit}>{busy ? "Creating…" : "Create login"}</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Full name *"><input className={inputClass} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></Field>
        <Field label="Email *"><input type="email" className={inputClass} value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} /></Field>
        <Field label="Role *"><select className={inputClass} value={v.role} onChange={(e) => setV({ ...v, role: e.target.value })}>{ROLE_KEYS.map((r) => <option key={r} value={r}>{ROLES[r].label}</option>)}</select></Field>
        <Field label="Staff record" hint="Teachers must be linked to see their classes"><select className={inputClass} value={v.staffId} onChange={(e) => setV({ ...v, staffId: e.target.value })}><option value="">None</option>{Q.staff.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.position}</option>)}</select></Field>
        <p className="sm:col-span-2 text-xs text-muted">A strong temporary password is created and shown once. Teachers see only the classes assigned to their staff record (Teachers &amp; Staff).</p>
        {err && <p role="alert" className="sm:col-span-2 text-sm text-danger">{err}</p>}
      </div>
    </Modal>
  );
}
