import { notFound } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Download, FileText } from "lucide-react";
import { Avatar, Badge, Card, CardHeader, LinkButton, PageHeader, Progress, StatusBadge } from "@/components/ui/primitives";
import { Suspense } from "react";
import { QueryTabs } from "@/components/ui/interactive";
import { ReminderButtons } from "@/components/fees/ReminderDialog";
import { RecordPaymentButton } from "@/components/students/ProfileActions";
import { MedicalGate } from "@/components/students/MedicalGate";
import { StudentRecordActions } from "@/components/RecordActions";
import { GuardiansPanel } from "@/components/students/GuardiansPanel";
import * as Q from "@/lib/data/queries";
import { money } from "@/lib/money";
import { ageFrom, fmtDate, fmtDateLong } from "@/lib/utils";

export function generateStaticParams() { return Q.students.map((s) => ({ id: s.id })); }
export const dynamicParams = false;

export default async function StudentProfile({ params }: PageProps<"/students/[id]">) {
  const { id } = await params;
  const s = Q.getStudent(id); if (!s) notFound();
  const cls = Q.getClass(s.classId); const f = Q.feeSummary(s.id);
  const inv = Q.invoices.filter((i) => i.studentId === s.id);
  const pays = Q.payments.filter((p) => p.studentId === s.id).sort((a, b) => b.date.localeCompare(a.date));
  const grades = Q.studentGrades(s.id); const att = Q.studentAttendance(s.id);
  const gl = s.guardians.map((g) => ({ g, rec: Q.getGuardian(g.guardianId)! }));
  const payer = gl.find((x) => x.g.financial && x.g.receivesFeeReminders && x.g.verified);
  const row = payer ? Q.reminderRows().find((r) => r.guardian.id === payer.rec.id) : undefined;
  const single = payer ? { guardian: payer.rec, lines: [{ student: s, balance: f.balance, overdue: f.overdue, dueOn: f.dueOn }], total: f.balance, eligible: true, channel: payer.rec.preferred } : undefined;
  const msg = single ? Q.buildReminder(single) : "";
  const history = Q.messages.filter((m) => m.studentIds.includes(s.id));
  const issues = Q.studentIssues.filter((x) => x.studentId === s.id);
  void row;

  // Ledger: chronological, running balance, append-only
  const ledger = [
    ...inv.map((i) => ({ date: i.billedOn, ref: i.no, desc: `Invoice — ${i.term} ${i.year}`, debit: i.items.reduce((a, b) => a + b.amount, 0), credit: 0 })),
    ...inv.filter((i) => i.discount > 0).map((i) => ({ date: i.billedOn, ref: i.no, desc: `Scholarship / discount`, debit: 0, credit: i.discount })),
    ...pays.filter((p) => p.status === "Confirmed").map((p) => ({ date: p.date, ref: p.receiptNo, desc: `Payment — ${p.method} (${p.ref})`, debit: 0, credit: p.amount })),
    ...pays.filter((p) => p.status === "Reversed").flatMap((p) => [{ date: p.date, ref: p.receiptNo, desc: `Payment — ${p.method} (${p.ref})`, debit: 0, credit: p.amount }, { date: p.date, ref: `REV-${p.receiptNo}`, desc: `Reversal of ${p.receiptNo}: ${p.note ?? ""}`, debit: p.amount, credit: 0 }]),
  ].sort((a, b) => a.date.localeCompare(b.date) || a.debit - b.debit);
  let run = 0; const ledgerRows = ledger.map((l) => ({ ...l, bal: (run += l.debit - l.credit) }));

  const directory = Q.guardians.map((g) => ({ id: g.id, title: g.title, name: g.name, phone: g.phone, email: g.email, children: Q.studentsOfGuardian(g.id).length }));
  const payStudent = { id: s.id, name: Q.fullName(s), adm: s.admissionNo, cls: cls.name, balance: f.balance, invoices: inv.map((i) => ({ no: i.no, balance: f.balance })) };
  const usedRefs = Q.payments.map((p) => p.ref.toUpperCase());
  const tone = f.status === "Paid in Full" ? "ok" : f.status === "Overdue" ? "danger" : f.status === "Credit Balance" ? "info" : "warn";
  const dl = (rows: [string, React.ReactNode][]) => <dl className="grid gap-x-8 sm:grid-cols-2">{rows.map(([k, v]) => <div key={k} className="flex justify-between gap-4 border-b border-line py-2"><dt className="text-muted">{k}</dt><dd className="text-right font-medium">{v}</dd></div>)}</dl>;

  const tabs = [
    { id: "overview", label: "Overview", content: (
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2"><CardHeader title="Personal & enrolment" /><div className="px-4 pb-4">{dl([["Admission no.", s.admissionNo], ["Date of birth", `${fmtDate(s.dob)} (${ageFrom(s.dob)} yrs)`], ["Gender", s.gender], ["Nationality", s.nationality], ["Class", cls.name], ["Category", s.category], ["House", s.house], ["Admitted", fmtDate(s.admittedOn)], ["Previous school", s.previousSchool ?? "—"], ["Address", s.address]])}</div></Card>
        <Card><CardHeader title="At a glance" /><div className="space-y-3 px-4 pb-4">
          <div><div className="mb-1 flex justify-between text-xs text-muted"><span>Fees paid</span><span>{Math.round((f.paid / Math.max(1, f.billed)) * 100)}%</span></div><Progress value={(f.paid / Math.max(1, f.billed)) * 100} tone={tone as "ok"} /></div>
          <div><div className="mb-1 flex justify-between text-xs text-muted"><span>Attendance</span><span>{att.rate}%</span></div><Progress value={att.rate} tone={att.rate > 90 ? "ok" : "warn"} /></div>
          <div className="flex justify-between"><span className="text-muted">Subjects</span><b>{grades.length}</b></div>
          <div className="flex justify-between"><span className="text-muted">Items on loan</span><b>{issues.filter((i) => i.returnRequired && !i.returned).length}</b></div>
        </div></Card>
      </div>) },
    { id: "guardians", label: "Parents & Guardians", badge: String(gl.length), content: <GuardiansPanel studentName={Q.shortName(s)} directory={directory} initial={gl.map(({ g, rec }) => ({ guardianId: rec.id, title: rec.title, name: rec.name, phone: rec.phone, email: rec.email, children: Q.studentsOfGuardian(rec.id).length, relationship: g.relationship, primary: g.primary, legal: g.legal, emergency: g.emergency, pickup: g.pickup, financial: g.financial, share: g.financialShare, reminders: g.receivesFeeReminders, academic: g.receivesAcademic, verified: g.verified, restriction: g.restriction }))} /> },
    { id: "academics", label: "Academic Performance", content: (
      <Card><CardHeader title={`${Q.SCHOOL.term} ${Q.SCHOOL.year}`} sub="Continuous assessment 40% + examination 60% · results shown as drafts until published" action={<LinkButton size="sm" href={`/print/report-card/${s.id}`}><Download size={14} />Report card</LinkButton>} />
        <table className="w-full text-sm"><thead className="bg-surface-2/60 text-xs uppercase text-muted"><tr><th className="px-4 py-2 text-left">Subject</th><th className="px-3 text-right">CA /40</th><th className="px-3 text-right">Exam /60</th><th className="px-3 text-right">Total</th><th className="px-4 text-right">Grade</th></tr></thead>
          <tbody className="divide-y divide-line">{grades.map((g) => <tr key={g.subject}><td className="px-4 py-2.5">{g.subject}</td><td className="num px-3 text-right">{g.ca}</td><td className="num px-3 text-right">{g.exam}</td><td className="num px-3 text-right font-medium">{g.total}</td><td className="px-4 text-right"><Badge tone={g.grade <= "B" ? "ok" : g.grade === "C" ? "info" : g.grade === "D" ? "warn" : "danger"}>{g.grade} · {g.label}</Badge></td></tr>)}</tbody></table>
        <div className="border-t border-line px-4 py-3 text-sm">Average: <b>{Math.round(grades.reduce((a, g) => a + g.total, 0) / Math.max(1, grades.length))}%</b></div></Card>) },
    { id: "fees", label: "School Fees", content: (
      <div className="space-y-4">
        <Card><div className="grid gap-4 p-4 sm:grid-cols-4">{[["Billed", money(f.billed)], ["Discounts", money(f.discount)], ["Paid", money(f.paid)], ["Outstanding", money(Math.max(0, f.balance))]].map(([k, v], i) => <div key={k}><div className="text-xs text-muted">{k}</div><div className={`num text-xl font-semibold ${i === 3 && f.balance > 0 ? "text-danger" : ""}`}>{v}</div></div>)}</div></Card>
        <Card><CardHeader title="Fee ledger" sub="Append-only. Corrections appear as reversals, never as edits." />
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-surface-2/60 text-xs uppercase text-muted"><tr><th className="px-4 py-2 text-left">Date</th><th className="text-left">Reference</th><th className="text-left">Description</th><th className="px-3 text-right">Debit</th><th className="px-3 text-right">Credit</th><th className="px-4 text-right">Balance</th></tr></thead>
            <tbody className="divide-y divide-line">{ledgerRows.map((l, i) => <tr key={i}><td className="px-4 py-2.5 whitespace-nowrap">{fmtDate(l.date)}</td><td className="num">{l.ref}</td><td>{l.desc}</td><td className="num px-3 text-right">{l.debit ? money(l.debit) : ""}</td><td className="num px-3 text-right text-ok">{l.credit ? money(l.credit) : ""}</td><td className="num px-4 text-right font-medium">{money(l.bal)}</td></tr>)}</tbody></table></div></Card>
        <Card><CardHeader title="Invoices" />{inv.map((i) => <div key={i.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-3"><div><b className="num">{i.no}</b><div className="text-xs text-muted">{i.items.map((x) => `${x.label} ${money(x.amount)}`).join(" · ")}</div></div><LinkButton size="sm" href={`/print/invoice/${i.id}`}><FileText size={14} />Invoice PDF</LinkButton></div>)}</Card>
        <Card><CardHeader title="Payments" />{pays.length === 0 ? <p className="px-4 pb-4 text-muted">No payments recorded yet.</p> : pays.map((p) => <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-3"><div><b className="num">{p.receiptNo}</b> <StatusBadge status={p.status} /><div className="text-xs text-muted">{p.method} · {fmtDate(p.date)} · {p.ref} · received by {p.staff}</div></div><div className="flex items-center gap-3"><b className="num">{money(p.amount)}</b>{p.status === "Confirmed" && <LinkButton size="sm" href={`/print/receipt/${p.id}`}>Receipt</LinkButton>}</div></div>)}</Card>
      </div>) },
    { id: "attendance", label: "Attendance", content: <Card><div className="grid gap-4 p-4 sm:grid-cols-4">{[["Present", att.present], ["Absent", att.absent], ["Late", att.late], ["Rate", `${att.rate}%`]].map(([k, v]) => <div key={k}><div className="text-xs text-muted">{k}</div><div className="num text-2xl font-semibold">{v}</div></div>)}</div></Card> },
    { id: "inventory", label: "Items Issued", badge: String(issues.length), content: (
      <Card>{issues.length === 0 ? <p className="p-6 text-muted">No items issued.</p> : <table className="w-full text-sm"><thead className="bg-surface-2/60 text-xs uppercase text-muted"><tr><th className="px-4 py-2 text-left">Item</th><th className="text-right">Qty</th><th className="px-3 text-left">Issued</th><th className="text-left">Return</th></tr></thead><tbody className="divide-y divide-line">{issues.map((i, k) => <tr key={k}><td className="px-4 py-2.5">{i.item}</td><td className="num text-right">{i.qty}</td><td className="px-3">{fmtDate(i.date)}</td><td>{i.returnRequired ? <Badge tone={i.returned ? "ok" : "warn"}>{i.returned ? "Returned" : "Return due at term end"}</Badge> : <Badge>Consumable</Badge>}</td></tr>)}</tbody></table>}</Card>) },
    { id: "medical", label: "Medical & Welfare", content: (
      <MedicalGate><Card><CardHeader title="Medical alerts" sub="Restricted · access is logged" /><div className="px-4 pb-4">{dl([["Alerts", s.medicalAlert ?? "None recorded"], ["Allergies", s.medicalAlert?.includes("allergy") ? s.medicalAlert : "None recorded"], ["Emergency instructions", s.medicalAlert ? "Call guardian immediately, then nearest clinic." : "—"]])}</div></Card></MedicalGate>) },
    { id: "documents", label: "Documents", content: <Card>{["Birth certificate", "Admission form", "Passport photograph", "Parental consent form"].map((d, i) => <div key={d} className="flex items-center justify-between border-b border-line px-4 py-3 last:border-0"><span className="flex items-center gap-2"><FileText size={16} className="text-muted" />{d}</span>{i === 3 ? <Badge tone="warn">Missing</Badge> : <Badge tone="ok">On file</Badge>}</div>)}</Card> },
    { id: "comms", label: "Communication", badge: String(history.length), content: <Card>{history.length === 0 ? <p className="p-6 text-muted">No messages sent about this student.</p> : history.map((m) => <div key={m.id} className="flex items-center justify-between gap-2 border-b border-line px-4 py-3 last:border-0"><div><div className="font-medium">{m.template} · {m.channel}</div><div className="text-xs text-muted">{fmtDate(m.date)} · to {Q.getGuardian(m.guardianId)?.name} · {m.sender}</div></div><StatusBadge status={m.status} /></div>)}</Card> },
    { id: "audit", label: "Activity & Audit", content: <Card>{Q.audit.slice(0, 5).map((a) => <div key={a.id} className="border-b border-line px-4 py-3 last:border-0"><div className="font-medium">{a.action}</div><div className="text-xs text-muted">{a.actor} · {a.at}</div></div>)}</Card> },
  ];

  return (
    <>
      <PageHeader crumbs={<Link href="/students" className="text-xs text-muted hover:text-fg">← Students</Link>} title={Q.fullName(s)} sub={`${s.admissionNo} · ${cls.name} · ${s.category}`}
        actions={<><LinkButton href={`/print/statement/${s.id}`}><Download size={14} />Statement</LinkButton><StudentRecordActions adm={s.admissionNo} classes={Q.classes.map((c) => c.name)} houses={["Nkrumah", "Aggrey", "Yaa Asantewaa", "Sutherland"]} initial={{ first: s.first, middle: s.middle ?? "", last: s.last, dob: s.dob, gender: s.gender, classId: cls.name, category: s.category, house: s.house, status: s.status, address: s.address }} /><RecordPaymentButton student={payStudent} usedRefs={usedRefs} /></>} />
      <div className="mb-5 flex flex-wrap items-center gap-4 rounded-xl border border-line bg-surface p-4">
        <Avatar name={Q.shortName(s)} size={64} />
        <div className="flex flex-wrap gap-2"><StatusBadge status={s.status} />{s.medicalAlert && <Badge tone="danger"><AlertTriangle size={11} />Medical alert</Badge>}{s.scholarship && <Badge tone="info">{s.scholarship}</Badge>}</div>
      </div>
      {f.balance > 0 ? (
        <div role="alert" className={`mb-5 flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 ${f.overdue ? "border-danger/30 bg-danger/8" : "border-warn/30 bg-warn/10"}`}>
          <AlertTriangle className={f.overdue ? "text-danger" : "text-warn"} />
          <div className="flex-1 min-w-[220px]"><div className="flex items-center gap-2 font-semibold">Outstanding Fee Balance: <span className="num">{money(f.balance)}</span> <StatusBadge status={f.status} /></div><div className="text-[13px] text-fg/80">Payment due: {fmtDateLong(f.dueOn)}{f.overdue && " (overdue)"}</div></div>
          {payer ? <ReminderButtons message={msg} guardianName={payer.rec.name} consent={payer.rec.consent} studentName={Q.shortName(s)} /> : <Badge tone="warn">No eligible guardian for reminders</Badge>}
        </div>
      ) : (
        <div className="mb-5 flex items-center gap-3 rounded-xl border border-ok/30 bg-ok/8 px-4 py-3"><CheckCircle2 className="text-ok" /><b>{f.status}</b><span className="text-muted">No outstanding fees this term.</span></div>
      )}
      <Suspense fallback={null}><QueryTabs tabs={tabs} /></Suspense>
    </>
  );
}
