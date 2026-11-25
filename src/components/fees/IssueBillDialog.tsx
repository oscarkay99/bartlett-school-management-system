"use client";
import Link from "next/link";
import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button, Field, inputClass } from "@/components/ui/primitives";
import { Modal, useToast } from "@/components/ui/interactive";
import { useCalendar } from "@/components/shell/CalendarContext";
import { useFeeSchedule } from "@/components/shell/FeeScheduleContext";
import { ACCOUNTS, activitiesFor, type FeeAccount } from "@/lib/accounts";
import { invoiceStem, termKey } from "@/lib/fees";
import { money } from "@/lib/money";

/** A student who can be billed in this account. `billed` maps a term key ("2026/2027|Term 1") to the lines they already have that term. */
export interface BillCandidate { id: string; name: string; adm: string; classId: string; cls: string; scholarship: boolean; billed: Record<string, string[]> }

// Issue an Extra Classes invoice (standalone, never added to school fees) for one student, for the term selected in the top bar.
// Prices come from that term's fee schedule. Front-end preview: the backend assigns the real number.
export function IssueBillDialog({ open, onClose, account, candidates }: { open: boolean; onClose: () => void; account: FeeAccount; candidates: BillCandidate[] }) {
  const A = ACCOUNTS[account]; const toast = useToast();
  const { year, term } = useCalendar(); const fs = useFeeSchedule(); const tf = fs.get(year, term);
  const [sid, setSid] = useState(""); const [filter, setFilter] = useState(""); const [acts, setActs] = useState<string[]>([]); const [done, setDone] = useState<string | null>(null);
  const st = candidates.find((c) => c.id === sid);
  const cls = st && fs.classes.find((c) => c.id === st.classId);
  const billed = st?.billed[termKey(year, term)] ?? [];
  const offered: string[] = cls ? activitiesFor(cls.level) : [];
  const items = ((): { label: string; amount: number }[] => {
    if (!st || !cls || !tf) return [];
    return acts.filter((a) => !billed.includes(a)).map((a) => ({ label: a, amount: tf.activities[a] ?? 0 }));
  })();
  const total = items.reduce((a, b) => a + b.amount, 0);
  const err = !tf ? `No fees set for ${term} ${year}` : !st ? "Select a student" : items.length === 0 ? "Select at least one activity" : items.some((i) => i.amount <= 0) ? `${items.find((i) => i.amount <= 0)!.label} has no price for ${term}` : "";
  const close = () => { setSid(""); setFilter(""); setActs([]); setDone(null); onClose(); };
  const list = candidates.filter((c) => !filter || (c.name + c.adm).toLowerCase().includes(filter.toLowerCase())).slice(0, 6);
  return (
    <Modal open={open} onClose={close} title={done ? "Bill issued" : `Enrol & bill student — ${term} ${year}`} wide
      footer={done ? <Button variant="primary" onClick={close}>Done</Button> : <><Button onClick={close}>Cancel</Button><Button variant="primary" disabled={!!err} onClick={() => { const no = `${invoiceStem(A.invoicePrefix, year, term)}-${String(900 + Math.floor(Math.random() * 99)).padStart(4, "0")}`; setDone(no); toast(`${A.label} bill ${no} issued`); }}>Issue bill · {money(total)}</Button></>}>
      {done ? (
        <div className="space-y-2 text-center"><CheckCircle2 className="mx-auto text-ok" size={40} />
          <p>{A.label} bill <b className="num">{done}</b> issued to {st?.name} for <b>{money(total)}</b>.</p>
          <p className="text-sm text-muted">This bill is separate from school fees. Payments against it get their own {A.receiptPrefix}- receipts.</p>
          <p className="text-xs text-muted">Front-end preview — the bill is saved once the backend is connected.</p></div>
      ) : !tf ? (
        <div className="space-y-2 text-sm"><p>{term} {year} has no fees set yet, so there is nothing to bill from.</p><Link className="font-medium text-info hover:underline" href="/settings?tab=fees" onClick={close}>Set {term} fees in Settings →</Link></div>
      ) : (
        <div className="space-y-4">
          <div><Field label="Student *"><input className={inputClass} placeholder="Search name or admission no." value={st ? st.name : filter} onChange={(e) => { setSid(""); setActs([]); setFilter(e.target.value); }} /></Field>
            {!st && filter && <ul className="mt-1 rounded-lg border border-line">{list.map((c) => { const has = c.billed[termKey(year, term)] ?? []; return <li key={c.id}><button className="flex w-full justify-between px-3 py-2 text-left hover:bg-surface-2" onClick={() => setSid(c.id)}><span>{c.name} <span className="text-xs text-muted">{c.cls} · {c.adm}</span></span>{has.length > 0 && <span className="text-xs text-muted">has {has.join(", ")}</span>}</button></li>; })}{list.length === 0 && <li className="px-3 py-2 text-sm text-muted">No matching students</li>}</ul>}</div>
          {st && account === "extra" && <fieldset><legend className="mb-1.5 text-sm font-medium">Activities</legend><div className="grid gap-2 sm:grid-cols-3">{offered.map((a) => { const has = billed.includes(a); return (
            <label key={a} className={`flex items-center justify-between gap-2 rounded-lg border border-line px-3 py-2 text-sm ${has ? "opacity-50" : "cursor-pointer hover:bg-surface-2"}`}><span className="flex items-center gap-2"><input type="checkbox" disabled={has} checked={has || acts.includes(a)} onChange={(e) => setActs(e.target.checked ? [...acts, a] : acts.filter((x) => x !== a))} />{a}</span><span className="num text-xs text-muted">{has ? "billed" : money(tf.activities[a] ?? 0)}</span></label>); })}</div>
            {cls?.level === "Kindergarten" && <p className="mt-1 text-xs text-muted">Kindergarten pupils can only take Music (Piano).</p>}</fieldset>}
          {items.length > 0 && <div className="rounded-lg border border-line p-3 text-sm"><div className="mb-1 font-medium">{A.invoiceTitle} preview · {term} {year}</div>{items.map((i) => <div key={i.label} className="flex justify-between py-0.5"><span>{i.label}</span><span className="num">{money(i.amount)}</span></div>)}<div className="mt-1 flex justify-between border-t border-line pt-1.5 font-medium"><span>Total</span><span className="num">{money(total)}</span></div></div>}
          {err && st && <p role="alert" className="text-sm text-danger">{err}</p>}
        </div>)}
    </Modal>
  );
}
