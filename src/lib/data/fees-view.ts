// Builds the props for the billing pages (School Fees, Feeding, Extracurricular) from the data layer.
import * as Q from "./queries";
import type { FeeAccount } from "../accounts";
import type { FeeLine, PRow, RRow, SRow } from "@/components/fees/FeesWorkspace";
import type { BillCandidate } from "@/components/fees/IssueBillDialog";

export function billingProps(account: FeeAccount) {
  const students: SRow[] = Q.activeStudents().flatMap((s) => {
    const f = Q.accountSummary(s.id, account); if (!f.enrolled) return [];
    const inv = Q.invoicesOf(s.id, account);
    return [{ id: s.id, name: Q.fullName(s), adm: s.admissionNo, classId: s.classId, cls: Q.getClass(s.classId).name, cat: s.category, billed: f.billed, paid: f.paid, balance: f.balance, dueOn: f.dueOn, overdue: f.overdue, status: f.status, invoice: inv[0].no, items: inv.flatMap((i) => i.items) }];
  });
  const payments: PRow[] = Q.accountPayments(account).map((p) => { const s = Q.getStudent(p.studentId)!; return { id: p.id, receipt: p.receiptNo, studentId: s.id, student: Q.fullName(s), classId: s.classId, cat: s.category, amount: p.amount, method: p.method, date: p.date, ref: p.ref, status: p.status, staff: p.staff }; });
  const reminders: RRow[] = Q.reminderRows({ account }).map((r) => ({ gid: r.guardian.id, name: `${r.guardian.title} ${r.guardian.name}`, channel: r.channel, eligible: r.eligible, reason: r.reason, last: r.lastReminder, total: r.total, overdue: r.lines.some((l) => l.overdue), classIds: r.lines.map((l) => l.student.classId), students: r.lines.map((l) => ({ id: l.student.id, name: Q.fullName(l.student), balance: l.balance })), message: Q.buildReminder(r, Q.SCHOOL, account) }));
  const structures: FeeLine[] = Q.feeStructure.map((f) => ({ className: f.className, classId: f.classId, day: f.day, boarding: f.boarding }));
  const candidates: BillCandidate[] = Q.activeStudents().map((s) => { const c = Q.getClass(s.classId); return { id: s.id, name: Q.fullName(s), adm: s.admissionNo, cls: c.name, kg: c.level === "Kindergarten", feeding: Q.feeStructure.find((f) => f.classId === s.classId)!.feeding, billed: Q.invoicesOf(s.id, account).flatMap((i) => i.items.map((x) => x.label)) }; });
  return { account, students, payments, reminders, structures, candidates, activityFees: Q.activityFees as Record<string, number>, classes: Q.classes.map((c) => ({ id: c.id, name: c.name })), usedRefs: Q.payments.map((p) => p.ref.toUpperCase()) };
}
