"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { readExceptions, readMeals, recordMeals, setException, type FeedingException, type MealEntry } from "@/lib/feeding";
import { LIVE } from "@/lib/live/config";
import { useLiveData } from "@/lib/live/data";
import { useSave } from "@/lib/live/useSave";
import { liveExtra } from "@/lib/live/hydrate";
import { saveMeals as saveMealsDb, setFeedingException } from "@/lib/live/actions";

const EX = "feeding-exceptions-v1", MEALS = "meal-register-v1";
const load = (k: string) => { try { return JSON.parse(localStorage.getItem(k) ?? "null"); } catch { return null; } };
const save = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

/** Feeding exceptions and the meal register: from the database on the live site, kept in this browser on the demo. */
export function useFeeding() { return useFeedingImpl(); }

function useLiveFeeding() {
  const { version } = useLiveData(); const run = useSave();
  const exceptions = useMemo(() => liveExtra.data?.feedingExceptions ?? [], [version]);   // eslint-disable-line react-hooks/exhaustive-deps
  const meals = useMemo(() => liveExtra.data?.meals ?? [], [version]);                     // eslint-disable-line react-hooks/exhaustive-deps
  const updateException = useCallback((studentId: string, term: string, ex: FeedingException | null) => { void run(() => setFeedingException(studentId, term, ex)); }, [run]);
  const saveMeals = useCallback((date: string, counts: Record<string, number>) => { void run(() => saveMealsDb(date, Object.entries(counts).map(([classId, served]) => ({ classId, served })))); }, [run]);
  const exceptionFor = useCallback((studentId: string, term: string) => exceptions.find((e) => e.studentId === studentId && e.term === term), [exceptions]);
  return { exceptions, meals, exceptionFor, updateException, saveMeals };
}

function useDemoFeeding() {
  const [exceptions, setExceptions] = useState<FeedingException[]>([]);
  const [meals, setMeals] = useState<MealEntry[]>([]);
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => { setExceptions(readExceptions(load(EX))); setMeals(readMeals(load(MEALS))); }, []);
  /* eslint-enable react-hooks/set-state-in-effect */
  const updateException = useCallback((studentId: string, term: string, ex: FeedingException | null) => setExceptions((cur) => { const next = setException(cur, studentId, term, ex); save(EX, next); return next; }), []);
  const saveMeals = useCallback((date: string, counts: Record<string, number>) => setMeals((cur) => { const next = recordMeals(cur, date, counts); save(MEALS, next); return next; }), []);
  const exceptionFor = useCallback((studentId: string, term: string) => exceptions.find((e) => e.studentId === studentId && e.term === term), [exceptions]);
  return { exceptions, meals, exceptionFor, updateException, saveMeals };
}

// LIVE is fixed per build, so the same hook always runs.
const useFeedingImpl = LIVE ? useLiveFeeding : useDemoFeeding;
