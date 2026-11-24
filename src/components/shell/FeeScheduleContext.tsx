"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { findTerm, mergeSchedule, termKey, type ClassRef, type TermFees } from "@/lib/fees";

const KEY = "fee-schedule-v1";
interface FeeScheduleState {
  schedule: TermFees[]; classes: ClassRef[]; activities: string[];
  get: (year: string, term: string) => TermFees | undefined;
  /** True once a term has invoices: its fees can only change through an approved adjustment. */
  isLocked: (year: string, term: string) => boolean;
  save: (tf: TermFees) => void;
}
const Ctx = createContext<FeeScheduleState | null>(null);
export const useFeeSchedule = () => { const c = useContext(Ctx); if (!c) throw new Error("useFeeSchedule outside FeeScheduleProvider"); return c; };

// Front-end stand-in: fees set in Settings are kept in this browser (localStorage) until the backend stores them.
export function FeeScheduleProvider({ seed, locked, classes, activities, children }: { seed: TermFees[]; locked: string[]; classes: ClassRef[]; activities: string[]; children: ReactNode }) {
  const [schedule, setSchedule] = useState(seed);
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => { try { setSchedule(mergeSchedule(seed, JSON.parse(localStorage.getItem(KEY) ?? "null"), locked, classes)); } catch {} }, [seed, locked, classes]);
  /* eslint-enable react-hooks/set-state-in-effect */
  const save = useCallback((tf: TermFees) => {
    if (locked.includes(termKey(tf.year, tf.term))) return;
    setSchedule((cur) => {
      const next = [...cur.filter((x) => termKey(x.year, x.term) !== termKey(tf.year, tf.term)), tf];
      // Only edits are stored; locked seed terms are never written.
      try { localStorage.setItem(KEY, JSON.stringify(next.filter((x) => !locked.includes(termKey(x.year, x.term))))); } catch {}
      return next;
    });
  }, [locked]);
  const value = useMemo(() => ({
    schedule, classes, activities, save,
    get: (year: string, term: string) => findTerm(schedule, year, term),
    isLocked: (year: string, term: string) => locked.includes(termKey(year, term)),
  }), [schedule, classes, activities, locked, save]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
