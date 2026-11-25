import { notFound } from "next/navigation";
import { PrintFrame } from "@/components/PrintDoc";
import * as Q from "@/lib/data/queries";
import { money } from "@/lib/money";
import { fmtDateLong } from "@/lib/utils";
import { ACCOUNTS } from "@/lib/accounts";
export function generateStaticParams() { return Q.payments.map((p) => ({ id: p.id })); }
export const dynamicParams = false;

export default async function ReceiptPrint({ params }: PageProps<"/print/receipt/[id]">) {
  const { id } = await params; const p = Q.payments.find((x) => x.id === id); if (!p) notFound();
  const s = Q.getStudent(p.studentId)!; const f = Q.accountSummary(s.id, p.account); const A = ACCOUNTS[p.account]; const items = Q.invoicesOf(s.id, p.account).flatMap((i) => i.items.map((x) => x.label)); const g = p.guardianId ? Q.getGuardian(p.guardianId) : undefined;
  return (
    <PrintFrame title={A.receiptTitle}>
      {/* Same layout as the invoice: who and what on the left, document details on the right, then the amounts table. */}
      <div className="mt-4 grid grid-cols-2 gap-6"><div><div className="text-[10px] uppercase text-neutral-500">Received from</div><b>{g ? `${g.title} ${g.name}` : "—"}</b>{g && <div>{g.phone}</div>}<div className="mt-2 text-[10px] uppercase text-neutral-500">Student</div><b>{Q.fullName(s)}</b><div>{s.admissionNo} · {Q.getClass(s.classId).name}</div></div>
        <div className="text-right"><div>Receipt <b>{p.receiptNo}</b></div><div>{A.label} · {Q.SCHOOL.term}, {Q.SCHOOL.year}</div><div>Payment date: <b>{fmtDateLong(p.date)}</b></div><div>{p.method} · Ref. {p.ref}</div></div></div>
      <div className="mt-6 overflow-x-auto"><table className="w-full min-w-[420px] border-collapse"><thead><tr className="bg-neutral-100 text-left"><th className="border border-neutral-300 p-2">Description</th><th className="border border-neutral-300 p-2 text-right">Amount (GHS)</th></tr></thead>
        <tbody><tr><td className="border border-neutral-300 p-2">Payment towards {A.label.toLowerCase()}{items.length ? ` (${items.join(", ")})` : ""}</td><td className="border border-neutral-300 p-2 text-right">{money(p.amount)}</td></tr></tbody>
        <tfoot>{[["Amount received", money(p.amount)], [`${A.label} balance after this payment`, money(Math.max(0, f.balance))]].map(([k, v], i) => <tr key={k} className={i === 0 ? "bg-neutral-100 font-bold" : ""}><td className="border border-neutral-300 p-2 text-right">{k}</td><td className="border border-neutral-300 p-2 text-right">{v}</td></tr>)}</tfoot></table></div>
      <p className="mt-6">Status: <b>{p.status}</b> · Received by {p.staff}</p>
      {p.status !== "Confirmed" && <p className="mt-2 font-bold text-red-700">This payment is {p.status.toUpperCase()} and is not valid as proof of payment.</p>}
      <div className="mt-16 flex justify-between text-[11px]"><div className="w-48 border-t border-neutral-900 pt-1">Authorised signature</div><div className="text-neutral-500">Computer-generated receipt</div></div>
    </PrintFrame>
  );
}
