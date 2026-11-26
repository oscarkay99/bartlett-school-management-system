"use client";
import { useLiveData } from "@/lib/live/data";
import { NotFound } from "@/components/NotFound";
import { PrintFrame } from "@/components/PrintDoc";
import * as Q from "@/lib/data/queries";
import { money } from "@/lib/money";
import { fmtDateLong } from "@/lib/utils";
import { ACCOUNTS } from "@/lib/accounts";
import { schoolFeeRows } from "@/lib/class-invoices";

export function InvoicePrint({ id }: { id: string }) {
  useLiveData(); // re-render with fresh data after each save (live site)
  const i = Q.invoices.find((x) => x.id === id || x.no === id); if (!i) return <NotFound />;
  const s = Q.getStudent(i.studentId)!; const f = Q.accountSummary(s.id, i.account); const A = ACCOUNTS[i.account]; const g = Q.getGuardian(s.guardians[0].guardianId)!;
  // School fees: always Tuition, Books, PTA, ICT & Development Levy (GH₵ 0 shows as "—"), never Feeding.
  const rows = i.account === "fees" ? schoolFeeRows(i.items) : [...i.items];
  const gross = rows.reduce((a, b) => a + b.amount, 0);
  return (
    <PrintFrame title={A.invoiceTitle}>
      <div className="mt-4 grid grid-cols-2 gap-6"><div><div className="text-[10px] uppercase text-neutral-500">Billed to</div><b>{g.title} {g.name}</b><div>{g.phone}</div><div className="mt-2 text-[10px] uppercase text-neutral-500">Student</div><b>{Q.fullName(s)}</b><div>{s.admissionNo} · {Q.getClass(s.classId).name}</div></div>
        <div className="text-right"><div>Invoice <b>{i.no}</b></div><div>{A.label} · {i.term}, {i.year}</div><div>Billing date: {fmtDateLong(i.billedOn)}</div><div>Due date: <b>{fmtDateLong(i.dueOn)}</b></div></div></div>
      <div className="mt-6 overflow-x-auto"><table className="w-full min-w-[420px] border-collapse"><thead><tr className="bg-neutral-100 text-left"><th className="border border-neutral-300 p-2">Description</th><th className="border border-neutral-300 p-2 text-right">Amount (GH₵)</th></tr></thead>
        <tbody>{rows.map((it) => <tr key={it.label}><td className="border border-neutral-300 p-2">{it.label}</td><td className="border border-neutral-300 p-2 text-right">{it.amount ? money(it.amount) : "—"}</td></tr>)}</tbody>
        <tfoot>{[["Subtotal", money(gross)], i.discount ? [Q.discountLabel(s.id), `− ${money(i.discount)}`] : null, ["Total invoice", money(gross - i.discount)], [`${A.label} paid`, money(f.paid)], ["Outstanding balance", money(Math.max(0, f.balance))]].filter(Boolean).map((r) => <tr key={r![0]} className={r![0] === "Outstanding balance" ? "font-bold" : ""}><td className="border border-neutral-300 p-2 text-right">{r![0]}</td><td className="border border-neutral-300 p-2 text-right">{r![1]}</td></tr>)}</tfoot></table></div>
      <p className="mt-6">Status: <b>{f.status}</b></p><p className="mt-6 text-[11px] text-neutral-600">Payment instructions: pay via Mobile Money or bank transfer using the invoice number as reference. Always request an official receipt.</p>{i.account !== "fees" && <p className="mt-2 text-[11px] text-neutral-600">This {A.label.toLowerCase()} bill is separate from school fees. Payments against it are receipted separately and do not reduce the school fees balance.</p>}
    </PrintFrame>
  );
}
