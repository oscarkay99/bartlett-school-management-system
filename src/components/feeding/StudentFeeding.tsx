"use client";
// Student profile → Feeding tab helpers. The tab itself uses the same layout as School Fees (see MoneyPanel).
import { useState } from "react";
import { Receipt } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { useCalendar } from "@/components/shell/CalendarContext";
import { useFeedingPlans } from "@/components/shell/FeedingPlansContext";
import { useRole } from "@/components/shell/AppShell";
import { termKey } from "@/lib/fees";
import { periodWord, perPeriod, planFreq, planLabel } from "@/lib/feeding";
import { money } from "@/lib/money";
import * as Q from "@/lib/data/queries";
import { FeedingPaymentDialog, type FeedingPayee } from "./FeedingPaymentDialog";

/** The student's feeding plan this term and what it means, e.g. "Daily · GH₵ 2.00 per school day". */
function usePayee(studentId: string): FeedingPayee | null {
  const { year, term, calendar } = useCalendar(); const plans = useFeedingPlans();
  const s = Q.getStudent(studentId); if (!s) return null;
  const fa = Q.feedingAccount(studentId); const td = calendar.find((y) => y.name === year)?.terms.find((t) => t.name === term);
  const freq = planFreq(plans.planOn(studentId, termKey(year, term), Q.TODAY)?.frequency);
  return { id: s.id, name: Q.fullName(s), adm: s.admissionNo, cls: Q.getClass(s.classId)?.name ?? "", billed: fa.billed, paid: fa.paid, rate: fa.billed, freq,
    perPeriod: td ? perPeriod(fa.billed, td, freq) : 0, payer: Q.payerOf(s) };
}

export function FeedingPlanLabel({ studentId }: { studentId: string }) {
  const p = usePayee(studentId); if (!p) return null;
  return <>{planLabel(p.freq)} · {p.freq === "Term" ? "all at once" : `${money(p.perPeriod)} per ${periodWord(p.freq)}`}</>;
}

/** "Record feeding payment" on the student page (roles that record payments only), with the student already chosen. */
export function RecordFeedingPaymentButton({ studentId, usedRefs }: { studentId: string; usedRefs: string[] }) {
  const [open, setOpen] = useState(false); const { allow, can } = useRole(); const { year, term } = useCalendar(); const p = usePayee(studentId);
  if (!p || !allow("payments", "create") || !can("feeding")) return null;
  return (<>
    <Button size="sm" variant="primary" onClick={() => setOpen(true)}><Receipt size={14} />Record feeding payment</Button>
    {open && <FeedingPaymentDialog students={[p]} usedRefs={usedRefs} termLabel={`${term}, ${year}`} today={Q.TODAY} initial={studentId} onClose={() => setOpen(false)} />}
  </>);
}
