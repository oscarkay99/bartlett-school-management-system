"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { DataTable, Select, type Column } from "@/components/ui/interactive";
import { Avatar, Badge, StatusBadge } from "@/components/ui/primitives";
import { money } from "@/lib/money";

export interface StudentRow { id: string; name: string; adm: string; cls: string; classId: string; cat: string; status: string; fee: string; balance: number; guardians: string; medical: boolean }
export function StudentsTable({ rows, classes }: { rows: StudentRow[]; classes: { id: string; name: string }[] }) {
  const r = useRouter(); const [cls, setCls] = useState(""); const [fee, setFee] = useState(""); const [st, setSt] = useState("");
  const data = useMemo(() => rows.filter((x) => (!cls || x.classId === cls) && (!fee || x.fee === fee) && (!st || x.status === st)), [rows, cls, fee, st]);
  const cols: Column<StudentRow>[] = [
    { key: "name", header: "Student", sort: (x) => x.name, render: (x) => <div className="flex items-center gap-2.5"><Avatar name={x.name} size={32} /><div><div className="font-medium">{x.name}</div><div className="text-xs text-muted">{x.adm}</div></div></div> },
    { key: "cls", header: "Class", sort: (x) => x.classId.padStart(3, "0"), render: (x) => x.cls },
    { key: "cat", header: "Category", hideOnMobile: true, render: (x) => x.cat },
    { key: "guardians", header: "Guardians", hideOnMobile: true, render: (x) => <span className="text-muted">{x.guardians}</span> },
    { key: "status", header: "Status", hideOnMobile: true, render: (x) => <StatusBadge status={x.status} /> },
    { key: "fee", header: "Fees", render: (x) => <StatusBadge status={x.fee} /> },
    { key: "bal", header: "Balance", align: "right", sort: (x) => x.balance, render: (x) => <span className={x.balance > 0 ? "text-danger font-medium" : ""}>{money(x.balance)}</span> },
  ];
  return <DataTable rows={data} columns={cols} rowId={(x) => x.id} pageSize={12} onRowClick={(x) => r.push(`/students/${x.id}`)} searchText={(x) => `${x.name} ${x.adm} ${x.guardians}`}
    filters={<><Select label="Class" value={cls} onChange={setCls} options={[{ value: "", label: "All classes" }, ...classes.map((c) => ({ value: c.id, label: c.name }))]} />
      <Select label="Fee status" value={fee} onChange={setFee} options={[{ value: "", label: "Any fee status" }, ...["Paid in Full", "Partially Paid", "Outstanding", "Overdue", "Credit Balance"].map((v) => ({ value: v, label: v }))]} />
      <Select label="Status" value={st} onChange={setSt} options={[{ value: "", label: "Any status" }, ...["Active", "Withdrawn", "Graduated"].map((v) => ({ value: v, label: v }))]} /></>}
    toolbar={<Badge>{data.length} students</Badge>} />;
}
