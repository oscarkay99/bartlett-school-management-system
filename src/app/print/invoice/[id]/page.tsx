import { notFound } from "next/navigation";
import { PrintFrame } from "@/components/PrintDoc";
import * as Q from "@/lib/data/queries";
import { money } from "@/lib/money";
import { fmtDateLong } from "@/lib/utils";
export function generateStaticParams() { return Q.invoices.flatMap((i) => [{ id: i.id }, { id: i.no }]); }
export const dynamicParams = false;

export default async function InvoicePrint({ params }: PageProps<"/print/invoice/[id]">) {
  const { id } = await params; const i = Q.invoices.find((x) => x.id === id || x.no === id); if (!i) notFound();
  const s = Q.getStudent(i.studentId)!; const f = Q.feeSummary(s.id); const g = Q.getGuardian(s.guardians[0].guardianId)!;
  const gross = i.items.reduce((a, b) => a + b.amount, 0);
  return (
    <PrintFrame title="Fee Invoice">
      <div className="mt-4 grid grid-cols-2 gap-6"><div><div className="text-[10px] uppercase text-neutral-500">Billed to</div><b>{g.title} {g.name}</b><div>{g.phone}</div><div className="mt-2 text-[10px] uppercase text-neutral-500">Student</div><b>{Q.fullName(s)}</b><div>{s.admissionNo} · {Q.getClass(s.classId).name}</div></div>
        <div className="text-right"><div>Invoice <b>{i.no}</b></div><div>{i.term}, {i.year}</div><div>Billing date: {fmtDateLong(i.billedOn)}</div><div>Due date: <b>{fmtDateLong(i.dueOn)}</b></div></div></div>
      <table className="mt-6 w-full border-collapse"><thead><tr className="bg-neutral-100 text-left"><th className="border border-neutral-300 p-2">Description</th><th className="border border-neutral-300 p-2 text-right">Amount (GHS)</th></tr></thead>
        <tbody>{i.items.map((it) => <tr key={it.label}><td className="border border-neutral-300 p-2">{it.label}</td><td className="border border-neutral-300 p-2 text-right">{money(it.amount)}</td></tr>)}</tbody>
        <tfoot>{[["Subtotal", money(gross)], i.discount ? ["Discount / scholarship", `− ${money(i.discount)}`] : null, ["Total invoice", money(gross - i.discount)], ["Amount paid", money(f.paid)], ["Outstanding balance", money(Math.max(0, f.balance))]].filter(Boolean).map((r) => <tr key={r![0]} className={r![0] === "Outstanding balance" ? "font-bold" : ""}><td className="border border-neutral-300 p-2 text-right">{r![0]}</td><td className="border border-neutral-300 p-2 text-right">{r![1]}</td></tr>)}</tfoot></table>
      <p className="mt-6">Status: <b>{f.status}</b></p><p className="mt-6 text-[11px] text-neutral-600">Payment instructions: pay via Mobile Money or bank transfer using the invoice number as reference. Always request an official receipt.</p>
    </PrintFrame>
  );
}
