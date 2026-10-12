import { cn, initials } from "@/lib/utils";
import Link from "next/link";
import type { ReactNode, ButtonHTMLAttributes } from "react";
import { TrendingDown, TrendingUp, Minus, Info, type LucideIcon } from "lucide-react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "success";
const variants: Record<Variant, string> = {
  primary: "bg-info text-white hover:brightness-110",
  secondary: "bg-surface border border-line hover:bg-surface-2",
  ghost: "hover:bg-surface-2",
  danger: "bg-danger text-white hover:brightness-110",
  success: "bg-ok text-white hover:brightness-110",
};
export function buttonClass(variant: Variant = "secondary", size: "sm" | "md" = "md") {
  return cn("inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition active:scale-[.98] disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap", size === "sm" ? "h-8 px-2.5 text-xs" : "h-9 px-3.5 text-sm", variants[variant]);
}
export function Button({ variant = "secondary", size = "md", className, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md" }) {
  return <button {...p} className={cn(buttonClass(variant, size), className)} />;
}
export function LinkButton({ href, variant = "secondary", size = "md", children, className }: { href: string; variant?: Variant; size?: "sm" | "md"; children: ReactNode; className?: string }) {
  return <Link href={href} className={cn(buttonClass(variant, size), className)}>{children}</Link>;
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cn("rounded-xl border border-line bg-surface shadow-[0_1px_2px_rgba(15,23,42,.04)]", className)}>{children}</section>;
}
export function CardHeader({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2 px-4 pt-4 pb-2">
      <div><h3 className="font-semibold text-[15px]">{title}</h3>{sub && <p className="text-xs text-muted mt-0.5">{sub}</p>}</div>{action}
    </div>
  );
}

type Tone = "ok" | "warn" | "danger" | "info" | "neutral";
const tones: Record<Tone, string> = {
  ok: "bg-ok/12 text-ok", warn: "bg-warn/15 text-warn", danger: "bg-danger/12 text-danger", info: "bg-info/12 text-info", neutral: "bg-surface-2 text-muted",
};
export function Badge({ tone = "neutral", children, dot }: { tone?: Tone; children: ReactNode; dot?: boolean }) {
  return <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", tones[tone])}>{dot && <span className="size-1.5 rounded-full bg-current" />}{children}</span>;
}
export const statusTone = (s: string): Tone =>
  ({ "Paid in Full": "ok", Paid: "ok", Confirmed: "ok", Delivered: "ok", Approved: "ok", Active: "ok", Enrolled: "ok", Sent: "info", "Partially Paid": "warn", Pending: "warn", "Pending Approval": "warn", Queued: "warn", "Awaiting Approval": "warn", Outstanding: "warn", Overdue: "danger", Failed: "danger", Reversed: "danger", Rejected: "danger", Withdrawn: "neutral", "Credit Balance": "info", "On leave": "warn" } as Record<string, Tone>)[s] ?? "neutral";
export const StatusBadge = ({ status }: { status: string }) => <Badge tone={statusTone(status)} dot>{status}</Badge>;

export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const hue = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return <span className="inline-grid place-items-center rounded-full font-semibold text-white shrink-0" style={{ width: size, height: size, fontSize: size * 0.36, background: `hsl(${hue} 45% 42%)` }} aria-hidden>{initials(name)}</span>;
}

export function PageHeader({ title, sub, actions, crumbs }: { title: string; sub?: string; actions?: ReactNode; crumbs?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>{crumbs}<h1 className="text-2xl font-semibold tracking-tight">{title}</h1>{sub && <p className="text-muted mt-0.5">{sub}</p>}</div>
      <div className="flex flex-wrap gap-2">{actions}</div>
    </div>
  );
}

export function Kpi({ label, value, icon: Icon, hint, trend, href, tone = "neutral" }: {
  label: string; value: string; icon: LucideIcon; hint: string; trend?: { dir: "up" | "down" | "flat"; text: string; good?: boolean }; href?: string; tone?: Tone;
}) {
  const body = (
    <div className="group h-full rounded-xl border border-line bg-surface p-3 transition hover:shadow-md hover:-translate-y-px sm:p-4">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[11px] font-medium leading-tight text-muted sm:text-xs">{label}
          <span title={hint} className="hidden cursor-help text-muted/70 sm:inline" aria-label={`Definition: ${hint}`}><Info size={12} /></span></span>
        <span className={cn("grid size-7 place-items-center rounded-lg sm:size-8", tones[tone])}><Icon size={16} /></span>
      </div>
      <div className="num mt-2 text-[20px] font-semibold leading-none tracking-tight sm:text-[26px]">{value}</div>
      <div className="mt-2 h-4 text-xs">
        {trend ? <span className={cn("inline-flex items-center gap-1 font-medium", trend.good === false ? "text-danger" : trend.good ? "text-ok" : "text-muted")}>
          {trend.dir === "up" ? <TrendingUp size={12} /> : trend.dir === "down" ? <TrendingDown size={12} /> : <Minus size={12} />}{trend.text}</span> : <span className="text-muted/70">No comparison yet</span>}
      </div>
    </div>
  );
  return href ? <Link href={href} className="block h-full">{body}</Link> : body;
}

export function AlertBanner({ tone, icon: Icon, title, children, actions }: { tone: "danger" | "warn" | "info" | "ok"; icon: LucideIcon; title: string; children?: ReactNode; actions?: ReactNode }) {
  const c = { danger: "border-danger/30 bg-danger/8", warn: "border-warn/30 bg-warn/10", info: "border-info/30 bg-info/8", ok: "border-ok/30 bg-ok/8" }[tone];
  const i = { danger: "text-danger", warn: "text-warn", info: "text-info", ok: "text-ok" }[tone];
  return (
    <div role="alert" className={cn("flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3", c)}>
      <Icon className={cn("shrink-0", i)} size={20} />
      <div className="min-w-[220px] flex-1"><div className="font-semibold">{title}</div>{children && <div className="text-[13px] text-fg/80">{children}</div>}</div>
      <div className="flex flex-wrap gap-2">{actions}</div>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, body, action }: { icon: LucideIcon; title: string; body?: string; action?: ReactNode }) {
  return <div className="grid place-items-center gap-2 px-6 py-12 text-center"><span className="grid size-12 place-items-center rounded-full bg-surface-2 text-muted"><Icon size={22} /></span><div className="font-medium">{title}</div>{body && <p className="max-w-sm text-muted">{body}</p>}{action}</div>;
}
export const Skeleton = ({ className }: { className?: string }) => <div className={cn("animate-pulse rounded-md bg-surface-2", className)} />;

export function Progress({ value, tone = "info" }: { value: number; tone?: Tone }) {
  const bar = { ok: "bg-ok", warn: "bg-warn", danger: "bg-danger", info: "bg-info", neutral: "bg-muted" }[tone];
  return <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}><div className={cn("h-full rounded-full", bar)} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} /></div>;
}

export function Field({ label, children, hint, error }: { label: string; children: ReactNode; hint?: string; error?: string }) {
  return <label className="block text-sm"><span className="mb-1 block font-medium">{label}</span>{children}{hint && !error && <span className="mt-1 block text-xs text-muted">{hint}</span>}{error && <span className="mt-1 block text-xs text-danger">{error}</span>}</label>;
}
export const inputClass = "h-9 w-full rounded-lg border border-line bg-surface px-3 text-sm placeholder:text-muted/70 focus:border-info focus:outline-none focus:ring-2 focus:ring-info/30";
