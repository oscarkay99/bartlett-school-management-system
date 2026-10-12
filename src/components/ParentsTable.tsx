"use client";
import { useRouter } from "next/navigation";
import { Avatar, Badge, Card } from "@/components/ui/primitives";
import { DataTable, type Column } from "@/components/ui/interactive";
import { money } from "@/lib/money";
export interface PRow { id: string; name: string; phone: string; email?: string; kids: string[]; owed: number; channel: string; account: boolean }
export function ParentsTable({ rows }: { rows: PRow[] }) {
  const r = useRouter();
  const cols: Column<PRow>[] = [
    { key: "n", header: "Parent / guardian", sort: (x) => x.name, render: (x) => <div className="flex items-center gap-2.5"><Avatar name={x.name} size={32} /><div><div className="font-medium">{x.name}</div><div className="text-xs text-muted">{x.phone}</div></div></div> },
    { key: "k", header: "Linked children", sort: (x) => x.kids.length, render: (x) => <div><Badge tone={x.kids.length > 1 ? "info" : "neutral"}>{x.kids.length}</Badge> <span className="text-xs text-muted">{x.kids.slice(0, 3).join(", ")}</span></div> },
    { key: "e", header: "Email", hideOnMobile: true, render: (x) => x.email ?? <span className="text-muted">—</span> }, { key: "c", header: "Preferred", hideOnMobile: true, render: (x) => x.channel },
    { key: "o", header: "Outstanding", align: "right", sort: (x) => x.owed, render: (x) => <span className={x.owed > 0 ? "font-medium text-danger" : ""}>{money(x.owed)}</span> },
  ];
  return <Card><DataTable rows={rows} columns={cols} rowId={(x) => x.id} pageSize={12} searchText={(x) => `${x.name} ${x.phone} ${x.email ?? ""} ${x.kids.join(" ")}`} onRowClick={(x) => r.push(`/parents/${x.id}`)} /></Card>;
}
