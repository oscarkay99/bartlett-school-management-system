"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ChevronsUpDown, Search, X, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, EmptyState } from "./primitives";

// ---------- Toasts ----------
type Toast = { id: number; kind: "ok" | "err"; text: string };
const ToastCtx = createContext<(t: string, k?: "ok" | "err") => void>(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [list, setList] = useState<Toast[]>([]);
  const push = useCallback((text: string, kind: "ok" | "err" = "ok") => {
    const id = Date.now() + Math.random(); setList((l) => [...l, { id, kind, text }]); setTimeout(() => setList((l) => l.filter((x) => x.id !== id)), 4000);
  }, []);
  return (
    <ToastCtx.Provider value={push}>{children}
      <div className="fixed bottom-4 right-4 z-[100] flex w-[min(92vw,360px)] flex-col gap-2" aria-live="polite">
        {list.map((t) => <div key={t.id} className="anim-pop flex items-start gap-2 rounded-lg border border-line bg-surface p-3 shadow-lg">{t.kind === "ok" ? <CheckCircle2 className="text-ok shrink-0" size={18} /> : <XCircle className="text-danger shrink-0" size={18} />}<span className="text-sm">{t.text}</span></div>)}
      </div>
    </ToastCtx.Provider>
  );
}

// ---------- Modal & Drawer ----------
function useEsc(open: boolean, onClose: () => void) {
  useEffect(() => { if (!open) return; const h = (e: KeyboardEvent) => e.key === "Escape" && onClose(); document.addEventListener("keydown", h); return () => document.removeEventListener("keydown", h); }, [open, onClose]);
}
export function Modal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEsc(open, onClose); if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/50 p-4" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.stopPropagation()} className={cn("anim-pop flex max-h-[90vh] w-full flex-col rounded-xl border border-line bg-surface shadow-2xl", wide ? "max-w-2xl" : "max-w-md")}>
        <div className="flex items-center justify-between border-b border-line px-5 py-3"><h2 className="font-semibold">{title}</h2><button onClick={onClose} aria-label="Close" className="rounded p-1 hover:bg-surface-2"><X size={18} /></button></div>
        <div className="overflow-y-auto p-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}
export function Drawer({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode }) {
  useEsc(open, onClose); if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] bg-black/40" onMouseDown={onClose}>
      <aside role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.stopPropagation()} className="anim-slide absolute right-0 top-0 flex h-full w-full max-w-lg flex-col border-l border-line bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-3"><h2 className="font-semibold">{title}</h2><button onClick={onClose} aria-label="Close" className="rounded p-1 hover:bg-surface-2"><X size={18} /></button></div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
      </aside>
    </div>
  );
}
export function ConfirmDialog({ open, onClose, onConfirm, title, body, confirmLabel = "Confirm", danger, needReason }: { open: boolean; onClose: () => void; onConfirm: (reason?: string) => void; title: string; body: string; confirmLabel?: string; danger?: boolean; needReason?: boolean }) {
  const [reason, setReason] = useState("");
  return (
    <Modal open={open} onClose={onClose} title={title} footer={<><Button onClick={onClose}>Cancel</Button><Button variant={danger ? "danger" : "primary"} disabled={needReason && reason.trim().length < 5} onClick={() => { onConfirm(reason); setReason(""); }}>{confirmLabel}</Button></>}>
      <p className="text-muted">{body}</p>
      {needReason && <label className="mt-3 block text-sm font-medium">Justification (required, logged to audit trail)<textarea value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1 h-20 w-full rounded-lg border border-line bg-surface p-2" /></label>}
    </Modal>
  );
}

// ---------- Tabs ----------
export function Tabs({ tabs, initial }: { tabs: { id: string; label: string; content: ReactNode; badge?: string }[]; initial?: string }) {
  const [active, setActive] = useState(initial ?? tabs[0].id);
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const onKey = (e: React.KeyboardEvent) => {
    const i = tabs.findIndex((t) => t.id === active); const n = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : null; if (n === null) return;
    const t = tabs[(n + tabs.length) % tabs.length]; setActive(t.id); refs.current[t.id]?.focus();
  };
  return (
    <div>
      <div role="tablist" onKeyDown={onKey} className="mb-4 flex gap-1 overflow-x-auto border-b border-line">
        {tabs.map((t) => (
          <button key={t.id} ref={(el) => { refs.current[t.id] = el; }} role="tab" aria-selected={active === t.id} tabIndex={active === t.id ? 0 : -1} onClick={() => setActive(t.id)}
            className={cn("-mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition", active === t.id ? "border-info text-info" : "border-transparent text-muted hover:text-fg")}>
            {t.label}{t.badge && <span className="rounded-full bg-surface-2 px-1.5 text-[11px]">{t.badge}</span>}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="anim-pop" key={active}>{tabs.find((t) => t.id === active)?.content}</div>
    </div>
  );
}

// ---------- DataTable ----------
export interface Column<T> { key: string; header: string; render: (r: T) => ReactNode; sort?: (r: T) => string | number; align?: "right"; className?: string; hideOnMobile?: boolean }
export function DataTable<T>({ rows, columns, searchText, filters, pageSize = 10, onRowClick, selectable, selected, onSelect, empty, toolbar, rowId }: {
  rows: T[]; columns: Column<T>[]; searchText?: (r: T) => string; filters?: ReactNode; pageSize?: number; onRowClick?: (r: T) => void;
  selectable?: boolean; selected?: Set<string>; onSelect?: (s: Set<string>) => void; empty?: ReactNode; toolbar?: ReactNode; rowId?: (r: T) => string;
}) {
  const [q, setQ] = useState(""); const [sort, setSort] = useState<{ k: string; d: 1 | -1 } | null>(null); const [page, setPage] = useState(0); const [size, setSize] = useState(pageSize);
  const data = useMemo(() => {
    let r = rows; if (q && searchText) { const n = q.toLowerCase(); r = r.filter((x) => searchText(x).toLowerCase().includes(n)); }
    if (sort) { const c = columns.find((c) => c.key === sort.k); if (c?.sort) r = [...r].sort((a, b) => { const x = c.sort!(a), y = c.sort!(b); return (x < y ? -1 : x > y ? 1 : 0) * sort.d; }); }
    return r;
  }, [rows, q, sort, columns, searchText]);
  const pages = Math.max(1, Math.ceil(data.length / size)); const cur = Math.min(page, pages - 1); const view = data.slice(cur * size, cur * size + size);
  const allOnPage = selectable && rowId && view.length > 0 && view.every((r) => selected?.has(rowId(r)));
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
        {searchText && <div className="relative min-w-[180px] flex-1 sm:max-w-xs"><Search size={15} className="absolute left-2.5 top-2.5 text-muted" /><input value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} placeholder="Search…" aria-label="Search table" className="h-9 w-full rounded-lg border border-line bg-surface pl-8 pr-3 text-sm" /></div>}
        {filters}<div className="ml-auto flex gap-2">{toolbar}</div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-2/60 text-xs uppercase tracking-wide text-muted">
            <tr>
              {selectable && rowId && <th className="w-10 px-3 py-2.5"><input type="checkbox" aria-label="Select page" checked={!!allOnPage} onChange={(e) => { const s = new Set(selected); view.forEach((r) => e.target.checked ? s.add(rowId(r)) : s.delete(rowId(r))); onSelect?.(s); }} /></th>}
              {columns.map((c) => (
                <th key={c.key} className={cn("px-3 py-2.5 font-medium", c.align === "right" && "text-right", c.hideOnMobile && "hidden md:table-cell")}>
                  {c.sort ? <button className="inline-flex items-center gap-1 uppercase hover:text-fg" onClick={() => setSort((s) => (s?.k === c.key ? { k: c.key, d: (-s.d as 1 | -1) } : { k: c.key, d: 1 }))}>{c.header}<ChevronsUpDown size={12} /></button> : c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {view.map((r, i) => (
              <tr key={rowId ? rowId(r) : i} onClick={onRowClick ? () => onRowClick(r) : undefined} className={cn("transition hover:bg-surface-2/60", onRowClick && "cursor-pointer")}>
                {selectable && rowId && <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}><input type="checkbox" aria-label="Select row" checked={selected?.has(rowId(r)) ?? false} onChange={(e) => { const s = new Set(selected); if (e.target.checked) s.add(rowId(r)); else s.delete(rowId(r)); onSelect?.(s); }} /></td>}
                {columns.map((c) => <td key={c.key} className={cn("px-3 py-2.5", c.align === "right" && "num text-right", c.hideOnMobile && "hidden md:table-cell", c.className)}>{c.render(r)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
        {view.length === 0 && (empty ?? <EmptyState icon={Search} title="No matching records" body="Try adjusting your search or filters." />)}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-3 py-2 text-xs text-muted">
        <div className="flex items-center gap-3">
          <span>{data.length === 0 ? "0 results" : `${cur * size + 1}–${Math.min(data.length, cur * size + size)} of ${data.length}`}</span>
          <label className="flex items-center gap-1.5">Rows per page
            <select aria-label="Rows per page" value={size} onChange={(e) => { setSize(Number(e.target.value)); setPage(0); }} className="h-7 rounded-md border border-line bg-surface px-1.5 text-xs text-fg">{[...new Set([pageSize, 10, 25, 50, 100])].sort((a, b) => a - b).map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
        </div>
        <nav aria-label="Pagination" className="flex items-center gap-0.5">
          <Button size="sm" variant="ghost" disabled={cur === 0} onClick={() => setPage(0)} aria-label="First page"><ChevronsLeft size={14} /></Button>
          <Button size="sm" variant="ghost" disabled={cur === 0} onClick={() => setPage(cur - 1)} aria-label="Previous page"><ChevronLeft size={14} /></Button>
          {pageWindow(cur, pages).map((n, i) => n === "…" ? <span key={`e${i}`} className="px-1">…</span> : (
            <button key={n} onClick={() => setPage(n - 1)} aria-label={`Page ${n}`} aria-current={n - 1 === cur ? "page" : undefined} className={cn("h-7 min-w-7 rounded-md px-1.5 text-xs font-medium transition", n - 1 === cur ? "bg-info text-white" : "hover:bg-surface-2 text-fg")}>{n}</button>))}
          <Button size="sm" variant="ghost" disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)} aria-label="Next page"><ChevronRight size={14} /></Button>
          <Button size="sm" variant="ghost" disabled={cur >= pages - 1} onClick={() => setPage(pages - 1)} aria-label="Last page"><ChevronsRight size={14} /></Button>
        </nav>
      </div>
    </div>
  );
}

// Compact page list: 1 … 4 5 [6] 7 8 … 15
function pageWindow(cur: number, total: number): (number | "…")[] {
  const c = cur + 1; if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (c <= 4) return [1, 2, 3, 4, 5, "…", total];
  if (c >= total - 3) return [1, "…", total - 4, total - 3, total - 2, total - 1, total];
  return [1, "…", c - 1, c, c + 1, "…", total];
}

export function Select({ value, onChange, options, label }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; label: string }) {
  return <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className="h-9 rounded-lg border border-line bg-surface px-2.5 text-sm">{options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>;
}
