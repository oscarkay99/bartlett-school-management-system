"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Bell, BookOpen, BookOpenCheck, LogOut, FileText, Utensils, Boxes, CalendarCheck, ChevronLeft, GraduationCap, HeartHandshake, LayoutDashboard, Landmark, Menu, MessageSquare, Moon, Plus, Receipt, Search, Settings, ShieldCheck, Sun, Monitor, UserPlus, Users, UsersRound, FileBarChart, Briefcase, X, Lock, Shapes, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/primitives";
import { SchoolLogo } from "@/components/SchoolLogo";
import { PeriodSelect, useCalendar } from "./CalendarContext";
import { createPortal } from "react-dom";
import { termOfDate } from "@/lib/calendar";
import { useAuth } from "@/lib/live/auth";
import { LIVE } from "@/lib/live/config";
import { buildSearchIndex } from "@/lib/search-index";

import { ROLES, DEFAULT_ROLE, normalizeRole, allowed as allowedOp, canVisit, type MoneyAccess, type Op, type Resource } from "@/lib/permissions";
export { ROLES };

/** `year`/`term` (invoices) or `date` (receipts) tie a result to a term; those only show for the term selected in the top bar. */
export interface SearchItem { type: string; label: string; sub: string; href: string; year?: string; term?: string; date?: string }
interface Nav { href: string; label: string; icon: LucideIcon; key: string }
const NAV: Nav[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, key: "dashboard" },
  { href: "/students", label: "Students", icon: GraduationCap, key: "students" },
  { href: "/parents", label: "Parents", icon: UsersRound, key: "parents" },
  { href: "/admissions", label: "Admissions", icon: UserPlus, key: "admissions" },
  { href: "/fees", label: "School Fees", icon: Receipt, key: "fees" },
  { href: "/feeding", label: "Feeding", icon: Utensils, key: "feeding" },
  { href: "/extracurricular", label: "Extracurricular", icon: Shapes, key: "extracurricular" },
  { href: "/extra-classes", label: "Extra Classes", icon: BookOpenCheck, key: "extra-classes" },
  { href: "/invoices", label: "Invoices", icon: FileText, key: "invoices" },
  { href: "/finance", label: "Finance", icon: Landmark, key: "finance" },
  { href: "/inventory", label: "Inventory", icon: Boxes, key: "inventory" },
  { href: "/academics", label: "Academics", icon: BookOpen, key: "academics" },
  { href: "/staff", label: "Teachers & Staff", icon: Briefcase, key: "staff" },
  { href: "/attendance", label: "Attendance", icon: CalendarCheck, key: "attendance" },
  { href: "/communications", label: "Communications", icon: MessageSquare, key: "comms" },
  { href: "/reports", label: "Reports", icon: FileBarChart, key: "reports" },
  { href: "/settings", label: "Settings", icon: Settings, key: "settings" },
];
interface RoleState { role: string; ready: boolean; money: MoneyAccess; can: (key: string) => boolean; allow: (r: Resource, o: Op) => boolean }
const RoleCtx = createContext<RoleState>({ role: DEFAULT_ROLE, ready: false, money: "full", can: () => true, allow: () => true });
export const useRole = () => useContext(RoleCtx);

/** Renders children only for roles with at least the given money access. Hidden until the saved role is known. */
export function MoneyGate({ level = "full", children, fallback = null }: { level?: "full" | "balances"; children: ReactNode; fallback?: ReactNode }) {
  const { money, ready } = useRole();
  if (!ready) return null;
  const ok = level === "balances" ? money !== "none" : money === "full";
  return <>{ok ? children : fallback}</>;
}

export function AppShell({ children, school }: { children: ReactNode; school: { name: string; short: string } }) {
  const path = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [demoRole, setRole] = useState(DEFAULT_ROLE); const [demoReady, setReady] = useState(false);
  // Live site: the role is the signed-in staff member's role in the database. Demo: the "preview as role" choice.
  const auth = useAuth(); const router = useRouter();
  const role = LIVE ? normalizeRole(auth.account?.role ?? null) : demoRole;
  const ready = LIVE ? auth.ready && !!auth.account : demoReady;
  // Read persisted prefs after mount so server and client markup match.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => { try { setCollapsed(localStorage.getItem("sb") === "1"); setRole(normalizeRole(localStorage.getItem("role"))); } catch {} setReady(true); }, []);
  useEffect(() => setMobile(false), [path]);
  /* eslint-enable react-hooks/set-state-in-effect */
  const allowed = ROLES[role].nav;
  const ctx = useMemo(() => ({ role, ready, money: ROLES[role].money, can: (k: string) => allowed.includes(k), allow: (r: Resource, o: Op) => allowedOp(role, r, o) }), [role, ready, allowed]);
  const blocked = ready && !canVisit(role, path);
  const standalone = path.startsWith("/print") || path.startsWith("/login");
  const signedOut = LIVE && auth.ready && !auth.account && !standalone;
  useEffect(() => { if (signedOut) router.replace("/login"); }, [signedOut, router]);
  if (standalone) return <>{children}</>;
  if (LIVE && !ready) return <div className="grid min-h-screen place-items-center text-sm text-muted">{signedOut ? "Redirecting to sign-in…" : "Loading…"}</div>;

  const sidebar = (
    <div className="flex h-full flex-col bg-navy text-navy-fg">
      <div className={cn("flex items-center justify-center border-b border-white/10 transition-[padding]", collapsed ? "px-2 py-4" : "px-4 py-6")}>
        <SchoolLogo size={collapsed ? 40 : 76} />
              </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2" aria-label="Primary">
        {NAV.filter((n) => allowed.includes(n.key)).map((n) => {
          const active = n.href === "/" ? path === "/" : path.startsWith(n.href);
          return (
            <Link key={n.href} href={n.href} title={collapsed ? n.label : undefined} aria-current={active ? "page" : undefined}
              className={cn("flex items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] font-medium transition", active ? "bg-white/12 text-white shadow-inner" : "hover:bg-white/8 hover:text-white")}>
              <n.icon size={18} className={cn("shrink-0", active && "text-brand")} />{!collapsed && n.label}
            </Link>
          );
        })}
      </nav>
      <div className="space-y-2 border-t border-white/10 p-3 md:hidden">
        <div className="text-[11px] font-semibold uppercase tracking-wide opacity-60">Academic period</div>
        <div className="grid grid-cols-2 gap-2">
          <PeriodSelect dark />
        </div>
      </div>
      <button onClick={() => { setCollapsed(!collapsed); try { localStorage.setItem("sb", collapsed ? "0" : "1"); } catch {} }} className="hidden lg:flex items-center gap-2 border-t border-white/10 px-4 py-3 text-xs hover:text-white" aria-label="Collapse sidebar">
        <ChevronLeft size={16} className={cn("transition", collapsed && "rotate-180")} />{!collapsed && "Collapse"}
      </button>
    </div>
  );

  return (
    <RoleCtx.Provider value={ctx}>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[200] focus:rounded focus:bg-surface focus:p-2">Skip to content</a>
      <aside className={cn("no-print fixed inset-y-0 left-0 z-40 hidden transition-[width] lg:block", collapsed ? "w-[68px]" : "w-[250px]")}>{sidebar}</aside>
      {mobile && <div className="no-print fixed inset-0 z-50 lg:hidden" onClick={() => setMobile(false)}><div className="absolute inset-0 bg-black/50" /><aside className="anim-slide relative h-full w-[260px]" style={{ animationName: "none" }} onClick={(e) => e.stopPropagation()}>{sidebar}<button className="absolute right-2 top-4 text-white" onClick={() => setMobile(false)} aria-label="Close menu"><X /></button></aside></div>}
      <div className={cn("transition-[padding]", collapsed ? "lg:pl-[68px]" : "lg:pl-[250px]")}>
        <Topbar school={school} onMenu={() => setMobile(true)} role={role} setRole={(r) => { setRole(r); try { localStorage.setItem("role", r); } catch {} }} />
        <main id="main" className="mx-auto max-w-[1500px] p-4 sm:p-6">
          {blocked ? <NoAccess label={ROLES[role].label} /> : children}</main>
      </div>
    </RoleCtx.Provider>
  );
}

function Topbar({ school, onMenu, role, setRole }: { school: { name: string }; onMenu: () => void; role: string; setRole: (r: string) => void }) {
  const auth = useAuth();
  const [open, setOpen] = useState<null | "search" | "notif" | "quick" | "user">(null);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen("search"); } if (e.key === "Escape") setOpen(null); };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, []);
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false); useEffect(() => setMounted(true), []); // eslint-disable-line react-hooks/set-state-in-effect
  const pop = "anim-pop absolute right-0 top-11 z-50 w-72 rounded-xl border border-line bg-surface p-1.5 shadow-xl";
  const notifs = [["3 grade batches awaiting approval", "/academics"], ["2 gateway payments pending verification", "/fees?tab=reconcile"], ["4 items below reorder level", "/inventory"], ["6 messages failed to deliver", "/communications"]];
  return (
    <header className="no-print sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-line bg-surface/90 px-3 backdrop-blur sm:px-5">
      <button className="grid size-10 shrink-0 place-items-center rounded-lg hover:bg-surface-2 lg:hidden" onClick={onMenu} aria-label="Open menu"><Menu size={20} /></button>
      <SchoolLogo size={34} className="shrink-0 lg:hidden" />
      <div className="hidden min-w-0 xl:block"><div className="truncate text-sm font-semibold">{school.name}</div></div>
      <div className="ml-1 hidden shrink-0 gap-2 md:flex">
        <PeriodSelect />
      </div>
      <button onClick={() => setOpen("search")} aria-label="Open search" className="ml-auto grid size-9 shrink-0 place-items-center rounded-lg text-muted hover:bg-surface-2 sm:mx-auto sm:ml-auto sm:flex sm:min-w-0 sm:shrink sm:h-9 sm:w-full sm:max-w-md sm:items-center sm:gap-2 sm:border sm:border-line sm:bg-surface-2/60 sm:px-3 sm:text-sm sm:hover:bg-surface-2">
        <Search size={17} className="sm:size-[15px]" /><span className="hidden min-w-0 flex-1 truncate text-left sm:block">Search students, parents, invoices…</span><kbd className="hidden rounded border border-line bg-surface px-1.5 text-[11px] md:block">⌘K</kbd>
      </button>
      <div className="relative">
        <button className="grid size-10 place-items-center rounded-lg hover:bg-surface-2" onClick={() => setOpen(open === "quick" ? null : "quick")} aria-label="Quick actions" aria-expanded={open === "quick"}><Plus size={19} /></button>
        {open === "quick" && <div className={pop}>{[["Register student", "/students/new", "students"], ["Record school fees payment", "/fees?pay=1", "fees"], ["Record extracurricular payment", "/extracurricular?pay=1", "extracurricular"], ["Record extra classes payment", "/extra-classes?pay=1", "extra-classes"], ["Prepare fee reminders", "/fees?tab=reminders", "fees"], ["Mark attendance", "/attendance", "attendance"], ["Issue inventory", "/inventory?issue=1", "inventory"]].filter(([l, , k]) => ROLES[role].nav.includes(k) && (!l.startsWith("Record") || allowedOp(role, "payments", "create"))).map(([l, h]) => <Link key={h} href={h} onClick={() => setOpen(null)} className="block rounded-lg px-3 py-2 hover:bg-surface-2">{l}</Link>)}</div>}
      </div>
      <div className="relative">
        <button className="relative grid size-10 place-items-center rounded-lg hover:bg-surface-2" onClick={() => setOpen(open === "notif" ? null : "notif")} aria-label="Notifications"><Bell size={19} /><span className="absolute right-2 top-2 size-2 rounded-full bg-danger" /></button>
        {open === "notif" && <div className={pop}><div className="px-3 py-2 text-xs font-semibold uppercase text-muted">Needs attention</div>{notifs.filter(([, h]) => canVisit(role, h.split("?")[0]) && (!h.includes("reconcile") || ROLES[role].money === "full")).map(([l, h]) => <Link key={l} href={h} onClick={() => setOpen(null)} className="block rounded-lg px-3 py-2 hover:bg-surface-2">{l}</Link>)}</div>}
      </div>
      <button className="grid size-10 place-items-center rounded-lg hover:bg-surface-2" aria-label="Toggle theme" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>{mounted && theme === "dark" ? <Sun size={19} /> : mounted ? <Moon size={19} /> : <Monitor size={19} />}</button>
      <div className="relative">
        <button onClick={() => setOpen(open === "user" ? null : "user")} className="flex items-center gap-2 rounded-lg p-1 hover:bg-surface-2" aria-label="User menu"><Avatar name={LIVE ? (auth.account?.name ?? "") : ROLES[role].person} size={32} /></button>
        {open === "user" && <div className={pop}>
          {LIVE ? <><div className="px-3 py-2"><div className="font-medium">{auth.account?.name}</div><div className="text-xs text-muted">{ROLES[role].label} · {auth.account?.email}</div></div>
            <button onClick={() => { setOpen(null); auth.signOut(); }} className="flex w-full items-center gap-2 rounded-lg border-t border-line px-3 py-2 text-left hover:bg-surface-2"><LogOut size={14} />Sign out</button></> : <>
          <div className="px-3 py-2"><div className="font-medium">{ROLES[role].person}</div><div className="text-xs text-muted">{ROLES[role].label}</div></div>
          <div className="border-t border-line px-3 py-2 text-xs font-semibold uppercase text-muted">Preview as role</div>
          {Object.entries(ROLES).map(([k, r]) => <button key={k} onClick={() => { setRole(k); setOpen(null); }} className={cn("flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-left hover:bg-surface-2", k === role && "font-semibold text-info")}>{r.label}{k === role && <ShieldCheck size={14} />}</button>)}</>}
        </div>}
      </div>
      {open === "search" && <CommandSearch onClose={() => setOpen(null)} />}
    </header>
  );
}

function NoAccess({ label }: { label: string }) {
  return (
    <div className="mx-auto mt-16 max-w-md rounded-xl border border-line bg-surface p-8 text-center">
      <Lock className="mx-auto text-muted" size={32} />
      <h1 className="mt-3 text-lg font-semibold">You don&apos;t have access to this page</h1>
      <p className="mt-1 text-sm text-muted">The {label} role can&apos;t open this module. Ask the Owner if you need access.</p>
      <Link href="/" className="mt-4 inline-block text-sm text-info">Back to dashboard</Link>
    </div>
  );
}

let searchCache: SearchItem[] | null = null;
function CommandSearch({ onClose }: { onClose: () => void }) {
  const [index, setIndex] = useState<SearchItem[]>(LIVE ? [] : searchCache ?? []); const [loading, setLoading] = useState(LIVE || !searchCache); const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (LIVE) { setIndex(buildSearchIndex()); setLoading(false); return; }   // eslint-disable-line react-hooks/set-state-in-effect -- live: from the school's loaded data
    if (searchCache) return; let live = true;
    fetch(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/search-index.json`).then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then((d: SearchItem[]) => { searchCache = d; if (live) { setIndex(d); setLoading(false); } }).catch(() => { if (live) { setFailed(true); setLoading(false); } });
    return () => { live = false; };
  }, []);
  const { calendar, year, term } = useCalendar();
  // Term-bound results (invoices, receipts) only for the selected year and term; people and items always.
  const scoped = useMemo(() => index.filter((x) => {
    if (x.year && x.term) return x.year === year && x.term === term;
    if (x.date) { const t = termOfDate(calendar, x.date); return !!t && t.year === year && t.term === term; }
    return true;
  }), [index, calendar, year, term]);
  const [q, setQ] = useState(""); const [i, setI] = useState(0); const router = useRouter(); const ref = useRef<HTMLInputElement>(null);
  useEffect(() => ref.current?.focus(), []);
  const results = useMemo(() => { const n = q.trim().toLowerCase(); if (!n) return scoped.filter((x) => x.type === "Student").slice(0, 8);
    return scoped.filter((x) => (x.label + " " + x.sub).toLowerCase().includes(n)).slice(0, 12); }, [q, scoped]);
  const go = (r?: SearchItem) => { if (r) { router.push(r.href); onClose(); } };
  const icon: Record<string, typeof Search> = { Student: GraduationCap, Parent: UsersRound, Staff: Users, Invoice: FileText, Receipt, Item: Boxes };
  // Rendered on <body> so the backdrop covers the whole screen (inside the top bar it was clipped to the bar).
  return createPortal(
    <div className="fixed inset-0 z-[90] bg-black/50 p-4 pt-[12vh] backdrop-blur-[2px]" onMouseDown={onClose}>
      <div role="dialog" aria-label="Global search" onMouseDown={(e) => e.stopPropagation()} className="anim-pop mx-auto w-full max-w-xl overflow-hidden rounded-xl border border-line bg-surface shadow-2xl">
        <div className="flex items-center gap-3 border-b border-line px-4"><Search size={18} className="shrink-0 text-muted" />
          <input ref={ref} value={q} onChange={(e) => { setQ(e.target.value); setI(0); }} onKeyDown={(e) => { if (e.key === "ArrowDown") { e.preventDefault(); setI((x) => Math.min(x + 1, results.length - 1)); } if (e.key === "ArrowUp") { e.preventDefault(); setI((x) => Math.max(x - 1, 0)); } if (e.key === "Enter") go(results[i]); }}
            placeholder="Search students, parents, invoices, receipts…" className="search-input h-14 min-w-0 flex-1 bg-transparent text-[15px]" aria-label="Search" />
          <span className="shrink-0 rounded-md bg-surface-2 px-2 py-1 text-[11px] text-muted" title="Invoices and receipts are limited to the term selected in the top bar">{term} · {year}</span></div>
        <ul className="max-h-[55vh] overflow-y-auto p-2" role="listbox">
          {!q.trim() && !loading && !failed && results.length > 0 && <li className="px-3 pb-1 pt-1 text-[11px] font-medium uppercase tracking-wide text-muted">Students</li>}
          {results.map((r, k) => { const Icon = icon[r.type] ?? FileText; return <li key={r.href + r.label} role="option" aria-selected={k === i}>
            <button onMouseEnter={() => setI(k)} onClick={() => go(r)} className={cn("flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left", k === i && "bg-surface-2")}>
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-2 text-muted"><Icon size={15} /></span>
              <span className="min-w-0 flex-1"><span className="block truncate font-medium">{r.label}</span><span className="block truncate text-xs text-muted">{r.sub}</span></span>
              <span className="shrink-0 text-[11px] text-muted">{r.type}</span></button></li>; })}
          {loading && <li className="p-6 text-center text-muted">Loading search…</li>}{failed && <li className="p-6 text-center text-danger">Search is unavailable right now.</li>}{!loading && !failed && results.length === 0 && <li className="p-6 text-center text-muted">No results for “{q}” in {term} {year}</li>}
        </ul>
        <div className="flex gap-4 border-t border-line px-4 py-2 text-[11px] text-muted"><span>↑↓ navigate</span><span>↵ open</span><span>esc close</span></div>
      </div>
    </div>, document.body);
}
export const _unused = HeartHandshake; export const _u2 = Users;
