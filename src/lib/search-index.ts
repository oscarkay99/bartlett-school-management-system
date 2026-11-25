import { students, guardians, staff, invoices, payments, inventory, fullName, getStudent, getClass } from "@/lib/data/queries";
import { ACCOUNTS } from "@/lib/accounts";
import type { SearchItem } from "@/components/shell/AppShell";

export function buildSearchIndex(): SearchItem[] {
  return [
    ...students.map((s) => ({ type: "Student", label: fullName(s), sub: `${s.admissionNo} · ${getClass(s.classId).name}`, href: `/students/${s.id}` })),
    ...guardians.map((g) => ({ type: "Parent", label: g.name, sub: `${g.phone}${g.email ? " · " + g.email : ""}`, href: `/parents/${g.id}` })),
    ...staff.map((s) => ({ type: "Staff", label: s.name, sub: `${s.empNo} · ${s.position}`, href: `/staff` })),
    // Invoices and receipts belong to a term: search shows only those of the year and term picked in the top bar.
    ...invoices.map((i) => ({ type: "Invoice", label: i.no, sub: `${fullName(getStudent(i.studentId)!)} · ${ACCOUNTS[i.account].label} · ${i.term} ${i.year}`, href: `/students/${i.studentId}?tab=${i.account}`, year: i.year, term: i.term })),
    ...payments.map((p) => ({ type: "Receipt", label: p.receiptNo, sub: `${fullName(getStudent(p.studentId)!)} · ${p.ref}`, href: `/print/receipt/${p.id}`, date: p.date })),
    ...inventory.map((i) => ({ type: "Item", label: i.name, sub: `${i.sku} · ${i.category}`, href: `/inventory` })),
  ];
}
