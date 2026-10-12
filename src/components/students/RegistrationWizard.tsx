"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangle, Check, CheckCircle2, ChevronLeft, ChevronRight, FileUp, Search, ShieldAlert, UserPlus, X } from "lucide-react";
import { Badge, Button, Card, Field, LinkButton, inputClass } from "@/components/ui/primitives";
import { ConfirmDialog, useToast } from "@/components/ui/interactive";
import { cn, ageFrom } from "@/lib/utils";

interface G { id: string; name: string; phone: string; email?: string; children: number }
interface Link_ { key: string; guardian: { id?: string; name: string; phone: string; email: string; isNew: boolean }; relationship: string; primary: boolean; legal: boolean; emergency: boolean; pickup: boolean; financial: boolean; reminders: boolean; academic: boolean }
const STEPS = ["Personal", "Academic", "Guardians", "Medical & Welfare", "Documents", "Review"];
const DOCS = ["Birth certificate", "Admission form", "Previous school records", "Passport photograph", "Parental consent form"];

export function RegistrationWizard({ guardians, classes, houses, nextAdm }: { guardians: G[]; classes: { id: string; name: string }[]; houses: string[]; nextAdm: string }) {
  const [step, setStep] = useState(0);
  const [f, setF] = useState({ first: "", middle: "", last: "", dob: "", gender: "", nationality: "Ghanaian", address: "", pob: "", admitted: "2026-10-12", category: "Day", prevSchool: "", ecName: "", ecPhone: "", year: "2026/2027", classId: "", stream: "", house: "", code: "", entry: "", allergies: "", alert: "", instructions: "" });
  const [links, setLinks] = useState<Link_[]>([]);
  const [q, setQ] = useState(""); const [adding, setAdding] = useState(false);
  const [np, setNp] = useState({ name: "", phone: "", email: "" });
  const [docs, setDocs] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [exception, setException] = useState(false); const [exceptionOpen, setExceptionOpen] = useState(false); const [exceptionReason, setExceptionReason] = useState("");
  const [done, setDone] = useState(false);
  const toast = useToast();
  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }));

  const matches = useMemo(() => { const n = q.trim().toLowerCase(); if (n.length < 2) return []; return guardians.filter((g) => !links.some((l) => l.guardian.id === g.id) && (g.name.toLowerCase().includes(n) || g.phone.replace(/\s/g, "").includes(n.replace(/\s/g, "")) || g.email?.toLowerCase().includes(n))).slice(0, 5); }, [q, guardians, links]);
  const dupCandidates = useMemo(() => { const n = np.name.trim().toLowerCase(), p = np.phone.replace(/\D/g, ""); if (!n && p.length < 6) return []; return guardians.filter((g) => (p.length >= 6 && g.phone.replace(/\D/g, "").endsWith(p.slice(-7))) || (n.length > 3 && g.name.toLowerCase() === n)); }, [np, guardians]);

  const addLink = (g: Link_["guardian"]) => { setLinks((l) => [...l, { key: crypto.randomUUID(), guardian: g, relationship: "Parent", primary: l.length === 0, legal: true, emergency: true, pickup: true, financial: l.length === 0, reminders: true, academic: true }]); setQ(""); setAdding(false); setNp({ name: "", phone: "", email: "" }); };
  const upd = (key: string, patch: Partial<Link_>) => setLinks((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : patch.primary ? { ...l, primary: false } : l)));

  const validate = (s: number) => {
    const e: Record<string, string> = {};
    if (s === 0) { if (!f.first.trim()) e.first = "First name is required"; if (!f.last.trim()) e.last = "Last name is required"; if (!f.dob) e.dob = "Date of birth is required"; else if (new Date(f.dob) > new Date("2026-10-12")) e.dob = "Date of birth cannot be in the future"; if (!f.gender) e.gender = "Select gender"; }
    if (s === 1) { if (!f.classId) e.classId = "Select the class to assign"; }
    if (s === 2) {
      if (links.length === 0 && !exception) e.links = "Link at least one guardian, or request an authorised exception.";
      if (links.length > 0) { if (!links.some((l) => l.primary)) e.links = "Choose a primary guardian."; else if (!links.some((l) => l.financial)) e.links = "Choose at least one guardian who receives financial messages."; }
      links.forEach((l) => { if (l.guardian.isNew && (!l.guardian.name.trim() || l.guardian.phone.replace(/\D/g, "").length < 9)) e.links = "New guardians need a name and a valid phone number."; });
    }
    setErrors(e); return Object.keys(e).length === 0;
  };
  const next = () => validate(step) && setStep(step + 1);

  if (done) return (
    <Card className="mx-auto max-w-xl p-8 text-center"><CheckCircle2 className="mx-auto text-ok" size={44} />
      <h2 className="mt-3 text-xl font-semibold">{f.first} {f.last} registered</h2><p className="mt-1 text-muted">Admission number <b className="num text-fg">{nextAdm}</b> · {classes.find((c) => c.id === f.classId)?.name}</p>
      <p className="mt-1 text-muted">{links.length} guardian link{links.length === 1 ? "" : "s"} saved in the same transaction. The term invoice can now be generated.</p>
      <div className="mt-5 flex justify-center gap-2"><LinkButton href="/students">All students</LinkButton><LinkButton href="/fees" variant="primary">Generate term invoice</LinkButton></div>
      <p className="mt-4 text-xs text-muted">Front-end preview: nothing is persisted until the backend is connected.</p></Card>
  );

  return (
    <div className="mx-auto max-w-3xl">
      <ol className="mb-5 flex gap-1 overflow-x-auto" aria-label="Registration progress">
        {STEPS.map((s, i) => (
          <li key={s} className="flex-1 min-w-[88px]"><button onClick={() => i < step && setStep(i)} disabled={i > step} className={cn("w-full rounded-lg border px-2 py-2 text-left text-xs font-medium transition", i === step ? "border-info bg-info/10 text-info" : i < step ? "border-ok/40 text-ok" : "border-line text-muted")}>
            <span className="mr-1.5 inline-grid size-4 place-items-center rounded-full bg-current/15 text-[10px]">{i < step ? <Check size={10} /> : i + 1}</span>{s}</button></li>
        ))}
      </ol>
      <Card className="p-5">
        {step === 0 && <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2 flex items-center gap-4"><div className="grid size-20 place-items-center rounded-xl border border-dashed border-line text-xs text-muted">Photo</div><div><Button size="sm"><FileUp size={14} />Upload photograph</Button><p className="mt-1 text-xs text-muted">Admission number (auto): <b className="num text-fg">{nextAdm}</b></p></div></div>
          <Field label="First name *" error={errors.first}><input className={inputClass} value={f.first} onChange={(e) => set("first", e.target.value)} /></Field>
          <Field label="Middle name"><input className={inputClass} value={f.middle} onChange={(e) => set("middle", e.target.value)} /></Field>
          <Field label="Last name *" error={errors.last}><input className={inputClass} value={f.last} onChange={(e) => set("last", e.target.value)} /></Field>
          <Field label="Date of birth *" error={errors.dob} hint={f.dob && !errors.dob ? `Age: ${ageFrom(f.dob)} years` : undefined}><input type="date" className={inputClass} value={f.dob} onChange={(e) => set("dob", e.target.value)} /></Field>
          <Field label="Gender *" error={errors.gender}><select className={inputClass} value={f.gender} onChange={(e) => set("gender", e.target.value)}><option value="">Select…</option><option>Female</option><option>Male</option></select></Field>
          <Field label="Nationality"><input className={inputClass} value={f.nationality} onChange={(e) => set("nationality", e.target.value)} /></Field>
          <Field label="Residential address"><input className={inputClass} value={f.address} onChange={(e) => set("address", e.target.value)} /></Field>
          <Field label="Place of birth"><input className={inputClass} value={f.pob} onChange={(e) => set("pob", e.target.value)} /></Field>
          <Field label="Admission date"><input type="date" className={inputClass} value={f.admitted} onChange={(e) => set("admitted", e.target.value)} /></Field>
          <Field label="Student category"><select className={inputClass} value={f.category} onChange={(e) => set("category", e.target.value)}><option>Day</option><option>Boarding</option></select></Field>
          <Field label="Previous school"><input className={inputClass} value={f.prevSchool} onChange={(e) => set("prevSchool", e.target.value)} /></Field>
          <Field label="Emergency contact name"><input className={inputClass} value={f.ecName} onChange={(e) => set("ecName", e.target.value)} /></Field>
          <Field label="Emergency contact phone"><input className={inputClass} inputMode="tel" value={f.ecPhone} onChange={(e) => set("ecPhone", e.target.value)} /></Field>
        </div>}
        {step === 1 && <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Academic year of admission"><select className={inputClass} value={f.year} onChange={(e) => set("year", e.target.value)}><option>2026/2027</option><option>2025/2026</option></select></Field>
          <Field label="Class *" error={errors.classId}><select className={inputClass} value={f.classId} onChange={(e) => set("classId", e.target.value)}><option value="">Select class…</option>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
          <Field label="Section / stream"><select className={inputClass} value={f.stream} onChange={(e) => set("stream", e.target.value)}><option value="">None</option><option>A</option><option>B</option></select></Field>
          <Field label="House"><select className={inputClass} value={f.house} onChange={(e) => set("house", e.target.value)}><option value="">Unassigned</option>{houses.map((h) => <option key={h}>{h}</option>)}</select></Field>
          <Field label="Student identification code"><input className={inputClass} value={f.code} onChange={(e) => set("code", e.target.value)} /></Field>
          <Field label="Entry assessment result (optional)"><input className={inputClass} value={f.entry} onChange={(e) => set("entry", e.target.value)} placeholder="e.g. 72%" /></Field>
          <p className="sm:col-span-2 text-xs text-muted">Subjects are assigned automatically from the class level and can be changed on the student profile.</p>
        </div>}
        {step === 2 && <div className="space-y-4">
          <div><h3 className="font-semibold">Parents & guardians <span className="text-danger">*</span></h3><p className="text-muted">Every student needs at least one verified guardian. Search first to avoid duplicates — one parent account can be linked to many children.</p></div>
          {links.map((l) => (
            <div key={l.key} className="rounded-xl border border-line p-3">
              <div className="flex flex-wrap items-start justify-between gap-2"><div><div className="font-medium">{l.guardian.name || "New guardian"} {l.guardian.isNew ? <Badge tone="info">New</Badge> : <Badge tone="ok">Existing · {guardians.find((g) => g.id === l.guardian.id)?.children} child(ren)</Badge>}</div><div className="text-xs text-muted">{l.guardian.phone} {l.guardian.email}</div></div>
                <button aria-label="Remove guardian" className="rounded p-1 hover:bg-surface-2" onClick={() => setLinks((x) => x.filter((y) => y.key !== l.key))}><X size={16} /></button></div>
              {l.guardian.isNew && <div className="mt-2 grid gap-2 sm:grid-cols-3"><input aria-label="Guardian name" className={inputClass} placeholder="Full name" value={l.guardian.name} onChange={(e) => setLinks((x) => x.map((y) => y.key === l.key ? { ...y, guardian: { ...y.guardian, name: e.target.value } } : y))} /><input aria-label="Guardian phone" className={inputClass} placeholder="Phone" value={l.guardian.phone} onChange={(e) => setLinks((x) => x.map((y) => y.key === l.key ? { ...y, guardian: { ...y.guardian, phone: e.target.value } } : y))} /><input aria-label="Guardian email" className={inputClass} placeholder="Email" value={l.guardian.email} onChange={(e) => setLinks((x) => x.map((y) => y.key === l.key ? { ...y, guardian: { ...y.guardian, email: e.target.value } } : y))} /></div>}
              <div className="mt-3 grid gap-2 sm:grid-cols-[160px_1fr]">
                <select aria-label="Relationship" className={inputClass} value={l.relationship} onChange={(e) => upd(l.key, { relationship: e.target.value })}>{["Father", "Mother", "Guardian", "Grandparent", "Uncle", "Aunt", "Sibling", "Sponsor"].map((r) => <option key={r}>{r}</option>)}</select>
                <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[13px]">
                  {([["primary", "Primary contact"], ["legal", "Legal guardian"], ["emergency", "Emergency contact"], ["pickup", "Authorised pickup"], ["financial", "Receives financial messages"], ["reminders", "Fee reminders"], ["academic", "Academic updates"]] as const).map(([k, label]) => (
                    <label key={k} className="flex items-center gap-1.5"><input type={k === "primary" ? "radio" : "checkbox"} name={k === "primary" ? "primary" : undefined} checked={l[k]} onChange={(e) => upd(l.key, { [k]: k === "primary" ? true : e.target.checked } as Partial<Link_>)} />{label}</label>))}
                </div></div>
            </div>
          ))}
          {errors.links && <p role="alert" className="flex items-center gap-1.5 text-sm text-danger"><AlertTriangle size={14} />{errors.links}</p>}
          {!adding ? (
            <div className="space-y-2">
              <div className="relative"><Search size={15} className="absolute left-3 top-3 text-muted" /><input className={cn(inputClass, "pl-9")} placeholder="Search existing parents by name, phone or email…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search guardians" /></div>
              {matches.map((g) => <button key={g.id} onClick={() => addLink({ id: g.id, name: g.name, phone: g.phone, email: g.email ?? "", isNew: false })} className="flex w-full items-center justify-between rounded-lg border border-line p-2.5 text-left hover:bg-surface-2"><span><span className="font-medium">{g.name}</span><span className="block text-xs text-muted">{g.phone} {g.email} · {g.children} linked child(ren)</span></span><Badge tone="info">Link</Badge></button>)}
              {q.trim().length >= 2 && matches.length === 0 && <p className="text-sm text-muted">No existing parent matches “{q}”.</p>}
              <div className="flex flex-wrap gap-2"><Button onClick={() => setAdding(true)}><UserPlus size={15} />Register new parent</Button>{links.length === 0 && !exception && <Button variant="ghost" onClick={() => setExceptionOpen(true)}><ShieldAlert size={15} />Request exception</Button>}</div>
              {exception && <p className="rounded-lg bg-warn/10 p-2 text-sm text-warn">Exception requested: registration will be held as “Pending guardian” until a guardian is linked. Reason logged.</p>}
            </div>
          ) : (
            <div className="space-y-3 rounded-xl border border-dashed border-line p-3">
              <div className="grid gap-2 sm:grid-cols-3"><input aria-label="New parent name" className={inputClass} placeholder="Full name *" value={np.name} onChange={(e) => setNp({ ...np, name: e.target.value })} /><input aria-label="New parent phone" className={inputClass} placeholder="Phone *" value={np.phone} onChange={(e) => setNp({ ...np, phone: e.target.value })} /><input aria-label="New parent email" className={inputClass} placeholder="Email" value={np.email} onChange={(e) => setNp({ ...np, email: e.target.value })} /></div>
              {dupCandidates.length > 0 && <div role="alert" className="rounded-lg border border-warn/40 bg-warn/10 p-2.5 text-sm"><b className="text-warn">Possible duplicate:</b> we never merge people automatically. Is this the same person?{dupCandidates.map((g) => <button key={g.id} className="mt-1.5 flex w-full items-center justify-between rounded border border-line bg-surface p-2 text-left" onClick={() => addLink({ id: g.id, name: g.name, phone: g.phone, email: g.email ?? "", isNew: false })}><span>{g.name} · {g.phone}</span><Badge tone="ok">Use this parent</Badge></button>)}</div>}
              <div className="flex gap-2"><Button variant="primary" disabled={!np.name.trim() || np.phone.replace(/\D/g, "").length < 9} onClick={() => addLink({ ...np, isNew: true })}>{dupCandidates.length ? "Not the same — create new" : "Add parent"}</Button><Button variant="ghost" onClick={() => setAdding(false)}>Cancel</Button></div>
            </div>
          )}
        </div>}
        {step === 3 && <div className="space-y-4">
          <div className="flex items-start gap-2 rounded-lg bg-info/10 p-3 text-sm"><ShieldAlert size={16} className="mt-0.5 text-info" /><span>Medical details are field-level restricted. Only the nurse, head and designated staff can view them; they never appear in ordinary reports or class rosters.</span></div>
          <Field label="Allergies"><input className={inputClass} value={f.allergies} onChange={(e) => set("allergies", e.target.value)} /></Field>
          <Field label="Important medical alerts"><input className={inputClass} value={f.alert} onChange={(e) => set("alert", e.target.value)} /></Field>
          <Field label="Emergency medical instructions"><textarea className={cn(inputClass, "h-24 py-2")} value={f.instructions} onChange={(e) => set("instructions", e.target.value)} /></Field>
        </div>}
        {step === 4 && <div className="space-y-2">
          <p className="text-muted">PDF, JPG or PNG up to 5 MB. Files are scanned and stored privately with access control.</p>
          {DOCS.map((d) => <div key={d} className="flex items-center justify-between rounded-lg border border-line p-2.5"><span>{d}</span><label className="cursor-pointer">{docs[d] ? <Badge tone="ok">{docs[d]}</Badge> : <span className="text-sm text-info">Choose file</span>}<input type="file" className="sr-only" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => { const file = e.target.files?.[0]; if (file) { if (file.size > 5_000_000) toast("File exceeds 5 MB limit.", "err"); else setDocs({ ...docs, [d]: file.name }); } }} /></label></div>)}
        </div>}
        {step === 5 && <div className="space-y-4">
          <h3 className="font-semibold">Review & submit</h3>
          <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2 text-sm">
            {[["Name", `${f.first} ${f.middle} ${f.last}`], ["Admission no.", nextAdm], ["Date of birth", f.dob ? `${f.dob} (${ageFrom(f.dob)} yrs)` : "—"], ["Gender", f.gender], ["Class", classes.find((c) => c.id === f.classId)?.name ?? "—"], ["Category", f.category], ["House", f.house || "Unassigned"], ["Documents", `${Object.keys(docs).length} / ${DOCS.length} uploaded`]].map(([k, v]) => <div key={k} className="flex justify-between border-b border-line py-1.5"><dt className="text-muted">{k}</dt><dd className="font-medium">{v}</dd></div>)}
          </dl>
          <div><div className="mb-1 font-medium">Guardians ({links.length})</div>{links.map((l) => <div key={l.key} className="flex flex-wrap items-center gap-2 border-b border-line py-1.5 text-sm"><span className="font-medium">{l.guardian.name}</span><span className="text-muted">{l.relationship}</span>{l.primary && <Badge tone="info">Primary</Badge>}{l.financial && <Badge tone="ok">Financial</Badge>}{l.guardian.isNew && <Badge>New record</Badge>}</div>)}{links.length === 0 && <p className="text-warn">No guardian linked (exception).</p>}</div>
          <p className="text-xs text-muted">On submit the student and all guardian relationships are saved together in a single transaction.</p>
        </div>}
      </Card>
      <div className="mt-4 flex justify-between">
        <Button onClick={() => (step === 0 ? history.back() : setStep(step - 1))}><ChevronLeft size={15} />{step === 0 ? "Cancel" : "Back"}</Button>
        {step < 5 ? <Button variant="primary" onClick={next}>Continue<ChevronRight size={15} /></Button> : <Button variant="success" onClick={() => { setDone(true); toast(`${f.first} ${f.last} registered`); }}><Check size={15} />Register student</Button>}
      </div>
      <ConfirmDialog open={exceptionOpen} onClose={() => setExceptionOpen(false)} needReason title="Request guardian exception" body="Registering a student without a guardian requires Headmaster authorisation and will be logged. Describe why no guardian can be linked now." confirmLabel="Submit exception" onConfirm={(r) => { setException(true); setExceptionReason(r ?? ""); setExceptionOpen(false); toast("Exception recorded (pending authorisation)"); void exceptionReason; }} />
      <p className="mt-3 text-center text-xs text-muted"><Link href="/students" className="hover:underline">Back to students</Link></p>
    </div>
  );
}
