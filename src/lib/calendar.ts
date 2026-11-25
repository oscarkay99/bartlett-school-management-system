// Academic calendar: years (e.g. "2026/2027") each holding dated terms. Pure helpers, safe on client and server.
export interface Term { name: string; start: string; end: string }
export interface AcademicYear { name: string; start: string; end: string; terms: Term[] }

const overlaps = (a: { start: string; end: string }, b: { start: string; end: string }) => a.start <= b.end && b.start <= a.end;
const addYears = (iso: string, n: number) => `${Number(iso.slice(0, 4)) + n}${iso.slice(4)}`;
const sortYears = (ys: AcademicYear[]) => [...ys].sort((a, b) => b.start.localeCompare(a.start)); // newest first
const sortTerms = (ts: Term[]) => [...ts].sort((a, b) => a.start.localeCompare(b.start));

/** Returns an error message, or "" when the new year is valid. */
export function validateYear(y: Pick<AcademicYear, "name" | "start" | "end">, existing: AcademicYear[]): string {
  const m = /^(\d{4})\/(\d{4})$/.exec(y.name.trim());
  if (!m) return "Use the format 2027/2028";
  if (Number(m[2]) !== Number(m[1]) + 1) return "The second year must follow the first (e.g. 2027/2028)";
  if (existing.some((x) => x.name === y.name.trim())) return `${y.name.trim()} already exists`;
  if (!y.start || !y.end) return "Enter a start and end date";
  if (y.start >= y.end) return "The end date must be after the start date";
  if (y.start.slice(0, 4) !== m[1]) return `The year should start in ${m[1]}`;
  const clash = existing.find((x) => overlaps(x, y));
  if (clash) return `Dates overlap ${clash.name} (${clash.start} – ${clash.end})`;
  return "";
}

/** Returns an error message, or "" when the term can be added to the year. */
export function validateTerm(t: Term, year: AcademicYear): string {
  if (!t.name.trim()) return "Enter a term name";
  if (year.terms.some((x) => x.name.toLowerCase() === t.name.trim().toLowerCase())) return `${year.name} already has ${t.name.trim()}`;
  if (!t.start || !t.end) return "Enter a start and end date";
  if (t.start >= t.end) return "The end date must be after the start date";
  if (t.start < year.start || t.end > year.end) return `The term must fall within ${year.name} (${year.start} – ${year.end})`;
  const clash = year.terms.find((x) => overlaps(x, t));
  if (clash) return `Dates overlap ${clash.name} (${clash.start} – ${clash.end})`;
  return "";
}

/** Suggested dates for a new year: the latest year shifted forward by one year (or a Sep–Jul default). */
export function suggestYear(existing: AcademicYear[]): AcademicYear {
  const last = sortYears(existing)[0];
  if (!last) { const y = new Date().getFullYear(); return { name: `${y}/${y + 1}`, start: `${y}-09-07`, end: `${y + 1}-07-23`, terms: [] }; }
  const first = Number(last.name.slice(0, 4)) + 1;
  return { name: `${first}/${first + 1}`, start: addYears(last.start, 1), end: addYears(last.end, 1), terms: last.terms.map((t) => ({ name: t.name, start: addYears(t.start, 1), end: addYears(t.end, 1) })) };
}

/** Suggested next term for a year: named "Term N", starting the day after the last term ends. */
export function suggestTerm(year: AcademicYear): Term {
  const ts = sortTerms(year.terms); const last = ts[ts.length - 1];
  const day = (iso: string, n: number) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const start = last ? day(last.end, 21) : year.start;
  const end = day(start, 77) > year.end ? year.end : day(start, 77);
  return { name: `Term ${ts.length + 1}`, start: start > year.end ? year.end : start, end };
}

export const addYear = (cal: AcademicYear[], y: AcademicYear) => sortYears([...cal, { ...y, name: y.name.trim(), terms: sortTerms(y.terms) }]);
export const addTerm = (cal: AcademicYear[], yearName: string, t: Term) => cal.map((y) => (y.name === yearName ? { ...y, terms: sortTerms([...y.terms, { ...t, name: t.name.trim() }]) } : y));

/** Seed calendar plus anything added locally (seed entries always win; additions are appended). */
export function mergeCalendar(seed: AcademicYear[], saved: unknown): AcademicYear[] {
  if (!Array.isArray(saved)) return seed;
  let cal = seed;
  for (const y of saved as AcademicYear[]) {
    if (!y || typeof y.name !== "string" || !Array.isArray(y.terms)) continue;
    const have = cal.find((x) => x.name === y.name);
    if (!have) { if (!validateYear(y, cal)) cal = addYear(cal, { ...y, terms: [] }); else continue; }
    for (const t of y.terms) { const yr = cal.find((x) => x.name === y.name)!; if (!validateTerm(t, yr)) cal = addTerm(cal, y.name, t); }
  }
  return cal;
}

/** The term a date belongs to: the latest term that has started by then (holidays count towards the term just ended). */
export function termOfDate(cal: AcademicYear[], date: string): { year: string; term: string } | undefined {
  let best: { year: string; term: string; start: string } | undefined;
  for (const y of cal) for (const t of y.terms) if (t.start <= date && (!best || t.start > best.start)) best = { year: y.name, term: t.name, start: t.start };
  return best && { year: best.year, term: best.term };
}
