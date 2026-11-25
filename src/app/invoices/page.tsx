import { PageHeader } from "@/components/ui/primitives";
import { ClassInvoices } from "@/components/invoices/ClassInvoices";
import { SCHOOL, classes, feeSchedule } from "@/lib/data/queries";
import { classFees, feedingRate, findTerm } from "@/lib/fees";
import { DEFAULT_NOTES, INVOICE_TABS, mainLines, type ClassInvoice } from "@/lib/class-invoices";

export const metadata = { title: "Invoices — EduFlow" };

// Starting content only: each invoice is a copy of the current term's fees. Edits stay with the invoice and change nothing else.
function defaults(): Record<string, ClassInvoice> {
  const tf = findTerm(feeSchedule, SCHOOL.year, SCHOOL.term);
  const period = `${SCHOOL.term}, ${SCHOOL.year}`;
  return Object.fromEntries(INVOICE_TABS.map((t) => {
    if (!t.classId) return [t.id, { title: "Extracurricular Activities", period, notes: DEFAULT_NOTES,
      lines: tf ? Object.entries(tf.activities).map(([description, amount]) => ({ description, amount })) : [] }];
    const cls = classes.find((c) => c.id === t.classId)!;
    const fees = tf ? classFees(tf, cls, false).map((i) => ({ description: i.label, amount: i.amount })) : [];
    // No class name on the invoice itself: the same small invoice is printed 10 to a page and handed out.
    return [t.id, { title: "School Fees", period, notes: DEFAULT_NOTES, lines: mainLines(fees, tf ? feedingRate(tf, cls) : 0) }];
  }));
}

export default function InvoicesPage() {
  return (<>
    <PageHeader title="Invoices" sub="One small invoice per class, plus extracurricular. Edit any figure, then print 10 to an A4 sheet and cut — nothing else in the system changes." />
    <ClassInvoices defaults={defaults()} school={{ name: SCHOOL.name, phone: SCHOOL.phone, email: SCHOOL.email }} />
  </>);
}
