"use client";
// Student profile → Feeding tab: "Record feeding payment" (any amount, at any time — no payment plans).
import { useState } from "react";
import { Receipt } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { useCalendar } from "@/components/shell/CalendarContext";
import { useRole } from "@/components/shell/AppShell";
import * as Q from "@/lib/data/queries";
import { FeedingPaymentDialog, type FeedingPayee } from "./FeedingPaymentDialog";

function payee(studentId: string): FeedingPayee | null {
  const s = Q.getStudent(studentId); if (!s) return null; const fa = Q.feedingAccount(studentId);
  return { id: s.id, name: Q.fullName(s), adm: s.admissionNo, cls: Q.getClass(s.classId)?.name ?? "", billed: fa.billed, paid: fa.paid, rate: fa.billed, payer: Q.payerOf(s) };
}

/** "Record feeding payment" on the student page (roles that record payments only), with the student already chosen. */
export function RecordFeedingPaymentButton({ studentId, usedRefs }: { studentId: string; usedRefs: string[] }) {
  const [open, setOpen] = useState(false); const { allow, can } = useRole(); const { year, term } = useCalendar(); const p = payee(studentId);
  if (!p || !allow("payments", "create") || !can("feeding")) return null;
  return (<>
    <Button size="sm" variant="primary" onClick={() => setOpen(true)}><Receipt size={14} />Record feeding payment</Button>
    {open && <FeedingPaymentDialog students={[p]} usedRefs={usedRefs} termLabel={`${term}, ${year}`} today={Q.TODAY} initial={studentId} onClose={() => setOpen(false)} />}
  </>);
}
