// Data access seam. Every page reads through these functions; the backend replaces this file later.
import { pct, type Minor } from "../money";
import * as D from "./seed";
import type { Student, Guardian } from "./types";

export const { SCHOOL, TODAY, classes, students, guardians, invoices, payments, staff, inventory, movements, expenses, budget, messages, approvals, audit, events, applicants, feeStructure, gradeScale, gradeOf, attendanceTrend, subjectsByLevel, studentIssues } = D;

export const getClass = (id: string) => classes.find((c) => c.id === id)!;
export const getStudent = (id: string) => students.find((s) => s.id === id);
export const getGuardian = (id: string) => guardians.find((g) => g.id === id);
export const getStaff = (id: string) => staff.find((s) => s.id === id);
export const fullName = (s: Student) => [s.first, s.middle, s.last].filter(Boolean).join(" ");
export const shortName = (s: Student) => `${s.first} ${s.last}`;

export type FeeStatus = "Paid in Full" | "Partially Paid" | "Outstanding" | "Overdue" | "Credit Balance";
export interface FeeSummary { billed: Minor; discount: Minor; paid: Minor; balance: Minor; dueOn: string; status: FeeStatus; overdue: boolean }

const feeCache = new Map<string, FeeSummary>();
export function feeSummary(studentId: string): FeeSummary {
  const hit = feeCache.get(studentId); if (hit) return hit;
  const inv = invoices.filter((i) => i.studentId === studentId);
  const gross = inv.reduce((a, i) => a + i.items.reduce((x, y) => x + y.amount, 0), 0);
  const discount = inv.reduce((a, i) => a + i.discount, 0);
  const billed = gross - discount;
  const paid = payments.filter((p) => p.studentId === studentId && p.status === "Confirmed").reduce((a, p) => a + p.amount, 0);
  const balance = billed - paid;
  const dueOn = inv.map((i) => i.dueOn).sort()[0] ?? D.TODAY;
  const overdue = balance > 0 && dueOn < D.TODAY;
  const status: FeeStatus = balance < 0 ? "Credit Balance" : balance === 0 ? "Paid in Full" : overdue ? "Overdue" : paid > 0 ? "Partially Paid" : "Outstanding";
  const r = { billed, discount, paid, balance, dueOn, status, overdue };
  feeCache.set(studentId, r); return r;
}

export const activeStudents = () => students.filter((s) => s.status === "Active");
export const studentsOfGuardian = (gid: string) => students.filter((s) => s.guardians.some((g) => g.guardianId === gid));

export function feesOverview(classId?: string, category?: string) {
  const list = activeStudents().filter((s) => (!classId || s.classId === classId) && (!category || s.category === category));
  const rows = list.map((s) => ({ s, f: feeSummary(s.id) }));
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

export function collectionsBy(days: number) {
  const cutoff = new Date(D.TODAY + "T00:00:00Z"); cutoff.setUTCDate(cutoff.getUTCDate() - days);
  return payments.filter((p) => p.status === "Confirmed" && p.date >= cutoff.toISOString().slice(0, 10)).reduce((a, p) => a + p.amount, 0);
}
export const collectedToday = () => payments.filter((p) => p.status === "Confirmed" && p.date === D.TODAY).reduce((a, p) => a + p.amount, 0);
export function collectionsByMethod() {
  const m = new Map<string, number>();
  payments.filter((p) => p.status === "Confirmed").forEach((p) => m.set(p.method, (m.get(p.method) ?? 0) + p.amount));
  return [...m].map(([name, value]) => ({ name, value: value / 100 })).sort((a, b) => b.value - a.value);
}
export function collectionTrend() {
  const byDay = new Map<string, number>();
  payments.filter((p) => p.status === "Confirmed").forEach((p) => byDay.set(p.date, (byDay.get(p.date) ?? 0) + p.amount));
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
export function reminderRows(opts: { classId?: string; overdueOnly?: boolean } = {}): ReminderRow[] {
  const map = new Map<string, ReminderRow>();
  activeStudents().forEach((s) => {
    if (opts.classId && s.classId !== opts.classId) return;
    const f = feeSummary(s.id); if (f.balance <= 0) return; if (opts.overdueOnly && !f.overdue) return;
    s.guardians.forEach((sg) => {
      if (!sg.financial || !sg.receivesFeeReminders || !sg.verified) return; // never disclose to unauthorised guardians
      const g = getGuardian(sg.guardianId)!;
      const row = map.get(g.id) ?? { guardian: g, lines: [], total: 0, eligible: true, channel: g.preferred, lastReminder: messages.filter((m) => m.guardianId === g.id && m.template === "Fee Reminder").map((m) => m.date).sort().pop() };
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

export function buildReminder(row: ReminderRow, school = SCHOOL) {
  const name = `${row.guardian.title} ${row.guardian.name.split(" ").pop()}`;
  const fmt = (m: number) => `GHS ${(m / 100).toLocaleString("en-GH", { minimumFractionDigits: 0 })}`;
  const due = new Date(row.lines[0].dueOn + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  if (row.lines.length === 1) {
    const l = row.lines[0];
    return `Dear ${name},\n\nGreetings from ${school.name}.\n\nThis is a friendly reminder that your ward, ${shortName(l.student)}, currently has an outstanding school fee balance of ${fmt(l.balance)} for ${school.term} of the ${school.year} academic year.\n\nKindly make payment by ${due}.\n\nIf you have already paid, please disregard this reminder and contact the school if the payment has not yet been reflected.\n\nThank you.\n\n${school.name}\nAccounts Department`;
  }
  return `Dear ${name},\n\nThe following outstanding balances remain for your wards:\n\n${row.lines.map((l) => `${shortName(l.student)} — ${fmt(l.balance)}`).join("\n")}\n\nTotal Outstanding: ${fmt(row.total)}.\n\nKindly contact the Accounts Department or use the approved school payment channel.\n\n${school.name}\nAccounts Department`;
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
export const cashPosition = () => 18_450_000 + D.payments.filter((p) => p.status === "Confirmed").reduce((a, p) => a + p.amount, 0) - totalExpenditure();
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
  { year: "2022/23", students: 139 }, { year: "2023/24", students: 152 }, { year: "2024/25", students: 168 }, { year: "2025/26", students: 177 }, { year: "2026/27", students: activeStudents().length },
];
export const unreconciled = () => payments.filter((p) => p.status === "Pending");

// ---- General ledger (derived; double-entry) ----
export const OPENING_CASH: Minor = 18_450_000;
export interface GLLine { date: string; ref: string; memo: string; account: string; dr: Minor; cr: Minor }
const incomeAccount = (label: string) => (label === "Tuition" ? "4100 Tuition Fees" : label === "Feeding" ? "4200 Feeding Fees" : label === "Boarding" ? "4300 Boarding Fees" : "4400 Levies & Other Fees");
const expenseAccount = (c: string) => `5${({ Salaries: "100", Utilities: "200", Internet: "250", Repairs: "300", Stationery: "350", "Food Supplies": "400", Transport: "450", "Inventory Purchases": "500", Software: "550", Building: "600", Maintenance: "650" } as Record<string, string>)[c] ?? "900"} ${c}`;
export function generalLedger(): GLLine[] {
  const L: GLLine[] = [{ date: "2026-08-31", ref: "OPEN", memo: "Opening balances", account: "1100 Bank & Cash", dr: OPENING_CASH, cr: 0 }, { date: "2026-08-31", ref: "OPEN", memo: "Opening balances", account: "3100 Accumulated Fund", dr: 0, cr: OPENING_CASH }];
  invoices.forEach((i) => {
    const gross = i.items.reduce((a, b) => a + b.amount, 0);
    L.push({ date: i.billedOn, ref: i.no, memo: "Term 1 invoice (accrual)", account: "1200 Fee Receivables", dr: gross, cr: 0 });
    i.items.forEach((it) => L.push({ date: i.billedOn, ref: i.no, memo: it.label, account: incomeAccount(it.label), dr: 0, cr: it.amount }));
    if (i.discount) { L.push({ date: i.billedOn, ref: i.no, memo: "Scholarship discount", account: "4900 Discounts & Scholarships", dr: i.discount, cr: 0 }); L.push({ date: i.billedOn, ref: i.no, memo: "Scholarship discount", account: "1200 Fee Receivables", dr: 0, cr: i.discount }); }
  });
  payments.filter((p) => p.status === "Confirmed").forEach((p) => { L.push({ date: p.date, ref: p.receiptNo, memo: `Receipt ${p.method}`, account: "1100 Bank & Cash", dr: p.amount, cr: 0 }); L.push({ date: p.date, ref: p.receiptNo, memo: "Receipt applied", account: "1200 Fee Receivables", dr: 0, cr: p.amount }); });
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
  const sub = students.reduce((a, s) => a + feeSummary(s.id).balance, 0);
  return { gl: glBal, sub, diff: glBal - sub };
}
