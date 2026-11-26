"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { findTerm, mergeSchedule, termKey, type ClassRef, type TermFees } from "@/lib/fees";
import { LIVE } from "@/lib/live/config";
import { useLiveData } from "@/lib/live/data";
import { useSave } from "@/lib/live/useSave";
import { saveTermFees } from "@/lib/live/actions";
import * as Q from "@/lib/data/queries";

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
export function FeeScheduleProvider(props: { seed: TermFees[]; locked: string[]; classes: ClassRef[]; activities: string[]; children: ReactNode }) {
  return LIVE ? <LiveFeeSchedule>{props.children}</LiveFeeSchedule> : <DemoFeeSchedule {...props} />;
}

/** Live site: the schedule is in the database (loaded with the school's data); saving writes it back. */
function LiveFeeSchedule({ children }: { children: ReactNode }) {
  const { version } = useLiveData(); const run = useSave();
  const value = useMemo(() => {
    const schedule = [...Q.feeSchedule]; const locked = Q.lockedFeeTerms();
    return { schedule, classes: Q.classes.map((c) => ({ id: c.id, name: c.name, level: c.level })), activities: Object.keys(schedule[0]?.activities ?? {}),
      save: (tf: TermFees) => { void run(() => saveTermFees(tf), `Fees for ${tf.term} ${tf.year} saved`); },
      get: (year: string, term: string) => findTerm(schedule, year, term), isLocked: (year: string, term: string) => locked.includes(termKey(year, term)) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, run]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

function DemoFeeSchedule({ seed, locked, classes, activities, children }: { seed: TermFees[]; locked: string[]; classes: ClassRef[]; activities: string[]; children: ReactNode }) {
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
