// Class invoices: what the school hands parents each term, one sheet per class (KG 1 … JHS 3).
// Front of the A4 sheet: the main invoice — tuition, books, levies, PTA and FEEDING, with a total.
// Back of the sheet: a small second invoice for extracurricular activities (music, STEM…).
// Standalone documents: they start as a copy of the current fees and editing them changes nothing else.
// Pure helpers, safe on client and server.
import type { Minor } from "./money";

export interface InvoiceLine { description: string; amount: Minor }
export interface ClassInvoice {
  title: string; period: string; lines: InvoiceLine[]; notes: string;
  /** The small invoice on the back of the sheet. */
  extraTitle: string; extraLines: InvoiceLine[];
}
export interface InvoiceTab { id: string; label: string; classId: string }

/** Tab order. Primary classes are called "Class 1 … Class 6" here, as the school does on its invoices. */
export const INVOICE_TABS: InvoiceTab[] = [
  { id: "kg1", label: "KG 1", classId: "c1" }, { id: "kg2", label: "KG 2", classId: "c2" },
  ...[1, 2, 3, 4, 5, 6].map((n) => ({ id: `class${n}`, label: `Class ${n}`, classId: `c${n + 2}` })),
  { id: "jhs1", label: "JHS 1", classId: "c9" }, { id: "jhs2", label: "JHS 2", classId: "c10" }, { id: "jhs3", label: "JHS 3", classId: "c11" },
];

export const DEFAULT_NOTES = "Payment by Mobile Money or bank transfer. Use the student's name and class as the reference, and always collect an official receipt.";
/** The school does not charge this yet (planned in about two years), so it starts at 0 and prints as "—". */
export const NOT_YET_BILLED = ["ICT & Development Levy"];

export const linesTotal = (lines: InvoiceLine[]) => lines.reduce((a, l) => a + (l.amount || 0), 0);
export const invoiceTotal = (inv: ClassInvoice) => linesTotal(inv.lines);
export const extraTotal = (inv: ClassInvoice) => linesTotal(inv.extraLines);

/**
 * Main-invoice lines for a class: its school-fee lines in order, with the not-yet-billed levies at 0
 * (kept on the invoice so parents see them as "—"), then feeding.
 */
export function mainLines(fees: InvoiceLine[], feeding: Minor): InvoiceLine[] {
  const lines = fees.map((l) => (NOT_YET_BILLED.includes(l.description) ? { ...l, amount: 0 } : l));
  for (const d of NOT_YET_BILLED) if (!lines.some((l) => l.description === d)) lines.splice(Math.min(2, lines.length), 0, { description: d, amount: 0 });
  return [...lines, { description: "Feeding", amount: feeding }];
}

const isLine = (l: unknown): l is InvoiceLine => !!l && typeof (l as InvoiceLine).description === "string" && Number.isInteger((l as InvoiceLine).amount) && (l as InvoiceLine).amount >= 0;
const isInvoice = (v: unknown): v is ClassInvoice => {
  const i = v as ClassInvoice;
  return !!i && typeof i.title === "string" && typeof i.period === "string" && typeof i.notes === "string" && typeof i.extraTitle === "string"
    && Array.isArray(i.lines) && i.lines.every(isLine) && Array.isArray(i.extraLines) && i.extraLines.every(isLine);
};

/** Defaults plus invoices saved in this browser. Anything malformed, from an older layout, or for an unknown tab is ignored. */
export function mergeInvoices(defaults: Record<string, ClassInvoice>, saved: unknown): Record<string, ClassInvoice> {
  if (!saved || typeof saved !== "object") return defaults;
  const out = { ...defaults };
  for (const [id, inv] of Object.entries(saved as Record<string, unknown>)) if (id in defaults && isInvoice(inv)) out[id] = inv;
  return out;
}

/** Blank description lines are dropped when saving; lines at 0 are kept (they print as "—"). */
export function cleanInvoice(inv: ClassInvoice): ClassInvoice {
  const clean = (ls: InvoiceLine[]) => ls.map((l) => ({ ...l, description: l.description.trim() })).filter((l) => l.description);
  return { ...inv, title: inv.title.trim(), period: inv.period.trim(), notes: inv.notes.trim(), extraTitle: inv.extraTitle.trim(), lines: clean(inv.lines), extraLines: clean(inv.extraLines) };
}
