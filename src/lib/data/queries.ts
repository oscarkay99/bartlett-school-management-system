// Data access seam. Every page reads through these functions; the backend replaces this file later.
import { CEDI, pct, type Minor } from "../money";
import * as D from "./seed";
import type { Student, Guardian, Invoice, Payment } from "./types";
import { ACCOUNTS, ACCOUNT_IDS, type FeeAccount } from "../accounts";
import { termKey } from "../fees";
export { ACCOUNTS, ACCOUNT_IDS, type FeeAccount };

export const { SCHOOL, TODAY, classes, students, guardians, invoices, payments, staff, inventory, movements, expenses, budget, messages, approvals, audit, events, applicants, feeStructure, feeSchedule, feedingPlans, activityFees, gradeScale, gradeOf, attendanceTrend, subjectsByLevel, studentIssues } = D;

/** Terms that already have invoices in any account. Their fees are locked: changing them needs an approved adjustment. */
export const lockedFeeTerms = () => [...new Set(invoices.map((i) => termKey(i.year, i.term)))];

export const getClass = (id: string) => classes.find((c) => c.id === id)!;
export const getStudent = (id: string) => students.find((s) => s.id === id);
export const getGuardian = (id: string) => guardians.find((g) => g.id === id);
/** Who a receipt is made out to: the student's primary guardian. */
export const payerOf = (s: Student) => { const g = getGuardian((s.guardians.find((x) => x.primary) ?? s.guardians[0])?.guardianId ?? ""); return g ? { name: `${g.title} ${g.name}`, phone: g.phone } : undefined; };
export const getStaff = (id: string) => staff.find((s) => s.id === id);
export const fullName = (s: Student) => [s.first, s.middle, s.last].filter(Boolean).join(" ");
export const shortName = (s: Student) => `${s.first} ${s.last}`;

/** Fee status shown everywhere. Overpaying counts as Paid in Full; a late balance is still Partially Paid / Outstanding. */
export type FeeStatus = "Paid in Full" | "Partially Paid" | "Outstanding";
export interface FeeSummary { billed: Minor; discount: Minor; paid: Minor; balance: Minor; dueOn: string; status: FeeStatus; overdue: boolean; enrolled: boolean }

// Each account is settled independently: feeding payments never reduce the school-fee balance and vice versa.
export const invoicesOf = (studentId: string, account: FeeAccount): Invoice[] => invoices.filter((i) => i.studentId === studentId && i.account === account);
/**
 * Feeding paid "small small" (daily / weekly / monthly / termly plan). It is NOT part of the school fees invoice,
 * so it never counts towards school fees balances, collections or reminders — only towards feeding.
 */
export const isFeedingPlanPayment = (p: Payment) => p.account === "fees" && !!p.feedingPeriod;
export const paymentsOf = (studentId: string, account: FeeAccount): Payment[] => payments.filter((p) => p.studentId === studentId && p.account === account && !isFeedingPlanPayment(p));
export const accountPayments = (account: FeeAccount) => payments.filter((p) => p.account === account && !isFeedingPlanPayment(p));

const feeCache = new Map<string, FeeSummary>();
/** School-fees balance (tuition, books, levies…). Use accountSummary for Extracurricular. */
export const feeSummary = (studentId: string) => accountSummary(studentId, "fees");
export function accountSummary(studentId: string, account: FeeAccount): FeeSummary {
  const key = `${account}:${studentId}`; const hit = feeCache.get(key); if (hit) return hit;
  const inv = invoicesOf(studentId, account);
  const gross = inv.reduce((a, i) => a + i.items.reduce((x, y) => x + y.amount, 0), 0);
  const discount = inv.reduce((a, i) => a + i.discount, 0);
  const billed = gross - discount;
  const paid = paymentsOf(studentId, account).filter((p) => p.status === "Confirmed").reduce((a, p) => a + p.amount, 0);
  const balance = billed - paid;
  const dueOn = inv.map((i) => i.dueOn).sort()[0] ?? D.TODAY;
  const overdue = balance > 0 && dueOn < D.TODAY;
  const status: FeeStatus = balance <= 0 ? "Paid in Full" : paid > 0 ? "Partially Paid" : "Outstanding";
  const r = { billed, discount, paid, balance, dueOn, status, overdue, enrolled: inv.length > 0 };
  feeCache.set(key, r); return r;
}
/**
 * What one term costs for a student: each account's bills for that term (net of discounts).
 * `total` is SCHOOL FEES ONLY. Extracurricular is standalone and is never added to it (see `extra`).
 */
export function termCharges(studentId: string, year = D.SCHOOL.year, term = D.SCHOOL.term) {
  const parts = ACCOUNT_IDS.map((account) => {
    const inv = invoicesOf(studentId, account).filter((i) => i.year === year && i.term === term);
    const gross = inv.reduce((a, i) => a + i.items.reduce((x, y) => x + y.amount, 0), 0); const discount = inv.reduce((a, i) => a + i.discount, 0);
    return { account, label: ACCOUNTS[account].label, billed: inv.length > 0, gross, discount, net: gross - discount };
  });
  return { year, term, parts, total: parts.find((p) => p.account === "fees")!.net, extra: parts.find((p) => p.account === "extra")! };
}
/**
 * Feeding for one student: billed (the Feeding line on their school fees invoices), paid (the feeding part of their
 * confirmed school fees payments, whether paid with the fees at once or daily/weekly/monthly) and still owed.
 */
export function feedingAccount(studentId: string) {
  // On the school fees invoice ("with school fees") → the Feeding line; on a plan → the class feeding rate for the term.
  const onInvoice = invoicesOf(studentId, "fees").reduce((a, i) => a + (i.items.find((x) => x.label === "Feeding")?.amount ?? 0), 0);
  const st = getStudent(studentId);
  const onPlan = feedingPlans.some((p) => p.studentId === studentId && p.frequency !== "With school fees");
  const billed = onInvoice || (onPlan && st ? feeStructure.find((f) => f.classId === st.classId)?.feeding ?? 0 : 0);
  const pays = payments.filter((p) => p.studentId === studentId && p.account === "fees" && (p.feeding ?? 0) > 0).sort((a, b) => b.date.localeCompare(a.date));
  const paid = pays.filter((p) => p.status === "Confirmed").reduce((a, p) => a + (p.feeding ?? 0), 0);
  return { billed, paid, balance: billed - paid, payments: pays, separate: !onInvoice && onPlan };
}
/** Label for an invoice's discount line, e.g. "Merit Scholarship (25%)". */
export const discountLabel = (studentId: string) => { const s = getStudent(studentId)?.scholarship; return s ? `${s} on tuition` : "Discount"; };
/** School fees still owed. Extracurricular is standalone: its balance is shown separately and never added here. */
export const totalOwed = (studentId: string) => Math.max(0, accountSummary(studentId, "fees").balance);

// Chronological, append-only ledger for one account with running balance.
export function accountLedger(studentId: string, account: FeeAccount) {
  const inv = invoicesOf(studentId, account); const pays = paymentsOf(studentId, account);
  const rows = [
    ...inv.map((i) => ({ date: i.billedOn, ref: i.no, desc: `${ACCOUNTS[account].label} invoice — ${i.term} ${i.year}`, debit: i.items.reduce((a, b) => a + b.amount, 0), credit: 0 })),
    ...inv.filter((i) => i.discount > 0).map((i) => ({ date: i.billedOn, ref: i.no, desc: discountLabel(studentId), debit: 0, credit: i.discount })),
    ...pays.filter((p) => p.status === "Confirmed").map((p) => ({ date: p.date, ref: p.receiptNo, desc: `Payment — ${p.method} (${p.ref})`, debit: 0, credit: p.amount })),
    ...pays.filter((p) => p.status === "Reversed").flatMap((p) => [{ date: p.date, ref: p.receiptNo, desc: `Payment — ${p.method} (${p.ref})`, debit: 0, credit: p.amount }, { date: p.date, ref: `REV-${p.receiptNo}`, desc: `Reversal of ${p.receiptNo}: ${p.note ?? ""}`, debit: p.amount, credit: 0 }]),
  ].sort((a, b) => a.date.localeCompare(b.date) || a.debit - b.debit);
  let run = 0; return rows.map((l) => ({ ...l, bal: (run += l.debit - l.credit) }));
}

export const activeStudents = () => students.filter((s) => s.status === "Active");
export const studentsOfGuardian = (gid: string) => students.filter((s) => s.guardians.some((g) => g.guardianId === gid));

export function feesOverview(classId?: string, account: FeeAccount = "fees") {
  const list = activeStudents().filter((s) => (!classId || s.classId === classId));
  const rows = list.map((s) => ({ s, f: accountSummary(s.id, account) })).filter((r) => r.f.enrolled);
  const billed = rows.reduce((a, r) => a + r.f.billed, 0);
  const paid = rows.reduce((a, r) => a + r.f.paid, 0);
  const owing = rows.filter((r) => r.f.balance > 0);
  const outstanding = owing.reduce((a, r) => a + r.f.balance, 0);
  const overdueRows = owing.filter((r) => r.f.overdue);
  const overdue = overdueRows.reduce((a, r) => a + r.f.balance, 0);
  const guardiansEligible = new Set(owing.flatMap((r) => r.s.guardians.filter((g) => g.financial && g.receivesFeeReminders && g.verified).map((g) => g.guardianId)).filter((id) => { const g = getGuardian(id)!; return g.consent.SMS || g.consent.WhatsApp || g.consent.Email; }));
  return {
    rows, billed, paid, outstanding, overdue, rate: pct(paid, billed), owingCount: owing.length, overdueCount: overdueRows.length,
    fullyPaid: rows.filter((r) => r.f.balance <= 0).length, partial: rows.filter((r) => r.f.balance > 0 && r.f.paid > 0).length, unpaid: rows.filter((r) => r.f.paid === 0 && r.f.balance > 0).length,
    eligibleGuardians: guardiansEligible.size,
  };
}

export function collectionsBy(days: number, account: FeeAccount = "fees") {
  const cutoff = new Date(D.TODAY + "T00:00:00Z"); cutoff.setUTCDate(cutoff.getUTCDate() - days);
  return accountPayments(account).filter((p) => p.status === "Confirmed" && p.date >= cutoff.toISOString().slice(0, 10)).reduce((a, p) => a + p.amount, 0);
}
export const collectedToday = (account: FeeAccount = "fees") => accountPayments(account).filter((p) => p.status === "Confirmed" && p.date === D.TODAY).reduce((a, p) => a + p.amount, 0);
export function collectionsByMethod(account: FeeAccount = "fees") {
  const m = new Map<string, number>();
  accountPayments(account).filter((p) => p.status === "Confirmed").forEach((p) => m.set(p.method, (m.get(p.method) ?? 0) + p.amount));
  return [...m].map(([name, value]) => ({ name, value: value / 100 })).sort((a, b) => b.value - a.value);
}
export function collectionTrend(account: FeeAccount = "fees") {
  const byDay = new Map<string, number>();
  accountPayments(account).filter((p) => p.status === "Confirmed").forEach((p) => byDay.set(p.date, (byDay.get(p.date) ?? 0) + p.amount));
  const days = [...byDay.keys()].sort();
  // weekly buckets
  const weeks = new Map<string, number>();
  days.forEach((d) => { const dt = new Date(d + "T00:00:00Z"); dt.setUTCDate(dt.getUTCDate() - ((dt.getUTCDay() + 6) % 7)); const k = dt.toISOString().slice(5, 10); weeks.set(k, (weeks.get(k) ?? 0) + byDay.get(d)!); });
  return [...weeks].map(([week, v]) => ({ week, collected: v / 100 }));
}
export function outstandingByClass() {
  return classes.map((c) => { const o = feesOverview(c.id); return { name: c.name, outstanding: o.outstanding / 100, rate: o.rate, billed: o.billed / 100 }; });
}
export const topDebtors = (n = 6) => feesOverview().rows.filter((r) => r.f.balance > 0).sort((a, b) => b.f.balance - a.f.balance).slice(0, n);

// ---- Reminder recipients (consolidated per guardian, respecting authorisation) ----
export interface ReminderRow {
  guardian: Guardian; lines: { student: Student; balance: Minor; overdue: boolean; dueOn: string }[]; total: Minor;
  eligible: boolean; reason?: string; channel: "SMS" | "WhatsApp" | "Email"; lastReminder?: string;
}
export function reminderRows(opts: { classId?: string; overdueOnly?: boolean; account?: FeeAccount } = {}): ReminderRow[] {
  const map = new Map<string, ReminderRow>(); const account = opts.account ?? "fees"; const template = ACCOUNTS[account].reminderTemplate;
  activeStudents().forEach((s) => {
    if (opts.classId && s.classId !== opts.classId) return;
    const f = accountSummary(s.id, account); if (f.balance <= 0) return; if (opts.overdueOnly && !f.overdue) return;
    s.guardians.forEach((sg) => {
      if (!sg.financial || !sg.receivesFeeReminders || !sg.verified) return; // never disclose to unauthorised guardians
      const g = getGuardian(sg.guardianId)!;
      const row = map.get(g.id) ?? { guardian: g, lines: [], total: 0, eligible: true, channel: g.preferred, lastReminder: messages.filter((m) => m.guardianId === g.id && m.template === template).map((m) => m.date).sort().pop() };
      row.lines.push({ student: s, balance: f.balance, overdue: f.overdue, dueOn: f.dueOn }); row.total += f.balance; map.set(g.id, row);
    });
  });
  return [...map.values()].map((r) => {
    const ok = r.guardian.consent[r.channel];
    if (!ok) { const alt = (["WhatsApp", "SMS", "Email"] as const).find((c) => r.guardian.consent[c] && (c !== "Email" || r.guardian.email)); if (alt) r.channel = alt; else { r.eligible = false; r.reason = "No channel consent"; } }
    if (r.eligible && r.lastReminder && r.lastReminder >= "2026-10-10") { r.eligible = false; r.reason = "Cooldown (reminded < 3 days ago)"; }
    return r;
  }).sort((a, b) => b.total - a.total);
}

export function buildReminder(row: ReminderRow, school = SCHOOL, account: FeeAccount = "fees") {
  const noun = ACCOUNTS[account].noun;
  const name = `${row.guardian.title} ${row.guardian.name.split(" ").pop()}`;
  const fmt = (m: number) => `${CEDI} ${(m / 100).toLocaleString("en-GH", { minimumFractionDigits: 0 })}`;
  const due = new Date(row.lines[0].dueOn + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  if (row.lines.length === 1) {
    const l = row.lines[0];
    return `Dear ${name},\n\nGreetings from ${school.name}.\n\nThis is a friendly reminder that your ward, ${shortName(l.student)}, currently has an outstanding ${noun} balance of ${fmt(l.balance)} for ${school.term} of the ${school.year} academic year.\n\nKindly make payment by ${due}.\n\nIf you have already paid, please disregard this reminder and contact the school if the payment has not yet been reflected.\n\nThank you.\n\n${school.name}\nAccounts Department`;
  }
  return `Dear ${name},\n\nThe following outstanding ${noun} balances remain for your wards:\n\n${row.lines.map((l) => `${shortName(l.student)} — ${fmt(l.balance)}`).join("\n")}\n\nTotal Outstanding: ${fmt(row.total)}.\n\nKindly contact the Accounts Department or use the approved school payment channel.\n\n${school.name}\nAccounts Department`;
}

// ---- Academics ----
export function studentGrades(studentId: string) {
  return D.grades.filter((g) => g.studentId === studentId).map((g) => { const total = g.ca + g.exam; return { ...g, total, ...gradeOf(total) }; });
}
export function subjectAverages() {
  const m = new Map<string, number[]>();
  D.grades.forEach((g) => m.set(g.subject, [...(m.get(g.subject) ?? []), g.ca + g.exam]));
  return [...m].map(([subject, v]) => ({ subject, avg: Math.round(v.reduce((a, b) => a + b, 0) / v.length) })).sort((a, b) => b.avg - a.avg);
}
export function classAverages() {
  return classes.map((c) => { const ids = new Set(students.filter((s) => s.classId === c.id).map((s) => s.id)); const g = D.grades.filter((x) => ids.has(x.studentId)); return { name: c.name, avg: Math.round(g.reduce((a, b) => a + b.ca + b.exam, 0) / Math.max(1, g.length)) }; });
}
export function gradeDistribution() {
  const c: Record<string, number> = {}; D.grades.forEach((g) => { const k = gradeOf(g.ca + g.exam).grade; c[k] = (c[k] ?? 0) + 1; });
  return gradeScale.map((g) => ({ grade: g.grade, count: c[g.grade] ?? 0 }));
}
// deterministic per-student attendance
export function studentAttendance(id: string) {
  const n = Number(id.slice(1)); const present = 38 + (n * 7) % 5; const absent = (n * 3) % 4; const late = (n * 5) % 3;
  return { present, absent, late, total: present + absent + late, rate: Math.round((present / (present + absent + late)) * 1000) / 10 };
}
export const avgAttendance = () => Math.round((D.attendanceTrend.reduce((a, b) => a + b.rate, 0) / D.attendanceTrend.length) * 10) / 10;

// ---- Inventory ----
export const stockValue = () => inventory.reduce((a, i) => a + i.onHand * i.cost, 0);
export const lowStock = () => inventory.filter((i) => i.onHand > 0 && i.onHand <= i.reorder);
export const outOfStock = () => inventory.filter((i) => i.onHand <= 0);
export function inventoryByCategory() {
  const m = new Map<string, number>(); inventory.forEach((i) => m.set(i.category, (m.get(i.category) ?? 0) + (i.onHand * i.cost) / 100));
  return [...m].map(([name, value]) => ({ name, value: Math.round(value) })).sort((a, b) => b.value - a.value);
}

// ---- Finance ----
export const totalExpenditure = () => expenses.filter((e) => e.status === "Approved" || e.status === "Paid").reduce((a, e) => a + e.amount, 0);
export const cashPosition = () => 1_845_000 + D.payments.filter((p) => p.status === "Confirmed").reduce((a, p) => a + p.amount, 0) - totalExpenditure();
export function expenseBreakdown() {
  const m = new Map<string, number>(); expenses.filter((e) => e.status !== "Rejected").forEach((e) => m.set(e.category, (m.get(e.category) ?? 0) + e.amount / 100));
  return [...m].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}
export function incomeVsExpense() {
  return [
    { month: "Sep", income: payments.filter((p) => p.status === "Confirmed" && p.date < "2026-10-01").reduce((a, p) => a + p.amount, 0) / 100, expense: expenses.filter((e) => e.date < "2026-10-01" && e.status !== "Rejected").reduce((a, e) => a + e.amount, 0) / 100 },
    { month: "Oct", income: payments.filter((p) => p.status === "Confirmed" && p.date >= "2026-10-01").reduce((a, p) => a + p.amount, 0) / 100, expense: expenses.filter((e) => e.date >= "2026-10-01" && e.status !== "Rejected").reduce((a, e) => a + e.amount, 0) / 100 },
  ];
}
export const enrollmentTrend = [
  { year: "2022/23", students: 15 }, { year: "2023/24", students: 16 }, { year: "2024/25", students: 18 }, { year: "2025/26", students: 19 }, { year: "2026/27", students: activeStudents().length },
];
export const unreconciled = () => payments.filter((p) => p.status === "Pending");
/** Billed / collected / outstanding for each account, school-wide (for the owner's dashboard). */
export const accountTotals = () => ACCOUNT_IDS.map((id) => { const o = feesOverview(undefined, id); return { id, label: ACCOUNTS[id].label, href: ACCOUNTS[id].href, billed: o.billed, paid: o.paid, outstanding: o.outstanding, rate: o.rate, students: o.rows.length, owing: o.owingCount }; });

// ---- General ledger (derived; double-entry) ----
export const OPENING_CASH: Minor = 1_845_000;
export interface GLLine { date: string; ref: string; memo: string; account: string; dr: Minor; cr: Minor }
// Feeding is a line on the school fees invoice, but its income is still posted to its own account.
const incomeAccount = (account: FeeAccount, label: string) => (account === "extra" ? "4500 Extracurricular Fees" : label === "Feeding" ? "4200 Feeding Fees" : label === "Tuition" ? "4100 Tuition Fees" : "4400 Levies & Other Fees");
const expenseAccount = (c: string) => `5${({ Salaries: "100", Utilities: "200", Internet: "250", Repairs: "300", Stationery: "350", "Food Supplies": "400", Transport: "450", "Inventory Purchases": "500", Software: "550", Building: "600", Maintenance: "650" } as Record<string, string>)[c] ?? "900"} ${c}`;
export function generalLedger(): GLLine[] {
  const L: GLLine[] = [{ date: "2026-08-31", ref: "OPEN", memo: "Opening balances", account: "1100 Bank & Cash", dr: OPENING_CASH, cr: 0 }, { date: "2026-08-31", ref: "OPEN", memo: "Opening balances", account: "3100 Accumulated Fund", dr: 0, cr: OPENING_CASH }];
  invoices.forEach((i) => {
    const gross = i.items.reduce((a, b) => a + b.amount, 0);
    L.push({ date: i.billedOn, ref: i.no, memo: `${i.term} ${ACCOUNTS[i.account].label} invoice (accrual)`, account: "1200 Fee Receivables", dr: gross, cr: 0 });
    i.items.forEach((it) => L.push({ date: i.billedOn, ref: i.no, memo: it.label, account: incomeAccount(i.account, it.label), dr: 0, cr: it.amount }));
    if (i.discount) { L.push({ date: i.billedOn, ref: i.no, memo: "Scholarship discount", account: "4900 Discounts & Scholarships", dr: i.discount, cr: 0 }); L.push({ date: i.billedOn, ref: i.no, memo: "Scholarship discount", account: "1200 Fee Receivables", dr: 0, cr: i.discount }); }
  });
  payments.filter((p) => p.status === "Confirmed" && isFeedingPlanPayment(p)).forEach((p) => { L.push({ date: p.date, ref: p.receiptNo, memo: `Feeding (${p.feedingPeriod}) ${p.method}`, account: "1100 Bank & Cash", dr: p.amount, cr: 0 }); L.push({ date: p.date, ref: p.receiptNo, memo: "Feeding paid separately", account: "4200 Feeding Fees", dr: 0, cr: p.amount }); });
  payments.filter((p) => p.status === "Confirmed" && !isFeedingPlanPayment(p)).forEach((p) => { L.push({ date: p.date, ref: p.receiptNo, memo: `${ACCOUNTS[p.account].label} receipt ${p.method}`, account: "1100 Bank & Cash", dr: p.amount, cr: 0 }); L.push({ date: p.date, ref: p.receiptNo, memo: "Receipt applied", account: "1200 Fee Receivables", dr: 0, cr: p.amount }); });
  expenses.filter((e) => e.status === "Approved" || e.status === "Paid").forEach((e) => { L.push({ date: e.date, ref: e.no, memo: e.description, account: expenseAccount(e.category), dr: e.amount, cr: 0 }); L.push({ date: e.date, ref: e.no, memo: e.description, account: "1100 Bank & Cash", dr: 0, cr: e.amount }); });
  return L;
}
export function trialBalance() {
  const m = new Map<string, { dr: Minor; cr: Minor }>();
  generalLedger().forEach((l) => { const a = m.get(l.account) ?? { dr: 0, cr: 0 }; a.dr += l.dr; a.cr += l.cr; m.set(l.account, a); });
  return [...m].map(([account, v]) => ({ account, dr: Math.max(0, v.dr - v.cr), cr: Math.max(0, v.cr - v.dr) })).sort((a, b) => a.account.localeCompare(b.account));
}
export function subledgerRecon() {
  const gl = trialBalance().find((t) => t.account.startsWith("1200"))!; const glBal = gl.dr - gl.cr;
  const sub = students.reduce((a, s) => a + ACCOUNT_IDS.reduce((x, acc) => x + accountSummary(s.id, acc).balance, 0), 0);
  return { gl: glBal, sub, diff: glBal - sub };
}
