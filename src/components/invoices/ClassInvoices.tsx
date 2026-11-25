"use client";
import { useEffect, useState } from "react";
import { Eye, Pencil, Plus, Printer, RotateCcw, Trash2 } from "lucide-react";
import { Badge, Button, Card } from "@/components/ui/primitives";
import { Modal, MoneyInput, useToast } from "@/components/ui/interactive";
import { SchoolLogo } from "@/components/SchoolLogo";
import { useRole } from "@/components/shell/AppShell";
import { cleanInvoice, INVOICE_TABS, invoiceTotal, mergeInvoices, type ClassInvoice } from "@/lib/class-invoices";
import { money } from "@/lib/money";
import { cn } from "@/lib/utils";

const KEY = "class-invoices-v1";
type School = { name: string; city: string; phone: string; email: string };
const box = "h-9 rounded-lg border border-line bg-surface px-2.5 text-sm placeholder:text-muted/60 focus:border-info focus:outline-none focus:ring-2 focus:ring-info/30";

// Invoices page: a tab per class (plus Extracurricular), each with one invoice that opens in a pop-up.
// Front-end stand-in: edits are kept in this browser (localStorage) until the backend stores them.
export function ClassInvoices({ defaults, school }: { defaults: Record<string, ClassInvoice>; school: School }) {
  const [invoices, setInvoices] = useState(defaults);
  const [tab, setTab] = useState(INVOICE_TABS[0].id); const [open, setOpen] = useState(false);
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => { try { setInvoices(mergeInvoices(defaults, JSON.parse(localStorage.getItem(KEY) ?? "null"))); } catch {} }, [defaults]);
  /* eslint-enable react-hooks/set-state-in-effect */
  const persist = (next: Record<string, ClassInvoice>) => {
    setInvoices(next);
    // Only invoices that differ from their starting copy are stored.
    try { localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(Object.entries(next).filter(([id, inv]) => JSON.stringify(inv) !== JSON.stringify(defaults[id]))))); } catch {}
  };
  const t = INVOICE_TABS.find((x) => x.id === tab)!; const inv = invoices[tab];
  const edited = JSON.stringify(inv) !== JSON.stringify(defaults[tab]);

  return (
    <div className="grid gap-4 md:grid-cols-[240px_1fr]">
      <nav aria-label="Classes" className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
        {INVOICE_TABS.map((x) => (
          <button key={x.id} onClick={() => setTab(x.id)} aria-current={tab === x.id ? "page" : undefined}
            className={cn("flex shrink-0 items-center justify-between gap-3 whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm transition", tab === x.id ? "bg-info/10 font-semibold text-info" : "text-fg hover:bg-surface-2", x.id === "extra" && "md:mt-2 md:border-t md:border-line md:pt-3")}>
            <span>{x.label}</span><span className="num hidden text-xs font-normal text-muted md:inline">{money(invoiceTotal(invoices[x.id]))}</span>
          </button>))}
      </nav>
      <Card className="self-start">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div><div className="flex items-center gap-2"><h2 className="font-semibold">{t.label} invoice</h2>{edited && <Badge tone="info">Edited</Badge>}</div>
            <p className="text-sm text-muted">{inv.title} · {inv.period}</p></div>
          <div className="text-right"><div className="text-xs text-muted">Total</div><div className="num text-xl font-semibold">{money(invoiceTotal(inv))}</div></div>
        </div>
        <ul className="divide-y divide-line border-t border-line text-sm">{inv.lines.map((l, i) => <li key={i} className="flex justify-between gap-3 px-4 py-2"><span>{l.description}</span><span className="num">{money(l.amount)}</span></li>)}
          {inv.lines.length === 0 && <li className="px-4 py-3 text-muted">No lines yet. Open the invoice to add them.</li>}</ul>
        <div className="border-t border-line p-4"><Button variant="primary" onClick={() => setOpen(true)}><Eye size={14} />View invoice</Button></div>
      </Card>
      {open && <InvoiceDialog key={tab} label={t.label} invoice={inv} original={defaults[tab]} school={school} onClose={() => setOpen(false)} onSave={(v) => persist({ ...invoices, [tab]: v })} />}
    </div>
  );
}

function InvoiceDialog({ label, invoice, original, school, onClose, onSave }: { label: string; invoice: ClassInvoice; original: ClassInvoice; school: School; onClose: () => void; onSave: (inv: ClassInvoice) => void }) {
  const { allow } = useRole(); const canEdit = allow("invoices", "create"); const toast = useToast();
  const [draft, setDraft] = useState<ClassInvoice | null>(null); const [rev, setRev] = useState(0);
  const doc = draft ?? invoice;
  const setLine = (i: number, patch: Partial<ClassInvoice["lines"][number]>) => draft && setDraft({ ...draft, lines: draft.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) });
  const print = () => { document.documentElement.classList.add("print-invoice"); const done = () => { document.documentElement.classList.remove("print-invoice"); window.removeEventListener("afterprint", done); }; window.addEventListener("afterprint", done); window.print(); };
  const footer = draft ? <>
      <Button variant="ghost" className="mr-auto" onClick={() => { setDraft(structuredClone(original)); setRev((r) => r + 1); }}><RotateCcw size={14} />Reset to current fees</Button>
      <Button onClick={() => setDraft(null)}>Cancel</Button>
      <Button variant="primary" onClick={() => { onSave(cleanInvoice(draft)); setDraft(null); toast(`${label} invoice saved`); }}>Save invoice</Button></>
    : <>{canEdit && <Button className="mr-auto" onClick={() => setDraft(structuredClone(invoice))}><Pencil size={14} />Edit</Button>}<Button onClick={onClose}>Close</Button><Button variant="primary" onClick={print}><Printer size={14} />Print / Save PDF</Button></>;

  return (
    <Modal open onClose={onClose} title={`${label} invoice`} wide footer={footer}>
      <style>{"@page { size: A4; margin: 0; }"}</style>
      {/* The document itself; when printing, only this is shown (see .print-invoice in globals.css). */}
      <article className="invoice-doc bg-white text-[13px] leading-relaxed text-neutral-900">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-neutral-900 pb-3">
          <div className="flex items-center gap-3"><SchoolLogo size={60} /><div><div className="text-base font-bold">{school.name}</div><div className="text-[11px] text-neutral-600">{school.city}</div><div className="text-[11px] text-neutral-600">{school.phone} · {school.email}</div></div></div>
          <div className="text-right text-xl font-bold tracking-wide">INVOICE</div>
        </header>
        <div className="mt-4 space-y-1">
          {draft ? <>
            <input aria-label="Invoice title" className={cn(box, "w-full font-semibold")} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            <input aria-label="Term and year" className={cn(box, "w-full")} value={draft.period} onChange={(e) => setDraft({ ...draft, period: e.target.value })} />
          </> : <><div className="text-[15px] font-semibold">{doc.title}</div><div className="text-neutral-600">{doc.period}</div></>}
        </div>
        <table className="mt-4 w-full border-collapse">
          <thead><tr className="bg-neutral-100 text-left"><th className="border border-neutral-300 p-2">Description</th><th className="w-40 border border-neutral-300 p-2 text-right">Amount (GHS)</th>{draft && <th className="w-10 border border-neutral-300" />}</tr></thead>
          <tbody>
            {doc.lines.map((l, i) => <tr key={`${rev}-${i}`}>
              <td className="border border-neutral-300 p-2">{draft ? <input aria-label={`Line ${i + 1} description`} placeholder="Description" className={cn(box, "w-full")} value={l.description} onChange={(e) => setLine(i, { description: e.target.value })} /> : l.description}</td>
              <td className="num border border-neutral-300 p-2 text-right">{draft ? <MoneyInput label={`Line ${i + 1} amount`} value={l.amount} onChange={(m) => setLine(i, { amount: m })} /> : money(l.amount)}</td>
              {draft && <td className="border border-neutral-300 text-center"><button type="button" aria-label={`Remove line ${i + 1}`} className="rounded p-1.5 text-neutral-500 hover:text-red-600" onClick={() => { setDraft({ ...draft, lines: draft.lines.filter((_, j) => j !== i) }); setRev((r) => r + 1); }}><Trash2 size={14} /></button></td>}
            </tr>)}
            {draft && <tr><td colSpan={3} className="border border-neutral-300 p-1.5"><Button size="sm" variant="ghost" onClick={() => setDraft({ ...draft, lines: [...draft.lines, { description: "", amount: 0 }] })}><Plus size={13} />Add line</Button></td></tr>}
          </tbody>
          <tfoot><tr className="font-bold"><td className="border border-neutral-300 p-2 text-right">Total</td><td className="num border border-neutral-300 p-2 text-right">{money(invoiceTotal(doc))}</td>{draft && <td className="border border-neutral-300" />}</tr></tfoot>
        </table>
        <div className="mt-4">{draft ? <textarea aria-label="Notes" className="h-20 w-full rounded-lg border border-line bg-surface p-2 text-sm" value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
          : doc.notes && <p className="text-[11px] text-neutral-600">{doc.notes}</p>}</div>
      </article>
    </Modal>
  );
}
