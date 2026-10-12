"use client";
import { useMemo, useState } from "react";
import { Search, UserPlus } from "lucide-react";
import { Badge, Button, Field, inputClass } from "@/components/ui/primitives";
import { Modal, useToast } from "@/components/ui/interactive";

const RELS = ["Father", "Mother", "Guardian", "Grandparent", "Uncle", "Aunt", "Sibling", "Sponsor"];
export function LinkChildButton({ parentName, students }: { parentName: string; students: { id: string; name: string; cls: string; adm: string }[] }) {
  const [open, setOpen] = useState(false); const [q, setQ] = useState(""); const [pick, setPick] = useState<string>(""); const [rel, setRel] = useState("Guardian"); const toast = useToast();
  const matches = useMemo(() => { const n = q.trim().toLowerCase(); return n.length < 2 ? [] : students.filter((s) => (s.name + s.adm).toLowerCase().includes(n)).slice(0, 6); }, [q, students]);
  const chosen = students.find((s) => s.id === pick);
  const close = () => { setOpen(false); setQ(""); setPick(""); };
  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}><UserPlus size={14} />Link another child</Button>
      <Modal open={open} onClose={close} title={`Link a child to ${parentName}`} footer={<><Button onClick={close}>Cancel</Button><Button variant="primary" disabled={!chosen} onClick={() => { toast(`${chosen!.name} linked to ${parentName}`); close(); }}>Link child</Button></>}>
        <div className="space-y-3">
          <div className="relative"><Search size={15} className="absolute left-3 top-3 text-muted" /><input className={`${inputClass} pl-9`} aria-label="Search students" placeholder="Search by name or admission number…" value={q} onChange={(e) => { setQ(e.target.value); setPick(""); }} /></div>
          {matches.map((s) => <button key={s.id} onClick={() => setPick(s.id)} className={`flex w-full items-center justify-between rounded-lg border p-2.5 text-left hover:bg-surface-2 ${pick === s.id ? "border-info bg-info/8" : "border-line"}`}><span><b>{s.name}</b><span className="block text-xs text-muted">{s.adm} · {s.cls}</span></span>{pick === s.id && <Badge tone="info">Selected</Badge>}</button>)}
          {q.trim().length >= 2 && matches.length === 0 && <p className="text-sm text-muted">No unlinked student matches “{q}”.</p>}
          <Field label="Relationship"><select className={inputClass} value={rel} onChange={(e) => setRel(e.target.value)}>{RELS.map((r) => <option key={r}>{r}</option>)}</select></Field>
        </div>
      </Modal>
    </>
  );
}
