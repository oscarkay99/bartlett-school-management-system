"use client";
import { useCallback, useEffect, useState } from "react";
import { readExceptions, readMeals, recordMeals, setException, type FeedingException, type MealEntry } from "@/lib/feeding";

const EX = "feeding-exceptions-v1", MEALS = "meal-register-v1";
const load = (k: string) => { try { return JSON.parse(localStorage.getItem(k) ?? "null"); } catch { return null; } };
const save = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

/** Feeding exceptions and the meal register, kept in this browser until the backend stores them. */
export function useFeeding() {
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
