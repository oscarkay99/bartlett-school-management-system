import { PageHeader } from "@/components/ui/primitives";
import { FeesWorkspace, type FeeLine, type PRow, type RRow, type SRow } from "@/components/fees/FeesWorkspace";
import * as Q from "@/lib/data/queries";

export const metadata = { title: "School Fees — EduFlow" };
export default async function FeesPage({ searchParams }: PageProps<"/fees">) {
  const sp = await searchParams;
  const students: SRow[] = Q.activeStudents().map((s) => { const f = Q.feeSummary(s.id); return { id: s.id, name: Q.fullName(s), adm: s.admissionNo, classId: s.classId, cls: Q.getClass(s.classId).name, cat: s.category, billed: f.billed, paid: f.paid, balance: f.balance, dueOn: f.dueOn, overdue: f.overdue, status: f.status, invoice: Q.invoices.find((i) => i.studentId === s.id)!.no }; });
  const payments: PRow[] = Q.payments.map((p) => { const s = Q.getStudent(p.studentId)!; return { id: p.id, receipt: p.receiptNo, studentId: s.id, student: Q.fullName(s), classId: s.classId, cat: s.category, amount: p.amount, method: p.method, date: p.date, ref: p.ref, status: p.status, staff: p.staff }; });
  const reminders: RRow[] = Q.reminderRows().map((r) => ({ gid: r.guardian.id, name: `${r.guardian.title} ${r.guardian.name}`, channel: r.channel, eligible: r.eligible, reason: r.reason, last: r.lastReminder, total: r.total, overdue: r.lines.some((l) => l.overdue), classIds: r.lines.map((l) => l.student.classId), students: r.lines.map((l) => ({ id: l.student.id, name: Q.fullName(l.student), balance: l.balance })), message: Q.buildReminder(r) }));
  const structures: FeeLine[] = Q.feeStructure.map((f) => ({ className: f.className, classId: f.classId, day: f.day, boarding: f.boarding }));
  const tab = typeof sp.tab === "string" ? sp.tab : undefined;
  return (<><PageHeader title="School Fees" sub="Invoices, collections, balances and parent reminders — balances are always derived from invoices and confirmed payments" />
    <FeesWorkspace key={String(tab) + String(sp.overdue)} students={students} payments={payments} reminders={reminders} structures={structures} classes={Q.classes.map((c) => ({ id: c.id, name: c.name }))} initialTab={tab} openPay={sp.pay === "1"} overdueOnly={sp.overdue === "1"} usedRefs={Q.payments.map((p) => p.ref.toUpperCase())} /></>);
}
