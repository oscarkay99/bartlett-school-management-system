import { notFound } from "next/navigation";
import { PrintFrame } from "@/components/PrintDoc";
import * as Q from "@/lib/data/queries";
import { money } from "@/lib/money";
import { fmtDateLong } from "@/lib/utils";
export function generateStaticParams() { return Q.payments.map((p) => ({ id: p.id })); }
export const dynamicParams = false;

export default async function ReceiptPrint({ params }: PageProps<"/print/receipt/[id]">) {
  const { id } = await params; const p = Q.payments.find((x) => x.id === id); if (!p) notFound();
  const s = Q.getStudent(p.studentId)!; const f = Q.feeSummary(s.id); const g = p.guardianId ? Q.getGuardian(p.guardianId) : undefined;
  return (
    <PrintFrame title="Official Receipt">
      <div className="mt-4 flex justify-between"><div>Receipt no. <b className="text-base">{p.receiptNo}</b></div><div>Date: <b>{fmtDateLong(p.date)}</b></div></div>
      <div className="mt-5 space-y-2">{[["Received from", g ? `${g.title} ${g.name}` : "—"], ["Student", `${Q.fullName(s)} (${s.admissionNo})`], ["Class", Q.getClass(s.classId).name], ["Payment method", p.method], ["Reference", p.ref], ["Received by", p.staff]].map(([k, v]) => <div key={k} className="flex border-b border-neutral-200 pb-1"><span className="w-40 text-neutral-500">{k}</span><b>{v}</b></div>)}</div>
      <div className="mt-6 rounded border-2 border-neutral-900 p-4 text-center"><div className="text-[10px] uppercase text-neutral-500">Amount received</div><div className="text-3xl font-bold">{money(p.amount)}</div></div>
      <div className="mt-4 flex justify-between"><span>Balance after this payment ({Q.SCHOOL.term}):</span><b>{money(Math.max(0, f.balance))}</b></div>
      {p.status !== "Confirmed" && <p className="mt-4 font-bold text-red-700">This payment is {p.status.toUpperCase()} and is not valid as proof of payment.</p>}
      <div className="mt-16 flex justify-between text-[11px]"><div className="w-48 border-t border-neutral-900 pt-1">Authorised signature</div><div className="text-neutral-500">Computer-generated receipt</div></div>
    </PrintFrame>
  );
}
