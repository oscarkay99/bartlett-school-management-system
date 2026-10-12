"use client";
import { useEffect, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, RotateCcw, SlidersHorizontal } from "lucide-react";
import { Button } from "./primitives";
import { cn } from "@/lib/utils";

export interface Widget { id: string; title: string; span?: 1 | 2; node: ReactNode }
export function WidgetBoard({ widgets, storageKey }: { widgets: Widget[]; storageKey: string }) {
  const [order, setOrder] = useState(widgets.map((w) => w.id)); const [hidden, setHidden] = useState<string[]>([]); const [edit, setEdit] = useState(false);
  // Restore the saved layout after mount (SSR renders the default order).
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { try { const s = JSON.parse(localStorage.getItem(storageKey) ?? "null"); if (s) { setOrder([...s.order.filter((i: string) => widgets.some((w) => w.id === i)), ...widgets.map((w) => w.id).filter((i) => !s.order.includes(i))]); setHidden(s.hidden); } } catch {} }, [storageKey, widgets]);
  const save = (o: string[], h: string[]) => { setOrder(o); setHidden(h); try { localStorage.setItem(storageKey, JSON.stringify({ order: o, hidden: h })); } catch {} };
  const move = (id: string, d: number) => { const i = order.indexOf(id), j = i + d; if (j < 0 || j >= order.length) return; const o = [...order]; [o[i], o[j]] = [o[j], o[i]]; save(o, hidden); };
  const toggle = (id: string) => save(order, hidden.includes(id) ? hidden.filter((x) => x !== id) : [...hidden, id]);
  const byId = Object.fromEntries(widgets.map((w) => [w.id, w]));
  return (
    <div>
      <div className="mb-3 flex justify-end gap-2">
        {edit && <Button size="sm" variant="ghost" onClick={() => save(widgets.map((w) => w.id), [])}><RotateCcw size={13} />Reset layout</Button>}
        <Button size="sm" variant={edit ? "primary" : "secondary"} onClick={() => setEdit(!edit)}><SlidersHorizontal size={13} />{edit ? "Done" : "Customize dashboard"}</Button>
      </div>
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {order.map((id) => { const w = byId[id]; if (!w) return null; const isHidden = hidden.includes(id); if (isHidden && !edit) return null;
          return (
            <div key={id} className={cn("relative min-w-0", w.span === 2 && "xl:col-span-2", isHidden && "opacity-40")}>
              {edit && <div className="absolute right-2 top-2 z-10 flex gap-0.5 rounded-lg border border-line bg-surface p-0.5 shadow">
                <button className="rounded p-1 hover:bg-surface-2" onClick={() => move(id, -1)} aria-label={`Move ${w.title} earlier`}><ArrowUp size={14} /></button>
                <button className="rounded p-1 hover:bg-surface-2" onClick={() => move(id, 1)} aria-label={`Move ${w.title} later`}><ArrowDown size={14} /></button>
                <button className="rounded p-1 hover:bg-surface-2" onClick={() => toggle(id)} aria-label={`${isHidden ? "Show" : "Hide"} ${w.title}`}>{isHidden ? <EyeOff size={14} /> : <Eye size={14} />}</button></div>}
              {w.node}
            </div>);
        })}
      </div>
    </div>
  );
}
