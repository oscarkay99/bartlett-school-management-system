"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { addPlan, currentPlan, planHistory, readPlans, type FeedingPlan } from "@/lib/feeding";
import { LIVE } from "@/lib/live/config";
import { useLiveData } from "@/lib/live/data";
import { useSave } from "@/lib/live/useSave";
import { setFeedingPlan } from "@/lib/live/actions";
import * as Q from "@/lib/data/queries";

const KEY = "feeding-plans-v1";
interface PlansState {
  plans: FeedingPlan[];
  /** The plan in force on a date (none = Termly). */
  planOn: (studentId: string, term: string, onDate: string) => FeedingPlan | undefined;
  history: (studentId: string, term: string) => FeedingPlan[];
  setPlan: (p: FeedingPlan) => void;
}
const Ctx = createContext<PlansState | null>(null);
export const useFeedingPlans = () => { const c = useContext(Ctx); if (!c) throw new Error("useFeedingPlans outside FeedingPlansProvider"); return c; };

// Feeding payment plans for the whole app. Front-end stand-in: changes are kept in this browser (on top of the
// demo plans) until the backend stores them in feeding_plans.
export function FeedingPlansProvider(props: { seed: FeedingPlan[]; children: ReactNode }) {
  return LIVE ? <LivePlans>{props.children}</LivePlans> : <DemoPlans {...props} />;
}

/** Live site: plans come from the database; a change adds a row there (history is kept). */
function LivePlans({ children }: { children: ReactNode }) {
  const { version } = useLiveData(); const run = useSave();
  const value = useMemo(() => { const plans = [...Q.feedingPlans];
    return { plans, setPlan: (p: FeedingPlan) => { void run(() => setFeedingPlan(p)); },
      planOn: (s: string, t: string, d: string) => currentPlan(plans, s, t, d), history: (s: string, t: string) => planHistory(plans, s, t) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, run]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

function DemoPlans({ seed, children }: { seed: FeedingPlan[]; children: ReactNode }) {
  const [added, setAdded] = useState<FeedingPlan[]>([]);
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => { try { setAdded(readPlans(JSON.parse(localStorage.getItem(KEY) ?? "null"))); } catch {} }, []);
  /* eslint-enable react-hooks/set-state-in-effect */
  const plans = useMemo(() => added.reduce(addPlan, seed), [seed, added]);
  const setPlan = useCallback((p: FeedingPlan) => setAdded((cur) => { const next = addPlan(cur, p); try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {} return next; }), []);
  const value = useMemo(() => ({ plans, setPlan,
    planOn: (s: string, t: string, d: string) => currentPlan(plans, s, t, d),
    history: (s: string, t: string) => planHistory(plans, s, t) }), [plans, setPlan]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
