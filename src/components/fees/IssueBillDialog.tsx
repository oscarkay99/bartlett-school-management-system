"use client";
import { useMemo, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button, Field, inputClass } from "@/components/ui/primitives";
import { Modal, useToast } from "@/components/ui/interactive";
import { ACCOUNTS, ACTIVITIES, type FeeAccount } from "@/lib/accounts";
import { money } from "@/lib/money";

/** A student who can be billed in this account. `feeding` is the class feeding rate; `kg` limits activities to Music. `billed` lists what they already have this term. */
export interface BillCandidate { id: string; name: string; adm: string; cls: string; feeding: number; kg: boolean; billed: string[] }

// Issue a feeding bill or an extracurricular invoice for one student. Front-end preview: the backend assigns the real number.
export function IssueBillDialog({ open, onClose, account, candidates, activityFees }: { open: boolean; onClose: () => void; account: FeeAccount; candidates: BillCandidate[]; activityFees: Record<string, number> }) {
  const A = ACCOUNTS[account]; const toast = useToast();
  const [sid, setSid] = useState(""); const [filter, setFilter] = useState(""); const [acts, setActs] = useState<string[]>([]); const [done, setDone] = useState<string | null>(null);
  const st = candidates.find((c) => c.id === sid);
  const offered = st?.kg ? ["Music (Piano)"] : [...ACTIVITIES];
  const items = useMemo(() => {
    if (!st) return [];
    if (account === "feeding") return st.billed.includes("Feeding") ? [] : [{ label: "Feeding", amount: st.feeding }];
    return acts.filter((a) => !st.billed.includes(a)).map((a) => ({ label: a, amount: activityFees[a] }));
  }, [st, account, acts, activityFees]);
  const total = items.reduce((a, b) => a + b.amount, 0);
  const err = !st ? "Select a student" : account === "feeding" && st.billed.includes("Feeding") ? `${st.name} already has a feeding bill this term` : items.length === 0 ? "Select at least one activity" : "";
  const close = () => { setSid(""); setFilter(""); setActs([]); setDone(null); onClose(); };
  const list = candidates.filter((c) => !filter || (c.name + c.adm).toLowerCase().includes(filter.toLowerCase())).slice(0, 6);
  return (
    <Modal open={open} onClose={close} title={done ? "Bill issued" : account === "feeding" ? "Add student to feeding" : "Enrol & bill student"} wide
      footer={done ? <Button variant="primary" onClick={close}>Done</Button> : <><Button onClick={close}>Cancel</Button><Button variant="primary" disabled={!!err} onClick={() => { const no = `${A.invoicePrefix}-2627-T1-${String(900 + Math.floor(Math.random() * 99)).padStart(4, "0")}`; setDone(no); toast(`${A.label} bill ${no} issued`); }}>Issue bill · {money(total)}</Button></>}>
      {done ? (
        <div className="space-y-2 text-center"><CheckCircle2 className="mx-auto text-ok" size={40} />
          <p>{A.label} bill <b className="num">{done}</b> issued to {st?.name} for <b>{money(total)}</b>.</p>
          <p className="text-sm text-muted">This bill is separate from school fees. Payments against it get their own {A.receiptPrefix}- receipts.</p>
          <p className="text-xs text-muted">Front-end preview — the bill is saved once the backend is connected.</p></div>
      ) : (
        <div className="space-y-4">
          <div><Field label="Student *"><input className={inputClass} placeholder="Search name or admission no." value={st ? st.name : filter} onChange={(e) => { setSid(""); setActs([]); setFilter(e.target.value); }} /></Field>
            {!st && filter && <ul className="mt-1 rounded-lg border border-line">{list.map((c) => <li key={c.id}><button className="flex w-full justify-between px-3 py-2 text-left hover:bg-surface-2" onClick={() => setSid(c.id)}><span>{c.name} <span className="text-xs text-muted">{c.cls} · {c.adm}</span></span>{c.billed.length > 0 && <span className="text-xs text-muted">has {c.billed.join(", ")}</span>}</button></li>)}{list.length === 0 && <li className="px-3 py-2 text-sm text-muted">No matching students</li>}</ul>}</div>
          {st && account === "extra" && <fieldset><legend className="mb-1.5 text-sm font-medium">Activities</legend><div className="grid gap-2 sm:grid-cols-3">{offered.map((a) => { const has = st.billed.includes(a); return (
            <label key={a} className={`flex items-center justify-between gap-2 rounded-lg border border-line px-3 py-2 text-sm ${has ? "opacity-50" : "cursor-pointer hover:bg-surface-2"}`}><span className="flex items-center gap-2"><input type="checkbox" disabled={has} checked={has || acts.includes(a)} onChange={(e) => setActs(e.target.checked ? [...acts, a] : acts.filter((x) => x !== a))} />{a}</span><span className="num text-xs text-muted">{has ? "billed" : money(activityFees[a])}</span></label>); })}</div>
            {st.kg && <p className="mt-1 text-xs text-muted">Kindergarten pupils can only take Music (Piano).</p>}</fieldset>}
          {items.length > 0 && <div className="rounded-lg border border-line p-3 text-sm"><div className="mb-1 font-medium">{A.invoiceTitle} preview · Term 1 2026/2027</div>{items.map((i) => <div key={i.label} className="flex justify-between py-0.5"><span>{i.label}</span><span className="num">{money(i.amount)}</span></div>)}<div className="mt-1 flex justify-between border-t border-line pt-1.5 font-medium"><span>Total</span><span className="num">{money(total)}</span></div></div>}
          {err && st && <p role="alert" className="text-sm text-danger">{err}</p>}
        </div>)}
    </Modal>
  );
}
