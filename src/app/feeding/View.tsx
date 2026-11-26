"use client";
import { useLiveData } from "@/lib/live/data";
import { Suspense } from "react";
import { PageHeader } from "@/components/ui/primitives";
import { FeedingWorkspace } from "@/components/feeding/FeedingWorkspace";
import * as Q from "@/lib/data/queries";

export function View() {
  useLiveData(); // re-render with fresh data after each save (live site)
  const students = Q.activeStudents().map((s) => { const fa = Q.feedingAccount(s.id);
    return { id: s.id, name: Q.fullName(s), adm: s.admissionNo, classId: s.classId, cls: Q.getClass(s.classId).name, billed: fa.billed, paid: fa.paid, dueOn: Q.invoicesOf(s.id, "fees")[0]?.dueOn, payer: Q.payerOf(s) }; });
  // Every feeding payment: for the term at once, or daily / weekly / monthly.
  const payments = Q.payments.filter((p) => p.account === "fees" && (p.feeding ?? 0) > 0 && p.status !== "Reversed").map((p) => { const s = Q.getStudent(p.studentId)!;
    return { id: p.id, receipt: p.receiptNo, studentId: s.id, name: Q.fullName(s), classId: s.classId, cls: Q.getClass(s.classId).name, date: p.date, feeding: p.feeding ?? 0, how: p.feedingPeriod ?? "Term", method: p.method, status: p.status }; })
    .sort((a, b) => b.date.localeCompare(a.date));
  const onHand = (id: string) => Q.inventory.find((i) => i.id === id)!.onHand;
  const kitchen = Q.inventory.filter((i) => i.category === "Kitchen & Feeding").map((i) => ({ id: i.id, name: i.name, unit: i.unit, onHand: onHand(i.id), reorder: i.reorder, expiry: i.expiry }));
  return (<>
    <PageHeader title="Feeding" sub="Who is on feeding, what has been paid (termly, or daily, weekly, monthly), the meal register and kitchen stock. Feeding is not part of school fees: it is billed and paid here." />
    {/* The workspace reads ?tab= from the URL, so it needs a Suspense boundary for the static export. */}
    <Suspense fallback={null}><FeedingWorkspace students={students} payments={payments} kitchen={kitchen} today={Q.TODAY} usedRefs={Q.payments.map((p) => p.ref.toUpperCase())} /></Suspense>
  </>);
}
