"use client";
import { useCallback } from "react";
import { useToast } from "@/components/ui/interactive";
import { useLiveData } from "./data";

/** Runs a database change, then reloads the school's data so every screen updates. Errors are shown as a toast.
 *  Resolves to true on success. */
export function useSave() {
  const toast = useToast(); const { reload } = useLiveData();
  return useCallback(async (op: () => Promise<string>, ok?: string) => {
    let e = "";
    try { e = await op(); } catch (x) { e = x instanceof Error ? x.message : String(x); }
    if (e) { toast(`Not saved: ${e}`, "err"); return false; }
    await reload(); if (ok) toast(ok); return true;
  }, [toast, reload]);
}
