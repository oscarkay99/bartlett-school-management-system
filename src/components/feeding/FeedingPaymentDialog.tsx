"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Printer } from "lucide-react";
import { Button, Field, inputClass } from "@/components/ui/primitives";
import { Modal, useToast } from "@/components/ui/interactive";
import { receiptLink } from "@/components/ReceiptDoc";
import { LIVE } from "@/lib/live/config";
import { useLiveData } from "@/lib/live/data";
import { recordPayment } from "@/lib/live/actions";
import { useCalendar } from "@/components/shell/CalendarContext";
import { splitTerm, TermSelect } from "@/components/fees/TermSelect";
import { Field as F2 } from "@/components/ui/primitives";
import { money } from "@/lib/money";

/** A student as the Feeding module sees them this term. */
export interface FeedingPayee { id: string; name: string; adm: string; cls: string; billed: number; paid: number; rate: number; payer?: { name: string; phone?: string } }
const METHODS = ["Cash", "Mobile Money", "Bank Transfer", "Card", "Cheque"];

// Feeding paid on its own: any amount, at any time (no payment plans). Never touches the school fees balance.

/** `initial`: open with this student already chosen (e.g. from Find a student). */
export function FeedingPaymentDialog({ students, usedRefs, termLabel, today, onClose, initial }: { students: FeedingPayee[]; usedRefs: string[]; termLabel: string; today: string; onClose: () => void; initial?: string }) {
  const first = students.find((x) => x.id === initial);
  const toast = useToast(); const { reload } = useLiveData(); const [saving, setSaving] = useState(false); const [saveErr, setSaveErr] = useState("");
  const [sid, setSid] = useState(first?.id ?? ""); const [filter, setFilter] = useState(""); const [amount, setAmount] = useState("");
  // The term and year this feeding payment is for (starts on the term selected at the top).
  const cal = useCalendar(); const [forTerm, setForTerm] = useState(`${cal.year}|${cal.term}`); const pt = splitTerm(forTerm); const forLabel = `${pt.term}, ${pt.year}`;
  const [method, setMethod] = useState("Mobile Money"); const [ref, setRef] = useState(""); const [date, setDate] = useState(today); const [done, setDone] = useState<string | null>(null);
  const st = students.find((s) => s.id === sid);
  const minor = Math.round(parseFloat(amount || "0") * 100);
  const pick = (s: FeedingPayee) => { setSid(s.id); setFilter(""); };
  const err = useMemo(() => {
    if (!sid) return "Select a student"; if (!(minor > 0)) return "Enter an amount greater than zero";
    if (method !== "Cash" && !ref.trim()) return "An external reference is required for non-cash payments";
    if (ref.trim() && usedRefs.includes(ref.trim().toUpperCase())) return "This reference was already recorded — duplicate payment blocked";
    return "";
  }, [sid, minor, method, ref, usedRefs]);
  const candidates = students.filter((s) => !filter || `${s.name} ${s.adm}`.toLowerCase().includes(filter.trim().toLowerCase())).slice(0, 6);
  return (
    <Modal open onClose={onClose} title={done ? "Feeding payment recorded" : "Record feeding payment"} wide
      footer={done ? <Button variant="primary" onClick={onClose}>Done</Button> : <><Button onClick={onClose}>Cancel</Button>
        <Button variant="success" disabled={!!err || saving} onClick={async () => {
          if (!LIVE) { setDone(`RCT-${String(900 + Math.floor(Math.random() * 99)).padStart(5, "0")}`); toast("Feeding payment recorded"); return; }
          // Live: a school-fees-account payment that is all feeding, for a period; it never touches the school fees balance.
          setSaving(true); setSaveErr("");
          const r = await recordPayment({ account: "fees", studentId: sid, amount: minor, method, date, ref, feedingAmount: minor, feedingPeriod: "Term", guardianId: undefined, year: pt.year, term: pt.term });
          setSaving(false); if (r.error) { setSaveErr(r.error); return; }
          setDone(r.receipt!); toast(`Feeding payment recorded — ${r.receipt}`); void reload();
        }}>{saving ? "Saving…" : "Confirm payment"}</Button></>}>
      {done && st ? (
        <div className="space-y-3 text-center"><CheckCircle2 className="mx-auto text-ok" size={40} />
          <p>Feeding receipt <b className="num">{done}</b> issued for <b>{money(minor)}</b>, for {forLabel}.</p>
          <p className="text-muted">School fees balance unchanged.</p>
          <Link target="_blank" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-sm font-medium hover:bg-surface-2"
            href={receiptLink({ title: "Official Receipt — Feeding", receiptNo: done, accountLabel: "Feeding", period: forLabel, payer: st.payer, student: { name: st.name, adm: st.adm, cls: st.cls },
              date, method, ref: ref.trim() || undefined, lines: [["Feeding payment", minor]], amount: minor, status: "Confirmed" })}>
            <Printer size={14} />Print receipt</Link>
          {!LIVE && <p className="text-xs text-muted">Front-end preview — the ledger and dashboards update once the backend posts this transaction.</p>}</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><Field label="Student *"><input className={inputClass} placeholder="Search name or admission no." value={st ? st.name : filter} onChange={(e) => { setSid(""); setFilter(e.target.value); }} /></Field>
            {!st && filter && candidates.length === 0 && <p className="mt-1 text-sm text-muted">No student matches &ldquo;{filter}&rdquo;.</p>}
            {!st && filter && <ul className="mt-1 rounded-lg border border-line">{candidates.map((s) => <li key={s.id}><button className="flex w-full justify-between px-3 py-2 text-left hover:bg-surface-2" onClick={() => pick(s)}><span>{s.name} <span className="text-xs text-muted">{s.cls} · {s.adm}</span></span></button></li>)}</ul>}</div>
          <p className="sm:col-span-2 -mb-1 text-xs text-muted">Feeding paid on its own. It is not part of school fees and does not change the school fees balance.</p>
          <div className="sm:col-span-2"><F2 label="Payment is for *" hint="The term and year this feeding payment is for."><TermSelect value={forTerm} onChange={setForTerm} /></F2></div>
          {st && <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-2 p-3 text-sm"><span><b>{st.name}</b> · {st.cls}</span></div>}
          <Field label="Amount (GH₵) *"><div className="flex gap-2"><input className={inputClass} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} placeholder="0.00" /></div></Field>
          <Field label="Payment method *"><select className={inputClass} value={method} onChange={(e) => setMethod(e.target.value)}>{METHODS.map((m) => <option key={m}>{m}</option>)}</select></Field>
          <Field label="External reference" hint="Momo transaction ID, bank ref or cheque no."><input className={inputClass} value={ref} onChange={(e) => setRef(e.target.value)} /></Field>
          <Field label="Payment date"><input type="date" className={inputClass} value={date} max={today} onChange={(e) => setDate(e.target.value)} /></Field>
          {err && sid && minor > 0 && <p role="alert" className="sm:col-span-2 text-sm text-danger">{err}</p>}
          {saveErr && <p role="alert" className="sm:col-span-2 rounded-lg border border-danger/30 bg-danger/8 px-3 py-2 text-sm text-danger">Not saved: {saveErr}</p>}
        </div>)}
    </Modal>
  );
}
