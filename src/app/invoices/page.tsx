import { PageHeader } from "@/components/ui/primitives";
import { ClassInvoices } from "@/components/invoices/ClassInvoices";
import { SCHOOL, classes, feeSchedule } from "@/lib/data/queries";
import { classFees, findTerm } from "@/lib/fees";
import { DEFAULT_NOTES, INVOICE_TABS, type ClassInvoice } from "@/lib/class-invoices";

export const metadata = { title: "Invoices — EduFlow" };

// Starting content only: each invoice is a copy of the current term's fees. Edits are kept with the invoice and change nothing else.
function defaults(): Record<string, ClassInvoice> {
  const tf = findTerm(feeSchedule, SCHOOL.year, SCHOOL.term);
  const period = `${SCHOOL.term}, ${SCHOOL.year} academic year`;
  return Object.fromEntries(INVOICE_TABS.map((t) => {
    const cls = t.classId ? classes.find((c) => c.id === t.classId) : undefined;
    const lines = !tf ? [] : cls ? classFees(tf, cls, false).map((i) => ({ description: i.label, amount: i.amount })) : Object.entries(tf.activities).map(([a, amount]) => ({ description: a, amount }));
    return [t.id, { title: t.classId ? `${t.label} School Fees` : "Extracurricular Activities", period, lines, notes: DEFAULT_NOTES }];
  }));
}

export default function InvoicesPage() {
  return (<>
    <PageHeader title="Invoices" sub="One invoice per class, ready to print or send. Edit the lines and amounts as you need — nothing else in the system changes." />
    <ClassInvoices defaults={defaults()} school={{ name: SCHOOL.name, city: SCHOOL.city, phone: SCHOOL.phone, email: SCHOOL.email }} />
  </>);
}
