import { notFound } from "next/navigation";
import { PrintFrame } from "@/components/PrintDoc";
import * as Q from "@/lib/data/queries";
import { ageFrom, fmtDateLong } from "@/lib/utils";
export function generateStaticParams() { return Q.students.map((s) => ({ id: s.id })); }
export const dynamicParams = false;

export default async function ReportCard({ params }: PageProps<"/print/report-card/[id]">) {
  const { id } = await params; const s = Q.getStudent(id); if (!s) notFound();
  const g = Q.studentGrades(id); const att = Q.studentAttendance(id); const avg = Math.round(g.reduce((a, b) => a + b.total, 0) / Math.max(1, g.length));
  return (
    <PrintFrame title="Terminal Report">
      <div className="mt-4 grid grid-cols-[90px_1fr_1fr] gap-4"><div className="grid h-24 w-[90px] place-items-center border border-neutral-300 text-[10px] text-neutral-400">Photo</div>
        <div className="space-y-1"><div><span className="text-neutral-500">Name: </span><b>{Q.fullName(s)}</b></div><div><span className="text-neutral-500">Admission no: </span>{s.admissionNo}</div><div><span className="text-neutral-500">Age: </span>{ageFrom(s.dob)}</div></div>
        <div className="space-y-1"><div><span className="text-neutral-500">Class: </span><b>{Q.getClass(s.classId).name}</b></div><div><span className="text-neutral-500">Year / Term: </span>{Q.SCHOOL.year} · {Q.SCHOOL.term}</div><div><span className="text-neutral-500">Attendance: </span>{att.present} of {att.total} days ({att.rate}%)</div></div></div>
      <table className="mt-5 w-full border-collapse"><thead><tr className="bg-neutral-100 text-left">{["Subject", "CA (40)", "Exam (60)", "Total", "Grade", "Remark"].map((h) => <th key={h} className="border border-neutral-300 p-2">{h}</th>)}</tr></thead>
        <tbody>{g.map((r) => <tr key={r.subject}><td className="border border-neutral-300 p-2">{r.subject}</td><td className="border border-neutral-300 p-2 text-right">{r.ca}</td><td className="border border-neutral-300 p-2 text-right">{r.exam}</td><td className="border border-neutral-300 p-2 text-right font-bold">{r.total}</td><td className="border border-neutral-300 p-2 text-center font-bold">{r.grade}</td><td className="border border-neutral-300 p-2">{r.label}</td></tr>)}</tbody></table>
      <p className="mt-3">Overall average: <b>{avg}%</b></p>
      <div className="mt-4 space-y-4"><div className="rounded border border-neutral-300 p-3"><b>Class teacher&apos;s remarks:</b><div className="mt-1 h-8 text-neutral-500">{avg >= 70 ? "An excellent term. Keep it up." : avg >= 50 ? "Steady progress; more practice in weaker subjects will help." : "Needs extra support — please meet the class teacher."}</div></div><div className="rounded border border-neutral-300 p-3"><b>Headteacher&apos;s remarks:</b><div className="mt-1 h-8" /></div></div>
      <div className="mt-6 flex justify-between"><span>School reopens: <b>{fmtDateLong(Q.SCHOOL.reopening)}</b></span><div className="w-48 border-t border-neutral-900 pt-1 text-[11px]">Headteacher&apos;s signature</div></div>
      <p className="mt-4 text-[10px] text-neutral-500">Grading: {Q.gradeScale.map((x) => `${x.grade} ${x.min}+`).join(" · ")}</p>
    </PrintFrame>
  );
}
