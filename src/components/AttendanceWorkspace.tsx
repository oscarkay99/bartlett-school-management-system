"use client";
import { useState } from "react";
import { Check } from "lucide-react";
import { Badge, Button, Card, CardHeader } from "@/components/ui/primitives";
import { Select, Tabs, useToast } from "@/components/ui/interactive";
import { LineTrend } from "@/components/charts/charts";
import { cn } from "@/lib/utils";
const OPTS = [["P", "Present", "bg-ok text-white"], ["A", "Absent", "bg-danger text-white"], ["L", "Late", "bg-warn text-white"], ["E", "Excused", "bg-info text-white"], ["S", "Sick", "bg-info text-white"], ["X", "Activity", "bg-brand text-white"]] as const;
export function AttendanceWorkspace({ classes, trend, chronic }: { classes: { id: string; name: string; students: { id: string; name: string }[] }[]; trend: { date: string; rate: number }[]; chronic: { id: string; name: string; cls: string; absent: number }[] }) {
  const [cid, setCid] = useState(classes[3].id); const [marks, setMarks] = useState<Record<string, string>>({}); const [saved, setSaved] = useState(false); const toast = useToast();
  const c = classes.find((x) => x.id === cid)!; const get = (id: string) => marks[`${cid}|${id}`] ?? "P";
  const counts = OPTS.map(([k]) => c.students.filter((s) => get(s.id) === k).length);
  return (
    <Tabs tabs={[
      { id: "mark", label: "Mark register", content: (
        <Card><div className="flex flex-wrap items-center gap-3 border-b border-line p-4"><Select label="Class" value={cid} onChange={(v) => { setCid(v); setSaved(false); }} options={classes.map((x) => ({ value: x.id, label: x.name }))} /><span className="text-sm text-muted">Mon 12 Oct 2026</span>
          <div className="ml-auto flex items-center gap-3"><Button size="sm" variant="ghost" onClick={() => { const m = { ...marks }; c.students.forEach((s) => (m[`${cid}|${s.id}`] = "P")); setMarks(m); }}>All present</Button><Button variant="primary" onClick={() => { setSaved(true); toast(`Register saved: ${counts[0]} present, ${counts[1]} absent. Absence alerts await verification.`); }}><Check size={14} />Save register</Button></div></div>
          <div className="flex flex-wrap gap-2 border-b border-line px-4 py-2 text-xs">{OPTS.map(([k, l], i) => <Badge key={k}>{l}: {counts[i]}</Badge>)}{saved && <Badge tone="ok">Saved</Badge>}</div>
          <ul className="divide-y divide-line">{c.students.map((s) => <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5"><span className="min-w-[140px] font-medium">{s.name}</span>
            <div role="radiogroup" aria-label={`Attendance for ${s.name}`} className="flex gap-1">{OPTS.map(([k, l, cls]) => <button key={k} role="radio" aria-checked={get(s.id) === k} title={l} onClick={() => { setMarks({ ...marks, [`${cid}|${s.id}`]: k }); setSaved(false); }} className={cn("size-10 rounded-lg border text-sm font-semibold transition sm:size-9", get(s.id) === k ? cls + " border-transparent" : "border-line text-muted hover:bg-surface-2")}>{k}</button>)}</div></li>)}</ul></Card>) },
      { id: "trend", label: "Trends", content: <Card><CardHeader title="School-wide attendance" sub="Daily %, last 20 school days" /><div className="px-2 pb-3"><LineTrend data={trend.map((t) => ({ ...t, date: t.date.slice(5) }))} x="date" y="rate" label="Attendance" money={false} domain={[85, 100]} color="var(--brand)" /></div></Card> },
      { id: "chronic", label: "Chronic absence", badge: String(chronic.length), content: <Card><CardHeader title="Attendance concerns" sub="Students absent 3+ days this term. Parent notifications for these need staff verification before sending." />{chronic.map((s) => <div key={s.id} className="flex items-center justify-between border-t border-line px-4 py-3"><a href={`/students/${s.id}`} className="hover:text-info">{s.name} <span className="text-xs text-muted">{s.cls}</span></a><div className="flex items-center gap-2"><Badge tone="warn">{s.absent} absences</Badge><Button size="sm" onClick={() => toast("Notification drafted — awaiting verification")}>Draft notice</Button></div></div>)}</Card> },
    ]} />
  );
}
