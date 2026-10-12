"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Bell, BookOpen, Boxes, CalendarCheck, ChevronLeft, GraduationCap, HeartHandshake, LayoutDashboard, Landmark, Menu, MessageSquare, Moon, Plus, Receipt, Search, Settings, ShieldCheck, Sun, Monitor, UserPlus, Users, UsersRound, FileBarChart, Briefcase, X, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/primitives";
import { SchoolLogo } from "@/components/SchoolLogo";
import { ROLES, DEFAULT_ROLE, normalizeRole, allowed as allowedOp, type Op, type Resource } from "@/lib/permissions";
export { ROLES };

export interface SearchItem { type: string; label: string; sub: string; href: string }
interface Nav { href: string; label: string; icon: LucideIcon; key: string }
const NAV: Nav[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, key: "dashboard" },
  { href: "/students", label: "Students", icon: GraduationCap, key: "students" },
  { href: "/parents", label: "Parents", icon: UsersRound, key: "parents" },
  { href: "/admissions", label: "Admissions", icon: UserPlus, key: "admissions" },
  { href: "/fees", label: "School Fees", icon: Receipt, key: "fees" },
  { href: "/finance", label: "Finance", icon: Landmark, key: "finance" },
  { href: "/inventory", label: "Inventory", icon: Boxes, key: "inventory" },
  { href: "/academics", label: "Academics", icon: BookOpen, key: "academics" },
  { href: "/staff", label: "Teachers & Staff", icon: Briefcase, key: "staff" },
  { href: "/attendance", label: "Attendance", icon: CalendarCheck, key: "attendance" },
  { href: "/communications", label: "Communications", icon: MessageSquare, key: "comms" },
  { href: "/reports", label: "Reports", icon: FileBarChart, key: "reports" },
  { href: "/settings", label: "Settings", icon: Settings, key: "settings" },
];
const RoleCtx = createContext<{ role: string; can: (key: string) => boolean; allow: (r: Resource, o: Op) => boolean }>({ role: DEFAULT_ROLE, can: () => true, allow: () => true });
export const useRole = () => useContext(RoleCtx);

export function AppShell({ children, school, years, terms }: { children: ReactNode; school: { name: string; short: string }; years: string[]; terms: string[] }) {
  const path = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [role, setRole] = useState(DEFAULT_ROLE);
  // Read persisted prefs after mount so server and client markup match.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => { try { setCollapsed(localStorage.getItem("sb") === "1"); setRole(normalizeRole(localStorage.getItem("role"))); } catch {} }, []);
  useEffect(() => setMobile(false), [path]);
  /* eslint-enable react-hooks/set-state-in-effect */
  const allowed = ROLES[role].nav;
  const ctx = useMemo(() => ({ role, can: (k: string) => allowed.includes(k), allow: (r: Resource, o: Op) => allowedOp(role, r, o) }), [role, allowed]);
  const standalone = path.startsWith("/print") || path === "/login";
  if (standalone) return <>{children}</>;

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
          <select aria-label="Academic year" className="h-9 rounded-lg border border-white/15 bg-white/10 px-2 text-xs text-white" defaultValue={years[0]}>{years.map((y) => <option key={y} className="text-black">{y}</option>)}</select>
          <select aria-label="Term" className="h-9 rounded-lg border border-white/15 bg-white/10 px-2 text-xs text-white" defaultValue={terms[0]}>{terms.map((y) => <option key={y} className="text-black">{y}</option>)}</select>
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
      <aside className={cn("fixed inset-y-0 left-0 z-40 hidden transition-[width] lg:block", collapsed ? "w-[68px]" : "w-[250px]")}>{sidebar}</aside>
      {mobile && <div className="fixed inset-0 z-50 lg:hidden" onClick={() => setMobile(false)}><div className="absolute inset-0 bg-black/50" /><aside className="anim-slide relative h-full w-[260px]" style={{ animationName: "none" }} onClick={(e) => e.stopPropagation()}>{sidebar}<button className="absolute right-2 top-4 text-white" onClick={() => setMobile(false)} aria-label="Close menu"><X /></button></aside></div>}
      <div className={cn("transition-[padding]", collapsed ? "lg:pl-[68px]" : "lg:pl-[250px]")}>
        <Topbar school={school} years={years} terms={terms} onMenu={() => setMobile(true)} role={role} setRole={(r) => { setRole(r); try { localStorage.setItem("role", r); } catch {} }} />
        <main id="main" className="mx-auto max-w-[1500px] p-4 sm:p-6">{children}</main>
      </div>
    </RoleCtx.Provider>
  );
}

function Topbar({ school, years, terms, onMenu, role, setRole }: { school: { name: string }; years: string[]; terms: string[]; onMenu: () => void; role: string; setRole: (r: string) => void }) {
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
    <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-line bg-surface/90 px-3 backdrop-blur sm:px-5">
      <button className="grid size-10 shrink-0 place-items-center rounded-lg hover:bg-surface-2 lg:hidden" onClick={onMenu} aria-label="Open menu"><Menu size={20} /></button>
      <SchoolLogo size={34} className="shrink-0 lg:hidden" />
      <div className="hidden min-w-0 xl:block"><div className="truncate text-sm font-semibold">{school.name}</div></div>
      <div className="ml-1 hidden shrink-0 gap-2 md:flex">
        <select aria-label="Academic year" className="h-8 rounded-lg border border-line bg-surface px-2 text-xs" defaultValue={years[0]}>{years.map((y) => <option key={y}>{y}</option>)}</select>
        <select aria-label="Term" className="h-8 rounded-lg border border-line bg-surface px-2 text-xs" defaultValue={terms[0]}>{terms.map((y) => <option key={y}>{y}</option>)}</select>
      </div>
      <button onClick={() => setOpen("search")} aria-label="Open search" className="ml-auto grid size-9 shrink-0 place-items-center rounded-lg text-muted hover:bg-surface-2 sm:mx-auto sm:ml-auto sm:flex sm:min-w-0 sm:shrink sm:h-9 sm:w-full sm:max-w-md sm:items-center sm:gap-2 sm:border sm:border-line sm:bg-surface-2/60 sm:px-3 sm:text-sm sm:hover:bg-surface-2">
        <Search size={17} className="sm:size-[15px]" /><span className="hidden min-w-0 flex-1 truncate text-left sm:block">Search students, parents, invoices…</span><kbd className="hidden rounded border border-line bg-surface px-1.5 text-[11px] md:block">⌘K</kbd>
      </button>
      <div className="relative">
        <button className="grid size-10 place-items-center rounded-lg hover:bg-surface-2" onClick={() => setOpen(open === "quick" ? null : "quick")} aria-label="Quick actions" aria-expanded={open === "quick"}><Plus size={19} /></button>
        {open === "quick" && <div className={pop}>{[["Register student", "/students/new"], ["Record payment", "/fees?pay=1"], ["Prepare fee reminders", "/fees?tab=reminders"], ["Mark attendance", "/attendance"], ["Issue inventory", "/inventory?issue=1"]].map(([l, h]) => <Link key={h} href={h} onClick={() => setOpen(null)} className="block rounded-lg px-3 py-2 hover:bg-surface-2">{l}</Link>)}</div>}
      </div>
      <div className="relative">
        <button className="relative grid size-10 place-items-center rounded-lg hover:bg-surface-2" onClick={() => setOpen(open === "notif" ? null : "notif")} aria-label="Notifications"><Bell size={19} /><span className="absolute right-2 top-2 size-2 rounded-full bg-danger" /></button>
        {open === "notif" && <div className={pop}><div className="px-3 py-2 text-xs font-semibold uppercase text-muted">Needs attention</div>{notifs.map(([l, h]) => <Link key={l} href={h} onClick={() => setOpen(null)} className="block rounded-lg px-3 py-2 hover:bg-surface-2">{l}</Link>)}</div>}
      </div>
      <button className="grid size-10 place-items-center rounded-lg hover:bg-surface-2" aria-label="Toggle theme" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>{mounted && theme === "dark" ? <Sun size={19} /> : mounted ? <Moon size={19} /> : <Monitor size={19} />}</button>
      <div className="relative">
        <button onClick={() => setOpen(open === "user" ? null : "user")} className="flex items-center gap-2 rounded-lg p-1 hover:bg-surface-2" aria-label="User menu"><Avatar name={ROLES[role].person} size={32} /></button>
        {open === "user" && <div className={pop}>
          <div className="px-3 py-2"><div className="font-medium">{ROLES[role].person}</div><div className="text-xs text-muted">{ROLES[role].label}</div></div>
          <div className="border-t border-line px-3 py-2 text-xs font-semibold uppercase text-muted">Preview as role</div>
          {Object.entries(ROLES).map(([k, r]) => <button key={k} onClick={() => { setRole(k); setOpen(null); }} className={cn("flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-left hover:bg-surface-2", k === role && "font-semibold text-info")}>{r.label}{k === role && <ShieldCheck size={14} />}</button>)}
        </div>}
      </div>
      {open === "search" && <CommandSearch onClose={() => setOpen(null)} />}
    </header>
  );
}

let searchCache: SearchItem[] | null = null;
function CommandSearch({ onClose }: { onClose: () => void }) {
  const [index, setIndex] = useState<SearchItem[]>(searchCache ?? []); const [loading, setLoading] = useState(!searchCache); const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (searchCache) return; let live = true;
    fetch(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/search-index.json`).then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then((d: SearchItem[]) => { searchCache = d; if (live) { setIndex(d); setLoading(false); } }).catch(() => { if (live) { setFailed(true); setLoading(false); } });
    return () => { live = false; };
  }, []);
  const [q, setQ] = useState(""); const [i, setI] = useState(0); const router = useRouter(); const ref = useRef<HTMLInputElement>(null);
  useEffect(() => ref.current?.focus(), []);
  const results = useMemo(() => { const n = q.trim().toLowerCase(); if (!n) return index.slice(0, 8); return index.filter((x) => (x.label + " " + x.sub).toLowerCase().includes(n)).slice(0, 12); }, [q, index]);
  const go = (r?: SearchItem) => { if (r) { router.push(r.href); onClose(); } };
  return (
    <div className="fixed inset-0 z-[90] grid place-items-start bg-black/50 p-4 pt-[12vh]" onMouseDown={onClose}>
      <div role="dialog" aria-label="Global search" onMouseDown={(e) => e.stopPropagation()} className="anim-pop mx-auto w-full max-w-xl overflow-hidden rounded-xl border border-line bg-surface shadow-2xl">
        <div className="flex items-center gap-2 border-b border-line px-4"><Search size={16} className="text-muted" />
          <input ref={ref} value={q} onChange={(e) => { setQ(e.target.value); setI(0); }} onKeyDown={(e) => { if (e.key === "ArrowDown") { e.preventDefault(); setI((x) => Math.min(x + 1, results.length - 1)); } if (e.key === "ArrowUp") { e.preventDefault(); setI((x) => Math.max(x - 1, 0)); } if (e.key === "Enter") go(results[i]); }}
            placeholder="Student, admission no., parent, phone, invoice, receipt, item…" className="h-12 flex-1 bg-transparent outline-none" aria-label="Search" /></div>
        <ul className="max-h-[50vh] overflow-y-auto p-1.5" role="listbox">
          {results.map((r, k) => <li key={r.href + r.label} role="option" aria-selected={k === i}><button onMouseEnter={() => setI(k)} onClick={() => go(r)} className={cn("flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left", k === i && "bg-surface-2")}><span className="w-16 shrink-0 text-[11px] uppercase text-muted">{r.type}</span><span className="min-w-0"><span className="block truncate font-medium">{r.label}</span><span className="block truncate text-xs text-muted">{r.sub}</span></span></button></li>)}
          {loading && <li className="p-6 text-center text-muted">Loading search…</li>}{failed && <li className="p-6 text-center text-danger">Search is unavailable right now.</li>}{!loading && !failed && results.length === 0 && <li className="p-6 text-center text-muted">No results for “{q}”</li>}
        </ul>
        <div className="flex gap-4 border-t border-line px-4 py-2 text-[11px] text-muted"><span>↑↓ navigate</span><span>↵ open</span><span>esc close</span></div>
      </div>
    </div>
  );
}
export const _unused = HeartHandshake; export const _u2 = Users;
