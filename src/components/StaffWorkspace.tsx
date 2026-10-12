"use client";
import { useState } from "react";
import { Avatar, Badge, Button, Card, CardHeader, StatusBadge } from "@/components/ui/primitives";
import { ConfirmDialog, DataTable, Tabs, useToast, type Column } from "@/components/ui/interactive";
import { RecordDialog, type FieldDef, type Values } from "@/components/ui/RecordDialog";
import { useRole } from "@/components/shell/AppShell";
import { Pencil, Trash2, UserPlus } from "lucide-react";
export interface SRow { id: string; empNo: string; name: string; position: string; department: string; type: string; phone: string; qualification: string; status: string; classes: string; subjects: string; students: number; periods: number }
const FIELDS: FieldDef[] = [
  { key: "name", label: "Full name", required: true }, { key: "position", label: "Position", type: "select", options: ["Class Teacher", "Subject Teacher", "Head of Department", "Bursar", "Storekeeper", "Administrator", "Nurse", "Driver", "Security"], required: true },
  { key: "department", label: "Department", type: "select", options: ["Kindergarten", "Primary", "JHS", "Administration", "Operations"], required: true }, { key: "type", label: "Employment type", type: "select", options: ["Full-time", "Part-time", "Contract"], required: true },
  { key: "phone", label: "Phone", type: "tel", required: true, validate: (v) => (v.replace(/\D/g, "").length < 9 ? "Enter a valid phone number" : undefined) }, { key: "email", label: "Email", type: "email", validate: (v) => (/^\S+@\S+\.\S+$/.test(v) ? undefined : "Enter a valid email") },
  { key: "qualification", label: "Qualification" }, { key: "status", label: "Status", type: "select", options: ["Active", "On leave"], required: true },
];
const toVals = (r?: SRow): Values => (r ? { name: r.name, position: r.position, department: r.department, type: r.type, phone: r.phone, email: "", qualification: r.qualification, status: r.status } : { name: "", position: "Class Teacher", department: "Primary", type: "Full-time", phone: "", email: "", qualification: "", status: "Active" });

export function StaffWorkspace({ rows: initialRows }: { rows: SRow[] }) {
  const { allow } = useRole(); const [rows, setRows] = useState(initialRows); const [form, setForm] = useState<null | { row?: SRow }>(null); const [del, setDel] = useState<SRow | null>(null);
  const [leave, setLeave] = useState([{ id: 1, who: "Yaw Danso", kind: "Annual leave", dates: "2–6 Nov 2026", status: "Pending" }, { id: 2, who: "Gifty Osei", kind: "Sick leave", dates: "14–15 Oct 2026", status: "Pending" }, { id: 3, who: "Isaac Badu", kind: "Study leave", dates: "1–5 Dec 2026", status: "Approved" }]);
  const toast = useToast();
  const cols: Column<SRow>[] = [
    { key: "n", header: "Staff", sort: (x) => x.name, render: (x) => <div className="flex items-center gap-2.5"><Avatar name={x.name} size={32} /><div><div className="font-medium">{x.name}</div><div className="text-xs text-muted">{x.empNo} · {x.position}</div></div></div> },
    { key: "d", header: "Department", hideOnMobile: true, render: (x) => x.department }, { key: "c", header: "Classes", render: (x) => x.classes || "—" },
    { key: "q", header: "Qualification", hideOnMobile: true, render: (x) => <span className="text-muted">{x.qualification}</span> }, { key: "t", header: "Type", hideOnMobile: true, render: (x) => x.type }, { key: "s", header: "Status", render: (x) => <StatusBadge status={x.status} /> },
    { key: "a", header: "", align: "right", render: (x) => <div className="flex justify-end gap-1">{allow("staff", "edit") && <Button size="sm" variant="ghost" aria-label={`Edit ${x.name}`} onClick={() => setForm({ row: x })}><Pencil size={14} /></Button>}{allow("staff", "delete") && <Button size="sm" variant="ghost" aria-label={`Delete ${x.name}`} onClick={() => setDel(x)}><Trash2 size={14} className="text-danger" /></Button>}</div> },
  ];
  const teach = rows.filter((r) => r.classes);
  return (
    <>
    <Tabs tabs={[
      { id: "dir", label: "Directory", content: <><div className="mb-3 flex justify-end">{allow("staff", "create") && <Button variant="primary" onClick={() => setForm({})}><UserPlus size={15} />Add staff</Button>}</div><Card><DataTable rows={rows} columns={cols} rowId={(x) => x.id} searchText={(x) => x.name + x.empNo + x.position} pageSize={12} /></Card></> },
      { id: "load", label: "Workload", content: <Card><CardHeader title="Teaching workload" sub="Periods per week and students taught" />{teach.map((t) => <div key={t.id} className="grid items-center gap-2 border-t border-line px-4 py-3 sm:grid-cols-[200px_1fr_auto]"><b>{t.name}</b><div className="h-2 overflow-hidden rounded-full bg-surface-2"><div className={`h-full rounded-full ${t.periods > 28 ? "bg-warn" : "bg-info"}`} style={{ width: `${Math.min(100, (t.periods / 35) * 100)}%` }} /></div><span className="text-xs text-muted">{t.periods} periods · {t.students} students</span></div>)}</Card> },
      { id: "leave", label: "Leave requests", badge: String(leave.filter((l) => l.status === "Pending").length), content: <Card>{leave.map((l) => <div key={l.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3 last:border-0"><div><b>{l.who}</b> <span className="text-muted">· {l.kind}</span><div className="text-xs text-muted">{l.dates}</div></div>{l.status === "Pending" ? <div className="flex gap-2"><Button size="sm" variant="success" onClick={() => { setLeave(leave.map((x) => x.id === l.id ? { ...x, status: "Approved" } : x)); toast(`Leave approved for ${l.who}`); }}>Approve</Button><Button size="sm" onClick={() => { setLeave(leave.map((x) => x.id === l.id ? { ...x, status: "Rejected" } : x)); toast("Leave declined"); }}>Decline</Button></div> : <Badge tone={l.status === "Approved" ? "ok" : "danger"}>{l.status}</Badge>}</div>)}</Card> },
    ]} />
      {form && <RecordDialog open key={form.row?.id ?? "new"} onClose={() => setForm(null)} title={form.row ? `Edit ${form.row.name}` : "Add staff member"} fields={FIELDS} initial={toVals(form.row)} submitLabel={form.row ? "Save changes" : "Add staff"} onSubmit={(v) => {
        const row: SRow = { id: form.row?.id ?? `new-${crypto.randomUUID().slice(0, 6)}`, empNo: form.row?.empNo ?? `EMP-${String(rows.length + 1).padStart(3, "0")}`, name: v.name.trim(), position: v.position, department: v.department, type: v.type, phone: v.phone, qualification: v.qualification, status: v.status, classes: form.row?.classes ?? "", subjects: form.row?.subjects ?? "", students: form.row?.students ?? 0, periods: form.row?.periods ?? 0 };
        setRows((x) => (form.row ? x.map((y) => (y.id === row.id ? row : y)) : [...x, row])); toast(form.row ? `${row.name} updated` : `${row.name} added (${row.empNo})`); setForm(null); }} />}
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} needReason danger confirmLabel="Delete staff" title={`Delete ${del?.name ?? ""}`} body="The staff record is removed from the directory and class assignments are cleared. Attendance and grade history stay on file. Recorded in the audit trail." onConfirm={() => { setRows((x) => x.filter((y) => y.id !== del!.id)); toast(`${del!.name} deleted`); setDel(null); }} />
    </>
  );
}
