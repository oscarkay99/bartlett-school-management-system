"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Copy, FilePlus2, Lock, Plus, Save, Trash2, Undo2 } from "lucide-react";
import { AlertBanner, Badge, Button, Card, CardHeader, EmptyState, Field, inputClass } from "@/components/ui/primitives";
import { Modal, useToast } from "@/components/ui/interactive";
import { PeriodSelect, useCalendar } from "@/components/shell/CalendarContext";
import { useFeeSchedule } from "@/components/shell/FeeScheduleContext";
import { useRole } from "@/components/shell/AppShell";
import { blankTerm, classFees, copyTerm, feedingRate, LEVELS, previousTermWithFees, sumItems, termKey, validateTermFees, type ClassRef, type FeeItem, type Level, type TermFees } from "@/lib/fees";
import { money } from "@/lib/money";
import { cn } from "@/lib/utils";

const num = "num text-right";

/** Calendar terms oldest → newest, for "Copy from last term". */
export function usePeriodOrder() {
  const { calendar } = useCalendar();
  return useMemo(() => calendar.flatMap((y) => y.terms.map((t) => ({ year: y.name, term: t.name, start: t.start }))).sort((a, b) => a.start.localeCompare(b.start)), [calendar]);
}

// Settings → Fee schedule: set what each class pays for the selected year + term.
export function FeeScheduleEditor() {
  const { year, term } = useCalendar(); const fs = useFeeSchedule(); const order = usePeriodOrder();
  const { allow } = useRole(); const canEdit = allow("settings", "create");
  const saved = fs.get(year, term); const locked = fs.isLocked(year, term);
  const prev = previousTermWithFees(fs.schedule, order, year, term);
  const [draft, setDraft] = useState<TermFees | null>(null); const [rev, setRev] = useState(0);
  // A draft belongs to one term; switching terms drops it.
  const current = draft && draft.year === year && draft.term === term ? draft : null;
  const start = (tf: TermFees) => { setDraft(tf); setRev((r) => r + 1); };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2"><PeriodSelect />
          {locked ? <Badge tone="warn" dot>Locked · bills issued</Badge> : current ? <Badge tone="info" dot>{saved ? "Unsaved changes" : "New · not saved"}</Badge> : saved ? <Badge tone="ok" dot>Set</Badge> : <Badge dot>Not set</Badge>}</div>
        <p className="text-sm text-muted">Fees are set per level. A class can be adjusted on top of its level.</p>
      </div>
      {locked && <AlertBanner tone="warn" icon={Lock} title={`Bills have been issued for ${term} ${year}, so its fees are locked`}
        actions={canEdit ? <RequestChange year={year} term={term} /> : undefined}>Invoices already sent to parents are never changed silently. To charge a different amount, request a change: once approved, it is applied as an adjustment on the affected invoices.</AlertBanner>}
      {current ? <TermEditor key={`${termKey(year, term)}#${rev}`} tf={current} onChange={setDraft} canEdit={canEdit && !locked}
        onSave={(tf) => { fs.save(tf); setDraft(null); }} onDiscard={() => setDraft(null)} isNew={!saved} />
        : saved ? <><div className="flex justify-end">{canEdit && !locked && <Button onClick={() => start(structuredClone(saved))}>Edit {term} fees</Button>}</div><FeesSummary tf={saved} classes={fs.classes} /></>
        : <Card><EmptyState icon={FilePlus2} title={`No fees set for ${term} ${year}`}
            body={canEdit ? (prev ? `Copy ${prev.term} ${prev.year} and adjust what changed, or start from blank lines.` : "Start from the usual lines and enter this term's amounts.") : "Ask the Owner to set this term's fees in Settings."}
            action={canEdit ? <div className="mt-2 flex flex-wrap justify-center gap-2">{prev && <Button variant="primary" onClick={() => start(copyTerm(prev, year, term))}><Copy size={14} />Copy from {prev.term} {prev.year}</Button>}
              <Button onClick={() => start(blankTerm(year, term, fs.activities))}>Start from blank</Button></div> : undefined} /></Card>}
    </div>
  );
}

function RequestChange({ year, term }: { year: string; term: string }) {
  const [open, setOpen] = useState(false); const [reason, setReason] = useState(""); const toast = useToast();
  return (<>
    <Button size="sm" onClick={() => setOpen(true)}>Request a change</Button>
    <Modal open={open} onClose={() => setOpen(false)} title={`Request a fee change — ${term} ${year}`}
      footer={<><Button onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary" disabled={reason.trim().length < 10} onClick={() => { toast("Change request sent for approval"); setOpen(false); setReason(""); }}>Send for approval</Button></>}>
      <p className="text-sm text-muted">Say what should change and why (for example: &quot;JHS 2 ICT levy should be GHS 200, approved at the PTA meeting on 3 Oct&quot;). It goes to the approvals queue and is logged.</p>
      <textarea aria-label="What should change and why" value={reason} onChange={(e) => setReason(e.target.value)} className="mt-3 h-28 w-full rounded-lg border border-line bg-surface p-2 text-sm" />
    </Modal>
  </>);
}

/** Cedi input that stores integer pesewas. */
function MoneyInput({ value, onChange, disabled, label, className }: { value: number; onChange: (m: number) => void; disabled?: boolean; label: string; className?: string }) {
  const [s, setS] = useState(value ? String(value / 100) : "0");
  return <input aria-label={label} inputMode="decimal" disabled={disabled} className={cn(inputClass, "num text-right disabled:opacity-70", className)} value={s}
    onFocus={(e) => e.target.select()}
    onChange={(e) => { const v = e.target.value.replace(/,/g, ""); if (!/^\d*\.?\d{0,2}$/.test(v)) return; setS(v); onChange(Math.round(Number(v || 0) * 100)); }} />;
}

function TermEditor({ tf, onChange, canEdit, onSave, onDiscard, isNew }: { tf: TermFees; onChange: (tf: TermFees) => void; canEdit: boolean; onSave: (tf: TermFees) => void; onDiscard: () => void; isNew: boolean }) {
  const { classes } = useFeeSchedule(); const toast = useToast();
  const err = validateTermFees(tf, classes);
  const setLevel = (lv: Level, patch: Partial<TermFees["levels"][Level]>) => onChange({ ...tf, levels: { ...tf.levels, [lv]: { ...tf.levels[lv], ...patch } } });
  const setOverrides = (cid: string, items: FeeItem[]) => { const o = { ...tf.overrides }; if (items.length) o[cid] = items; else delete o[cid]; onChange({ ...tf, overrides: o }); };
  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-3">
        {LEVELS.map((lv) => { const l = tf.levels[lv]; return (
          <Card key={lv}><CardHeader title={lv} sub={`${classes.filter((c) => c.level === lv).map((c) => c.name).join(", ")}`} action={<Badge tone="info">Day {money(sumItems(l.items))}</Badge>} />
            <div className="space-y-2 px-4 pb-4">
              {l.items.map((it, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input aria-label={`${lv} line ${i + 1} name`} disabled={!canEdit} className={cn(inputClass, "disabled:opacity-70")} value={it.label} onChange={(e) => setLevel(lv, { items: l.items.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} />
                  <MoneyInput label={`${lv} ${it.label || "line"} amount`} disabled={!canEdit} className="w-28 shrink-0" value={it.amount} onChange={(m) => setLevel(lv, { items: l.items.map((x, j) => (j === i ? { ...x, amount: m } : x)) })} />
                  {canEdit && <button type="button" aria-label={`Remove ${it.label || "line"}`} className="rounded p-1.5 text-muted hover:bg-surface-2 hover:text-danger" onClick={() => setLevel(lv, { items: l.items.filter((_, j) => j !== i) })}><Trash2 size={14} /></button>}
                </div>))}
              {canEdit && <Button size="sm" variant="ghost" onClick={() => setLevel(lv, { items: [...l.items, { label: "", amount: 0 }] })}><Plus size={13} />Add line</Button>}
              <div className="grid grid-cols-2 gap-3 border-t border-line pt-3">
                <Field label="Boarding add-on" hint="0 = no boarders"><MoneyInput label={`${lv} boarding`} disabled={!canEdit} value={l.boarding} onChange={(m) => setLevel(lv, { boarding: m })} /></Field>
                <Field label="Feeding" hint="Billed separately"><MoneyInput label={`${lv} feeding`} disabled={!canEdit} value={l.feeding} onChange={(m) => setLevel(lv, { feeding: m })} /></Field>
              </div>
            </div></Card>); })}
      </div>

      <ClassAdjustments tf={tf} classes={classes} canEdit={canEdit} onChange={setOverrides} />

      <Card><CardHeader title="Extracurricular activities" sub="Price per term, billed on the Extracurricular account" />
        <div className="grid gap-3 px-4 pb-4 sm:grid-cols-3">{Object.entries(tf.activities).map(([a, m]) => <Field key={a} label={a}><MoneyInput label={`${a} price`} disabled={!canEdit} value={m} onChange={(v) => onChange({ ...tf, activities: { ...tf.activities, [a]: v } })} /></Field>)}</div></Card>

      <ClassFeeTable tf={tf} classes={classes} title={`What each class pays — ${tf.term} ${tf.year}`} />

      {canEdit && <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-end gap-3 rounded-xl border border-line bg-surface/95 p-3 shadow-lg backdrop-blur">
        {err ? <p role="alert" className="mr-auto text-sm text-danger">{err}</p> : <p className="mr-auto text-sm text-muted">Fees can be changed until the first bill for {tf.term} is issued.</p>}
        <Button onClick={onDiscard}><Undo2 size={14} />{isNew ? "Cancel" : "Discard changes"}</Button>
        <Button variant="primary" disabled={!!err} onClick={() => { onSave(tf); toast(`${tf.term} ${tf.year} fees saved`); }}><Save size={14} />Save {tf.term} fees</Button>
      </div>}
    </div>
  );
}

function ClassAdjustments({ tf, classes, canEdit, onChange }: { tf: TermFees; classes: ClassRef[]; canEdit: boolean; onChange: (cid: string, items: FeeItem[]) => void }) {
  const [pick, setPick] = useState("");
  const adjusted = classes.filter((c) => tf.overrides[c.id]);
  const free = classes.filter((c) => !tf.overrides[c.id]);
  return (
    <Card><CardHeader title="Class adjustments" sub="Change a level's line for one class (e.g. a higher exam fee for JHS 3), or add a line only that class pays. 0 removes the line for that class."
      action={canEdit && free.length > 0 ? <div className="flex items-center gap-2"><select aria-label="Class to adjust" className="h-8 rounded-lg border border-line bg-surface px-2 text-xs" value={pick} onChange={(e) => setPick(e.target.value)}><option value="">Choose class…</option>{free.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <Button size="sm" disabled={!pick} onClick={() => { onChange(pick, [{ label: "", amount: 0 }]); setPick(""); }}><Plus size={13} />Adjust class</Button></div> : undefined} />
      {adjusted.length === 0 ? <p className="border-t border-line px-4 py-3 text-sm text-muted">No class adjustments. Every class pays its level&apos;s fees.</p>
        : adjusted.map((c) => { const over = tf.overrides[c.id]; const lvl = tf.levels[c.level]; const listId = `labels-${c.id}`; return (
          <div key={c.id} className="border-t border-line px-4 py-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><b>{c.name} <span className="text-xs font-normal text-muted">{c.level}</span></b><span className="text-sm text-muted">Day total {money(sumItems(lvl.items))} → <b className="num text-fg">{money(sumItems(classFees(tf, c, false)))}</b></span></div>
            <datalist id={listId}>{lvl.items.map((i) => <option key={i.label} value={i.label} />)}</datalist>
            <div className="space-y-2">{over.map((o, i) => { const base = lvl.items.find((x) => x.label === o.label); return (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <input list={listId} aria-label={`${c.name} adjustment ${i + 1} name`} placeholder="Line name" disabled={!canEdit} className={cn(inputClass, "max-w-xs disabled:opacity-70")} value={o.label} onChange={(e) => onChange(c.id, over.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
                <MoneyInput label={`${c.name} ${o.label || "adjustment"} amount`} disabled={!canEdit} className="w-28" value={o.amount} onChange={(m) => onChange(c.id, over.map((x, j) => (j === i ? { ...x, amount: m } : x)))} />
                <span className="text-xs text-muted">{o.label.trim() ? (base ? `replaces ${money(base.amount)}` : "added for this class only") : ""}</span>
                {canEdit && <button type="button" aria-label={`Remove ${c.name} ${o.label || "adjustment"}`} className="rounded p-1.5 text-muted hover:bg-surface-2 hover:text-danger" onClick={() => onChange(c.id, over.filter((_, j) => j !== i))}><Trash2 size={14} /></button>}
              </div>); })}
              {canEdit && <Button size="sm" variant="ghost" onClick={() => onChange(c.id, [...over, { label: "", amount: 0 }])}><Plus size={13} />Add adjustment</Button>}</div>
          </div>); })}
    </Card>
  );
}

/** Read-only view of a saved term: level lines, adjustments, activities and per-class totals. */
function FeesSummary({ tf, classes }: { tf: TermFees; classes: ClassRef[] }) {
  return (
    <div className="space-y-4">
      <ClassFeeTable tf={tf} classes={classes} title={`What each class pays — ${tf.term} ${tf.year}`} />
      <Card><CardHeader title="Extracurricular activities" sub="Price per term" /><div className="flex flex-wrap gap-x-6 gap-y-1 px-4 pb-4 text-sm">{Object.entries(tf.activities).map(([a, m]) => <span key={a}>{a} <b className="num">{money(m)}</b></span>)}</div></Card>
    </div>
  );
}

/** Per-class breakdown of one term's school fees, with day / boarding totals and the feeding rate. Shared with Fees → Fee structures. */
export function ClassFeeTable({ tf, classes, title, sub }: { tf: TermFees; classes: ClassRef[]; title: string; sub?: string }) {
  const rows = classes.map((c) => ({ c, day: classFees(tf, c, false), boarding: tf.levels[c.level].boarding, feeding: feedingRate(tf, c), adjusted: !!tf.overrides[c.id] }));
  const labels = Array.from(new Set(rows.flatMap((r) => r.day.map((i) => i.label))));
  const anyBoarding = rows.some((r) => r.boarding > 0);
  return (
    <Card><CardHeader title={title} sub={sub ?? "School fees per student. Feeding and extracurricular are billed on their own accounts."} />
      <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-surface-2/60 text-xs uppercase text-muted"><tr><th className="px-4 py-2 text-left">Class</th>{labels.map((l) => <th key={l} className="whitespace-nowrap px-3 text-right">{l}</th>)}<th className="whitespace-nowrap px-3 text-right">Day total</th>{anyBoarding && <th className="whitespace-nowrap px-3 text-right">Boarding total</th>}<th className="whitespace-nowrap px-4 text-right">Feeding</th></tr></thead>
        <tbody className="divide-y divide-line">{rows.map((r) => <tr key={r.c.id}><td className="whitespace-nowrap px-4 py-2.5 font-medium">{r.c.name}{r.adjusted && <span className="ml-1.5"><Badge tone="info">adjusted</Badge></span>}</td>
          {labels.map((l) => { const a = r.day.find((i) => i.label === l)?.amount; return <td key={l} className={cn(num, "whitespace-nowrap px-3")}>{a ? money(a) : "—"}</td>; })}
          <td className={cn(num, "whitespace-nowrap px-3 font-medium")}>{money(sumItems(r.day))}</td>
          {anyBoarding && <td className={cn(num, "whitespace-nowrap px-3 font-medium")}>{r.boarding ? money(sumItems(r.day) + r.boarding) : "—"}</td>}
          <td className={cn(num, "whitespace-nowrap px-4")}>{money(r.feeding)}</td></tr>)}</tbody></table></div></Card>
  );
}

/** Fees → Fee structures: the selected term's fees, or a pointer to Settings when none are set. */
export function TermFeeStructure() {
  const { year, term } = useCalendar(); const fs = useFeeSchedule(); const tf = fs.get(year, term);
  if (!tf) return <Card><EmptyState icon={FilePlus2} title={`No fees set for ${term} ${year}`} body="Set this term's fees before billing. You can copy last term's and change what's different." action={<Link className="mt-2 text-sm font-medium text-info hover:underline" href="/settings?tab=fees">Set fees in Settings →</Link>} /></Card>;
  return <ClassFeeTable tf={tf} classes={fs.classes} title={`Fee structure — ${term}, ${year}`} sub={`${fs.isLocked(year, term) ? "Locked: bills have been issued for this term. " : ""}Scholarships and per-student changes are applied as approved adjustments on the invoice.`} />;
}
