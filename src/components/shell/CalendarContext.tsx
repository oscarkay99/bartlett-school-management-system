"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { addTerm as addTermTo, addYear as addYearTo, mergeCalendar, type AcademicYear, type Term } from "@/lib/calendar";
import { cn } from "@/lib/utils";

const KEY = "calendar-v1", SEL = "period-v1";
interface CalendarState {
  calendar: AcademicYear[]; year: string; term: string; setPeriod: (year: string, term?: string) => void;
  addYear: (y: AcademicYear) => void; addTerm: (year: string, t: Term) => void;
}
const Ctx = createContext<CalendarState | null>(null);
export const useCalendar = () => { const c = useContext(Ctx); if (!c) throw new Error("useCalendar outside CalendarProvider"); return c; };

// Front-end stand-in: additions are kept in this browser (localStorage) until the backend stores the calendar.
export function CalendarProvider({ seed, current, children }: { seed: AcademicYear[]; current: { year: string; term: string }; children: ReactNode }) {
  const [calendar, setCalendar] = useState(seed);
  const [sel, setSel] = useState(current);
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      const cal = mergeCalendar(seed, JSON.parse(localStorage.getItem(KEY) ?? "null")); setCalendar(cal);
      const s = JSON.parse(localStorage.getItem(SEL) ?? "null");
      if (s && cal.some((y) => y.name === s.year && y.terms.some((t) => t.name === s.term))) setSel(s);
    } catch {}
  }, [seed]);
  /* eslint-enable react-hooks/set-state-in-effect */
  const save = useCallback((cal: AcademicYear[]) => { setCalendar(cal); try { localStorage.setItem(KEY, JSON.stringify(cal)); } catch {} }, []);
  const setPeriod = useCallback((year: string, term?: string) => {
    const y = calendar.find((x) => x.name === year); const t = term ?? (y?.terms.some((x) => x.name === sel.term) ? sel.term : y?.terms[0]?.name ?? "");
    const next = { year, term: t }; setSel(next); try { localStorage.setItem(SEL, JSON.stringify(next)); } catch {}
  }, [calendar, sel.term]);
  const value = useMemo(() => ({
    calendar, year: sel.year, term: sel.term, setPeriod,
    addYear: (y: AcademicYear) => save(addYearTo(calendar, y)),
    addTerm: (year: string, t: Term) => save(addTermTo(calendar, year, t)),
  }), [calendar, sel, setPeriod, save]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Year + term pickers. Terms list only the selected year's terms. */
export function PeriodSelect({ dark }: { dark?: boolean }) {
  const { calendar, year, term, setPeriod } = useCalendar();
  const terms = calendar.find((y) => y.name === year)?.terms ?? [];
  const cls = dark ? "h-9 rounded-lg border border-white/15 bg-white/10 px-2 text-xs text-white" : "h-8 rounded-lg border border-line bg-surface px-2 text-xs";
  const opt = dark ? "text-black" : undefined;
  return (
    <>
      <select aria-label="Academic year" className={cls} value={year} onChange={(e) => setPeriod(e.target.value)}>{calendar.map((y) => <option key={y.name} className={opt}>{y.name}</option>)}</select>
      <select aria-label="Term" className={cn(cls, terms.length === 0 && "opacity-60")} value={term} disabled={terms.length === 0} onChange={(e) => setPeriod(year, e.target.value)}>
        {terms.length === 0 ? <option value="" className={opt}>No terms yet</option> : terms.map((t) => <option key={t.name} className={opt}>{t.name}</option>)}
      </select>
    </>
  );
}
