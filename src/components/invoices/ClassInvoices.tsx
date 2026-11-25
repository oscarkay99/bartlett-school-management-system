"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Eye, Pencil, Plus, Printer, RotateCcw, Trash2 } from "lucide-react";
import { Badge, Button, Card } from "@/components/ui/primitives";
import { Modal, MoneyInput, useToast } from "@/components/ui/interactive";
import { SchoolLogo } from "@/components/SchoolLogo";
import { useRole } from "@/components/shell/AppShell";
import { cleanInvoice, INVOICE_TABS, invoiceTotal, linesTotal, mergeInvoices, type ClassInvoice, type InvoiceLine } from "@/lib/class-invoices";
import { money } from "@/lib/money";
import { cn } from "@/lib/utils";

const KEY = "class-invoices-v2";
type School = { name: string; city: string; phone: string; email: string };
const box = "h-9 rounded-lg border border-line bg-surface px-2.5 text-sm placeholder:text-muted/60 focus:border-info focus:outline-none focus:ring-2 focus:ring-info/30";
/** 0 prints as a dash: the line is on the invoice but not charged (e.g. ICT levy, not billed yet). */
const amt = (m: number) => (m ? money(m) : "—");

// Invoices page: a tab per class. Each holds one sheet for parents — the school fees invoice (feeding included)
// on the front and a small extracurricular invoice on the back. Edits are kept in this browser until the backend stores them.
export function ClassInvoices({ defaults, school }: { defaults: Record<string, ClassInvoice>; school: School }) {
  const [invoices, setInvoices] = useState(defaults);
  const [tab, setTab] = useState(INVOICE_TABS[0].id); const [open, setOpen] = useState(false);
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => { try { setInvoices(mergeInvoices(defaults, JSON.parse(localStorage.getItem(KEY) ?? "null"))); } catch {} }, [defaults]);
  /* eslint-enable react-hooks/set-state-in-effect */
  const persist = (next: Record<string, ClassInvoice>) => {
    setInvoices(next);
    // Only sheets that differ from their starting copy are stored.
    try { localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(Object.entries(next).filter(([id, inv]) => JSON.stringify(inv) !== JSON.stringify(defaults[id]))))); } catch {}
  };
  const t = INVOICE_TABS.find((x) => x.id === tab)!; const inv = invoices[tab];
  const edited = JSON.stringify(inv) !== JSON.stringify(defaults[tab]);

  return (
    <div className="grid gap-4 md:grid-cols-[220px_1fr]">
      <nav aria-label="Classes" className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
        {INVOICE_TABS.map((x) => (
          <button key={x.id} onClick={() => setTab(x.id)} aria-current={tab === x.id ? "page" : undefined}
            className={cn("flex shrink-0 items-center justify-between gap-3 whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm transition", tab === x.id ? "bg-info/10 font-semibold text-info" : "text-fg hover:bg-surface-2")}>
            <span>{x.label}</span><span className="num hidden text-xs font-normal text-muted md:inline">{money(invoiceTotal(invoices[x.id]))}</span>
          </button>))}
      </nav>
      <Card className="self-start">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div><div className="flex items-center gap-2"><h2 className="font-semibold">{t.label}</h2>{edited && <Badge tone="info">Edited</Badge>}</div><p className="text-sm text-muted">{inv.period}</p></div>
          <Button variant="primary" onClick={() => setOpen(true)}><Eye size={14} />View invoice</Button>
        </div>
        <Summary title={inv.title} lines={inv.lines} />
        <Summary title={`${inv.extraTitle} · back of sheet`} lines={inv.extraLines} muted />
      </Card>
      {open && <InvoiceDialog key={tab} label={t.label} invoice={inv} original={defaults[tab]} school={school} onClose={() => setOpen(false)} onSave={(v) => persist({ ...invoices, [tab]: v })} />}
    </div>
  );
}

function Summary({ title, lines, muted }: { title: string; lines: InvoiceLine[]; muted?: boolean }) {
  return (
    <div className="border-t border-line">
      <div className={cn("flex items-center justify-between px-4 pt-3 text-sm font-medium", muted && "text-muted")}><span>{title}</span><span className="num">{money(linesTotal(lines))}</span></div>
      <ul className="px-4 pb-3 pt-1 text-sm">{lines.map((l, i) => <li key={i} className="flex justify-between gap-3 py-0.5 text-muted"><span>{l.description}</span><span className="num">{amt(l.amount)}</span></li>)}
        {lines.length === 0 && <li className="py-0.5 text-muted">No lines. Open the invoice to add them.</li>}</ul>
    </div>
  );
}

function InvoiceDialog({ label, invoice, original, school, onClose, onSave }: { label: string; invoice: ClassInvoice; original: ClassInvoice; school: School; onClose: () => void; onSave: (inv: ClassInvoice) => void }) {
  const { allow } = useRole(); const canEdit = allow("invoices", "create"); const toast = useToast();
  const [draft, setDraft] = useState<ClassInvoice | null>(null); const [rev, setRev] = useState(0);
  const doc = draft ?? invoice; const edit = draft ? { rev, set: setDraft, setRev } : undefined;
  const print = () => {
    document.documentElement.classList.add("print-invoice");
    const done = () => { document.documentElement.classList.remove("print-invoice"); window.removeEventListener("afterprint", done); };
    window.addEventListener("afterprint", done); window.print();
  };
  const footer = draft ? <>
      <Button variant="ghost" className="mr-auto" onClick={() => { setDraft(structuredClone(original)); setRev((r) => r + 1); }}><RotateCcw size={14} />Reset to current fees</Button>
      <Button onClick={() => setDraft(null)}>Cancel</Button>
      <Button variant="primary" onClick={() => { onSave(cleanInvoice(draft)); setDraft(null); toast(`${label} invoice saved`); }}>Save invoice</Button></>
    : <>{canEdit && <Button className="mr-auto" onClick={() => setDraft(structuredClone(invoice))}><Pencil size={14} />Edit figures</Button>}<Button onClick={onClose}>Close</Button><Button variant="primary" onClick={print}><Printer size={14} />Print / Save PDF</Button></>;

  return (
    <Modal open onClose={onClose} title={`${label} invoice`} wide footer={footer}>
      <div className="space-y-4">
        <MainSheet school={school} doc={doc} edit={edit} />
        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted"><span className="h-px flex-1 bg-line" />Back of the sheet<span className="h-px flex-1 bg-line" /></div>
        <ExtraSheet school={school} doc={doc} edit={edit} />
      </div>
      {/* Print copy: front and back as two A4 pages. Only this is printed (see .print-root in globals.css). */}
      {createPortal(<div className="print-root"><style>{"@page { size: A4; margin: 0; }"}</style><MainSheet school={school} doc={invoice} /><ExtraSheet school={school} doc={invoice} /></div>, document.body)}
    </Modal>
  );
}

type Edit = { rev: number; set: (d: ClassInvoice) => void; setRev: (f: (r: number) => number) => void };

function Letterhead({ school, small }: { school: School; small?: boolean }) {
  return (
    <header className={cn("flex items-center justify-between gap-3 border-b-2 border-neutral-900", small ? "pb-2" : "pb-3")}>
      <div className="flex items-center gap-3"><SchoolLogo size={small ? 40 : 60} /><div><div className={cn("font-bold", small ? "text-sm" : "text-base")}>{school.name}</div><div className="text-[11px] text-neutral-600">{school.city}</div>{!small && <div className="text-[11px] text-neutral-600">{school.phone} · {school.email}</div>}</div></div>
      <div className={cn("text-right font-bold tracking-wide", small ? "text-base" : "text-xl")}>INVOICE</div>
    </header>
  );
}

// Front: the school fees invoice, feeding included.
function MainSheet({ school, doc: d, edit }: { school: School; doc: ClassInvoice; edit?: Edit }) {
  return (
    <article className="invoice-sheet bg-white text-[13px] leading-relaxed text-neutral-900">
      <Letterhead school={school} />
      <div className="mt-4 space-y-1">
        {edit ? <>
          <input aria-label="Invoice title" className={cn(box, "w-full font-semibold")} value={d.title} onChange={(e) => edit.set({ ...d, title: e.target.value })} />
          <input aria-label="Term and year" className={cn(box, "w-full")} value={d.period} onChange={(e) => edit.set({ ...d, period: e.target.value })} />
        </> : <><div className="text-[15px] font-semibold">{d.title}</div><div className="text-neutral-600">{d.period}</div></>}
      </div>
      <Lines lines={d.lines} edit={edit && { ...edit, onChange: (lines) => edit.set({ ...d, lines }) }} name="Line" />
      <div className="mt-4">{edit ? <textarea aria-label="Notes" className="h-20 w-full rounded-lg border border-line bg-surface p-2 text-sm" value={d.notes} onChange={(e) => edit.set({ ...d, notes: e.target.value })} />
        : d.notes && <p className="text-[11px] text-neutral-600">{d.notes}</p>}</div>
    </article>
  );
}

// Back: the small extracurricular invoice.
function ExtraSheet({ school, doc: d, edit }: { school: School; doc: ClassInvoice; edit?: Edit }) {
  return (
    <article className="invoice-sheet bg-white text-[13px] leading-relaxed text-neutral-900">
      <Letterhead school={school} small />
      <div className="mt-3 space-y-1">
        {edit ? <input aria-label="Second invoice title" className={cn(box, "w-full font-semibold")} value={d.extraTitle} onChange={(e) => edit.set({ ...d, extraTitle: e.target.value })} />
          : <><div className="font-semibold">{d.extraTitle}</div><div className="text-neutral-600">{d.title.replace(/ School Fees$/, "")} · {d.period}</div></>}
      </div>
      <Lines lines={d.extraLines} edit={edit && { ...edit, onChange: (extraLines) => edit.set({ ...d, extraLines }) }} name="Activity" />
    </article>
  );
}

function Lines({ lines, edit, name }: { lines: InvoiceLine[]; edit?: Edit & { onChange: (l: InvoiceLine[]) => void }; name: string }) {
  const set = (i: number, patch: Partial<InvoiceLine>) => edit?.onChange(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  return (
    <table className="mt-3 w-full border-collapse">
      <thead><tr className="bg-neutral-100 text-left"><th className="border border-neutral-300 p-2">Description</th><th className="w-40 border border-neutral-300 p-2 text-right">Amount (GHS)</th>{edit && <th className="w-10 border border-neutral-300" />}</tr></thead>
      <tbody>
        {lines.map((l, i) => <tr key={`${edit?.rev ?? 0}-${i}`}>
          <td className="border border-neutral-300 p-2">{edit ? <input aria-label={`${name} ${i + 1} description`} placeholder="Description" className={cn(box, "w-full")} value={l.description} onChange={(e) => set(i, { description: e.target.value })} /> : l.description}</td>
          <td className="num border border-neutral-300 p-2 text-right">{edit ? <MoneyInput label={`${name} ${i + 1} amount`} value={l.amount} onChange={(m) => set(i, { amount: m })} /> : amt(l.amount)}</td>
          {edit && <td className="border border-neutral-300 text-center"><button type="button" aria-label={`Remove ${name.toLowerCase()} ${i + 1}`} className="rounded p-1.5 text-neutral-500 hover:text-red-600" onClick={() => { edit.onChange(lines.filter((_, j) => j !== i)); edit.setRev((r) => r + 1); }}><Trash2 size={14} /></button></td>}
        </tr>)}
        {edit && <tr><td colSpan={3} className="border border-neutral-300 p-1.5"><Button size="sm" variant="ghost" onClick={() => edit.onChange([...lines, { description: "", amount: 0 }])}><Plus size={13} />Add {name.toLowerCase()}</Button></td></tr>}
      </tbody>
      <tfoot><tr className="font-bold"><td className="border border-neutral-300 p-2 text-right">Total</td><td className="num border border-neutral-300 p-2 text-right">{money(linesTotal(lines))}</td>{edit && <td className="border border-neutral-300" />}</tr></tfoot>
    </table>
  );
}
