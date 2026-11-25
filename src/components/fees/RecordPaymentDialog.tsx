"use client";
import { useMemo, useState } from "react";
import { CheckCircle2, Printer } from "lucide-react";
import { Badge, Button, Field, inputClass } from "@/components/ui/primitives";
import { Modal, MoneyInput, useToast } from "@/components/ui/interactive";
import { useFeedingPlans } from "@/components/shell/FeedingPlansContext";
import { useCalendar } from "@/components/shell/CalendarContext";
import { termKey } from "@/lib/fees";
import { perPeriod } from "@/lib/feeding";
import { money } from "@/lib/money";
import { ACCOUNTS, type FeeAccount } from "@/lib/accounts";

/** `feedingOwed`: feeding still owed on the school fees invoice (feeding is billed there). */
export interface PayStudent { id: string; name: string; adm: string; cls: string; balance: number; feedingOwed?: number; feedingRate?: number; invoices: { no: string; balance: number }[] }
const PERIODS = ["Daily", "Weekly", "Monthly", "Term"] as const;
const METHODS = ["Cash", "Mobile Money", "Bank Transfer", "Card", "Cheque", "Sponsor"];

export function RecordPaymentDialog({ open, onClose, students, studentId, usedRefs, account = "fees" }: { open: boolean; onClose: () => void; students: PayStudent[]; studentId?: string; usedRefs: string[]; account?: FeeAccount }) {
  const A = ACCOUNTS[account];
  const [sid, setSid] = useState(studentId ?? ""); const [amount, setAmount] = useState(""); const [method, setMethod] = useState("Mobile Money"); const [ref, setRef] = useState("");
  const [date, setDate] = useState("2026-10-12"); const [note, setNote] = useState(""); const [done, setDone] = useState<null | { receipt: string; after: number }>(null);
  const [filter, setFilter] = useState(""); const toast = useToast();
  // School fees only: what the payment is for. Feeding is billed on the school fees invoice and can be paid with the fees
  // at once, or on its own daily / weekly / monthly / for the term.
  const [purpose, setPurpose] = useState<"fees" | "feeding">("fees"); const [periodSel, setPeriod] = useState<(typeof PERIODS)[number] | null>(null);
  const [feedPart, setFeedPart] = useState<number | null>(null);
  const st = students.find((s) => s.id === sid);
  const minor = Math.round(parseFloat(amount || "0") * 100);
  const isFees = account === "fees"; const feedingOwed = Math.max(0, st?.feedingOwed ?? 0);
  // The student's feeding payment plan pre-selects the period and suggests the amount per period.
  const plans = useFeedingPlans(); const { calendar, year, term } = useCalendar();
  const td = calendar.find((y) => y.name === year)?.terms.find((t) => t.name === term);
  const planFreq = st ? plans.planOn(st.id, termKey(year, term), date)?.frequency : undefined;
  const planned = planFreq && planFreq !== "With school fees" ? planFreq : undefined;
  const period = periodSel ?? planned ?? "Weekly";
  const suggested = planned && td && st?.feedingRate ? Math.min(perPeriod(st.feedingRate, td, planned), feedingOwed || Infinity) : 0;
  // Feeding part of this payment: all of it for a feeding-only payment; otherwise what the bursar entered,
  // defaulting to the feeding still owed (never more than the payment).
  const feeding = !isFees ? 0 : purpose === "feeding" ? minor : Math.min(minor, feedPart ?? feedingOwed);
  const err = useMemo(() => {
    if (!sid) return "Select a student"; if (!(minor > 0)) return "Enter an amount greater than zero";
    if (isFees && purpose === "fees" && feedPart !== null && feedPart > minor) return "The feeding part cannot be more than the payment";
    if (method !== "Cash" && !ref.trim()) return "An external reference is required for non-cash payments";
    if (ref.trim() && usedRefs.includes(ref.trim().toUpperCase())) return "This reference was already recorded — duplicate payment blocked";
    return "";
  }, [sid, minor, method, ref, usedRefs, isFees, purpose, feedPart]);
  const alloc = useMemo(() => { if (!st || !(minor > 0)) return []; let left = minor; const out = st.invoices.map((i) => { const a = Math.min(left, Math.max(0, i.balance)); left -= a; return { no: i.no, applied: a }; }); if (left > 0) out.push({ no: "Credit on account", applied: left }); return out; }, [st, minor]);
  const reset = () => { setDone(null); setAmount(""); setRef(""); setNote(""); setPurpose("fees"); setFeedPart(null); setPeriod(null); if (!studentId) setSid(""); onClose(); };
  const candidates = students.filter((s) => !filter || (s.name + s.adm).toLowerCase().includes(filter.toLowerCase())).slice(0, 6);
  return (
    <Modal open={open} onClose={reset} title={done ? `${A.label} payment recorded` : `Record ${A.label.toLowerCase()} payment`} wide
      footer={done ? <Button variant="primary" onClick={reset}>Done</Button> : <><Button onClick={reset}>Cancel</Button><Button variant="success" disabled={!!err} onClick={() => { setDone({ receipt: `${A.receiptPrefix}-${String(900 + Math.floor(Math.random() * 99)).padStart(5, "0")}`, after: (st?.balance ?? 0) - minor }); toast(`${A.label} payment recorded`); }}>Confirm payment</Button></>}>
      {done ? (
        <div className="space-y-3 text-center"><CheckCircle2 className="mx-auto text-ok" size={40} />
          <p>{A.label} receipt <b className="num">{done.receipt}</b> issued for <b>{money(minor)}</b>.</p>
          {isFees && feeding > 0 && <p className="text-sm">{purpose === "feeding" ? `Feeding payment (${period.toLowerCase()})` : `Of which feeding: ${money(feeding)}`}</p>}
          {isFees && purpose === "feeding" ? <p className="text-muted">{st?.name}&apos;s feeding still owed is now <b>{money(Math.max(0, feedingOwed - minor))}</b>. School fees balance unchanged.</p>
              : <p className="text-muted">{st?.name}&apos;s {A.label.toLowerCase()} balance is now <b className={done.after > 0 ? "text-warn" : "text-ok"}>{money(Math.max(0, done.after))}</b>{done.after < 0 && ` (credit ${money(-done.after)})`}.</p>}
          <Button onClick={() => window.print()}><Printer size={14} />Print receipt</Button>
          <p className="text-xs text-muted">Front-end preview — the ledger and dashboards update once the backend posts this transaction.</p></div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {!studentId && <div className="sm:col-span-2"><Field label="Student *"><input className={inputClass} placeholder="Search name or admission no." value={st ? st.name : filter} onChange={(e) => { setSid(""); setFilter(e.target.value); }} /></Field>
            {!st && filter && <ul className="mt-1 rounded-lg border border-line">{candidates.map((s) => <li key={s.id}><button className="flex w-full justify-between px-3 py-2 text-left hover:bg-surface-2" onClick={() => setSid(s.id)}><span>{s.name} <span className="text-xs text-muted">{s.cls} · {s.adm}</span></span><span className="num text-xs">{money(s.balance)}</span></button></li>)}</ul>}</div>}
          <p className="sm:col-span-2 -mb-1 text-xs text-muted">This payment is applied to {A.label} only and gets its own {A.receiptPrefix}- receipt. It does not reduce any other balance.</p>
          {st && <div className="sm:col-span-2 flex items-center justify-between rounded-lg bg-surface-2 p-3"><span><b>{st.name}</b> · {st.cls}</span><span>{A.label} outstanding <b className="num text-danger">{money(st.balance)}</b></span></div>}
          <Field label="Amount (GH₵) *"><input className={inputClass} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} placeholder="0.00" /></Field>
          {isFees && <fieldset className="sm:col-span-2 rounded-lg border border-line p-3">
            <legend className="px-1 text-sm font-medium">This payment is for</legend>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
              <label className="flex items-center gap-2"><input type="radio" checked={purpose === "fees"} onChange={() => setPurpose("fees")} />School fees (feeding included)</label>
              <label className="flex items-center gap-2"><input type="radio" checked={purpose === "feeding"} onChange={() => setPurpose("feeding")} />Feeding only <span className="text-xs text-muted">(paid separately, not part of school fees)</span></label>
            </div>
            {purpose === "fees" ? <div className="mt-3 flex flex-wrap items-center gap-3 text-sm"><span>Of which feeding</span>
                <MoneyInput key={`${sid}-${feedPart === null ? minor : "edited"}`} className="w-36" label="Of which feeding (GH₵)" value={feedPart ?? Math.min(minor, feedingOwed)} onChange={setFeedPart} />
                {st && <span className="text-xs text-muted">Feeding still owed: {money(feedingOwed)}</span>}</div>
              : <div className="mt-3 flex flex-wrap items-center gap-3 text-sm"><span>Paid</span>
                <select aria-label="Feeding period" className="h-9 rounded-lg border border-line bg-surface px-2 text-sm" value={period} onChange={(e) => setPeriod(e.target.value as typeof period)}>{PERIODS.map((p) => <option key={p} value={p}>{p === "Term" ? "For the term" : p}</option>)}</select>
                {st && <span className="text-xs text-muted">Feeding still owed: {money(feedingOwed)}</span>}
                {planned && <span className="basis-full text-xs">Plan: <b>{planned === "Term" ? "Termly" : planned}</b>{suggested > 0 && <> · {money(suggested)} per period <button type="button" className="ml-1 font-medium text-info hover:underline" onClick={() => setAmount(String(suggested / 100))}>Use {money(suggested)}</button></>}</span>}</div>}
          </fieldset>}
          <Field label="Payment method *"><select className={inputClass} value={method} onChange={(e) => setMethod(e.target.value)}>{METHODS.map((m) => <option key={m}>{m}</option>)}</select></Field>
          <Field label="External reference" hint="Momo transaction ID, bank ref or cheque no."><input className={inputClass} value={ref} onChange={(e) => setRef(e.target.value)} /></Field>
          <Field label="Payment date"><input type="date" className={inputClass} value={date} max="2026-10-12" onChange={(e) => setDate(e.target.value)} /></Field>
          <div className="sm:col-span-2"><Field label="Notes"><input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} /></Field></div>
          {isFees && purpose === "feeding" && st && minor > 0 && <div className="sm:col-span-2 flex justify-between rounded-lg border border-line p-3 text-sm"><span>Feeding still owed after this payment <span className="text-xs text-muted">(school fees balance unchanged)</span></span><b className="num">{money(Math.max(0, feedingOwed - minor))}</b></div>}
          {!(isFees && purpose === "feeding") && alloc.length > 0 && <div className="sm:col-span-2 rounded-lg border border-line p-3 text-sm"><div className="mb-1 font-medium">Allocation preview <Badge>oldest invoice first</Badge></div>{alloc.filter((a) => a.applied > 0).map((a) => <div key={a.no} className="flex justify-between py-0.5"><span>{a.no}</span><span className="num">{money(a.applied)}</span></div>)}
            {st && <div className="mt-1 flex justify-between border-t border-line pt-1.5 font-medium"><span>Balance after payment</span><span className="num">{money(Math.max(0, st.balance - minor))}</span></div>}</div>}
          {err && sid && minor > 0 && <p role="alert" className="sm:col-span-2 text-sm text-danger">{err}</p>}
        </div>)}
    </Modal>
  );
}
