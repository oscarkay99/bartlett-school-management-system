"use client";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { Badge, Button, Card } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/interactive";
const STAGES = ["Submitted", "Documents Reviewed", "Assessment", "Accepted", "Registered", "Enrolled"];
export interface Ap { id: string; name: string; classApplied: string; stage: string; date: string; guardian: string }
export function AdmissionsBoard({ initial }: { initial: Ap[] }) {
  const [list, setList] = useState(initial); const toast = useToast();
  const advance = (a: Ap) => { const n = STAGES[STAGES.indexOf(a.stage) + 1]; setList((l) => l.map((x) => (x.id === a.id ? { ...x, stage: n } : x))); toast(`${a.name} moved to “${n}”`); };
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">{STAGES.map((st) => { const items = list.filter((a) => a.stage === st); return (
      <div key={st} className="w-[230px] shrink-0"><div className="mb-2 flex items-center justify-between px-1"><span className="text-xs font-semibold uppercase text-muted">{st}</span><Badge>{items.length}</Badge></div>
        <div className="space-y-2 rounded-xl bg-surface-2/60 p-2">{items.map((a) => <Card key={a.id} className="p-3"><div className="font-medium">{a.name}</div><div className="text-xs text-muted">{a.classApplied} · {a.guardian}</div>{st !== "Enrolled" && <Button size="sm" className="mt-2" onClick={() => advance(a)}>Advance<ArrowRight size={13} /></Button>}</Card>)}{items.length === 0 && <p className="p-3 text-center text-xs text-muted">None</p>}</div></div>); })}</div>
  );
}
