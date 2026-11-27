"use client";
import { useLiveData } from "@/lib/live/data";
import { PageHeader } from "@/components/ui/primitives";
import { ClassInvoices } from "@/components/invoices/ClassInvoices";
import { SCHOOL, classes, feeSchedule } from "@/lib/data/queries";
import { classFees, findTerm } from "@/lib/fees";
import { DEFAULT_NOTES, INVOICE_TABS, mainLines, SMALL_NOTES, type ClassInvoice } from "@/lib/class-invoices";
import { activitiesOf } from "@/lib/accounts";


// Starting content only: each invoice is a copy of the current term's fees. Edits stay with the invoice and change nothing else.
function defaults(): Record<string, ClassInvoice> {
  const tf = findTerm(feeSchedule, SCHOOL.year, SCHOOL.term);
  // Only the classes the school has (e.g. no Creche tab until a Creche class exists).
  return Object.fromEntries(INVOICE_TABS.filter((t) => !t.classId || classes.some((c) => c.id === t.classId)).map((t) => {
    // Extracurricular / Extra Classes: small invoices, printed 10 to an A4 sheet.
    if (!t.classId) return [t.id, { title: t.label, period: `${SCHOOL.term}, ${SCHOOL.year}`, notes: SMALL_NOTES,
      lines: tf && t.account ? activitiesOf(t.account).map((description) => ({ description, amount: tf.activities[description] ?? 0 })) : [] }];
    // Classes: the full A4 school fees invoice (feeding is billed separately in the Feeding module).
    const cls = classes.find((c) => c.id === t.classId)!;
    const fees = tf ? classFees(tf, cls).map((i) => ({ description: i.label, amount: i.amount })) : [];
    return [t.id, { title: `${t.label} School Fees`, period: `${SCHOOL.term}, ${SCHOOL.year} academic year`, notes: DEFAULT_NOTES, lines: mainLines(fees) }];
  }));
}

export function View() {
  useLiveData(); // re-render with fresh data after each save (live site)
  return (<>
    <PageHeader title="Invoices" sub="A school fees invoice for each class, plus Extracurricular and Extra Classes (each printed 10 to an A4 sheet). Edit any figure — nothing else in the system changes." />
    <ClassInvoices defaults={defaults()} school={{ name: SCHOOL.name, city: SCHOOL.city, phone: SCHOOL.phone, email: SCHOOL.email }} />
  </>);
}
