"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Printer } from "lucide-react";
import { Badge, Button, Field, inputClass } from "@/components/ui/primitives";
import { Modal, useToast } from "@/components/ui/interactive";
import { money } from "@/lib/money";
import { ACCOUNTS, type FeeAccount } from "@/lib/accounts";
import { useCalendar } from "@/components/shell/CalendarContext";
import { receiptLink } from "@/components/ReceiptDoc";
import { LIVE } from "@/lib/live/config";
import * as Q from "@/lib/data/queries";
import { useLiveData } from "@/lib/live/data";
import { recordPayment } from "@/lib/live/actions";

/** Feeding paid on its own is recorded in the Feeding module, not here. The feeding fields are optional extras callers may pass. */
export interface PayStudent { id: string; name: string; adm: string; cls: string; balance: number; feedingOwed?: number; feedingRate?: number; payer?: { name: string; phone?: string }; items?: string[]; invoices: { no: string; balance: number }[] }
const METHODS = ["Cash", "Mobile Money", "Bank Transfer", "Card", "Cheque", "Sponsor"];

export function RecordPaymentDialog({ open, onClose, students, studentId, usedRefs, account = "fees" }: { open: boolean; onClose: () => void; students: PayStudent[]; studentId?: string; usedRefs: string[]; account?: FeeAccount }) {
  const A = ACCOUNTS[account];
  const [sid, setSid] = useState(studentId ?? ""); const [amount, setAmount] = useState(""); const [method, setMethod] = useState("Mobile Money"); const [ref, setRef] = useState("");
  const [date, setDate] = useState(Q.TODAY); const [note, setNote] = useState(""); const [done, setDone] = useState<null | { receipt: string; after: number }>(null);
  const [filter, setFilter] = useState(""); const toast = useToast(); const { year, term } = useCalendar(); const { reload } = useLiveData(); const [saving, setSaving] = useState(false); const [saveErr, setSaveErr] = useState("");
  const st = students.find((s) => s.id === sid);
  const minor = Math.round(parseFloat(amount || "0") * 100);
  const maxPay = Math.max(0, st?.balance ?? 0);   // the most that can be paid now
  const err = useMemo(() => {
    if (!sid) return "Select a student"; if (!(minor > 0)) return "Enter an amount greater than zero";
    // Never more than is owed (the database refuses it too).
    if (minor > maxPay) return maxPay === 0 ? `Nothing is owed for ${A.label.toLowerCase()} — no payment can be recorded.` : `Only ${money(maxPay)} is owed — a payment can't be more than that.`;
    if (method !== "Cash" && !ref.trim()) return "An external reference is required for non-cash payments";
    if (ref.trim() && usedRefs.includes(ref.trim().toUpperCase())) return "This reference was already recorded — duplicate payment blocked";
    return "";
  }, [sid, minor, maxPay, A.label, method, ref, usedRefs]);
  const alloc = useMemo(() => { if (!st || !(minor > 0)) return []; let left = minor; const out = st.invoices.map((i) => { const a = Math.min(left, Math.max(0, i.balance)); left -= a; return { no: i.no, applied: a }; }); if (left > 0) out.push({ no: "Credit on account", applied: left }); return out; }, [st, minor]);
  const reset = () => { setDone(null); setAmount(""); setRef(""); setNote(""); if (!studentId) setSid(""); onClose(); };
  const candidates = students.filter((s) => !filter.trim() || `${s.name} ${s.adm}`.toLowerCase().includes(filter.trim().toLowerCase())).slice(0, 6);
  return (
    <Modal open={open} onClose={reset} title={done ? `${A.label} payment recorded` : `Record ${A.label.toLowerCase()} payment`} wide
      footer={done ? <Button variant="primary" onClick={reset}>Done</Button> : <><Button onClick={reset}>Cancel</Button><Button variant="success" disabled={!!err || saving} onClick={async () => {
          if (!LIVE) { setDone({ receipt: `${A.receiptPrefix}-${String(900 + Math.floor(Math.random() * 99)).padStart(5, "0")}`, after: (st?.balance ?? 0) - minor }); toast(`${A.label} payment recorded`); return; }
          // Live: the database assigns the receipt number and refuses a reference already used.
          setSaving(true); setSaveErr("");
          const r = await recordPayment({ account, studentId: sid, amount: minor, method, date, ref, note });
          setSaving(false); if (r.error) { setSaveErr(r.error); return; }
          setDone({ receipt: r.receipt!, after: (st?.balance ?? 0) - minor }); toast(`${A.label} payment recorded — ${r.receipt}`); void reload();
        }}>{saving ? "Saving…" : "Confirm payment"}</Button></>}>
      {done ? (
        <div className="space-y-3 text-center"><CheckCircle2 className="mx-auto text-ok" size={40} />
          <p>{A.label} receipt <b className="num">{done.receipt}</b> issued for <b>{money(minor)}</b>.</p>
          <p className="text-muted">{st?.name}&apos;s {A.label.toLowerCase()} balance is now <b className={done.after > 0 ? "text-warn" : "text-ok"}>{money(Math.max(0, done.after))}</b>{done.after < 0 && ` (credit ${money(-done.after)})`}.</p>
          {st && <Link target="_blank" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-sm font-medium hover:bg-surface-2"
            href={receiptLink({ title: A.receiptTitle, receiptNo: done.receipt, accountLabel: A.label, period: `${term}, ${year}`, payer: st.payer, student: { name: st.name, adm: st.adm, cls: st.cls },
              date, method, ref: ref.trim() || undefined, lines: [[`Payment towards ${A.label.toLowerCase()}${st.items?.length ? ` (${st.items.join(", ")})` : ""}`, minor]], amount: minor,
              balanceLabel: `${A.label} balance after this payment`, balanceAfter: done.after, status: "Confirmed" })}><Printer size={14} />Print receipt</Link>}
          {!LIVE && <p className="text-xs text-muted">Front-end preview — the ledger and dashboards update once the backend posts this transaction.</p>}</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {!studentId && <div className="sm:col-span-2"><Field label="Student *"><input className={inputClass} placeholder="Search name or admission no." value={st ? st.name : filter} onChange={(e) => { setSid(""); setFilter(e.target.value); }} /></Field>
            {!st && filter && candidates.length === 0 && <p className="mt-1 text-sm text-muted">No student matches &ldquo;{filter}&rdquo;. Check the spelling, or register the student first.</p>}
            {!st && filter && <ul className="mt-1 rounded-lg border border-line">{candidates.map((s) => <li key={s.id}><button className="flex w-full justify-between px-3 py-2 text-left hover:bg-surface-2" onClick={() => setSid(s.id)}><span>{s.name} <span className="text-xs text-muted">{s.cls} · {s.adm}</span></span><span className="num text-xs">{money(s.balance)}</span></button></li>)}</ul>}</div>}
          <p className="sm:col-span-2 -mb-1 text-xs text-muted">This payment is applied to {A.label} only and gets its own {A.receiptPrefix}- receipt. It does not reduce any other balance.{account === "fees" && " Feeding paid on its own is recorded in the Feeding module."}</p>
          {st && <div className="sm:col-span-2 flex items-center justify-between rounded-lg bg-surface-2 p-3"><span><b>{st.name}</b> · {st.cls}</span><span className="text-right">{A.label} outstanding <b className="num text-danger">{money(st.balance)}</b>
            {st.invoices.some((i) => i.balance > 0) && <span className="block text-xs text-muted">from {st.invoices.filter((i) => i.balance > 0).map((i) => i.no).join(", ")}{st.items?.length ? ` (${st.items.join(", ")})` : ""}</span>}</span></div>}
          <Field label="Amount (GH₵) *" hint={st ? (maxPay > 0 ? `At most ${money(maxPay)} (what is owed)` : "Nothing is owed") : undefined}><div className="flex gap-2"><input className={inputClass} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} placeholder="0.00" />
            {st && maxPay > 0 && <Button type="button" size="sm" onClick={() => setAmount(String(maxPay / 100))}>Pay all</Button>}</div></Field>
          <Field label="Payment method *"><select className={inputClass} value={method} onChange={(e) => setMethod(e.target.value)}>{METHODS.map((m) => <option key={m}>{m}</option>)}</select></Field>
          <Field label="External reference" hint="Momo transaction ID, bank ref or cheque no."><input className={inputClass} value={ref} onChange={(e) => setRef(e.target.value)} /></Field>
          <Field label="Payment date"><input type="date" className={inputClass} value={date} max={Q.TODAY} onChange={(e) => setDate(e.target.value)} /></Field>
          <div className="sm:col-span-2"><Field label="Notes"><input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} /></Field></div>
          {alloc.length > 0 && <div className="sm:col-span-2 rounded-lg border border-line p-3 text-sm"><div className="mb-1 font-medium">Allocation preview <Badge>oldest invoice first</Badge></div>{alloc.filter((a) => a.applied > 0).map((a) => <div key={a.no} className="flex justify-between py-0.5"><span>{a.no}</span><span className="num">{money(a.applied)}</span></div>)}
            {st && <div className="mt-1 flex justify-between border-t border-line pt-1.5 font-medium"><span>Balance after payment</span><span className="num">{money(Math.max(0, st.balance - minor))}</span></div>}</div>}
          {err && sid && minor > 0 && <p role="alert" className="sm:col-span-2 text-sm text-danger">{err}</p>}
          {saveErr && <p role="alert" className="sm:col-span-2 rounded-lg border border-danger/30 bg-danger/8 px-3 py-2 text-sm text-danger">Not saved: {saveErr}</p>}
        </div>)}
    </Modal>
  );
}
