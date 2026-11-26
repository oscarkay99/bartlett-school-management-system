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
import { planFreq, planLabel, type PlanFrequency } from "@/lib/feeding";
import { money } from "@/lib/money";

/** A student as the Feeding module sees them this term. */
export interface FeedingPayee { id: string; name: string; adm: string; cls: string; billed: number; paid: number; rate: number; freq: PlanFrequency; perPeriod: number; payer?: { name: string; phone?: string } }
const PERIODS = ["Daily", "Weekly", "Monthly", "Term"] as const;
type Period = (typeof PERIODS)[number];
const METHODS = ["Cash", "Mobile Money", "Bank Transfer", "Card", "Cheque"];
const periodText = (p: Period) => (p === "Term" ? "for the term" : p.toLowerCase());

// Feeding paid on its own (daily / weekly / monthly / for the term). Never touches the school fees balance.
// The period and amount start from the student's payment plan.
export function FeedingPaymentDialog({ students, usedRefs, termLabel, today, onClose }: { students: FeedingPayee[]; usedRefs: string[]; termLabel: string; today: string; onClose: () => void }) {
  const toast = useToast(); const { reload } = useLiveData(); const [saving, setSaving] = useState(false); const [saveErr, setSaveErr] = useState("");
  const [sid, setSid] = useState(""); const [filter, setFilter] = useState(""); const [amount, setAmount] = useState(""); const [period, setPeriod] = useState<Period>("Weekly");
  const [method, setMethod] = useState("Mobile Money"); const [ref, setRef] = useState(""); const [date, setDate] = useState(today); const [done, setDone] = useState<string | null>(null);
  const st = students.find((s) => s.id === sid);
  const owed = st ? Math.max(0, st.rate - st.paid) : 0;
  const minor = Math.round(parseFloat(amount || "0") * 100);
  const pick = (s: FeedingPayee) => { setSid(s.id); setFilter("");
    const p: Period = planFreq(s.freq); setPeriod(p);
    const left = Math.max(0, s.rate - s.paid);
    const suggest = p === "Term" ? left : Math.min(s.perPeriod, left); if (suggest > 0) setAmount(String(suggest / 100)); };
  const err = useMemo(() => {
    if (!sid) return "Select a student"; if (!(minor > 0)) return "Enter an amount greater than zero";
    // Never more than this term's feeding still owed (the database refuses it too).
    if (minor > owed) return owed === 0 ? "Nothing is owed for feeding this term — no payment can be recorded." : `Only ${money(owed)} is owed for feeding — a payment can't be more than that.`;
    if (method !== "Cash" && !ref.trim()) return "An external reference is required for non-cash payments";
    if (ref.trim() && usedRefs.includes(ref.trim().toUpperCase())) return "This reference was already recorded — duplicate payment blocked";
    return "";
  }, [sid, minor, owed, method, ref, usedRefs]);
  const candidates = students.filter((s) => !filter || `${s.name} ${s.adm}`.toLowerCase().includes(filter.trim().toLowerCase())).slice(0, 6);
  return (
    <Modal open onClose={onClose} title={done ? "Feeding payment recorded" : "Record feeding payment"} wide
      footer={done ? <Button variant="primary" onClick={onClose}>Done</Button> : <><Button onClick={onClose}>Cancel</Button>
        <Button variant="success" disabled={!!err || saving} onClick={async () => {
          if (!LIVE) { setDone(`RCT-${String(900 + Math.floor(Math.random() * 99)).padStart(5, "0")}`); toast("Feeding payment recorded"); return; }
          // Live: a school-fees-account payment that is all feeding, for a period; it never touches the school fees balance.
          setSaving(true); setSaveErr("");
          const r = await recordPayment({ account: "fees", studentId: sid, amount: minor, method, date, ref, feedingAmount: minor, feedingPeriod: period, guardianId: undefined });
          setSaving(false); if (r.error) { setSaveErr(r.error); return; }
          setDone(r.receipt!); toast(`Feeding payment recorded — ${r.receipt}`); void reload();
        }}>{saving ? "Saving…" : "Confirm payment"}</Button></>}>
      {done && st ? (
        <div className="space-y-3 text-center"><CheckCircle2 className="mx-auto text-ok" size={40} />
          <p>Feeding receipt <b className="num">{done}</b> issued for <b>{money(minor)}</b> ({periodText(period)}).</p>
          <p className="text-muted">{st.name}&apos;s feeding still owed is now <b className={owed - minor > 0 ? "text-warn" : "text-ok"}>{money(Math.max(0, owed - minor))}</b>. School fees balance unchanged.</p>
          <Link target="_blank" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-sm font-medium hover:bg-surface-2"
            href={receiptLink({ title: "Official Receipt — Feeding", receiptNo: done, accountLabel: "Feeding", period: termLabel, payer: st.payer, student: { name: st.name, adm: st.adm, cls: st.cls },
              date, method, ref: ref.trim() || undefined, lines: [[`Feeding payment (${periodText(period)})`, minor]], amount: minor, balanceLabel: "Feeding still owed", balanceAfter: owed - minor, status: "Confirmed" })}>
            <Printer size={14} />Print receipt</Link>
          {!LIVE && <p className="text-xs text-muted">Front-end preview — the ledger and dashboards update once the backend posts this transaction.</p>}</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><Field label="Student *"><input className={inputClass} placeholder="Search name or admission no." value={st ? st.name : filter} onChange={(e) => { setSid(""); setFilter(e.target.value); }} /></Field>
            {!st && filter && candidates.length === 0 && <p className="mt-1 text-sm text-muted">No student matches &ldquo;{filter}&rdquo;.</p>}
            {!st && filter && <ul className="mt-1 rounded-lg border border-line">{candidates.map((s) => <li key={s.id}><button className="flex w-full justify-between px-3 py-2 text-left hover:bg-surface-2" onClick={() => pick(s)}><span>{s.name} <span className="text-xs text-muted">{s.cls} · {s.adm}</span></span><span className="text-xs text-muted">{planLabel(s.freq)}</span></button></li>)}</ul>}</div>
          <p className="sm:col-span-2 -mb-1 text-xs text-muted">Feeding paid on its own. It is not part of school fees and does not change the school fees balance.</p>
          {st && <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-2 p-3 text-sm"><span><b>{st.name}</b> · {st.cls} · Plan: <b>{planLabel(st.freq)}</b>{st.perPeriod > 0 && ` (${money(st.perPeriod)} per period)`}</span><span>Feeding still owed <b className="num text-danger">{money(owed)}</b></span></div>}
          <Field label="Amount (GH₵) *" hint={st ? (owed > 0 ? `At most ${money(owed)} (feeding still owed)` : "Nothing is owed") : undefined}><div className="flex gap-2"><input className={inputClass} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} placeholder="0.00" />
            {st && owed > 0 && <Button type="button" size="sm" onClick={() => setAmount(String(owed / 100))}>Pay all</Button>}</div></Field>
          <Field label="Paid for"><select className={inputClass} value={period} onChange={(e) => setPeriod(e.target.value as Period)}>{PERIODS.map((p) => <option key={p} value={p}>{p === "Term" ? "The term" : `One ${p === "Daily" ? "day" : p === "Weekly" ? "week" : "month"}`}</option>)}</select></Field>
          <Field label="Payment method *"><select className={inputClass} value={method} onChange={(e) => setMethod(e.target.value)}>{METHODS.map((m) => <option key={m}>{m}</option>)}</select></Field>
          <Field label="External reference" hint="Momo transaction ID, bank ref or cheque no."><input className={inputClass} value={ref} onChange={(e) => setRef(e.target.value)} /></Field>
          <Field label="Payment date"><input type="date" className={inputClass} value={date} max={today} onChange={(e) => setDate(e.target.value)} /></Field>
          {st && minor > 0 && <div className="flex items-end justify-between rounded-lg border border-line p-3 text-sm"><span>Feeding still owed after</span><b className="num">{money(Math.max(0, owed - minor))}</b></div>}
          {err && sid && minor > 0 && <p role="alert" className="sm:col-span-2 text-sm text-danger">{err}</p>}
          {saveErr && <p role="alert" className="sm:col-span-2 rounded-lg border border-danger/30 bg-danger/8 px-3 py-2 text-sm text-danger">Not saved: {saveErr}</p>}
        </div>)}
    </Modal>
  );
}
