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

/** Replace or drop the Feeding line on an invoice according to the student's feeding for that term. */
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
