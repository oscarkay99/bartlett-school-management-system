"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Eye, Pencil, Plus, Printer, RotateCcw, Trash2 } from "lucide-react";
import { Badge, Button, Card } from "@/components/ui/primitives";
import { Modal, MoneyInput, useToast } from "@/components/ui/interactive";
import { useRole } from "@/components/shell/AppShell";
import { cleanInvoice, INVOICE_TABS, invoiceTotal, isSmall, linesTotal, mergeInvoices, PER_PAGE, type ClassInvoice, type InvoiceLine } from "@/lib/class-invoices";
import { SchoolLogo } from "@/components/SchoolLogo";
import { money } from "@/lib/money";
import { cn } from "@/lib/utils";

const KEY = "class-invoices-v4";
type School = { name: string; city: string; phone: string; email: string };
const box = "h-9 rounded-lg border border-line bg-surface px-2.5 text-sm placeholder:text-muted/60 focus:border-info focus:outline-none focus:ring-2 focus:ring-info/30";
/** 0 prints as a dash: the line is on the invoice but not charged (e.g. ICT levy, not billed yet). */
const amt = (m: number) => (m ? money(m) : "—");
// One small (Extracurricular) invoice = one cell of a 2 × 5 grid on A4 (210 × 297 mm).
const W = "105mm", H = "59.4mm";

// Invoices page: a tab per class (full A4 school fees invoice) plus Extracurricular (small invoice, 10 per A4 page).
// Edits are kept in this browser until the backend stores them.
export function ClassInvoices({ defaults, school }: { defaults: Record<string, ClassInvoice>; school: School }) {
  const [invoices, setInvoices] = useState(defaults);
  const [tab, setTab] = useState(INVOICE_TABS[0].id); const [open, setOpen] = useState(false);
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => { try { setInvoices(mergeInvoices(defaults, JSON.parse(localStorage.getItem(KEY) ?? "null"))); } catch {} }, [defaults]);
  /* eslint-enable react-hooks/set-state-in-effect */
  const persist = (next: Record<string, ClassInvoice>) => {
    setInvoices(next);
    try { localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(Object.entries(next).filter(([id, inv]) => JSON.stringify(inv) !== JSON.stringify(defaults[id]))))); } catch {}
  };
  const t = INVOICE_TABS.find((x) => x.id === tab)!; const inv = invoices[tab];
  const edited = JSON.stringify(inv) !== JSON.stringify(defaults[tab]);

  return (
    <div className="grid gap-4 md:grid-cols-[220px_1fr]">
      <nav aria-label="Invoices" className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
        {INVOICE_TABS.map((x) => (
          <button key={x.id} onClick={() => setTab(x.id)} aria-current={tab === x.id ? "page" : undefined}
            className={cn("flex shrink-0 items-center justify-between gap-3 whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm transition",
              tab === x.id ? "bg-info/10 font-semibold text-info" : "text-fg hover:bg-surface-2", !x.classId && "md:mt-2 md:border-t md:border-line md:pt-3")}>
            <span>{x.label}</span><span className="num hidden text-xs font-normal text-muted md:inline">{money(invoiceTotal(invoices[x.id]))}</span>
          </button>))}
      </nav>
      <Card className="self-start">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div><div className="flex items-center gap-2"><h2 className="font-semibold">{t.label}</h2>{edited && <Badge tone="info">Edited</Badge>}</div><p className="text-sm text-muted">{inv.title} · {inv.period}</p></div>
          <Button variant="primary" onClick={() => setOpen(true)}><Eye size={14} />View invoice</Button>
        </div>
        <ul className="border-t border-line px-4 py-3 text-sm">{inv.lines.map((l, i) => <li key={i} className="flex justify-between gap-3 py-0.5 text-muted"><span>{l.description}</span><span className="num">{amt(l.amount)}</span></li>)}
          {inv.lines.length === 0 && <li className="py-0.5 text-muted">No lines. Open the invoice to add them.</li>}
          <li className="mt-1 flex justify-between gap-3 border-t border-line pt-1.5 font-semibold"><span>Total</span><span className="num">{money(invoiceTotal(inv))}</span></li></ul>
      </Card>
      {open && <InvoiceDialog key={tab} small={isSmall(t)} label={t.label} invoice={inv} original={defaults[tab]} school={school} onClose={() => setOpen(false)} onSave={(v) => persist({ ...invoices, [tab]: v })} />}
    </div>
  );
}

function InvoiceDialog({ small, label, invoice, original, school, onClose, onSave }: { small: boolean; label: string; invoice: ClassInvoice; original: ClassInvoice; school: School; onClose: () => void; onSave: (inv: ClassInvoice) => void }) {
  const { allow } = useRole(); const canEdit = allow("invoices", "create"); const toast = useToast();
  const [draft, setDraft] = useState<ClassInvoice | null>(null); const [rev, setRev] = useState(0);
  const print = () => {
    document.documentElement.classList.add("print-invoice");
    const done = () => { document.documentElement.classList.remove("print-invoice"); window.removeEventListener("afterprint", done); };
    window.addEventListener("afterprint", done); window.print();
  };
  const footer = draft ? <>
      <Button variant="ghost" className="mr-auto" onClick={() => { setDraft(structuredClone(original)); setRev((r) => r + 1); }}><RotateCcw size={14} />Reset to current fees</Button>
      <Button onClick={() => setDraft(null)}>Cancel</Button>
      <Button variant="primary" onClick={() => { onSave(cleanInvoice(draft)); setDraft(null); toast(`${label} invoice saved`); }}>Save invoice</Button></>
    : <>{canEdit && <Button className="mr-auto" onClick={() => setDraft(structuredClone(invoice))}><Pencil size={14} />Edit figures</Button>}<Button onClick={onClose}>Close</Button><Button variant="primary" onClick={print}><Printer size={14} />{small ? `Print ${PER_PAGE} per A4` : "Print / Save PDF"}</Button></>;

  return (
    <Modal open onClose={onClose} title={`${label} invoice`} wide footer={footer}>
      {small
        ? (draft ? <Editor key={rev} draft={draft} setDraft={setDraft} school={school} />
          : <div className="space-y-2"><Preview school={school} inv={invoice} /><p className="text-center text-xs text-muted">Actual size is about 10.5 × 6 cm. Printing puts {PER_PAGE} copies on one A4 page with cut lines.</p></div>)
        : <FullSheet key={rev} school={school} doc={draft ?? invoice} setDoc={draft ? setDraft : undefined} />}
      {/* Print copy, only this prints (see .print-root in globals.css): 10 small invoices per page, or the full invoice. */}
      {createPortal(<div className="print-root"><style>{"@page { size: A4; margin: 0; }"}</style>
        {small ? <div className="mini-page">{Array.from({ length: PER_PAGE }, (_, i) => <MiniInvoice key={i} school={school} inv={invoice} />)}</div> : <FullSheet school={school} doc={invoice} />}</div>, document.body)}
    </Modal>
  );
}

/** The small invoice enlarged on screen: same layout and proportions as the printed one. */
function Preview({ school, inv }: { school: School; inv: ClassInvoice }) {
  return <div className="flex justify-center overflow-hidden rounded-lg bg-surface-2 p-4"><div style={{ zoom: 1.45 }} className="shadow-md"><MiniInvoice school={school} inv={inv} /></div></div>;
}

/** One small Extracurricular invoice, sized in millimetres so the screen preview and the A4 print match exactly. No crest, school name or contacts. */
export function MiniInvoice({ inv }: { school?: School; inv: ClassInvoice }) {
  return (
    <article className="mini-invoice flex flex-col overflow-hidden bg-white text-neutral-900" style={{ width: W, height: H, padding: "3.5mm 4.5mm", fontSize: "7.4pt", lineHeight: 1.3 }}>
      {/* No school name or contacts on the small invoice: just what it is for, the term, the lines and the total. */}
      <header className="flex items-start justify-between gap-2 border-b border-neutral-800 pb-[1.2mm]">
        <div className="min-w-0"><div className="truncate font-bold" style={{ fontSize: "8.6pt" }}>{inv.title}</div><div className="truncate text-neutral-600" style={{ fontSize: "6.8pt" }}>{inv.period}</div></div>
        <div className="shrink-0 font-bold tracking-wide" style={{ fontSize: "9pt" }}>INVOICE</div>
      </header>
      <table className="mt-[1mm] w-full border-collapse">
        <tbody>{inv.lines.map((l, i) => <tr key={i} className="border-b border-neutral-200"><td className="py-[0.35mm] pr-2">{l.description}</td><td className="num whitespace-nowrap py-[0.35mm] text-right">{amt(l.amount)}</td></tr>)}</tbody>
        <tfoot><tr className="font-bold"><td className="pt-[0.8mm]">Total</td><td className="num whitespace-nowrap pt-[0.8mm] text-right">{money(invoiceTotal(inv))}</td></tr></tfoot>
      </table>
      {inv.notes && <p className="mt-auto text-neutral-600" style={{ fontSize: "5.8pt", lineHeight: 1.25 }}>{inv.notes}</p>}
    </article>
  );
}

// Edit as a simple form, with the small invoice updating live beside it.
function Editor({ draft, setDraft, school }: { draft: ClassInvoice; setDraft: (d: ClassInvoice) => void; school: School }) {
  const [rev, setRev] = useState(0);
  const setLine = (i: number, patch: Partial<ClassInvoice["lines"][number]>) => setDraft({ ...draft, lines: draft.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) });
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm"><span className="mb-1 block font-medium">Title</span><input aria-label="Invoice title" className={cn(box, "w-full")} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></label>
        <label className="block text-sm"><span className="mb-1 block font-medium">Term</span><input aria-label="Term and year" className={cn(box, "w-full")} value={draft.period} onChange={(e) => setDraft({ ...draft, period: e.target.value })} /></label>
      </div>
      <div className="space-y-2">
        {draft.lines.map((l, i) => (
          <div key={`${rev}-${i}`} className="flex items-center gap-2">
            <input aria-label={`Line ${i + 1} description`} placeholder="Description" className={cn(box, "min-w-0 flex-1")} value={l.description} onChange={(e) => setLine(i, { description: e.target.value })} />
            <MoneyInput className="w-32 flex-none" label={`Line ${i + 1} amount`} value={l.amount} onChange={(m) => setLine(i, { amount: m })} />
            <button type="button" aria-label={`Remove line ${i + 1}`} className="rounded p-1.5 text-muted hover:bg-surface-2 hover:text-danger" onClick={() => { setDraft({ ...draft, lines: draft.lines.filter((_, j) => j !== i) }); setRev((r) => r + 1); }}><Trash2 size={15} /></button>
          </div>))}
        <Button size="sm" variant="ghost" onClick={() => setDraft({ ...draft, lines: [...draft.lines, { description: "", amount: 0 }] })}><Plus size={13} />Add line</Button>
        <p className="text-xs text-muted">Leave an amount empty to show “—” (listed but not charged).</p>
      </div>
      <label className="block text-sm"><span className="mb-1 block font-medium">Note at the bottom</span><textarea aria-label="Notes" className="h-16 w-full rounded-lg border border-line bg-surface p-2 text-sm" value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} /></label>
      <div><div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">Preview</div><Preview school={school} inv={draft} /></div>
    </div>
  );
}

// ---------- Full A4 school fees invoice (classes) ----------
function FullSheet({ school, doc: d, setDoc }: { school: School; doc: ClassInvoice; setDoc?: (d: ClassInvoice) => void }) {
  const [rev, setRev] = useState(0);
  const setLines = (lines: InvoiceLine[]) => setDoc?.({ ...d, lines });
  return (
    <article className="invoice-sheet bg-white text-[13px] leading-relaxed text-neutral-900">
      <header className="flex items-center justify-between gap-3 border-b-2 border-neutral-900 pb-3">
        <div className="flex items-center gap-3"><SchoolLogo size={60} /><div><div className="text-base font-bold">{school.name}</div><div className="text-[11px] text-neutral-600">{school.city}</div><div className="text-[11px] text-neutral-600">{school.phone} · {school.email}</div></div></div>
        <div className="text-right text-xl font-bold tracking-wide">INVOICE</div>
      </header>
      <div className="mt-4 space-y-1">
        {setDoc ? <>
          <input aria-label="Invoice title" className={cn(box, "w-full font-semibold")} value={d.title} onChange={(e) => setDoc({ ...d, title: e.target.value })} />
          <input aria-label="Term and year" className={cn(box, "w-full")} value={d.period} onChange={(e) => setDoc({ ...d, period: e.target.value })} />
        </> : <><div className="text-[15px] font-semibold">{d.title}</div><div className="text-neutral-600">{d.period}</div></>}
      </div>
      <table className="mt-3 w-full border-collapse">
        <thead><tr className="bg-neutral-100 text-left"><th className="border border-neutral-300 p-2">Description</th><th className="w-40 border border-neutral-300 p-2 text-right">Amount (GHS)</th>{setDoc && <th className="w-10 border border-neutral-300" />}</tr></thead>
        <tbody>
          {d.lines.map((l, i) => <tr key={`${rev}-${i}`}>
            <td className="border border-neutral-300 p-2">{setDoc ? <input aria-label={`Line ${i + 1} description`} placeholder="Description" className={cn(box, "w-full")} value={l.description} onChange={(e) => setLines(d.lines.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} /> : l.description}</td>
            <td className="num border border-neutral-300 p-2 text-right">{setDoc ? <MoneyInput label={`Line ${i + 1} amount`} value={l.amount} onChange={(m) => setLines(d.lines.map((x, j) => (j === i ? { ...x, amount: m } : x)))} /> : amt(l.amount)}</td>
            {setDoc && <td className="border border-neutral-300 text-center"><button type="button" aria-label={`Remove line ${i + 1}`} className="rounded p-1.5 text-neutral-500 hover:text-red-600" onClick={() => { setLines(d.lines.filter((_, j) => j !== i)); setRev((r) => r + 1); }}><Trash2 size={14} /></button></td>}
          </tr>)}
          {setDoc && <tr><td colSpan={3} className="border border-neutral-300 p-1.5"><Button size="sm" variant="ghost" onClick={() => setLines([...d.lines, { description: "", amount: 0 }])}><Plus size={13} />Add line</Button></td></tr>}
        </tbody>
        <tfoot><tr className="font-bold"><td className="border border-neutral-300 p-2 text-right">Total</td><td className="num border border-neutral-300 p-2 text-right">{money(linesTotal(d.lines))}</td>{setDoc && <td className="border border-neutral-300" />}</tr></tfoot>
      </table>
      <div className="mt-4">{setDoc ? <textarea aria-label="Notes" className="h-20 w-full rounded-lg border border-line bg-surface p-2 text-sm" value={d.notes} onChange={(e) => setDoc({ ...d, notes: e.target.value })} />
        : d.notes && <p className="text-[11px] text-neutral-600">{d.notes}</p>}</div>
    </article>
  );
}
