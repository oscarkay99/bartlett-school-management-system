// School fees invoices created with "Generate Term N invoices" on the School Fees page.
// Built from the fee schedule for that term: the class's lines, boarding for boarders, then feeding,
// with a 25% tuition discount for scholarship students (as on seeded invoices). Pure helpers, safe on client and server.
// Front-end stand-in: the page keeps these in the browser until the backend stores invoices.
import { invoiceStem, sumItems, termBillLines, type ClassRef, type FeeItem, type TermFees } from "./fees";

export interface GenCandidate { id: string; name: string; adm: string; classId: string; boarding: boolean; scholarship: boolean }
export interface GeneratedInvoice {
  no: string; year: string; term: string; studentId: string; name: string; adm: string; classId: string;
  items: FeeItem[]; discount: number; billedOn: string; dueOn: string;
}

export const SCHOLARSHIP_SHARE = 0.25;
export const generatedTotal = (i: GeneratedInvoice) => sumItems(i.items) - i.discount;

const addDays = (iso: string, n: number) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

/**
 * One invoice per candidate, numbered after `startSeq` (e.g. INV-2627-T2-0001 …).
 * Billed on the term's first day, due four weeks later. Candidates whose class is unknown are skipped.
 */
export function buildTermInvoices(candidates: GenCandidate[], classes: ClassRef[], tf: TermFees, termStart: string, startSeq = 0): GeneratedInvoice[] {
  const stem = invoiceStem("INV", tf.year, tf.term); let seq = startSeq;
  return candidates.flatMap((c) => {
    const cls = classes.find((x) => x.id === c.classId); if (!cls) return [];
    const items = termBillLines(tf, cls, c.boarding);
    const tuition = items.find((i) => i.label === "Tuition")?.amount ?? 0;
    return [{ no: `${stem}-${String(++seq).padStart(4, "0")}`, year: tf.year, term: tf.term, studentId: c.id, name: c.name, adm: c.adm, classId: c.classId,
      items, discount: c.scholarship ? Math.round(tuition * SCHOLARSHIP_SHARE) : 0, billedOn: termStart, dueOn: addDays(termStart, 28) }];
  });
}

/** Saved invoices for one term, ignoring anything malformed. */
export function readGenerated(saved: unknown): GeneratedInvoice[] {
  if (!Array.isArray(saved)) return [];
  return saved.filter((i): i is GeneratedInvoice => !!i && typeof i.no === "string" && typeof i.studentId === "string" && Array.isArray(i.items)
    && i.items.every((x: FeeItem) => x && typeof x.label === "string" && Number.isInteger(x.amount)) && Number.isInteger(i.discount));
}
