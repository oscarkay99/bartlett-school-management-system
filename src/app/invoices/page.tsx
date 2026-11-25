import { PageHeader } from "@/components/ui/primitives";
import { ClassInvoices } from "@/components/invoices/ClassInvoices";
import { SCHOOL, classes, feeSchedule } from "@/lib/data/queries";
import { classFees, feedingRate, findTerm } from "@/lib/fees";
import { DEFAULT_NOTES, INVOICE_TABS, mainLines, type ClassInvoice } from "@/lib/class-invoices";

export const metadata = { title: "Invoices — EduFlow" };

// Starting content only: each class sheet is a copy of the current term's fees. Edits stay with the sheet and change nothing else.
function defaults(): Record<string, ClassInvoice> {
  const tf = findTerm(feeSchedule, SCHOOL.year, SCHOOL.term);
  const period = `${SCHOOL.term}, ${SCHOOL.year} academic year`;
  return Object.fromEntries(INVOICE_TABS.map((t) => {
    const cls = classes.find((c) => c.id === t.classId)!;
    const fees = tf ? classFees(tf, cls, false).map((i) => ({ description: i.label, amount: i.amount })) : [];
    // Kindergarten pupils can only take Music (Piano).
    const acts = tf ? Object.entries(tf.activities).filter(([a]) => cls.level !== "Kindergarten" || a === "Music (Piano)") : [];
    return [t.id, {
      title: `${t.label} School Fees`, period, notes: DEFAULT_NOTES,
      lines: mainLines(fees, tf ? feedingRate(tf, cls) : 0),
      extraTitle: "Extracurricular Activities", extraLines: acts.map(([description, amount]) => ({ description, amount })),
    }];
  }));
}

export default function InvoicesPage() {
  return (<>
    <PageHeader title="Invoices" sub="One sheet per class for parents: the school fees invoice (with feeding) on the front, extracurricular on the back. Edit any figure — nothing else in the system changes." />
    <ClassInvoices defaults={defaults()} school={{ name: SCHOOL.name, city: SCHOOL.city, phone: SCHOOL.phone, email: SCHOOL.email }} />
  </>);
}
