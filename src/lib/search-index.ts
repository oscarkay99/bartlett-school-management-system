import { students, guardians, staff, invoices, payments, inventory, fullName, getStudent } from "@/lib/data/queries";
import type { SearchItem } from "@/components/shell/AppShell";

export function buildSearchIndex(): SearchItem[] {
  return [
    ...students.map((s) => ({ type: "Student", label: fullName(s), sub: `${s.admissionNo}`, href: `/students/${s.id}` })),
    ...guardians.map((g) => ({ type: "Parent", label: g.name, sub: `${g.phone}${g.email ? " · " + g.email : ""}`, href: `/parents/${g.id}` })),
    ...staff.map((s) => ({ type: "Staff", label: s.name, sub: `${s.empNo} · ${s.position}`, href: `/staff` })),
    ...invoices.map((i) => ({ type: "Invoice", label: i.no, sub: fullName(getStudent(i.studentId)!), href: `/students/${i.studentId}?tab=fees` })),
    ...payments.map((p) => ({ type: "Receipt", label: p.receiptNo, sub: `${fullName(getStudent(p.studentId)!)} · ${p.ref}`, href: `/print/receipt/${p.id}` })),
    ...inventory.map((i) => ({ type: "Item", label: i.name, sub: i.sku, href: `/inventory` })),
  ];
}
