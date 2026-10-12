"use client";
import { useState } from "react";
import { Upload } from "lucide-react";
import { Badge, Button, Card, CardHeader, Field, inputClass } from "@/components/ui/primitives";
import { SchoolLogo } from "@/components/SchoolLogo";
import { Tabs, useToast } from "@/components/ui/interactive";
const PERMS = ["students.read", "students.update", "parents.link", "fees.record_payment", "fees.adjust", "fees.refund", "finance.approve", "inventory.issue", "inventory.adjust", "grades.enter", "grades.approve", "reports.export", "settings.manage"];
const ROLES: Record<string, string[]> = { Proprietor: ["students.read", "finance.approve", "reports.export"], Headmaster: ["students.read", "students.update", "parents.link", "grades.approve", "finance.approve", "reports.export", "settings.manage"], Administrator: ["students.read", "students.update", "parents.link", "grades.approve", "reports.export"], Bursar: ["students.read", "fees.record_payment", "fees.adjust", "fees.refund", "finance.approve", "reports.export"], Storekeeper: ["inventory.issue", "inventory.adjust"], Teacher: ["students.read", "grades.enter"], Auditor: ["students.read", "reports.export"] };
export function SettingsWorkspace({ school }: { school: Record<string, string> }) {
  const toast = useToast(); const [logo, setLogo] = useState<string | null>(null); const [t, setT] = useState([{ label: "Finance Officer", upTo: 5000 }, { label: "School Administrator", upTo: 25000 }, { label: "Proprietor", upTo: 0 }]);
  const [roles, setRoles] = useState(ROLES);
  const save = (m: string) => toast(`${m} saved`);
  return (
    <Tabs tabs={[
      { id: "profile", label: "School profile", content: (
        <Card className="max-w-3xl p-5"><div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2 flex items-center gap-4"><div className="grid size-20 place-items-center overflow-hidden rounded-xl border border-dashed border-line bg-surface-2">{logo ? <img /* eslint-disable-line @next/next/no-img-element */ src={logo} alt="School logo preview" className="size-full object-contain" /> : <SchoolLogo size={80} />}</div>
            <div><label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-line px-3 text-sm font-medium hover:bg-surface-2"><Upload size={14} />Upload logo<input type="file" accept="image/png,image/jpeg,image/svg+xml" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) setLogo(URL.createObjectURL(f)); }} /></label><p className="mt-1 text-xs text-muted">Appears on invoices, receipts, report cards and exports.</p></div></div>
          {[["School name", school.name], ["Phone", school.phone], ["Email", school.email], ["Location", school.city], ["Currency", school.currency], ["Timezone", school.timezone]].map(([l, v]) => <Field key={l} label={l}><input className={inputClass} defaultValue={v} /></Field>)}
          <div className="sm:col-span-2"><Button variant="primary" onClick={() => save("School profile")}>Save changes</Button></div></div></Card>) },
      { id: "calendar", label: "Academic calendar", content: <Card className="max-w-3xl"><CardHeader title="2026/2027" sub="Terms, holidays and report dates" />{[["Term 1", "7 Sep 2026 – 18 Dec 2026"], ["Term 2", "11 Jan 2027 – 8 Apr 2027"], ["Term 3", "3 May 2027 – 23 Jul 2027"]].map(([a, b]) => <div key={a} className="flex justify-between border-t border-line px-4 py-3"><b>{a}</b><span className="text-muted">{b}</span></div>)}</Card> },
      { id: "numbering", label: "Numbering", content: <Card className="max-w-2xl p-5"><div className="grid gap-4 sm:grid-cols-2">{[["Admission number", "BMS/{YY}/{SEQ:4}"], ["Invoice number", "INV-{YYYY}-T{TERM}-{SEQ:4}"], ["Receipt number", "RCT-{SEQ:5}"], ["Purchase order", "PO-{SEQ:4}"]].map(([l, v]) => <Field key={l} label={l}><input className={inputClass} defaultValue={v} /></Field>)}</div><Button className="mt-4" variant="primary" onClick={() => save("Numbering schemes")}>Save</Button></Card> },
      { id: "approvals", label: "Approval thresholds", content: (
        <Card className="max-w-2xl p-5"><p className="mb-3 text-sm text-muted">Expenses up to each limit (GHS) are approved by the listed role. Configurable, never hard-coded.</p>
          {t.map((r, i) => <div key={r.label} className="mb-3 grid items-center gap-3 sm:grid-cols-[200px_1fr]"><b>{r.label}</b>{i < 2 ? <input aria-label={`${r.label} limit`} className={inputClass} inputMode="numeric" value={r.upTo} onChange={(e) => setT(t.map((x, j) => (j === i ? { ...x, upTo: Number(e.target.value.replace(/\D/g, "")) } : x)))} /> : <span className="text-muted">Everything above {t[1].upTo.toLocaleString()}</span>}</div>)}
          {t[0].upTo >= t[1].upTo && <p role="alert" className="text-sm text-danger">Each limit must be higher than the one before it.</p>}
          <Button variant="primary" disabled={t[0].upTo >= t[1].upTo} onClick={() => save("Approval thresholds")}>Save</Button></Card>) },
      { id: "roles", label: "Roles & permissions", content: (
        <Card><CardHeader title="Permission matrix" sub="Enforced on the server; the UI only mirrors it." /><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-surface-2/60 text-xs"><tr><th className="px-4 py-2 text-left">Permission</th>{Object.keys(roles).map((r) => <th key={r} className="px-2 text-center font-medium">{r}</th>)}</tr></thead>
          <tbody className="divide-y divide-line">{PERMS.map((p) => <tr key={p}><td className="px-4 py-2 font-mono text-xs">{p}</td>{Object.keys(roles).map((r) => <td key={r} className="text-center"><input type="checkbox" aria-label={`${r} ${p}`} checked={roles[r].includes(p)} onChange={(e) => setRoles({ ...roles, [r]: e.target.checked ? [...roles[r], p] : roles[r].filter((x) => x !== p) })} /></td>)}</tr>)}</tbody></table></div>
          <div className="flex items-center gap-3 border-t border-line p-4"><Button variant="primary" onClick={() => save("Role permissions")}>Save matrix</Button><Badge tone="warn">Sensitive operations also require justification</Badge></div></Card>) },
      { id: "integrations", label: "Integrations", content: <Card className="max-w-2xl">{[["Payment gateway (Paystack / Hubtel)", "Not connected", "warn"], ["SMS provider", "Not connected", "warn"], ["WhatsApp Business", "Not connected", "warn"], ["Email (SMTP)", "Not connected", "warn"], ["Nightly encrypted backup", "Not configured", "warn"]].map(([n, s, t]) => <div key={n} className="flex items-center justify-between border-b border-line px-4 py-3 last:border-0"><span>{n}</span><div className="flex items-center gap-2"><Badge tone={t as "warn"}>{s}</Badge><Button size="sm" onClick={() => toast("Available once the backend is connected", "err")}>Configure</Button></div></div>)}</Card> },
    ]} />
  );
}
