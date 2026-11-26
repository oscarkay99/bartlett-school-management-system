"use client";
import { parentHref } from "@/lib/links";
import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangle, Link2, Mail, Phone, Search, ShieldCheck, TriangleAlert, Unlink, UserPlus } from "lucide-react";
import { Avatar, Badge, Button, Card, Field, inputClass } from "@/components/ui/primitives";
import { ConfirmDialog, Modal, useToast } from "@/components/ui/interactive";
import { cn } from "@/lib/utils";
import { useRole } from "@/components/shell/AppShell";
import { canEditGuardianLinks } from "@/lib/permissions";
import { LIVE } from "@/lib/live/config";
import { useSave } from "@/lib/live/useSave";
import { createGuardian, linkGuardian, unlinkGuardian } from "@/lib/live/actions";

export interface GLink { guardianId: string; title: string; name: string; phone: string; email?: string; children: number; relationship: string; primary: boolean; legal: boolean; emergency: boolean; pickup: boolean; financial: boolean; share?: number; reminders: boolean; academic: boolean; verified: boolean; restriction?: string }
export interface GDir { id: string; title: string; name: string; phone: string; email?: string; children: number }
const RELS = ["Father", "Mother", "Guardian", "Grandparent", "Uncle", "Aunt", "Sibling", "Sponsor"];
const FLAGS = [["legal", "Legal guardian"], ["emergency", "Emergency contact"], ["pickup", "Authorised pickup"], ["financial", "Financially responsible"], ["reminders", "Fee reminders"], ["academic", "Academic updates"]] as const;

export function GuardiansPanel({ studentId, studentName, initial, directory }: { studentId: string; studentName: string; initial: GLink[]; directory: GDir[] }) {
  const [links, setLinksState] = useState(initial); const run = useSave();
  // Live: every change is written to the database (all links, so exactly one stays primary); demo: kept on screen.
  const save = (next: GLink[]) => { if (LIVE) void run(async () => { for (const l of next) { const e = await linkGuardian(studentId, l.guardianId, l); if (e) return e; } return ""; }); };
  const setLinks = (f: GLink[] | ((ls: GLink[]) => GLink[])) => setLinksState((ls) => { const next = typeof f === "function" ? f(ls) : f; if (next !== ls) save(next); return next; }); const [add, setAdd] = useState(false); const [unlink, setUnlink] = useState<GLink | null>(null); const toast = useToast();
  const patch = (id: string, p: Partial<GLink>) => setLinks((ls) => ls.map((l) => (l.guardianId === id ? { ...l, ...p } : p.primary ? { ...l, primary: false } : l)));
  const doUnlink = () => {
    if (!unlink) return; const rest = links.filter((l) => l.guardianId !== unlink.guardianId);
    if (unlink.primary && rest[0]) rest[0] = { ...rest[0], primary: true }; // never leave a student without a primary
    if (LIVE) { const gone = unlink; void run(() => unlinkGuardian(studentId, gone.guardianId), `${gone.name} unlinked from ${studentName}`).then((ok) => { if (ok) setLinksState(rest); }); if (rest[0]) save(rest); setUnlink(null); return; }
    setLinks(rest); toast(`${unlink.name} unlinked from ${studentName}`); setUnlink(null);
  };
  const { role } = useRole(); const editable = canEditGuardianLinks(role);
  return (
    // Read-only for roles that can't change guardian links (e.g. teachers): every control is disabled, links still work.
    <fieldset disabled={!editable} className="min-w-0 space-y-3">
      {!editable && <p className="text-xs text-muted">Read-only: only the Owner, Administrator or Bursar can change guardian links.</p>}
      {links.length === 0 ? (
        <div role="alert" className="flex items-center gap-3 rounded-xl border border-danger/30 bg-danger/8 p-4"><AlertTriangle className="text-danger" /><div className="flex-1"><b>No guardian linked</b><p className="text-sm text-muted">Every student must be tied to at least one parent or guardian.</p></div><Button variant="primary" onClick={() => setAdd(true)}>Link a guardian</Button></div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm text-muted">{links.length} guardian{links.length === 1 ? "" : "s"} linked · one parent record can be linked to several children.</p><Button variant="primary" onClick={() => setAdd(true)}><UserPlus size={14} />Link parent / guardian</Button></div>
          {!links.some((l) => l.financial) && <p role="alert" className="flex items-center gap-2 rounded-lg bg-warn/10 p-2.5 text-sm text-warn"><TriangleAlert size={15} />No guardian is marked financially responsible, so fee reminders cannot be sent for this student.</p>}
          <div className="grid gap-3 md:grid-cols-2">
            {links.map((l) => (
              <Card key={l.guardianId}><div className="p-4">
                <div className="flex items-start justify-between gap-2"><div className="flex items-center gap-3"><Avatar name={l.name} /><div><Link href={parentHref(l.guardianId)} className="font-semibold hover:text-info">{l.title} {l.name}</Link><div className="text-xs text-muted">Linked to {l.children} child{l.children === 1 ? "" : "ren"}</div></div></div>
                  {l.verified ? <Badge tone="ok"><ShieldCheck size={12} />Verified</Badge> : <Badge tone="warn">Unverified</Badge>}</div>
                <div className="mt-3 grid gap-2 sm:grid-cols-[130px_1fr] sm:items-center"><select aria-label={`Relationship of ${l.name}`} className={inputClass} value={l.relationship} onChange={(e) => patch(l.guardianId, { relationship: e.target.value })}>{[...new Set([l.relationship, ...RELS])].map((r) => <option key={r}>{r}</option>)}</select>
                  <label className="flex items-center gap-1.5 text-sm"><input type="radio" name="primary-guardian" checked={l.primary} onChange={() => { patch(l.guardianId, { primary: true }); toast(`${l.name} is now the primary contact`); }} />Primary contact</label></div>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[13px]">{FLAGS.map(([k, label]) => <label key={k} className="flex items-center gap-1.5"><input type="checkbox" checked={l[k]} onChange={(e) => patch(l.guardianId, { [k]: e.target.checked })} />{label}</label>)}</div>
                <div className="mt-3 space-y-1 text-sm text-muted"><div className="flex items-center gap-2"><Phone size={13} />{l.phone}</div>{l.email && <div className="flex items-center gap-2"><Mail size={13} />{l.email}</div>}</div>
                {l.restriction && <p className="mt-3 flex gap-2 rounded-lg bg-warn/10 p-2.5 text-sm text-warn"><TriangleAlert size={15} className="mt-0.5 shrink-0" />{l.restriction}</p>}
                <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
                  {links.length === 1 ? <span className="text-xs text-muted">Last guardian — add another before unlinking.</span> : <span />}
                  <Button size="sm" variant="ghost" disabled={links.length === 1} onClick={() => setUnlink(l)} title={links.length === 1 ? "Every student must keep at least one guardian" : undefined}><Unlink size={13} />Unlink</Button></div>
              </div></Card>
            ))}
          </div>
        </>
      )}
      <ConfirmDialog open={!!unlink} onClose={() => setUnlink(null)} needReason danger confirmLabel="Unlink guardian" title={`Unlink ${unlink?.name ?? ""}`} body={`${unlink?.name} will lose access to ${studentName}'s records and fee information. Billing history is kept. This is recorded in the audit trail.`} onConfirm={doUnlink} />
      <LinkDialog open={add} onClose={() => setAdd(false)} directory={directory} linkedIds={links.map((l) => l.guardianId)} studentName={studentName}
        onAdd={async (g, rel, flags) => {
          if (LIVE) { // new parent: create the record first, then link it
            let gid = g.id; if (g.id === "new") { const r = await createGuardian(g); if (r.error) { toast(`Not saved: ${r.error}`, "err"); return; } gid = r.id!; }
            if (await run(() => linkGuardian(studentId, gid, { relationship: rel, primary: links.length === 0, ...flags }), `${g.name} linked to ${studentName}`)) { setLinksState((ls) => [...ls, { guardianId: gid, title: g.title, name: g.name, phone: g.phone, email: g.email, children: g.children + 1, relationship: rel, primary: ls.length === 0, ...flags, verified: true }]); setAdd(false); } return; }
          setLinks((ls) => [...ls, { guardianId: g.id === "new" ? crypto.randomUUID() : g.id, title: g.title, name: g.name, phone: g.phone, email: g.email, children: g.children + 1, relationship: rel, primary: ls.length === 0, ...flags, verified: true }]); toast(`${g.name} linked to ${studentName}`); setAdd(false); }} />
    </fieldset>
  );
}

type Flags = { legal: boolean; emergency: boolean; pickup: boolean; financial: boolean; reminders: boolean; academic: boolean };
function LinkDialog({ open, onClose, directory, linkedIds, studentName, onAdd }: { open: boolean; onClose: () => void; directory: GDir[]; linkedIds: string[]; studentName: string; onAdd: (g: GDir, rel: string, f: Flags) => void }) {
  const [q, setQ] = useState(""); const [pick, setPick] = useState<GDir | null>(null); const [mode, setMode] = useState<"existing" | "new">("existing");
  const [np, setNp] = useState({ name: "", phone: "", email: "" }); const [rel, setRel] = useState("Guardian");
  const [f, setF] = useState<Flags>({ legal: true, emergency: true, pickup: true, financial: false, reminders: true, academic: true });
  const matches = useMemo(() => { const n = q.trim().toLowerCase(); if (n.length < 2) return []; return directory.filter((g) => !linkedIds.includes(g.id) && (g.name.toLowerCase().includes(n) || g.phone.replace(/\s/g, "").includes(n.replace(/\s/g, "")) || g.email?.toLowerCase().includes(n))).slice(0, 5); }, [q, directory, linkedIds]);
  const dups = useMemo(() => { const p = np.phone.replace(/\D/g, ""), n = np.name.trim().toLowerCase(); return directory.filter((g) => (p.length >= 7 && g.phone.replace(/\D/g, "").endsWith(p.slice(-7))) || (n.length > 3 && g.name.toLowerCase() === n)); }, [np, directory]);
  const reset = () => { setQ(""); setPick(null); setNp({ name: "", phone: "", email: "" }); setMode("existing"); onClose(); };
  const target: GDir | null = mode === "existing" ? pick : np.name.trim() && np.phone.replace(/\D/g, "").length >= 9 ? { id: "new", title: "", name: np.name.trim(), phone: np.phone, email: np.email || undefined, children: 0 } : null;
  return (
    <Modal open={open} onClose={reset} wide title={`Link a parent or guardian to ${studentName}`} footer={<><Button onClick={reset}>Cancel</Button><Button variant="primary" disabled={!target} onClick={() => { onAdd(target!, rel, f); reset(); }}><Link2 size={14} />Link guardian</Button></>}>
      <div className="space-y-4">
        <div className="inline-flex rounded-lg border border-line p-0.5 text-sm">{(["existing", "new"] as const).map((m) => <button key={m} onClick={() => setMode(m)} className={cn("rounded-md px-3 py-1", mode === m ? "bg-info text-white" : "text-muted")}>{m === "existing" ? "Existing parent" : "New parent"}</button>)}</div>
        {mode === "existing" ? (
          <div className="space-y-2"><div className="relative"><Search size={15} className="absolute left-3 top-3 text-muted" /><input className={cn(inputClass, "pl-9")} placeholder="Search by name, phone or email…" aria-label="Search parents" value={q} onChange={(e) => { setQ(e.target.value); setPick(null); }} /></div>
            {matches.map((g) => <button key={g.id} onClick={() => setPick(g)} className={cn("flex w-full items-center justify-between rounded-lg border p-2.5 text-left hover:bg-surface-2", pick?.id === g.id ? "border-info bg-info/8" : "border-line")}><span><b>{g.title} {g.name}</b><span className="block text-xs text-muted">{g.phone} {g.email} · {g.children} linked child(ren)</span></span>{pick?.id === g.id && <Badge tone="info">Selected</Badge>}</button>)}
            {q.trim().length >= 2 && matches.length === 0 && <p className="text-sm text-muted">No unlinked parent matches “{q}”. Try “New parent”.</p>}</div>
        ) : (
          <div className="space-y-3"><div className="grid gap-2 sm:grid-cols-3"><input aria-label="Full name" className={inputClass} placeholder="Full name *" value={np.name} onChange={(e) => setNp({ ...np, name: e.target.value })} /><input aria-label="Phone" className={inputClass} placeholder="Phone *" value={np.phone} onChange={(e) => setNp({ ...np, phone: e.target.value })} /><input aria-label="Email" className={inputClass} placeholder="Email" value={np.email} onChange={(e) => setNp({ ...np, email: e.target.value })} /></div>
            {dups.length > 0 && <div role="alert" className="rounded-lg border border-warn/40 bg-warn/10 p-2.5 text-sm"><b className="text-warn">Possible duplicate.</b> People are never merged automatically — is this the same person?{dups.filter((g) => !linkedIds.includes(g.id)).map((g) => <button key={g.id} className="mt-1.5 flex w-full items-center justify-between rounded border border-line bg-surface p-2 text-left" onClick={() => { setPick(g); setMode("existing"); setQ(g.name); }}><span>{g.name} · {g.phone}</span><Badge tone="ok">Use this parent</Badge></button>)}</div>}</div>
        )}
        <Field label="Relationship to student"><select className={inputClass} value={rel} onChange={(e) => setRel(e.target.value)}>{RELS.map((r) => <option key={r}>{r}</option>)}</select></Field>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[13px]">{FLAGS.map(([k, label]) => <label key={k} className="flex items-center gap-1.5"><input type="checkbox" checked={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.checked })} />{label}</label>)}</div>
      </div>
    </Modal>
  );
}
