"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Pencil, Trash2, UserPlus } from "lucide-react";
import { Avatar, Badge, Button, Card } from "@/components/ui/primitives";
import { ConfirmDialog, DataTable, Modal, useToast, type Column } from "@/components/ui/interactive";
import { RecordDialog, type FieldDef, type Values } from "@/components/ui/RecordDialog";
import { useRole } from "@/components/shell/AppShell";
import { money } from "@/lib/money";

export interface PRow { id: string; title: string; name: string; phone: string; whatsapp?: string; email?: string; address?: string; occupation?: string; preferred: string; language: string; kids: string[]; soleFor: string[]; owed: number; consent: { SMS: boolean; WhatsApp: boolean; Email: boolean } }
export const PARENT_FIELDS: FieldDef[] = [
  { key: "title", label: "Title", type: "select", options: ["Mr.", "Mrs.", "Ms.", "Dr.", "Rev.", "Chief"], required: true },
  { key: "name", label: "Full name", required: true, validate: (v) => (v.trim().split(/\s+/).length < 2 ? "Enter first and last name" : undefined) },
  { key: "phone", label: "Phone", type: "tel", required: true, validate: (v) => (v.replace(/\D/g, "").length < 9 ? "Enter a valid phone number" : undefined) },
  { key: "whatsapp", label: "WhatsApp number", type: "tel", hint: "Leave blank if same as phone" },
  { key: "email", label: "Email", type: "email", validate: (v) => (/^\S+@\S+\.\S+$/.test(v) ? undefined : "Enter a valid email") },
  { key: "occupation", label: "Occupation" },
  { key: "address", label: "Residential address", span: 2 },
  { key: "preferred", label: "Preferred contact method", type: "select", options: ["WhatsApp", "SMS", "Email"], required: true },
  { key: "language", label: "Preferred language", type: "select", options: ["English", "Twi", "Ga", "Ewe", "Hausa"], required: true },
  { key: "cSMS", label: "Consents to SMS", type: "checkbox" }, { key: "cWhatsApp", label: "Consents to WhatsApp", type: "checkbox" }, { key: "cEmail", label: "Consents to email", type: "checkbox" },
];
const toValues = (r?: PRow): Values => r ? { title: r.title, name: r.name, phone: r.phone, whatsapp: r.whatsapp ?? "", email: r.email ?? "", occupation: r.occupation ?? "", address: r.address ?? "", preferred: r.preferred, language: r.language, cSMS: r.consent.SMS ? "1" : "", cWhatsApp: r.consent.WhatsApp ? "1" : "", cEmail: r.consent.Email ? "1" : "" }
  : { title: "Mr.", name: "", phone: "", whatsapp: "", email: "", occupation: "", address: "", preferred: "WhatsApp", language: "English", cSMS: "1", cWhatsApp: "1", cEmail: "1" };

export function ParentsTable({ rows: initial }: { rows: PRow[] }) {
  const r = useRouter(); const toast = useToast(); const { allow } = useRole();
  const [rows, setRows] = useState(initial); const [form, setForm] = useState<null | { mode: "add" } | { mode: "edit"; row: PRow }>(null); const [del, setDel] = useState<PRow | null>(null); const [dupOk, setDupOk] = useState(false);
  const save = (v: Values, id?: string) => {
    const row: PRow = { id: id ?? `new-${crypto.randomUUID().slice(0, 6)}`, title: v.title, name: v.name.trim(), phone: v.phone, whatsapp: v.whatsapp || undefined, email: v.email || undefined, address: v.address, occupation: v.occupation, preferred: v.preferred, language: v.language, consent: { SMS: !!v.cSMS, WhatsApp: !!v.cWhatsApp, Email: !!v.cEmail }, kids: [], soleFor: [], owed: 0 };
    setRows((x) => id ? x.map((y) => (y.id === id ? { ...y, ...row, kids: y.kids, soleFor: y.soleFor, owed: y.owed } : y)) : [row, ...x]);
    toast(id ? `${row.name} updated` : `${row.name} added. Link a child from their profile.`); setForm(null); setDupOk(false);
  };
  const dups = (v: Values, selfId?: string) => { const p = v.phone?.replace(/\D/g, "") ?? "", n = v.name?.trim().toLowerCase() ?? ""; return rows.filter((x) => x.id !== selfId && ((p.length >= 7 && x.phone.replace(/\D/g, "").endsWith(p.slice(-7))) || (n.length > 3 && x.name.toLowerCase() === n))); };
  const cols: Column<PRow>[] = useMemo(() => [
    { key: "n", header: "Parent / guardian", sort: (x) => x.name, render: (x) => <div className="flex items-center gap-2.5"><Avatar name={x.name} size={32} /><div><div className="font-medium">{x.title} {x.name}</div><div className="text-xs text-muted">{x.phone}</div></div></div> },
    { key: "k", header: "Linked children", sort: (x) => x.kids.length, render: (x) => x.kids.length === 0 ? <Badge tone="warn">None yet</Badge> : <div><Badge tone={x.kids.length > 1 ? "info" : "neutral"}>{x.kids.length}</Badge> <span className="text-xs text-muted">{x.kids.slice(0, 3).join(", ")}</span></div> },
    { key: "e", header: "Email", hideOnMobile: true, render: (x) => x.email ?? <span className="text-muted">—</span> }, { key: "c", header: "Preferred", hideOnMobile: true, render: (x) => x.preferred },
    { key: "o", header: "Outstanding", align: "right", sort: (x) => x.owed, render: (x) => <span className={x.owed > 0 ? "font-medium text-danger" : ""}>{money(x.owed)}</span> },
    { key: "a", header: "", align: "right", render: (x) => <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
      {allow("parents", "edit") && <Button size="sm" variant="ghost" aria-label={`Edit ${x.name}`} onClick={() => setForm({ mode: "edit", row: x })}><Pencil size={14} /></Button>}
      {allow("parents", "delete") && <Button size="sm" variant="ghost" aria-label={`Delete ${x.name}`} onClick={() => setDel(x)}><Trash2 size={14} className="text-danger" /></Button>}</div> },
  ], [allow]);
  return (
    <>
      <div className="mb-4 flex justify-end">{allow("parents", "create") && <Button variant="primary" onClick={() => { setDupOk(false); setForm({ mode: "add" }); }}><UserPlus size={15} />Add parent</Button>}</div>
      <Card><DataTable rows={rows} columns={cols} rowId={(x) => x.id} pageSize={12} searchText={(x) => `${x.name} ${x.phone} ${x.email ?? ""} ${x.kids.join(" ")}`} onRowClick={(x) => r.push(`/parents/${x.id}`)} /></Card>
      {form && <RecordDialog key={form.mode === "edit" ? form.row.id : "add"} open onClose={() => setForm(null)} title={form.mode === "add" ? "Add parent / guardian" : `Edit ${form.row.name}`} fields={PARENT_FIELDS} initial={toValues(form.mode === "edit" ? form.row : undefined)} submitLabel={form.mode === "add" ? "Add parent" : "Save changes"}
        extra={(v) => { const d = dups(v, form.mode === "edit" ? form.row.id : undefined); return d.length ? <div role="alert" className="rounded-lg border border-warn/40 bg-warn/10 p-3 text-sm"><b className="text-warn">Possible duplicate.</b> People are never merged automatically.{d.map((x) => <div key={x.id} className="mt-1 flex justify-between"><span>{x.name} · {x.phone}</span><Button size="sm" onClick={() => r.push(`/parents/${x.id}`)}>Open</Button></div>)}<label className="mt-2 flex items-center gap-2"><input type="checkbox" checked={dupOk} onChange={(e) => setDupOk(e.target.checked)} />This is a different person — create anyway</label></div> : null; }}
        blocked={(v) => (dups(v, form.mode === "edit" ? form.row.id : undefined).length && !dupOk ? "Confirm this is a different person, or open the existing record." : undefined)}
        onSubmit={(v) => save(v, form.mode === "edit" ? form.row.id : undefined)} />}
      <Modal open={!!del && del.soleFor.length > 0} onClose={() => setDel(null)} title="Can't delete this parent" footer={<Button onClick={() => setDel(null)}>OK</Button>}>
        <p>{del?.name} is the <b>only guardian</b> of {del?.soleFor.join(", ")}. Every student must stay tied to at least one parent, so link another guardian to {del?.soleFor.length === 1 ? "that student" : "those students"} first.</p>
      </Modal>
      <ConfirmDialog open={!!del && del.soleFor.length === 0} onClose={() => setDel(null)} needReason danger confirmLabel="Delete parent" title={`Delete ${del?.name ?? ""}`} body="The parent record and their links to children are removed. Fee and payment history of the students is kept. This is recorded in the audit trail." onConfirm={() => { setRows((x) => x.filter((y) => y.id !== del!.id)); toast(`${del!.name} deleted`); setDel(null); }} />
    </>
  );
}
