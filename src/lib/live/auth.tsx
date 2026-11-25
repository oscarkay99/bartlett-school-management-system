"use client";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { db, friendlyError } from "./client";
import { LIVE } from "./config";

/** The signed-in staff member, as the database knows them (staff_accounts). */
export interface Account { userId: string; email: string; role: string; name: string }
interface AuthState { live: boolean; ready: boolean; account: Account | null; error: string; signIn: (email: string, password: string) => Promise<string>; signOut: () => Promise<void> }

const Ctx = createContext<AuthState>({ live: false, ready: true, account: null, error: "", signIn: async () => "", signOut: async () => {} });
export const useAuth = () => useContext(Ctx);

async function loadAccount(userId: string, email: string): Promise<{ account: Account | null; error: string }> {
  const { data, error } = await db().from("staff_accounts").select("role, display_name, active").eq("user_id", userId).maybeSingle();
  if (error) return { account: null, error: friendlyError(error) };
  if (!data || !data.active) return { account: null, error: "This login has no active staff role. Ask the Owner to set one up." };
  return { account: { userId, email, role: data.role, name: data.display_name }, error: "" };
}

/** Live mode only: keeps the session, and the role from the database. In demo mode it does nothing. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(!LIVE); const [account, setAccount] = useState<Account | null>(null); const [error, setError] = useState("");
  useEffect(() => {
    if (!LIVE) return;
    let live = true;
    const apply = async (user: { id: string; email?: string } | null) => {
      if (!user) { if (live) { setAccount(null); setReady(true); } return; }
      const r = await loadAccount(user.id, user.email ?? "");
      if (live) { setAccount(r.account); setError(r.error); setReady(true); }
    };
    db().auth.getSession().then(({ data }) => apply(data.session?.user ?? null));
    const { data: sub } = db().auth.onAuthStateChange((event, session) => { if (event === "SIGNED_OUT" || event === "SIGNED_IN") apply(session?.user ?? null); });
    return () => { live = false; sub.subscription.unsubscribe(); };
  }, []);
  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error: e } = await db().auth.signInWithPassword({ email, password });
    if (e) return /invalid/i.test(e.message) ? "Wrong email or password." : friendlyError(e);
    const r = await loadAccount(data.user.id, data.user.email ?? email);
    if (!r.account) { await db().auth.signOut(); return r.error; }
    setAccount(r.account); setError(""); return "";
  }, []);
  const signOut = useCallback(async () => { await db().auth.signOut(); setAccount(null); }, []);
  return <Ctx.Provider value={{ live: LIVE, ready, account, error, signIn, signOut }}>{children}</Ctx.Provider>;
}
