"use client";
// Puts loaded database data into the app's data module in place of the demo data, so every page, report and
// print-out keeps using the same functions (lib/data/queries). Arrays and objects are replaced in place.
import * as D from "../data/seed";
import { resetCaches } from "../data/queries";
import { classFees, feedingRate, findTerm } from "../fees";
import { INVOICE_TABS } from "../class-invoices";
import type { LiveData } from "./load";

const replace = <T,>(arr: T[], next: T[]) => { arr.splice(0, arr.length, ...next); };
const keys = <T extends object>(o: T) => Object.keys(o) as (keyof T)[];

/** Database-only data the demo module has no place for (ids for writing back, drafts, sheets…). */
export const liveExtra: { data: LiveData | null } = { data: null };

export function hydrate(d: LiveData) {
  liveExtra.data = d;
  const cur = d.current ?? d.terms.filter((t) => t.start <= D.TODAY).at(-1) ?? d.terms[0];
  const yr = d.calendar.find((y) => y.name === cur?.year);
  const next = d.terms.find((t) => cur && t.start > cur.end);
  Object.assign(D.SCHOOL, {
    ...d.school, year: cur?.year ?? D.SCHOOL.year, term: cur?.term ?? D.SCHOOL.term, termStart: cur?.start ?? "", termEnd: cur?.end ?? "", reopening: next?.start ?? "",
    terms: yr ? yr.terms.map((t) => t.name) : [], years: [...d.calendar].map((y) => y.name), calendar: d.calendar,
  });
  replace(D.classes, d.classes); replace(D.staff, d.staff); replace(D.guardians, d.guardians); replace(D.students, d.students);
  replace(D.invoices, d.invoices); replace(D.payments, d.payments); replace(D.feeSchedule, d.feeSchedule); replace(D.feedingPlans, d.feedingPlans);
  replace(D.grades, d.grades); replace(D.inventory, d.inventory); replace(D.movements, d.movements); replace(D.expenses, d.expenses);
  replace(D.messages, d.messages); replace(D.approvals, d.approvals); replace(D.audit, d.audit); replace(D.events, d.events); replace(D.applicants, d.applicants);
  if (d.gradeScale.length) replace(D.gradeScale, d.gradeScale);
  for (const k of keys(D.subjectsByLevel)) delete D.subjectsByLevel[k];
  for (const x of d.subjects) (D.subjectsByLevel[x.level] ??= []).push(x.name);

  // Derived from the current term's fees.
  const tf = cur ? findTerm(d.feeSchedule, cur.year, cur.term) : undefined;
  replace(D.feeStructure, tf ? d.classes.map((c) => ({ classId: c.id, className: c.name, day: classFees(tf, c), feeding: feedingRate(tf, c) })) : []);
  for (const k of keys(D.activityFees)) delete D.activityFees[k];
  Object.assign(D.activityFees, tf?.activities ?? {});
  replace(D.budget, d.budget.map((b) => ({ category: b.category, budget: b.amount, actual: d.expenses.filter((e) => e.category === b.category && e.status !== "Rejected" && e.status !== "Pending Approval").reduce((a, e) => a + e.amount, 0) })));
  replace(D.studentIssues, d.movements.filter((m) => m.studentId && m.type === "Issued").map((m) => ({ studentId: m.studentId!, item: d.inventory.find((i) => i.id === m.itemId)?.name ?? "", qty: m.qty, date: m.date,
    returnRequired: !!m.returnRequired, returned: d.movements.some((r) => r.type === "Returned" && r.studentId === m.studentId && r.itemId === m.itemId && r.date >= m.date), staff: m.staff })));
  // Attendance rate per school day (present + late of those marked).
  const days = new Map<string, { p: number; t: number }>();
  for (const a of d.attendance) { const x = days.get(a.date) ?? { p: 0, t: 0 }; x.t++; if (a.status === "P" || a.status === "L" || a.status === "Present" || a.status === "Late") x.p++; days.set(a.date, x); }
  replace(D.attendanceTrend, [...days].sort(([a], [b]) => a.localeCompare(b)).slice(-20).map(([date, x]) => ({ date, rate: Math.round((x.p / x.t) * 1000) / 10 })));

  // Invoices page tabs point at the school's real classes (matched by name: "Class 3" = "Primary 3").
  for (const t of INVOICE_TABS) if (t.classId || !t.account) {
    const want = t.label.replace(/^Class /, "Primary "); const c = d.classes.find((x) => x.name === want || x.name === t.label); t.classId = c?.id ?? t.classId;
  }
  resetCaches();
}
