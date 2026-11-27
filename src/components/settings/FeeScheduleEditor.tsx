"use client";
import { LIVE } from "@/lib/live/config";
import { ACTIVITY_LEVELS } from "@/lib/accounts";
import * as Q from "@/lib/data/queries";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Copy, FilePlus2, Lock, Pencil, Plus, Trash2 } from "lucide-react";
import { AlertBanner, Badge, Button, Card, CardHeader, EmptyState } from "@/components/ui/primitives";
import { Modal, MoneyInput, useToast } from "@/components/ui/interactive";
import { PeriodSelect, useCalendar } from "@/components/shell/CalendarContext";
import { useFeeSchedule } from "@/components/shell/FeeScheduleContext";
import { useRole } from "@/components/shell/AppShell";
import { blankTerm, copyTerm, feedingRate, fromClassGrid, termBillLines, LEVELS, previousTermWithFees, sumItems, toClassGrid, validateClassGrid, type ClassGrid, type ClassRef, type TermFees } from "@/lib/fees";
import { money } from "@/lib/money";
import { cn } from "@/lib/utils";

// Inputs here set their own width (cn() does not resolve Tailwind conflicts, so never mix with inputClass's w-full).
const box = "h-9 rounded-lg border border-line bg-surface px-2.5 text-sm placeholder:text-muted/60 focus:border-info focus:outline-none focus:ring-2 focus:ring-info/30";

/** Calendar terms oldest → newest, for "Copy from last term". */
export function usePeriodOrder() {
  const { calendar } = useCalendar();
  return useMemo(() => calendar.flatMap((y) => y.terms.map((t) => ({ year: y.name, term: t.name, start: t.start }))).sort((a, b) => a.start.localeCompare(b.start)), [calendar]);
}

// Settings → Fee schedule: what each level pays for the term selected at the top.
export function FeeScheduleEditor() {
  const { year, term } = useCalendar(); const fs = useFeeSchedule(); const order = usePeriodOrder();
  const { allow } = useRole(); const canEdit = allow("settings", "create");
  const saved = fs.get(year, term); const locked = fs.isLocked(year, term);
  const prev = previousTermWithFees(fs.schedule, order, year, term);
  const [draft, setDraft] = useState<{ key: string; tf: TermFees } | null>(null);
  const key = `${year}|${term}`; const editing = draft?.key === key ? draft.tf : null; // switching terms drops the draft
  const edit = (tf: TermFees) => setDraft({ key, tf });
  // Invoices already issued for this term (they are updated to the new fees when the Owner saves).
  const billedCount = Q.invoices.filter((i) => i.year === year && i.term === term).length;

  return (
    <div className="max-w-6xl space-y-4">
      <div className="flex flex-wrap items-center gap-2"><PeriodSelect />
        {locked ? <Badge tone="warn" dot>Locked</Badge> : saved && !editing ? <Badge tone="ok" dot>Set</Badge> : !saved && !editing ? <Badge dot>Not set</Badge> : null}</div>

      {locked && (LIVE && canEdit
        ? <AlertBanner tone="warn" icon={Lock} title={`${term} ${year} has been billed: ${billedCount} invoice${billedCount === 1 ? "" : "s"} issued`}>
            You can still change its fees. When you save, every issued invoice for {term} {year} is updated to the new amounts (recorded in the audit trail). Payments stay as they are; if a student has now paid more than the new amount, it shows as credit.</AlertBanner>
        : <AlertBanner tone="warn" icon={Lock} title={`${term} ${year} has been billed, so its fees can't be edited`} actions={canEdit ? <RequestChange year={year} term={term} /> : undefined}>
            Bills already sent to parents never change silently. Ask for a change and, once approved, it is applied as an adjustment.</AlertBanner>)}

      {editing ? <GridEditor key={key} tf={editing} onCancel={() => setDraft(null)} onSave={(tf) => { fs.save(tf); setDraft(null); }} />
        : saved ? <>
            <ClassFeeTable tf={saved} classes={fs.classes} title={`Fees for ${term} ${year}`} sub="What one student pays this term. Feeding and extra classes are billed separately."
              action={canEdit && (!locked || LIVE) ? <Button size="sm" variant="primary" onClick={() => edit(structuredClone(saved))}><Pencil size={13} />Edit fees</Button> : undefined} />
            <p className="text-sm text-muted">Activities this term: {Object.entries(saved.activities).map(([a, m]) => `${a} ${money(m)}`).join(" · ")}</p></>
        : <Card><EmptyState icon={FilePlus2} title={`No fees set for ${term} ${year}`}
            body={!canEdit ? "Ask the Owner to set this term's fees." : prev ? `Start from ${prev.term} ${prev.year}'s fees and change what's different.` : "Enter what each level pays this term."}
            action={canEdit ? <div className="mt-2 flex flex-wrap justify-center gap-2">
              {prev && <Button variant="primary" onClick={() => edit(copyTerm(prev, year, term))}><Copy size={14} />Copy {prev.term} {prev.year}</Button>}
              <Button variant={prev ? "secondary" : "primary"} onClick={() => edit(blankTerm(year, term, fs.activities))}>{prev ? "Start empty" : "Set fees"}</Button></div> : undefined} /></Card>}
    </div>
  );
}

function RequestChange({ year, term }: { year: string; term: string }) {
  const [open, setOpen] = useState(false); const [reason, setReason] = useState(""); const toast = useToast();
  return (<>
    <Button size="sm" onClick={() => setOpen(true)}>Request a change</Button>
    <Modal open={open} onClose={() => setOpen(false)} title={`Request a fee change — ${term} ${year}`}
      footer={<><Button onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary" disabled={reason.trim().length < 10} onClick={() => { toast("Change request sent for approval"); setOpen(false); setReason(""); }}>Send for approval</Button></>}>
      <p className="text-sm text-muted">What should change, and why? For example: &quot;JHS ICT levy should be GH₵ 200, agreed at the PTA meeting on 3 Oct.&quot;</p>
      <textarea aria-label="What should change and why" value={reason} onChange={(e) => setReason(e.target.value)} className="mt-3 h-28 w-full rounded-lg border border-line bg-surface p-2 text-sm" />
    </Modal>
  </>);
}

// One table: a row per fee, a column per class (every class has its own fees). Feeding is per level, below.
function GridEditor({ tf, onCancel, onSave }: { tf: TermFees; onCancel: () => void; onSave: (tf: TermFees) => void }) {
  const { classes } = useFeeSchedule(); const toast = useToast();
  const [g, setG] = useState<ClassGrid>(() => toClassGrid(tf, classes)); const [tried, setTried] = useState(false);
  const err = validateClassGrid(g, classes);
  const setRow = (i: number, patch: Partial<ClassGrid["rows"][number]>) => setG({ ...g, rows: g.rows.map((r, j) => (j === i ? { ...r, ...patch } : r)) });
  const total = (cid: string) => g.rows.reduce((a, r) => a + (r.amounts[cid] || 0), 0);
  const levels = LEVELS.filter((lv) => classes.some((c) => c.level === lv));
  const th = "px-2 py-2 text-right font-medium whitespace-nowrap";
  const save = () => { setTried(true); if (err) return; onSave(fromClassGrid({ ...g, rows: g.rows.filter((r) => r.label.trim()) }, classes, tf.year, tf.term)); toast(`${tf.term} ${tf.year} fees saved`); };
  const sticky = "sticky left-0 z-10 bg-surface";

  return (
    <div className="space-y-4">
      <Card><CardHeader title={`Fees for ${tf.term} ${tf.year}`} sub="Amounts in GH₵ for one student, per term, for each class. Leave a box at 0 if that class doesn't pay that fee. Scroll sideways for more classes." />
        <div className="overflow-x-auto"><table className="text-sm">
          <thead className="bg-surface-2/60 text-xs uppercase text-muted"><tr><th className={cn("px-4 py-2 text-left font-medium", sticky, "bg-surface-2")}>Fee</th>{classes.map((c) => <th key={c.id} className={th}>{c.name}</th>)}<th className="w-10" /></tr></thead>
          <tbody className="divide-y divide-line">
            {g.rows.map((r, i) => (
              <tr key={i}>
                <td className={cn("px-4 py-2", sticky)}><input aria-label={`Fee ${i + 1} name`} placeholder="Fee name" className={cn(box, "w-44")} value={r.label} onChange={(e) => setRow(i, { label: e.target.value })} /></td>
                {classes.map((c) => <td key={c.id} className="px-1.5 py-2"><MoneyInput className="w-24" label={`${r.label || "Fee"} for ${c.name}`} value={r.amounts[c.id] ?? 0} onChange={(m) => setRow(i, { amounts: { ...r.amounts, [c.id]: m } })} /></td>)}
                <td className="pr-3"><button type="button" aria-label={`Remove ${r.label || "fee"}`} className="rounded p-1.5 text-muted hover:bg-surface-2 hover:text-danger" onClick={() => setG({ ...g, rows: g.rows.filter((_, j) => j !== i) })}><Trash2 size={15} /></button></td>
              </tr>))}
            <tr><td colSpan={classes.length + 2} className="px-4 py-2"><Button size="sm" variant="ghost" onClick={() => setG({ ...g, rows: [...g.rows, { label: "", amounts: Object.fromEntries(classes.map((c) => [c.id, 0])) }] })}><Plus size={13} />Add a fee</Button></td></tr>
          </tbody>
          <tbody className="border-t-2 border-line bg-surface-2/40">
            <tr className="font-semibold"><td className={cn("px-4 py-2.5", sticky, "bg-surface-2")}>School fees total</td>{classes.map((c) => <td key={c.id} className="num whitespace-nowrap px-2 text-right">{money(total(c.id))}</td>)}<td /></tr>
          </tbody>
          <tbody className="border-t-2 border-line">
            <tr><td colSpan={classes.length + 2} className="px-4 pb-1 pt-4"><div className="font-semibold">Feeding and activities</div><div className="text-xs text-muted">Billed separately, never on the school fees invoice. Feeding is compulsory (set exceptions in the Feeding module). Music (Piano): KG 1 – Class 6 · STEM: Class 1 – JHS 3 · Extra Classes: everyone.</div></td></tr>
            <tr><td className={cn("px-4 py-2 font-medium", sticky)}>Feeding</td>{classes.map((c) => <td key={c.id} className="px-1.5 py-2"><MoneyInput className="w-24" label={`Feeding for ${c.name}`} value={g.feeding[c.id] ?? 0} onChange={(m) => setG({ ...g, feeding: { ...g.feeding, [c.id]: m } })} /></td>)}<td /></tr>
            {Object.entries(g.activities).map(([a, per]) => (
              <tr key={a}><td className={cn("px-4 py-2 font-medium", sticky)}>{a}</td>{classes.map((c) => <td key={c.id} className="px-1.5 py-2">{(ACTIVITY_LEVELS as Record<string, readonly string[]>)[a]?.includes(c.level) ?? true
                ? <MoneyInput className="w-24" label={`${a} for ${c.name}`} value={per[c.id] ?? 0} onChange={(m) => setG({ ...g, activities: { ...g.activities, [a]: { ...per, [c.id]: m } } })} />
                : <span className="block w-24 text-right text-muted">—</span>}</td>)}<td /></tr>))}
          </tbody>
        </table></div></Card>

      <div className="flex flex-wrap items-center justify-end gap-3">
        {tried && err && <p role="alert" className="mr-auto text-sm text-danger">{err}</p>}
        <Button onClick={onCancel}>Cancel</Button>
        <Button variant="primary" onClick={save}>Save fees</Button>
      </div>
    </div>
  );
}


/** What each class pays in a term: school fees (with what's included), and feeding, which is billed separately. Shared with Fees → Fee structures. */
export function ClassFeeTable({ tf, classes, title, sub, action }: { tf: TermFees; classes: ClassRef[]; title: string; sub?: string; action?: React.ReactNode }) {
  const rows = classes.map((c) => ({ c, day: termBillLines(tf, c), extra: tf.overrides[c.id] ?? [] }));
  const short = (m: number) => (m / 100).toLocaleString("en-GH");
  return (
    <Card><CardHeader title={title} sub={sub ?? "School fees per student. Feeding is billed separately in the Feeding module; extra classes on their own invoices."} action={action} />
      <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-surface-2/60 text-xs uppercase text-muted"><tr><th className="px-4 py-2 text-left">Class</th><th className="hidden px-3 text-left md:table-cell">Includes (GH₵)</th><th className="whitespace-nowrap px-3 text-right">School fees</th><th className="whitespace-nowrap px-3 text-right text-muted">Feeding (separate)</th></tr></thead>
        <tbody className="divide-y divide-line">{rows.map((r) => <tr key={r.c.id} className="align-top">
          <td className="whitespace-nowrap px-4 py-2.5 font-medium">{r.c.name}</td>
          <td className="hidden px-3 py-2.5 text-muted md:table-cell">{r.day.map((i) => { const odd = r.extra.some((e) => e.label === i.label); return <span key={i.label} className={cn("mr-3 inline-block", odd && "font-medium text-info")}>{i.label} {short(i.amount)}</span>; })}</td>
          <td className="num whitespace-nowrap px-3 py-2.5 text-right font-medium">{money(sumItems(r.day))}</td><td className="num whitespace-nowrap px-3 py-2.5 text-right text-muted">{money(feedingRate(tf, r.c))}</td></tr>)}</tbody></table></div>
      {rows.some((r) => r.extra.length) && <p className="border-t border-line px-4 py-2 text-xs text-muted">Highlighted fees differ for that class only.</p>}</Card>
  );
}

/** Fees → Fee structures: the selected term's fees, or a pointer to Settings when none are set. */
export function TermFeeStructure() {
  const { year, term } = useCalendar(); const fs = useFeeSchedule(); const tf = fs.get(year, term);
  if (!tf) return <Card><EmptyState icon={FilePlus2} title={`No fees set for ${term} ${year}`} body="Set this term's fees before billing. You can copy last term's and change what's different." action={<Link className="mt-2 text-sm font-medium text-info hover:underline" href="/settings?tab=fees">Set fees in Settings →</Link>} /></Card>;
  return <ClassFeeTable tf={tf} classes={fs.classes} title={`Fee structure — ${term}, ${year}`} sub={`${fs.isLocked(year, term) ? "Locked: bills have been issued for this term. " : ""}Scholarships and per-student changes are applied as approved adjustments on the invoice.`} />;
}
