"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { LIVE } from "./config";
import { useAuth } from "./auth";
import { loadSchool } from "./load";
import { hydrate } from "./hydrate";
import { db } from "./client";

interface LiveDataState { ready: boolean; error: string; version: number; reload: () => Promise<void> }
const Ctx = createContext<LiveDataState>({ ready: true, error: "", version: 0, reload: async () => {} });
/** Live site: whether the school's data has loaded, and `reload()` to fetch it again after a change. */
export const useLiveData = () => useContext(Ctx);

/** Loads the school's data after sign-in (and again on reload) and puts it in place of the demo data. */
export function LiveDataProvider({ children }: { children: ReactNode }) {
  const { account } = useAuth();
  const [state, setState] = useState({ ready: !LIVE, error: "", version: 0 });
  const busy = useRef<Promise<void> | null>(null);
  const reload = useCallback(async () => {
    if (!LIVE) return;
    busy.current ??= (async () => {
      // Everything bills itself: once the term has started, every active student without this term's school fees,
      // Extracurricular or Extra Classes bill gets it, from the fees in Settings (idempotent; usually a no-op).
      try { await db().rpc("bill_current_term"); } catch {}
      try { hydrate(await loadSchool()); setState((s) => ({ ready: true, error: "", version: s.version + 1 })); }
      catch (e) { setState((s) => ({ ...s, ready: s.ready, error: e instanceof Error ? e.message : String(e) })); }
      finally { busy.current = null; }
    })();
    return busy.current;
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (LIVE && account) reload(); if (LIVE && !account) setState({ ready: false, error: "", version: 0 }); }, [account, reload]);
  return <Ctx.Provider value={{ ...state, reload }}>{children}</Ctx.Provider>;
}

/** Renders the page only once live data is in (immediately on the demo site). Page views call useLiveData() so they
 *  re-render with fresh numbers after each reload, keeping open dialogs and tabs as they are. */
export function LiveGate({ children }: { children: ReactNode }) {
  const { ready, error, reload } = useLiveData();
  if (!LIVE) return <>{children}</>;
  if (error && !ready) return <div className="rounded-xl border border-danger/30 bg-danger/8 p-6 text-sm">Could not load the school&apos;s data: {error} <button className="ml-2 font-medium text-info hover:underline" onClick={() => reload()}>Try again</button></div>;
  if (!ready) return <div className="grid min-h-[40vh] place-items-center text-sm text-muted">Loading the school&apos;s data…</div>;
  return <>{children}</>;
}
