// Fee schedule: what each class is charged, set per academic year + term.
// Fees are set per level (Kindergarten / Primary / JHS); a class can override or add lines on top of its level.
// Pure helpers, safe on client and server. All amounts are integer minor units (pesewas).
import type { Minor } from "./money";

export const LEVELS = ["Kindergarten", "Primary", "JHS"] as const;
export type Level = (typeof LEVELS)[number];
export interface FeeItem { label: string; amount: Minor }
export interface LevelFees {
  /** School-fee lines for a day student (tuition, books, levies…). */
  items: FeeItem[];
  /** Added to school fees for boarders. 0 = no boarding at this level. */
  boarding: Minor;
  /** Feeding is billed on its own account, per term. */
  feeding: Minor;
}
export interface TermFees {
  year: string; term: string;
  levels: Record<Level, LevelFees>;
  /** classId → lines that replace the level's line with the same label, or are added to it. Amount 0 drops the line. */
  overrides: Record<string, FeeItem[]>;
  /** Extracurricular activity → price per term. */
  activities: Record<string, Minor>;
}
export interface ClassRef { id: string; name: string; level: Level }

export const termKey = (year: string, term: string) => `${year}|${term}`;
export const findTerm = (schedule: TermFees[], year: string, term: string) => schedule.find((t) => t.year === year && t.term === term);

/** School-fee lines for one student of a class this term (overrides applied, boarding added for boarders). */
export function classFees(tf: TermFees, cls: ClassRef, boarding: boolean): FeeItem[] {
  const lvl = tf.levels[cls.level]; const over = tf.overrides[cls.id] ?? [];
  const lines = lvl.items.map((i) => over.find((o) => o.label === i.label) ?? i);
  for (const o of over) if (!lvl.items.some((i) => i.label === o.label)) lines.push(o);
  if (boarding && lvl.boarding > 0) lines.push({ label: "Boarding", amount: lvl.boarding });
  return lines.filter((l) => l.amount > 0).map((l) => ({ ...l }));
}
export const feedingRate = (tf: TermFees, cls: ClassRef) => tf.levels[cls.level].feeding;
export const sumItems = (items: FeeItem[]) => items.reduce((a, i) => a + i.amount, 0);

/** A fresh copy of another term's fees for a new year/term — the starting point for "Copy from last term". */
export const copyTerm = (from: TermFees, year: string, term: string): TermFees => ({ ...structuredClone(from), year, term });

/** An empty schedule for a term: the usual lines at zero, so the school only types amounts. */
export function blankTerm(year: string, term: string, activities: readonly string[]): TermFees {
  const lines = (extra: string[] = []) => ["Tuition", "Books", "ICT & Development Levy", "PTA", ...extra].map((label) => ({ label, amount: 0 }));
  return { year, term, levels: { Kindergarten: { items: lines(), boarding: 0, feeding: 0 }, Primary: { items: lines(), boarding: 0, feeding: 0 }, JHS: { items: lines(["Examination"]), boarding: 0, feeding: 0 } }, overrides: {}, activities: Object.fromEntries(activities.map((a) => [a, 0])) };
}

/** The most recent term before (year, term) in calendar order that already has fees — what "Copy from" offers. */
export function previousTermWithFees(schedule: TermFees[], order: { year: string; term: string }[], year: string, term: string) {
  const i = order.findIndex((p) => p.year === year && p.term === term);
  for (let j = i - 1; j >= 0; j--) { const hit = findTerm(schedule, order[j].year, order[j].term); if (hit) return hit; }
  return undefined;
}

const okAmount = (m: unknown) => typeof m === "number" && Number.isInteger(m) && m >= 0;
/** Returns an error message, or "" when the term's fees can be saved. */
export function validateTermFees(tf: TermFees, classes: ClassRef[]): string {
  for (const lv of LEVELS) {
    const l = tf.levels[lv]; if (!l) return `${lv} fees are missing`;
    const labels = l.items.map((i) => i.label.trim());
    if (labels.some((x) => !x)) return `${lv}: every line needs a name`;
    const dup = labels.find((x, i) => labels.findIndex((y) => y.toLowerCase() === x.toLowerCase()) !== i); if (dup) return `${lv}: "${dup}" appears twice`;
    if (labels.some((x) => x.toLowerCase() === "boarding")) return `${lv}: set boarding in the Boarding field, not as a line`;
    if (!l.items.every((i) => okAmount(i.amount)) || !okAmount(l.boarding) || !okAmount(l.feeding)) return `${lv}: amounts must be zero or more`;
    if (sumItems(l.items) === 0) return `${lv}: school fees add up to zero`;
  }
  for (const [cid, over] of Object.entries(tf.overrides)) {
    const c = classes.find((x) => x.id === cid); if (!c) return "An adjustment refers to a class that no longer exists";
    const labels = over.map((o) => o.label.trim());
    if (labels.some((x) => !x)) return `${c.name}: every adjustment needs a name`;
    const dup = labels.find((x, i) => labels.indexOf(x) !== i); if (dup) return `${c.name}: "${dup}" is adjusted twice`;
    if (labels.some((x) => x.toLowerCase() === "boarding")) return `${c.name}: boarding is set per level`;
    if (!over.every((o) => okAmount(o.amount))) return `${c.name}: amounts must be zero or more`;
  }
  if (!Object.values(tf.activities).every(okAmount)) return "Activity prices must be zero or more";
  return "";
}

/** Invoice number stem for a term, e.g. ("INV", "2026/2027", "Term 2") → "INV-2627-T2". */
export function invoiceStem(prefix: string, year: string, term: string) {
  const yy = /^(\d{4})\/(\d{4})$/.exec(year); const n = /(\d+)/.exec(term)?.[1] ?? term.replace(/\W/g, "").slice(0, 3).toUpperCase();
  return `${prefix}-${yy ? yy[1].slice(2) + yy[2].slice(2) : year.replace(/\W/g, "")}-T${n}`;
}

/** Seed schedule plus fees saved in this browser. Locked terms (already invoiced) always keep the seed's fees. */
export function mergeSchedule(seed: TermFees[], saved: unknown, locked: string[], classes: ClassRef[]): TermFees[] {
  if (!Array.isArray(saved)) return seed;
  let out = seed;
  for (const t of saved as TermFees[]) {
    if (!t || typeof t.year !== "string" || typeof t.term !== "string" || !t.levels || !t.overrides || !t.activities) continue;
    if (locked.includes(termKey(t.year, t.term)) || validateTermFees(t, classes)) continue;
    out = [...out.filter((x) => termKey(x.year, x.term) !== termKey(t.year, t.term)), t];
  }
  return out;
}
