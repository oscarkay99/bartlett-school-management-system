// Class invoices: one full A4 school fees invoice per class (KG 1 … JHS 3), plus one small Extracurricular
// invoice (music, STEM…) listed after JHS 3 that prints 10 to an A4 sheet for cutting.
// Standalone documents: they start as a copy of the current fees and editing them changes nothing else.
// Pure helpers, safe on client and server.
import type { Minor } from "./money";

export interface InvoiceLine { description: string; amount: Minor }
export interface ClassInvoice { title: string; period: string; lines: InvoiceLine[]; notes: string }
/** A class tab has a classId; the Extracurricular tab does not. */
export interface InvoiceTab { id: string; label: string; classId?: string }

/** Tab order. Primary classes are called "Class 1 … Class 6" here, as the school does on its invoices. */
export const INVOICE_TABS: InvoiceTab[] = [
  { id: "kg1", label: "KG 1", classId: "c1" }, { id: "kg2", label: "KG 2", classId: "c2" },
  ...[1, 2, 3, 4, 5, 6].map((n) => ({ id: `class${n}`, label: `Class ${n}`, classId: `c${n + 2}` })),
  { id: "jhs1", label: "JHS 1", classId: "c9" }, { id: "jhs2", label: "JHS 2", classId: "c10" }, { id: "jhs3", label: "JHS 3", classId: "c11" },
  { id: "extra", label: "Extracurricular" },
];

/** How many small (Extracurricular) invoices print on one A4 page (2 across × 5 down). */
export const PER_PAGE = 10;
export const DEFAULT_NOTES = "Payment by Mobile Money or bank transfer. Use the student's name and class as the reference, and always collect an official receipt.";
/** Shorter note for the small Extracurricular invoice. */
export const SMALL_NOTES = "Pay by Mobile Money or bank transfer, quoting the student's name and class. Always collect an official receipt.";
/** Only the Extracurricular invoice (no classId) uses the small 10-per-A4 format. */
export const isSmall = (t: InvoiceTab) => !t.classId;
/** The school does not charge this yet (planned in about two years), so it starts at 0 and prints as "—". */
export const NOT_YET_BILLED = ["ICT & Development Levy"];

export const linesTotal = (lines: InvoiceLine[]) => lines.reduce((a, l) => a + (l.amount || 0), 0);
export const invoiceTotal = (inv: ClassInvoice) => linesTotal(inv.lines);

/**
 * School fees invoice lines for a class: its fee lines in order, with the not-yet-billed levies at 0
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
  return !!i && typeof i.title === "string" && typeof i.period === "string" && typeof i.notes === "string" && Array.isArray(i.lines) && i.lines.every(isLine);
};

/** Defaults plus invoices saved in this browser. Anything malformed or for an unknown tab is ignored. */
export function mergeInvoices(defaults: Record<string, ClassInvoice>, saved: unknown): Record<string, ClassInvoice> {
  if (!saved || typeof saved !== "object") return defaults;
  const out = { ...defaults };
  for (const [id, inv] of Object.entries(saved as Record<string, unknown>)) if (id in defaults && isInvoice(inv)) out[id] = inv;
  return out;
}

/** Blank description lines are dropped when saving; lines at 0 are kept (they print as "—"). */
export const cleanInvoice = (inv: ClassInvoice): ClassInvoice => ({
  ...inv, title: inv.title.trim(), period: inv.period.trim(), notes: inv.notes.trim(),
  lines: inv.lines.map((l) => ({ ...l, description: l.description.trim() })).filter((l) => l.description),
});
