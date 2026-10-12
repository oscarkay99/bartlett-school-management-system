import { notFound } from "next/navigation";
import { PrintFrame } from "@/components/PrintDoc";
import * as Q from "@/lib/data/queries";
import { money } from "@/lib/money";
import { fmtDate } from "@/lib/utils";
export function generateStaticParams() { return Q.students.map((s) => ({ id: s.id })); }
export const dynamicParams = false;

export default async function StatementPrint({ params }: PageProps<"/print/statement/[id]">) {
  const { id } = await params; const s = Q.getStudent(id); if (!s) notFound();
  const rows = [
    ...Q.invoices.filter((i) => i.studentId === id).flatMap((i) => [{ d: i.billedOn, r: i.no, t: `Invoice ${i.term}`, dr: i.items.reduce((a, b) => a + b.amount, 0), cr: 0 }, ...(i.discount ? [{ d: i.billedOn, r: i.no, t: "Discount / scholarship", dr: 0, cr: i.discount }] : [])]),
    ...Q.payments.filter((p) => p.studentId === id && p.status === "Confirmed").map((p) => ({ d: p.date, r: p.receiptNo, t: `Payment (${p.method})`, dr: 0, cr: p.amount })),
  ].sort((a, b) => a.d.localeCompare(b.d));
  const running = rows.reduce<number[]>((acc, r) => [...acc, (acc[acc.length - 1] ?? 0) + r.dr - r.cr], []); const bal = running[running.length - 1] ?? 0;
  return (
    <PrintFrame title="Student Statement">
      <div className="mt-4"><b>{Q.fullName(s)}</b> · {s.admissionNo} · {Q.getClass(s.classId).name}<div className="text-neutral-500">Statement as at 12 October 2026</div></div>
      <table className="mt-5 w-full border-collapse"><thead><tr className="bg-neutral-100 text-left">{["Date", "Reference", "Description", "Debit", "Credit", "Balance"].map((h) => <th key={h} className="border border-neutral-300 p-2">{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => { return <tr key={i}><td className="border border-neutral-300 p-2">{fmtDate(r.d)}</td><td className="border border-neutral-300 p-2">{r.r}</td><td className="border border-neutral-300 p-2">{r.t}</td><td className="border border-neutral-300 p-2 text-right">{r.dr ? money(r.dr) : ""}</td><td className="border border-neutral-300 p-2 text-right">{r.cr ? money(r.cr) : ""}</td><td className="border border-neutral-300 p-2 text-right">{money(running[i])}</td></tr>; })}</tbody></table>
      <p className="mt-4 text-right text-base">Balance due: <b>{money(Math.max(0, bal))}</b></p>
    </PrintFrame>
  );
}
