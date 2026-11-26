"use client";
import { PrintFrame } from "@/components/PrintDoc";
import { money } from "@/lib/money";
import { fmtDateLong } from "@/lib/utils";

/** Everything printed on a receipt, as plain data, so a saved payment and one just recorded print identically. */
export interface ReceiptData {
  title: string; receiptNo: string; accountLabel: string; period: string;
  payer?: { name: string; phone?: string }; student: { name: string; adm: string; cls: string };
  date: string; method: string; ref?: string; lines: [string, number][]; amount: number;
  balanceLabel?: string; balanceAfter?: number; status: string; staff?: string;
}

/** The official receipt: same A4 frame and layout as the invoice (crest and school details at the top). */
export function ReceiptDoc({ r }: { r: ReceiptData }) {
  return (
    <PrintFrame title={r.title}>
      <div className="mt-4 grid grid-cols-2 gap-6">
        <div><div className="text-[10px] uppercase text-neutral-500">Received from</div><b>{r.payer?.name || "—"}</b>{r.payer?.phone && <div>{r.payer.phone}</div>}
          <div className="mt-2 text-[10px] uppercase text-neutral-500">Student</div><b>{r.student.name}</b><div>{r.student.adm} · {r.student.cls}</div></div>
        <div className="text-right"><div>Receipt <b>{r.receiptNo}</b></div><div>{r.accountLabel} · {r.period}</div><div>Payment date: <b>{fmtDateLong(r.date)}</b></div><div>{r.method}{r.ref ? ` · Ref. ${r.ref}` : ""}</div></div>
      </div>
      <div className="mt-6 overflow-x-auto"><table className="w-full min-w-[420px] border-collapse">
        <thead><tr className="bg-neutral-100 text-left"><th className="border border-neutral-300 p-2">Description</th><th className="border border-neutral-300 p-2 text-right">Amount (GH₵)</th></tr></thead>
        <tbody>{r.lines.map(([d, a]) => <tr key={d}><td className="border border-neutral-300 p-2">{d}</td><td className="border border-neutral-300 p-2 text-right">{money(a)}</td></tr>)}</tbody>
        <tfoot>{[["Amount received", money(r.amount)], ...(r.balanceLabel ? [[r.balanceLabel, money(Math.max(0, r.balanceAfter ?? 0))]] : [])].map(([k, v], i) =>
          <tr key={k} className={i === 0 ? "bg-neutral-100 font-bold" : ""}><td className="border border-neutral-300 p-2 text-right">{k}</td><td className="border border-neutral-300 p-2 text-right">{v}</td></tr>)}</tfoot>
      </table></div>
      <p className="mt-6">Status: <b>{r.status}</b>{r.staff ? ` · Received by ${r.staff}` : ""}</p>
      {r.status !== "Confirmed" && <p className="mt-2 font-bold text-red-700">This payment is {r.status.toUpperCase()} and is not valid as proof of payment.</p>}
      <div className="mt-16 flex justify-between text-[11px]"><div className="w-48 border-t border-neutral-900 pt-1">Authorised signature</div><div className="text-neutral-500">Computer-generated receipt</div></div>
    </PrintFrame>
  );
}

/** A just-recorded payment travels to /print/receipt/new in the link (the page is static, so there is no server to ask). */
export const receiptLink = (r: ReceiptData) => `/print/receipt/new?d=${encodeURIComponent(JSON.stringify(r))}`;
