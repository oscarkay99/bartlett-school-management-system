"use client";
import { useLiveData } from "@/lib/live/data";
import { NotFound } from "@/components/NotFound";
import { ReceiptDoc } from "@/components/ReceiptDoc";
import * as Q from "@/lib/data/queries";
import { ACCOUNTS } from "@/lib/accounts";

export function ReceiptPrint({ id }: { id: string }) {
  useLiveData(); // re-render with fresh data after each save (live site)
  const p = Q.payments.find((x) => x.id === id); if (!p) return <NotFound />;
  const s = Q.getStudent(p.studentId)!; const f = Q.accountSummary(s.id, p.account); const A = ACCOUNTS[p.account];
  // Feeding paid small small (on a plan) is separate from school fees: its own receipt title and feeding balance.
  const sep = Q.isFeedingPlanPayment(p); const items = Q.invoicesOf(s.id, p.account).flatMap((i) => i.items.map((x) => x.label)); const g = p.guardianId ? Q.getGuardian(p.guardianId) : undefined;
  const lines: [string, number][] = p.feedingPeriod ? [[`Feeding payment (${p.feedingPeriod === "Term" ? "for the term" : p.feedingPeriod.toLowerCase()})`, p.amount]]
    // School fees receipts show a feeding part separately (feeding is billed on the school fees invoice).
    : (p.feeding ?? 0) > 0 && (p.feeding ?? 0) < p.amount ? [[`Payment towards school fees${items.length ? ` (${items.filter((x) => x !== "Feeding").join(", ")})` : ""}`, p.amount - (p.feeding ?? 0)], ["Feeding", p.feeding ?? 0]]
    : [[`Payment towards ${A.label.toLowerCase()}${items.length ? ` (${items.join(", ")})` : ""}`, p.amount]];
  return <ReceiptDoc r={{ title: sep ? "Official Receipt — Feeding" : A.receiptTitle, receiptNo: p.receiptNo, accountLabel: A.label, period: `${Q.paymentTerm(p).term}, ${Q.paymentTerm(p).year}`,
    payer: g ? { name: `${g.title} ${g.name}`, phone: g.phone } : undefined, student: { name: Q.fullName(s), adm: s.admissionNo, cls: Q.getClass(s.classId).name },
    date: p.date, method: p.method, ref: p.ref, lines, amount: p.amount,
    balanceLabel: sep ? undefined : `${A.label} balance after this payment`, balanceAfter: sep ? undefined : f.balance, status: p.status, staff: p.staff }} />;
}
