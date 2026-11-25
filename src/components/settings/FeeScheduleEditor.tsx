"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Copy, FilePlus2, Lock, Pencil, Plus, Trash2 } from "lucide-react";
import { AlertBanner, Badge, Button, Card, CardHeader, EmptyState } from "@/components/ui/primitives";
import { Modal, MoneyInput, useToast } from "@/components/ui/interactive";
import { PeriodSelect, useCalendar } from "@/components/shell/CalendarContext";
import { useFeeSchedule } from "@/components/shell/FeeScheduleContext";
import { useRole } from "@/components/shell/AppShell";
import { blankTerm, copyTerm, fromGrid, termBillLines, LEVELS, previousTermWithFees, sumItems, toGrid, validateGrid, type ClassRef, type FeeGrid, type Level, type TermFees } from "@/lib/fees";
import { money } from "@/lib/money";
import { cn } from "@/lib/utils";

// Inputs here set their own width (cn() does not resolve Tailwind conflicts, so never mix with inputClass's w-full).
const box = "h-9 rounded-lg border border-line bg-surface px-2.5 text-sm placeholder:text-muted/60 focus:border-info focus:outline-none focus:ring-2 focus:ring-info/30";
const SHORT: Record<Level, string> = { Kindergarten: "KG", Primary: "Primary", JHS: "JHS" };

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

  return (
    <div className="max-w-4xl space-y-4">
      <div className="flex flex-wrap items-center gap-2"><PeriodSelect />
        {locked ? <Badge tone="warn" dot>Locked</Badge> : saved && !editing ? <Badge tone="ok" dot>Set</Badge> : !saved && !editing ? <Badge dot>Not set</Badge> : null}</div>

      {locked && <AlertBanner tone="warn" icon={Lock} title={`${term} ${year} has been billed, so its fees can't be edited`} actions={canEdit ? <RequestChange year={year} term={term} /> : undefined}>
        Bills already sent to parents never change silently. Ask for a change and, once approved, it is applied as an adjustment.</AlertBanner>}

      {editing ? <GridEditor key={key} tf={editing} onCancel={() => setDraft(null)} onSave={(tf) => { fs.save(tf); setDraft(null); }} />
        : saved ? <>
            <ClassFeeTable tf={saved} classes={fs.classes} title={`Fees for ${term} ${year}`} sub="What one student pays this term, feeding included. Extra classes are billed separately."
              action={canEdit && !locked ? <Button size="sm" variant="primary" onClick={() => edit(structuredClone(saved))}><Pencil size={13} />Edit fees</Button> : undefined} />
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
      <p className="text-sm text-muted">What should change, and why? For example: &quot;JHS ICT levy should be GHS 200, agreed at the PTA meeting on 3 Oct.&quot;</p>
      <textarea aria-label="What should change and why" value={reason} onChange={(e) => setReason(e.target.value)} className="mt-3 h-28 w-full rounded-lg border border-line bg-surface p-2 text-sm" />
    </Modal>
  </>);
}

// One table: a row per fee, a column per level. Feeding is a row too.
function GridEditor({ tf, onCancel, onSave }: { tf: TermFees; onCancel: () => void; onSave: (tf: TermFees) => void }) {
  const { classes } = useFeeSchedule(); const toast = useToast();
  const [g, setG] = useState<FeeGrid>(() => toGrid(tf)); const [tried, setTried] = useState(false);
  const err = validateGrid(g, classes);
  const setRow = (i: number, patch: Partial<FeeGrid["rows"][number]>) => setG({ ...g, rows: g.rows.map((r, j) => (j === i ? { ...r, ...patch } : r)) });
  const total = (lv: Level) => g.rows.reduce((a, r) => a + (r.amounts[lv] || 0), 0);
  const th = "px-2 py-2 text-right font-medium sm:px-3";
  const save = () => { setTried(true); if (err) return; onSave(fromGrid({ ...g, rows: g.rows.filter((r) => r.label.trim()) }, tf.year, tf.term)); toast(`${tf.term} ${tf.year} fees saved`); };

  return (
    <div className="space-y-4">
      <Card><CardHeader title={`Fees for ${tf.term} ${tf.year}`} sub="Amounts in GHS for one student, per term. Leave a box empty if that level doesn't pay that fee." />
        <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead className="bg-surface-2/60 text-xs uppercase text-muted"><tr><th className="px-4 py-2 text-left font-medium">Fee</th>{LEVELS.map((lv) => <th key={lv} className={th}><span className="hidden sm:inline">{lv}</span><span className="sm:hidden">{SHORT[lv]}</span></th>)}<th className="w-10" /></tr></thead>
          <tbody className="divide-y divide-line">
            {g.rows.map((r, i) => (
              <tr key={i}>
                <td className="px-4 py-2"><input aria-label={`Fee ${i + 1} name`} placeholder="Fee name" className={cn(box, "w-full min-w-[150px]")} value={r.label} onChange={(e) => setRow(i, { label: e.target.value })} /></td>
                {LEVELS.map((lv) => <td key={lv} className="px-2 py-2 sm:px-3"><MoneyInput label={`${r.label || "Fee"} for ${lv}`} value={r.amounts[lv]} onChange={(m) => setRow(i, { amounts: { ...r.amounts, [lv]: m } })} /></td>)}
                <td className="pr-3"><button type="button" aria-label={`Remove ${r.label || "fee"}`} className="rounded p-1.5 text-muted hover:bg-surface-2 hover:text-danger" onClick={() => setG({ ...g, rows: g.rows.filter((_, j) => j !== i) })}><Trash2 size={15} /></button></td>
              </tr>))}
            <tr><td colSpan={5} className="px-4 py-2"><Button size="sm" variant="ghost" onClick={() => setG({ ...g, rows: [...g.rows, { label: "", amounts: { Kindergarten: 0, Primary: 0, JHS: 0 } }] })}><Plus size={13} />Add a fee</Button></td></tr>
          </tbody>
          <tbody className="border-t-2 border-line bg-surface-2/40">
            <tr><td className="px-4 py-2"><div className="font-medium">Feeding</div><div className="text-xs text-muted">On every school fees invoice</div></td>{LEVELS.map((lv) => <td key={lv} className="px-2 py-2 sm:px-3"><MoneyInput label={`Feeding for ${lv}`} value={g.feeding[lv]} onChange={(m) => setG({ ...g, feeding: { ...g.feeding, [lv]: m } })} /></td>)}<td /></tr>
            <tr className="font-semibold"><td className="px-4 py-2.5">School fees total (with feeding)</td>{LEVELS.map((lv) => <td key={lv} className="num whitespace-nowrap px-2 text-right sm:px-3">{money(total(lv) + (g.feeding[lv] || 0))}</td>)}<td /></tr>
          </tbody>
        </table></div></Card>

      <Card><CardHeader title="Activities" sub="Price per term. Billed separately when a student joins." />
        <div className="grid gap-3 px-4 pb-4 sm:grid-cols-3">{Object.entries(g.activities).map(([a, m]) => <label key={a} className="block text-sm"><span className="mb-1 block font-medium">{a}</span><MoneyInput label={`${a} price`} value={m} onChange={(v) => setG({ ...g, activities: { ...g.activities, [a]: v } })} /></label>)}</div></Card>

      <Exceptions g={g} setG={setG} classes={classes} />

      <div className="flex flex-wrap items-center justify-end gap-3">
        {tried && err && <p role="alert" className="mr-auto text-sm text-danger">{err}</p>}
        <Button onClick={onCancel}>Cancel</Button>
        <Button variant="primary" onClick={save}>Save fees</Button>
      </div>
    </div>
  );
}

// Optional: one class pays a different amount for a fee, or an extra fee (e.g. JHS 3 BECE registration).
function Exceptions({ g, setG, classes }: { g: FeeGrid; setG: (g: FeeGrid) => void; classes: ClassRef[] }) {
  const [open, setOpen] = useState(g.exceptions.length > 0);
  const set = (i: number, patch: Partial<FeeGrid["exceptions"][number]>) => setG({ ...g, exceptions: g.exceptions.map((e, j) => (j === i ? { ...e, ...patch } : e)) });
  const add = () => setG({ ...g, exceptions: [...g.exceptions, { classId: "", label: "", amount: 0 }] });
  if (!open) return <button type="button" className="text-sm font-medium text-info hover:underline" onClick={() => { setOpen(true); if (!g.exceptions.length) add(); }}>+ One class pays a different amount (optional)</button>;
  return (
    <Card><CardHeader title="Class exceptions" sub="Use when one class pays a different amount for a fee, or a fee only it pays. Enter 0 to remove a fee for that class." />
      <datalist id="fee-names">{g.rows.filter((r) => r.label.trim()).map((r) => <option key={r.label} value={r.label} />)}</datalist>
      <div className="space-y-2 px-4 pb-4">
        {g.exceptions.map((e, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <select aria-label={`Exception ${i + 1} class`} className={cn(box, "w-36")} value={e.classId} onChange={(x) => set(i, { classId: x.target.value })}><option value="">Class…</option>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
            <input list="fee-names" aria-label={`Exception ${i + 1} fee`} placeholder="Fee, e.g. BECE Registration" className={cn(box, "min-w-[180px] flex-1")} value={e.label} onChange={(x) => set(i, { label: x.target.value })} />
            <MoneyInput className="w-28 flex-none" label={`Exception ${i + 1} amount`} value={e.amount} onChange={(m) => set(i, { amount: m })} />
            <button type="button" aria-label={`Remove exception ${i + 1}`} className="rounded p-1.5 text-muted hover:bg-surface-2 hover:text-danger" onClick={() => setG({ ...g, exceptions: g.exceptions.filter((_, j) => j !== i) })}><Trash2 size={15} /></button>
          </div>))}
        <Button size="sm" variant="ghost" onClick={add}><Plus size={13} />Add exception</Button>
      </div></Card>
  );
}

/** What each class pays in a term: school fees (with what's included), feeding included. Shared with Fees → Fee structures. */
export function ClassFeeTable({ tf, classes, title, sub, action }: { tf: TermFees; classes: ClassRef[]; title: string; sub?: string; action?: React.ReactNode }) {
  const rows = classes.map((c) => ({ c, day: termBillLines(tf, c), extra: tf.overrides[c.id] ?? [] }));
  const short = (m: number) => (m / 100).toLocaleString("en-GH");
  return (
    <Card><CardHeader title={title} sub={sub ?? "School fees per student, feeding included. Extra classes are billed separately."} action={action} />
      <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-surface-2/60 text-xs uppercase text-muted"><tr><th className="px-4 py-2 text-left">Class</th><th className="hidden px-3 text-left md:table-cell">Includes (GHS)</th><th className="whitespace-nowrap px-3 text-right">School fees</th></tr></thead>
        <tbody className="divide-y divide-line">{rows.map((r) => <tr key={r.c.id} className="align-top">
          <td className="whitespace-nowrap px-4 py-2.5 font-medium">{r.c.name}</td>
          <td className="hidden px-3 py-2.5 text-muted md:table-cell">{r.day.map((i) => { const odd = r.extra.some((e) => e.label === i.label); return <span key={i.label} className={cn("mr-3 inline-block", odd && "font-medium text-info")}>{i.label} {short(i.amount)}</span>; })}</td>
          <td className="num whitespace-nowrap px-3 py-2.5 text-right font-medium">{money(sumItems(r.day))}</td></tr>)}</tbody></table></div>
      {rows.some((r) => r.extra.length) && <p className="border-t border-line px-4 py-2 text-xs text-muted">Highlighted fees differ for that class only.</p>}</Card>
  );
}

/** Fees → Fee structures: the selected term's fees, or a pointer to Settings when none are set. */
export function TermFeeStructure() {
  const { year, term } = useCalendar(); const fs = useFeeSchedule(); const tf = fs.get(year, term);
  if (!tf) return <Card><EmptyState icon={FilePlus2} title={`No fees set for ${term} ${year}`} body="Set this term's fees before billing. You can copy last term's and change what's different." action={<Link className="mt-2 text-sm font-medium text-info hover:underline" href="/settings?tab=fees">Set fees in Settings →</Link>} /></Card>;
  return <ClassFeeTable tf={tf} classes={fs.classes} title={`Fee structure — ${term}, ${year}`} sub={`${fs.isLocked(year, term) ? "Locked: bills have been issued for this term. " : ""}Scholarships and per-student changes are applied as approved adjustments on the invoice.`} />;
}
