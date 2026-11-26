// Feeding module. Feeding is BILLED on the school fees invoice; this module runs it:
// who is on feeding each term (everyone by default, with per-student exceptions), the daily meal register,
// and per-class totals. Mirrors supabase/migrations/…_feeding.sql. Pure helpers, safe on client and server.
import type { Minor } from "./money";

/** An exception for one student in one term ("2026/2027|Term 1"). No exception = on feeding at the class rate. */
export interface FeedingException { studentId: string; term: string; onFeeding: boolean; rate?: Minor; reason: string }
/** Meals served for one class on one day. */
export interface MealEntry { date: string; classId: string; served: number }

/** What a student pays for feeding this term: the class rate, a different rate, or 0 when not on feeding. */
export function studentFeedingRate(classRate: Minor, ex?: FeedingException): Minor {
  if (!ex) return classRate;
  if (!ex.onFeeding) return 0;
  return ex.rate ?? classRate;
}

export type FeedingStatus = "On feeding" | "Different rate" | "Not on feeding";
export const feedingStatus = (ex?: FeedingException): FeedingStatus => (!ex ? "On feeding" : !ex.onFeeding ? "Not on feeding" : ex.rate !== undefined ? "Different rate" : "On feeding");

/** Returns an error message, or "" when the exception can be saved. */
export function validateException(ex: FeedingException): string {
  if (ex.reason.trim().length < 3) return "Give a reason (e.g. brings lunch from home, half-day)";
  if (!ex.onFeeding && ex.rate !== undefined) return "A student not on feeding cannot have a rate";
  if (ex.rate !== undefined && (!Number.isInteger(ex.rate) || ex.rate < 0)) return "The rate must be zero or more";
  return "";
}

/** (Older invoices only) Replace or drop a Feeding line according to the student's feeding for that term. */
export function applyFeeding<T extends { label: string; amount: Minor }>(items: T[], rate: Minor): T[] {
  return items.flatMap((i) => (i.label !== "Feeding" ? [i] : rate > 0 ? [{ ...i, amount: rate }] : []));
}

export function readExceptions(saved: unknown): FeedingException[] {
  if (!Array.isArray(saved)) return [];
  return saved.filter((e): e is FeedingException => !!e && typeof e.studentId === "string" && typeof e.term === "string" && typeof e.onFeeding === "boolean"
    && typeof e.reason === "string" && (e.rate === undefined || Number.isInteger(e.rate)) && validateException(e) === "");
}
export function readMeals(saved: unknown): MealEntry[] {
  if (!Array.isArray(saved)) return [];
  return saved.filter((m): m is MealEntry => !!m && /^\d{4}-\d{2}-\d{2}$/.test(m.date) && typeof m.classId === "string" && Number.isInteger(m.served) && m.served >= 0);
}
/** Set one exception (replacing any for the same student + term); null removes it (back to the class rate). */
export function setException(list: FeedingException[], studentId: string, term: string, ex: FeedingException | null): FeedingException[] {
  const rest = list.filter((e) => !(e.studentId === studentId && e.term === term));
  return ex ? [...rest, ex] : rest;
}
/** Record a day's meals for some classes (replacing earlier counts for that day and class). */
export function recordMeals(list: MealEntry[], date: string, counts: Record<string, number>): MealEntry[] {
  const rest = list.filter((m) => !(m.date === date && m.classId in counts));
  return [...rest, ...Object.entries(counts).map(([classId, served]) => ({ date, classId, served }))].sort((a, b) => b.date.localeCompare(a.date));
}

// ---------- Feeding payment plans ----------
// How a family pays feeding this term. Feeding is never on the school fees invoice: it is paid on its own, all at once
// for the term (Termly, the default) or a fixed amount per day / week / month. A change keeps the history.
export const PLAN_FREQUENCIES = ["Term", "Daily", "Weekly", "Monthly"] as const;
/** "With school fees" only appears in records made before feeding left the invoice; it is treated as Termly. */
export type PlanFrequency = (typeof PLAN_FREQUENCIES)[number] | "With school fees";
export const DEFAULT_PLAN = "Term" as const;
/** The plan as it works now: no plan, or an old "With school fees" plan, means Termly. */
export const planFreq = (f?: PlanFrequency): Exclude<PlanFrequency, "With school fees"> => (!f || f === "With school fees" ? "Term" : f);
export interface FeedingPlan { studentId: string; term: string; frequency: PlanFrequency; from: string; note?: string }
export interface TermDates { start: string; end: string }
export const planLabel = (f: PlanFrequency) => (planFreq(f) === "Term" ? "Termly" : planFreq(f));
const perWord: Record<PlanFrequency, string> = { "With school fees": "term", Daily: "school day", Weekly: "week", Monthly: "month", Term: "term" };
export const periodWord = (f: PlanFrequency) => perWord[f];

const day = (iso: string) => new Date(iso + "T00:00:00Z");
const iso = (d: Date) => d.toISOString().slice(0, 10);
/** School days (Mon–Fri) from `a` to `b` inclusive. */
export function schoolDays(a: string, b: string): number {
  if (b < a) return 0; let n = 0;
  for (let d = day(a); iso(d) <= b; d.setUTCDate(d.getUTCDate() + 1)) { const w = d.getUTCDay(); if (w !== 0 && w !== 6) n++; }
  return n;
}
const monthsSpanned = (a: string, b: string) => (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + Number(b.slice(5, 7)) - Number(a.slice(5, 7)) + 1;

/** How many payment periods a term has for a plan. */
export function termPeriods(t: TermDates, f: PlanFrequency): number {
  if (f === "Daily") return Math.max(1, schoolDays(t.start, t.end));
  if (f === "Weekly") return Math.max(1, Math.ceil((day(t.end).getTime() - day(t.start).getTime() + 86400000) / (7 * 86400000)));
  if (f === "Monthly") return Math.max(1, monthsSpanned(t.start, t.end));
  return 1;
}
/** Amount per period, rounded up to a whole cedi (the last period can be smaller; the total never exceeds the rate). */
export const perPeriod = (rate: number, t: TermDates, f: PlanFrequency) => Math.ceil(rate / termPeriods(t, f) / 100) * 100;

/** Periods that have started by `today`. Termly: the whole term's feeding is due once the term starts. */
export function periodsElapsed(t: TermDates, f: PlanFrequency, today: string, dueOn?: string): number {
  if (today < t.start) return 0;
  const upTo = today > t.end ? t.end : today;
  if (f === "Daily") return schoolDays(t.start, upTo);
  if (f === "Weekly") return Math.min(termPeriods(t, f), Math.floor((day(upTo).getTime() - day(t.start).getTime()) / (7 * 86400000)) + 1);
  if (f === "Monthly") return Math.min(termPeriods(t, f), monthsSpanned(t.start, upTo));
  void dueOn;
  return 1;   // Termly (and old "With school fees" plans)
}

/** Feeding that should have been paid by today under the plan (never more than the term's feeding). */
export function expectedByToday(rate: number, t: TermDates, f: PlanFrequency, today: string, dueOn?: string): number {
  if (planFreq(f) === "Term") return periodsElapsed(t, f, today, dueOn) > 0 ? rate : 0;
  return Math.min(rate, perPeriod(rate, t, f) * periodsElapsed(t, f, today, dueOn));
}

export type PlanStatus = { label: "Paid in full" | "On track" | "Behind" | "Not on feeding"; behind: number };
export function planStatus(rate: number, paid: number, expected: number): PlanStatus {
  if (rate <= 0) return { label: "Not on feeding", behind: 0 };
  if (paid >= rate) return { label: "Paid in full", behind: 0 };
  return expected > paid ? { label: "Behind", behind: expected - paid } : { label: "On track", behind: 0 };
}

/** The plan in force on `onDate` (latest start on or before it); none = Termly (see planFreq). */
export function currentPlan(plans: FeedingPlan[], studentId: string, term: string, onDate: string): FeedingPlan | undefined {
  return plans.filter((p) => p.studentId === studentId && p.term === term && p.from <= onDate).sort((a, b) => b.from.localeCompare(a.from))[0];
}
export const planHistory = (plans: FeedingPlan[], studentId: string, term: string) =>
  plans.filter((p) => p.studentId === studentId && p.term === term).sort((a, b) => a.from.localeCompare(b.from));

export function validatePlan(p: FeedingPlan, t?: TermDates): string {
  if (!(PLAN_FREQUENCIES as readonly string[]).includes(p.frequency)) return "Choose a plan";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p.from)) return "Choose the date the plan starts";
  if (t && (p.from < t.start || p.from > t.end)) return `The start date must be within the term (${t.start} – ${t.end})`;
  return "";
}
/** Add a plan change; a change starting on the same day as an earlier one replaces it. */
export function addPlan(list: FeedingPlan[], p: FeedingPlan): FeedingPlan[] {
  return [...list.filter((x) => !(x.studentId === p.studentId && x.term === p.term && x.from === p.from)), p];
}
export function readPlans(saved: unknown): FeedingPlan[] {
  if (!Array.isArray(saved)) return [];
  return saved.filter((p): p is FeedingPlan => !!p && typeof p.studentId === "string" && typeof p.term === "string" && validatePlan(p) === "");
}
