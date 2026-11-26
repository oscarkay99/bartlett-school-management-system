"use client";
import { useMemo } from "react";
import { LIVE } from "@/lib/live/config";
import { useLiveData } from "@/lib/live/data";
import { useSave } from "@/lib/live/useSave";
import { liveExtra } from "@/lib/live/hydrate";
import { approveInvoices, createInvoices, discardInvoices } from "@/lib/live/actions";
import * as Q from "@/lib/data/queries";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/interactive";
import { SchoolLogo } from "@/components/SchoolLogo";
import { NOT_YET_BILLED } from "@/lib/class-invoices";
import { generatedTotal, readGenerated, type GeneratedInvoice } from "@/lib/generated-invoices";
import { termKey } from "@/lib/fees";
import { money } from "@/lib/money";
import { fmtDateLong } from "@/lib/utils";
import { SCHOOL } from "@/lib/data/seed";

const KEY = "generated-invoices-v1";
const load = (): Record<string, unknown> => { try { return JSON.parse(localStorage.getItem(KEY) ?? "{}") ?? {}; } catch { return {}; } };

/** School fees invoices generated for one term, kept in this browser (front-end stand-in until the backend stores them). */
/** The term's school fees invoices that are not issued yet. Live: drafts / awaiting the Owner's approval in the database.
 *  Demo: kept in this browser. `approve` is Owner-only (the database refuses anyone else). */
export function useGeneratedInvoices(year: string, term: string) { return useGeneratedImpl(year, term); }

function useLiveGenerated(year: string, term: string) {
  const { version } = useLiveData(); const run = useSave();
  const drafts = useMemo(() => (liveExtra.data?.drafts ?? []).filter((d) => d.account === "fees" && d.year === year && d.term === term), [version, year, term]);   // eslint-disable-line react-hooks/exhaustive-deps
  const list: GeneratedInvoice[] = drafts.map((d) => { const s = Q.getStudent(d.studentId);
    return { no: `${d.status === "submitted" ? "Awaiting approval" : "Draft"} · ${d.id.slice(0, 4).toUpperCase()}`, year, term, studentId: d.studentId, name: s ? Q.fullName(s) : "", adm: s?.admissionNo ?? "",
      classId: s?.classId ?? "", items: d.items, discount: 0, billedOn: "", dueOn: "" }; });
  return { list, live: true as const, awaiting: drafts.filter((d) => d.status === "submitted").length,
    add: (inv: GeneratedInvoice[]) => { void run(() => createInvoices(inv.map((i) => ({ studentId: i.studentId, account: "fees", year, term, items: i.items, dueOn: i.dueOn, discount: i.discount }))), `${inv.length} invoices sent to the Owner for approval`); },
    clear: () => { void run(() => discardInvoices(drafts.map((d) => d.id)), "Invoices not yet approved were discarded"); },
    approve: () => { void run(() => approveInvoices(drafts.filter((d) => d.status === "submitted").map((d) => d.id)), "Invoices approved and issued — numbers assigned"); } };
}

function useDemoGenerated(year: string, term: string) {
  const key = termKey(year, term);
  const [list, setList] = useState<GeneratedInvoice[]>([]);
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => { setList(readGenerated(load()[key])); }, [key]);
  /* eslint-enable react-hooks/set-state-in-effect */
  const save = useCallback((next: GeneratedInvoice[]) => {
    setList(next);
    try { const all = load(); if (next.length) all[key] = next; else delete all[key]; localStorage.setItem(KEY, JSON.stringify(all)); } catch {}
  }, [key]);
  return { list, live: false as const, awaiting: 0, add: (inv: GeneratedInvoice[]) => save([...list, ...inv]), clear: () => save([]), approve: () => {} };
}

// The invoice as parents get it, same layout as the printed school fees invoice. Print / Save PDF prints only this.
export function GeneratedInvoiceDialog({ inv, cls, onClose }: { inv: GeneratedInvoice; cls: string; onClose: () => void }) {
  const school = SCHOOL;
  const rows = [...inv.items];
  for (const label of NOT_YET_BILLED) if (!rows.some((r) => r.label === label)) rows.splice(Math.min(2, rows.length), 0, { label, amount: 0 });
  const gross = inv.items.reduce((a, i) => a + i.amount, 0);
  const print = () => {
    document.documentElement.classList.add("print-invoice");
    const done = () => { document.documentElement.classList.remove("print-invoice"); window.removeEventListener("afterprint", done); };
    window.addEventListener("afterprint", done); window.print();
  };
  const doc = (
    <article className="invoice-sheet bg-white text-[12px] leading-relaxed text-neutral-900">
      <header className="flex items-center justify-between gap-4 border-b-2 border-neutral-900 pb-3">
        <div className="flex items-center gap-3"><SchoolLogo size={56} /><div><div className="text-base font-bold">{school.name}</div><div className="text-[11px] text-neutral-600">{school.city} · {school.phone} · {school.email}</div></div></div>
        <div className="max-w-[45%] text-right text-lg font-bold uppercase leading-tight tracking-wide">School Fees Invoice</div>
      </header>
      <div className="mt-4 grid grid-cols-2 gap-6"><div><div className="text-[10px] uppercase text-neutral-500">Student</div><b>{inv.name}</b><div>{inv.adm} · {cls}</div></div>
        <div className="text-right"><div>Invoice <b>{inv.no}</b></div><div>School Fees · {inv.term}, {inv.year}</div><div>Billing date: {fmtDateLong(inv.billedOn)}</div><div>Due date: <b>{fmtDateLong(inv.dueOn)}</b></div></div></div>
      <table className="mt-6 w-full border-collapse"><thead><tr className="bg-neutral-100 text-left"><th className="border border-neutral-300 p-2">Description</th><th className="border border-neutral-300 p-2 text-right">Amount (GH₵)</th></tr></thead>
        <tbody>{rows.map((it) => <tr key={it.label}><td className="border border-neutral-300 p-2">{it.label}</td><td className="border border-neutral-300 p-2 text-right">{it.amount ? money(it.amount) : "—"}</td></tr>)}</tbody>
        <tfoot>{[["Subtotal", money(gross)], ...(inv.discount ? [["Scholarship on tuition", `− ${money(inv.discount)}`]] : []), ["Total due", money(generatedTotal(inv))]].map(([k, v]) => <tr key={k} className={k === "Total due" ? "font-bold" : ""}><td className="border border-neutral-300 p-2 text-right">{k}</td><td className="border border-neutral-300 p-2 text-right">{v}</td></tr>)}</tfoot></table>
      <p className="mt-6 text-[11px] text-neutral-600">Payment instructions: pay via Mobile Money or bank transfer using the invoice number as reference. Always request an official receipt.</p>
    </article>
  );
  return (
    <Modal open onClose={onClose} title={`Invoice ${inv.no}`} wide footer={<><Button onClick={onClose}>Close</Button><Button variant="primary" onClick={print}><Printer size={14} />Print / Save PDF</Button></>}>
      {doc}
      {createPortal(<div className="print-root"><style>{"@page { size: A4; margin: 0; }"}</style>{doc}</div>, document.body)}
    </Modal>
  );
}

// LIVE is fixed per build, so the same hook always runs.
const useGeneratedImpl = LIVE ? useLiveGenerated : useDemoGenerated;
