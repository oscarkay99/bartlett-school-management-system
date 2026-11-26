"use client";
import { useState } from "react";
import { Button, Field, inputClass } from "@/components/ui/primitives";
import { Modal, useToast } from "@/components/ui/interactive";
import { planFreq, PLAN_FREQUENCIES, periodWord, perPeriod, planLabel, validatePlan, type FeedingPlan, type PlanFrequency, type TermDates } from "@/lib/feeding";
import { money } from "@/lib/money";
import { fmtDate } from "@/lib/utils";

/** Today, kept within the term (the default start date for a plan change). */
export const clampToTerm = (today: string, t: TermDates) => (today < t.start ? t.start : today > t.end ? t.end : today);

// Change how a family pays feeding this term. The history is kept: the new plan applies from its start date.
export function PlanDialog({ student, current, rate, term, termLabel, termKey, today, onClose, onSave }: {
  student: { id: string; name: string }; current: PlanFrequency; rate: number; term: TermDates; termLabel: string; termKey: string; today: string;
  onClose: () => void; onSave: (p: FeedingPlan) => void;
}) {
  const toast = useToast();
  const [freq, setFreq] = useState<PlanFrequency>(planFreq(current)); const [from, setFrom] = useState(clampToTerm(today, term)); const [note, setNote] = useState("");
  const plan: FeedingPlan = { studentId: student.id, term: termKey, frequency: freq, from, note: note.trim() || undefined };
  const err = freq === planFreq(current) ? "Choose a different plan" : validatePlan(plan, term);
  return (
    <Modal open onClose={onClose} title={`Feeding payment plan — ${student.name}`}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!!err} onClick={() => { onSave(plan); toast(`${student.name}: feeding plan is now ${planLabel(freq).toLowerCase()} from ${fmtDate(from)}`); }}>Save plan</Button></>}>
      <div className="space-y-3">
        <p className="text-sm text-muted">{termLabel} feeding: <b className="text-fg">{money(rate)}</b>. Pick how the family pays it. Payments already made still count.</p>
        <div className="space-y-2">{PLAN_FREQUENCIES.map((f) => (
          <label key={f} className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-line p-3 text-sm hover:bg-surface-2">
            <span className="flex items-center gap-2"><input type="radio" checked={freq === f} onChange={() => setFreq(f)} /><b>{planLabel(f)}</b>{f === planFreq(current) && <span className="text-xs text-muted">(current)</span>}</span>
            <span className="num text-muted">{f === "Term" ? `${money(rate)} for the term, at once` : `${money(perPeriod(rate, term, f))} per ${periodWord(f)}`}</span>
          </label>))}</div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Starts on"><input type="date" className={inputClass} min={term.start} max={term.end} value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
          <Field label="Note (optional)"><input className={inputClass} placeholder="e.g. parent asked to pay weekly" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        </div>
        {err && freq !== current && <p role="alert" className="text-sm text-danger">{err}</p>}
      </div>
    </Modal>
  );
}
