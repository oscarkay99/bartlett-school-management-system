"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogIn, ShieldCheck } from "lucide-react";
import { SchoolLogo } from "@/components/SchoolLogo";
import { useAuth } from "@/lib/live/auth";
import { LIVE, QA_LOGINS } from "@/lib/live/config";
import { ROLES } from "@/lib/permissions";

// Sign-in. On the QA site each role has a button (tap to sign in as that role); real staff use email and password.
export function SignIn() {
  const { signIn, account, ready } = useAuth(); const router = useRouter();
  const [email, setEmail] = useState(""); const [pw, setPw] = useState(""); const [busy, setBusy] = useState<string | null>(null); const [err, setErr] = useState("");
  useEffect(() => { if (ready && account) router.replace("/"); }, [ready, account, router]);
  const go = async (key: string, e: string, p: string) => { setBusy(key); setErr(""); const m = await signIn(e, p); setBusy(null); if (m) setErr(m); else router.replace("/"); };
  if (!LIVE) return <Shell><p className="text-sm text-muted">This is the demo version: no sign-in needed. <a className="font-medium text-info hover:underline" href="./..">Open the demo →</a></p></Shell>;
  return (
    <Shell>
      {QA_LOGINS.length > 0 && <>
        <p className="mb-3 text-sm text-muted">Tap a role to sign in as it.</p>
        <div className="grid gap-2 sm:grid-cols-2">{QA_LOGINS.map((l) => { const r = ROLES[l.role];
          return <button key={l.role} disabled={!!busy} onClick={() => go(l.role, l.email, l.password)}
            className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-left transition hover:border-info hover:shadow-md disabled:opacity-60">
            <span><span className="block font-semibold">{r?.label ?? l.role}</span><span className="block text-xs text-muted">{roleBlurb[l.role] ?? ""}</span></span>
            {busy === l.role ? <Loader2 size={16} className="animate-spin text-info" /> : <LogIn size={16} className="text-muted" />}</button>; })}</div>
        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-warn"><ShieldCheck size={13} />Test sign-ins: turn these off before real school data is entered.</p>
        <div className="my-5 flex items-center gap-3 text-xs text-muted"><span className="h-px flex-1 bg-line" />or with a staff login<span className="h-px flex-1 bg-line" /></div>
      </>}
      <form onSubmit={(e) => { e.preventDefault(); go("form", email.trim(), pw); }} className="space-y-3">
        <label className="block text-sm"><span className="mb-1 block font-medium">Email</span><input type="email" autoComplete="username" required className="h-10 w-full rounded-lg border border-line bg-surface px-3" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label className="block text-sm"><span className="mb-1 block font-medium">Password</span><input type="password" autoComplete="current-password" required className="h-10 w-full rounded-lg border border-line bg-surface px-3" value={pw} onChange={(e) => setPw(e.target.value)} /></label>
        <button type="submit" disabled={!!busy} className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-info font-medium text-white disabled:opacity-60">{busy === "form" ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}Sign in</button>
      </form>
      {err && <p role="alert" className="mt-3 text-sm text-danger">{err}</p>}
    </Shell>
  );
}

const roleBlurb: Record<string, string> = {
  owner: "Everything, approves invoices", admin: "Students, parents, admissions", bursar: "Fees, payments, receipts",
  teacher: "Own class: attendance, grades", storekeeper: "Inventory and kitchen", auditor: "Read-only finance",
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen place-items-center bg-surface-2 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-line bg-surface p-6 shadow-xl sm:p-8">
        <div className="mb-6 flex items-center gap-3"><SchoolLogo size={56} /><div><h1 className="text-lg font-semibold">Bartlett Montessori School</h1><p className="text-sm text-muted">Sign in to the school management system</p></div></div>
        {children}
      </div>
    </div>
  );
}
