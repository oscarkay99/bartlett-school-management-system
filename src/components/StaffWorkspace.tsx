"use client";
import { useState } from "react";
import { Avatar, Badge, Button, Card, CardHeader, StatusBadge } from "@/components/ui/primitives";
import { DataTable, Tabs, useToast, type Column } from "@/components/ui/interactive";
export interface SRow { id: string; empNo: string; name: string; position: string; department: string; type: string; phone: string; qualification: string; status: string; classes: string; subjects: string; students: number; periods: number }
export function StaffWorkspace({ rows }: { rows: SRow[] }) {
  const [leave, setLeave] = useState([{ id: 1, who: "Yaw Danso", kind: "Annual leave", dates: "2–6 Nov 2026", status: "Pending" }, { id: 2, who: "Gifty Osei", kind: "Sick leave", dates: "14–15 Oct 2026", status: "Pending" }, { id: 3, who: "Isaac Badu", kind: "Study leave", dates: "1–5 Dec 2026", status: "Approved" }]);
  const toast = useToast();
  const cols: Column<SRow>[] = [
    { key: "n", header: "Staff", sort: (x) => x.name, render: (x) => <div className="flex items-center gap-2.5"><Avatar name={x.name} size={32} /><div><div className="font-medium">{x.name}</div><div className="text-xs text-muted">{x.empNo} · {x.position}</div></div></div> },
    { key: "d", header: "Department", hideOnMobile: true, render: (x) => x.department }, { key: "c", header: "Classes", render: (x) => x.classes || "—" },
    { key: "q", header: "Qualification", hideOnMobile: true, render: (x) => <span className="text-muted">{x.qualification}</span> }, { key: "t", header: "Type", hideOnMobile: true, render: (x) => x.type }, { key: "s", header: "Status", render: (x) => <StatusBadge status={x.status} /> },
  ];
  const teach = rows.filter((r) => r.classes);
  return (
    <Tabs tabs={[
      { id: "dir", label: "Directory", content: <Card><DataTable rows={rows} columns={cols} rowId={(x) => x.id} searchText={(x) => x.name + x.empNo + x.position} pageSize={12} /></Card> },
      { id: "load", label: "Workload", content: <Card><CardHeader title="Teaching workload" sub="Periods per week and students taught" />{teach.map((t) => <div key={t.id} className="grid items-center gap-2 border-t border-line px-4 py-3 sm:grid-cols-[200px_1fr_auto]"><b>{t.name}</b><div className="h-2 overflow-hidden rounded-full bg-surface-2"><div className={`h-full rounded-full ${t.periods > 28 ? "bg-warn" : "bg-info"}`} style={{ width: `${Math.min(100, (t.periods / 35) * 100)}%` }} /></div><span className="text-xs text-muted">{t.periods} periods · {t.students} students</span></div>)}</Card> },
      { id: "leave", label: "Leave requests", badge: String(leave.filter((l) => l.status === "Pending").length), content: <Card>{leave.map((l) => <div key={l.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3 last:border-0"><div><b>{l.who}</b> <span className="text-muted">· {l.kind}</span><div className="text-xs text-muted">{l.dates}</div></div>{l.status === "Pending" ? <div className="flex gap-2"><Button size="sm" variant="success" onClick={() => { setLeave(leave.map((x) => x.id === l.id ? { ...x, status: "Approved" } : x)); toast(`Leave approved for ${l.who}`); }}>Approve</Button><Button size="sm" onClick={() => { setLeave(leave.map((x) => x.id === l.id ? { ...x, status: "Rejected" } : x)); toast("Leave declined"); }}>Decline</Button></div> : <Badge tone={l.status === "Approved" ? "ok" : "danger"}>{l.status}</Badge>}</div>)}</Card> },
    ]} />
  );
}
