"use client";
import { useState } from "react";
import { ArrowRight, Plus } from "lucide-react";
import { RecordDialog } from "@/components/ui/RecordDialog";
import { useRole } from "@/components/shell/AppShell";
import { LIVE } from "@/lib/live/config";
import { useSave } from "@/lib/live/useSave";
import { saveApplicant, setApplicantStage } from "@/lib/live/actions";
import { Badge, Button, Card } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/interactive";
const STAGES = ["Submitted", "Documents Reviewed", "Assessment", "Accepted", "Registered", "Enrolled"];
export interface Ap { id: string; name: string; classApplied: string; stage: string; date: string; guardian: string }
export function AdmissionsBoard({ initial, classes = [] }: { initial: Ap[]; classes?: { id: string; name: string }[] }) {
  const [listState, setList] = useState(initial); const list = LIVE ? initial : listState; const toast = useToast(); const run = useSave(); const { allow } = useRole(); const [adding, setAdding] = useState(false);
  const advance = (a: Ap) => { const n = STAGES[STAGES.indexOf(a.stage) + 1];
    if (LIVE) { void run(() => setApplicantStage(a.id, n), `${a.name} moved to “${n}”`); return; }
    setList((l) => l.map((x) => (x.id === a.id ? { ...x, stage: n } : x))); toast(`${a.name} moved to “${n}”`); };
  return (
    <>
    {LIVE && allow("students", "create") && <div className="mb-3 flex justify-end"><Button onClick={() => setAdding(true)}><Plus size={14} />New application</Button></div>}
    {adding && <RecordDialog open onClose={() => setAdding(false)} title="New application" submitLabel="Add application"
      fields={[{ key: "name", label: "Child's full name", required: true }, { key: "classId", label: "Class applied for", type: "select", options: classes.map((c) => c.name), required: true },
        { key: "guardian", label: "Parent / guardian name", required: true }, { key: "phone", label: "Parent phone", type: "tel", required: true, validate: (v) => (v.replace(/\D/g, "").length < 9 ? "Enter a valid phone number" : undefined) }]}
      initial={{ name: "", classId: "", guardian: "", phone: "" }}
      onSubmit={async (v) => { if (await run(() => saveApplicant({ name: v.name, classId: classes.find((c) => c.name === v.classId)?.id ?? "", guardian: v.guardian, phone: v.phone, stage: "Submitted" }), `${v.name} added to admissions`)) setAdding(false); }} />}
    <div className="flex gap-3 overflow-x-auto pb-2">{STAGES.map((st) => { const items = list.filter((a) => a.stage === st); return (
      <div key={st} className="w-[230px] shrink-0"><div className="mb-2 flex items-center justify-between px-1"><span className="text-xs font-semibold uppercase text-muted">{st}</span><Badge>{items.length}</Badge></div>
        <div className="space-y-2 rounded-xl bg-surface-2/60 p-2">{items.map((a) => <Card key={a.id} className="p-3"><div className="font-medium">{a.name}</div><div className="text-xs text-muted">{a.classApplied} · {a.guardian}</div>{st !== "Enrolled" && <Button size="sm" className="mt-2" onClick={() => advance(a)}>Advance<ArrowRight size={13} /></Button>}</Card>)}{items.length === 0 && <p className="p-3 text-center text-xs text-muted">None</p>}</div></div>); })}</div>
  </>
  );
}
