// Class invoices: one standalone invoice per class (KG 1 … JHS 3) plus one for extracurricular activities.
// Each is just a document the school types up and hands out. It is not linked to students, billing or the fee schedule:
// it starts as a copy of the current fees, and editing it changes nothing else. Pure helpers, safe on client and server.
import type { Minor } from "./money";

export interface InvoiceLine { description: string; amount: Minor }
export interface ClassInvoice { title: string; period: string; lines: InvoiceLine[]; notes: string }
export interface InvoiceTab { id: string; label: string; classId?: string }

/** Tab order. Primary classes are called "Class 1 … Class 6" here, as the school does on its invoices. */
export const INVOICE_TABS: InvoiceTab[] = [
  { id: "kg1", label: "KG 1", classId: "c1" }, { id: "kg2", label: "KG 2", classId: "c2" },
  ...[1, 2, 3, 4, 5, 6].map((n) => ({ id: `class${n}`, label: `Class ${n}`, classId: `c${n + 2}` })),
  { id: "jhs1", label: "JHS 1", classId: "c9" }, { id: "jhs2", label: "JHS 2", classId: "c10" }, { id: "jhs3", label: "JHS 3", classId: "c11" },
  { id: "extra", label: "Extracurricular" },
];

export const DEFAULT_NOTES = "Payment by Mobile Money or bank transfer. Use the student's name and class as the reference, and always collect an official receipt.";
export const invoiceTotal = (inv: ClassInvoice) => inv.lines.reduce((a, l) => a + (l.amount || 0), 0);

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

/** Blank description lines are dropped when saving. */
export const cleanInvoice = (inv: ClassInvoice): ClassInvoice => ({ ...inv, title: inv.title.trim(), period: inv.period.trim(), notes: inv.notes.trim(), lines: inv.lines.map((l) => ({ ...l, description: l.description.trim() })).filter((l) => l.description) });
