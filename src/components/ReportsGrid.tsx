"use client";
import Link from "next/link";
import { Download, Printer } from "lucide-react";
import { Badge, Button, Card } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/interactive";
export interface Rep { id: string; title: string; desc: string; group: string; basis?: string; header: string[]; rows: (string | number)[][]; href: string }
export function ReportsGrid({ reports }: { reports: Rep[] }) {
  const toast = useToast();
  const csv = (r: Rep) => { const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`; const t = [r.header, ...r.rows].map((row) => row.map(esc).join(",")).join("\n"); const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([t], { type: "text/csv" })); a.download = `${r.id}.csv`; a.click(); toast(`${r.title}: ${r.rows.length} rows exported`); };
  const groups = Array.from(new Set(reports.map((r) => r.group)));
  return (
    <div className="space-y-6">{groups.map((g) => <section key={g}><h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{g}</h2>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{reports.filter((r) => r.group === g).map((r) => <Card key={r.id} className="flex flex-col p-4"><div className="flex items-start justify-between gap-2"><b>{r.title}</b>{r.basis && <Badge tone="info">{r.basis}</Badge>}</div><p className="mt-1 flex-1 text-sm text-muted">{r.desc}</p><div className="mt-3 flex gap-2"><Button size="sm" onClick={() => csv(r)}><Download size={13} />CSV</Button><Link href={r.href} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line px-2.5 text-xs font-medium hover:bg-surface-2"><Printer size={13} />View</Link></div><div className="mt-2 text-[11px] text-muted">{r.rows.length} rows</div></Card>)}</div></section>)}</div>
  );
}
