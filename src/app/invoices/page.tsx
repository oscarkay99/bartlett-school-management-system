import { PageHeader } from "@/components/ui/primitives";
import { ClassInvoices } from "@/components/invoices/ClassInvoices";
import { SCHOOL, classes, feeSchedule } from "@/lib/data/queries";
import { classFees, feedingRate, findTerm } from "@/lib/fees";
import { DEFAULT_NOTES, INVOICE_TABS, mainLines, SMALL_NOTES, type ClassInvoice } from "@/lib/class-invoices";

export const metadata = { title: "Invoices — EduFlow" };

// Starting content only: each invoice is a copy of the current term's fees. Edits stay with the invoice and change nothing else.
function defaults(): Record<string, ClassInvoice> {
  const tf = findTerm(feeSchedule, SCHOOL.year, SCHOOL.term);
  return Object.fromEntries(INVOICE_TABS.map((t) => {
    // Extracurricular: a small invoice, printed 10 to an A4 sheet.
    if (!t.classId) return [t.id, { title: "Extracurricular", period: `${SCHOOL.term}, ${SCHOOL.year}`, notes: SMALL_NOTES,
      lines: tf ? Object.entries(tf.activities).map(([description, amount]) => ({ description, amount })) : [] }];
    // Classes: the full A4 school fees invoice, feeding included.
    const cls = classes.find((c) => c.id === t.classId)!;
    const fees = tf ? classFees(tf, cls, false).map((i) => ({ description: i.label, amount: i.amount })) : [];
    return [t.id, { title: `${t.label} School Fees`, period: `${SCHOOL.term}, ${SCHOOL.year} academic year`, notes: DEFAULT_NOTES, lines: mainLines(fees, tf ? feedingRate(tf, cls) : 0) }];
  }));
}

export default function InvoicesPage() {
  return (<>
    <PageHeader title="Invoices" sub="A school fees invoice for each class, plus Extracurricular (printed 10 to an A4 sheet). Edit any figure — nothing else in the system changes." />
    <ClassInvoices defaults={defaults()} school={{ name: SCHOOL.name, city: SCHOOL.city, phone: SCHOOL.phone, email: SCHOOL.email }} />
  </>);
}
