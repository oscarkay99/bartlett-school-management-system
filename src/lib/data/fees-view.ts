// Builds the props for the billing pages (School Fees, Extracurricular, Extra Classes) from the data layer.
// Amounts to bill come from the fee schedule on the client (Settings → Fee schedule), for the selected term.
import * as Q from "./queries";
import { activitiesFor, activitiesOf, type FeeAccount } from "../accounts";
import { termKey } from "../fees";
import { liveExtra } from "../live/hydrate";
import type { PRow, RRow, SRow } from "@/components/fees/FeesWorkspace";
import type { BillCandidate } from "@/components/fees/IssueBillDialog";

export function billingProps(account: FeeAccount) {
  const now = termKey(Q.SCHOOL.year, Q.SCHOOL.term); const acts = new Set(activitiesOf(account));
  const students: SRow[] = Q.activeStudents().flatMap((s): SRow[] => {
    const f = Q.accountSummary(s.id, account);
    if (!f.enrolled) {
      // Extracurricular / Extra Classes: also list students enrolled this term whose bill is not issued yet
      // (awaiting the Owner's approval, or not billed), so every enrolment shows.
      if (account === "fees") return [];
      const draft = (liveExtra.data?.drafts ?? []).find((d) => d.studentId === s.id && d.account === account && termKey(d.year, d.term) === now);
      const enrolled = (liveExtra.data?.enrolments ?? []).filter((e) => e.studentId === s.id && e.term === now && acts.has(e.activity as never)).map((e) => e.activity);
      if (!draft && enrolled.length === 0) return [];
      const items = draft ? draft.items : enrolled.map((label) => ({ label, amount: 0 }));
      return [{ id: s.id, name: Q.fullName(s), adm: s.admissionNo, classId: s.classId, cls: Q.getClass(s.classId).name, feedingOwed: 0, feedingRate: 0, payer: Q.payerOf(s), billed: 0, paid: 0, balance: 0, dueOn: "", overdue: false,
        status: draft ? (draft.status === "submitted" ? "Awaiting Approval" : "Draft") : "Not billed", invoice: "", terms: [], items }];
    }
    const inv = Q.invoicesOf(s.id, account);
    const fd = account === "fees" ? Q.feedingAccount(s.id) : undefined;
    return [{ id: s.id, name: Q.fullName(s), adm: s.admissionNo, classId: s.classId, cls: Q.getClass(s.classId).name, feedingOwed: Math.max(0, fd?.balance ?? 0), feedingRate: fd?.billed ?? 0, payer: Q.payerOf(s), billed: f.billed, paid: f.paid, balance: f.balance, dueOn: f.dueOn, overdue: f.overdue, status: f.status, invoice: inv[0].no, terms: inv.map((i) => termKey(i.year, i.term)), items: inv.flatMap((i) => i.items) }];
  });
  const payments: PRow[] = Q.accountPayments(account).map((p) => { const s = Q.getStudent(p.studentId)!; return { term: Q.paymentTermLabel(p), id: p.id, receipt: p.receiptNo, studentId: s.id, student: Q.fullName(s), classId: s.classId, amount: p.amount, feeding: p.feeding ?? 0, feedingPeriod: p.feedingPeriod, method: p.method, date: p.date, ref: p.ref, status: p.status, staff: p.staff }; });
  const reminders: RRow[] = Q.reminderRows({ account }).map((r) => ({ gid: r.guardian.id, name: `${r.guardian.title} ${r.guardian.name}`, channel: r.channel, eligible: r.eligible, reason: r.reason, last: r.lastReminder, total: r.total, overdue: r.lines.some((l) => l.overdue), classIds: r.lines.map((l) => l.student.classId), students: r.lines.map((l) => ({ id: l.student.id, name: Q.fullName(l.student), balance: l.balance })), message: Q.buildReminder(r, Q.SCHOOL, account) }));
  const candidates: BillCandidate[] = Q.activeStudents().map((s) => {
    const billed: Record<string, string[]> = {};
    for (const i of Q.invoicesOf(s.id, account)) (billed[termKey(i.year, i.term)] ??= []).push(...i.items.map((x) => x.label));
    // Bills not issued yet (live: drafts / awaiting approval) count too, so a student is never billed twice.
    for (const d of liveExtra.data?.drafts ?? []) if (d.studentId === s.id && d.account === account) (billed[termKey(d.year, d.term)] ??= []).push(...d.items.map((x) => x.label));
    return { id: s.id, name: Q.fullName(s), adm: s.admissionNo, classId: s.classId, cls: Q.getClass(s.classId).name, scholarship: !!s.scholarship, billed };
  });
  // Extracurricular / Extra Classes: only the classes that take one of its activities (Settings shows "—" for the others).
  const takes = (level: string) => account === "fees" || activitiesFor(level, account).length > 0;
  const classes = Q.classes.filter((c) => takes(c.level)).map((c) => ({ id: c.id, name: c.name }));
  return { account, students, payments, reminders, candidates: candidates.filter((c) => takes(Q.getClass(c.classId).level)), classes, usedRefs: Q.payments.map((p) => p.ref.toUpperCase()) };
}
