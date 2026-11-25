import { notFound } from "next/navigation";
import { PrintFrame } from "@/components/PrintDoc";
import * as Q from "@/lib/data/queries";
import { money } from "@/lib/money";
import { fmtDate } from "@/lib/utils";
import { ACCOUNTS, ACCOUNT_IDS } from "@/lib/accounts";
export function generateStaticParams() { return Q.students.map((s) => ({ id: s.id })); }
export const dynamicParams = false;

// One statement, two separately settled sections: School Fees (feeding included) and Extracurricular.
export default async function StatementPrint({ params }: PageProps<"/print/statement/[id]">) {
  const { id } = await params; const s = Q.getStudent(id); if (!s) notFound();
  const sections = ACCOUNT_IDS.map((acc) => ({ acc, a: ACCOUNTS[acc], f: Q.accountSummary(id, acc), rows: Q.accountLedger(id, acc) })).filter((x) => x.f.enrolled);
  const th = "border border-neutral-300 p-2"; const total = sections.reduce((a, x) => a + Math.max(0, x.f.balance), 0);
  return (
    <PrintFrame title="Student Statement">
      <div className="mt-4"><b>{Q.fullName(s)}</b> · {s.admissionNo} · {Q.getClass(s.classId).name}<div className="text-neutral-500">Statement as at 12 October 2026 · {Q.SCHOOL.term}, {Q.SCHOOL.year}</div></div>
      <table className="mt-4 w-full border-collapse"><thead><tr className="bg-neutral-100 text-left">{["Account", "Billed", "Paid", "Balance"].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
        <tbody>{sections.map((x) => <tr key={x.acc}><td className={th}>{x.a.label}</td><td className={`${th} text-right`}>{money(x.f.billed)}</td><td className={`${th} text-right`}>{money(x.f.paid)}</td><td className={`${th} text-right font-semibold`}>{money(Math.max(0, x.f.balance))}</td></tr>)}</tbody>
        <tfoot><tr className="font-bold"><td className={th} colSpan={3}>Total due (all accounts)</td><td className={`${th} text-right`}>{money(total)}</td></tr></tfoot></table>
      {sections.map((x) => (
        <section key={x.acc} className="mt-6 break-inside-avoid">
          <h2 className="text-sm font-bold uppercase tracking-wide">{x.a.label}</h2>
          <div className="mt-2 overflow-x-auto"><table className="w-full min-w-[480px] border-collapse"><thead><tr className="bg-neutral-100 text-left">{["Date", "Reference", "Description", "Debit", "Credit", "Balance"].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
            <tbody>{x.rows.map((r, i) => <tr key={i}><td className={th}>{fmtDate(r.date)}</td><td className={th}>{r.ref}</td><td className={th}>{r.desc}</td><td className={`${th} text-right`}>{r.debit ? money(r.debit) : ""}</td><td className={`${th} text-right`}>{r.credit ? money(r.credit) : ""}</td><td className={`${th} text-right`}>{money(r.bal)}</td></tr>)}</tbody></table></div>
          <p className="mt-2 text-right">{x.a.label} balance due: <b>{money(Math.max(0, x.f.balance))}</b></p>
        </section>
      ))}
      <p className="mt-6 text-[11px] text-neutral-600">School fees (feeding included) and extracurricular activities are billed and receipted separately. A payment only settles the account it was made for.</p>
    </PrintFrame>
  );
}
