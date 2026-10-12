import Link from "next/link";
import { AlertTriangle, Banknote, Boxes, CalendarCheck, ClipboardCheck, GraduationCap, Landmark, PackageX, Percent, Receipt, UserCheck, Users, UsersRound, Wallet, Clock } from "lucide-react";
import { AlertBanner, Badge, Card, CardHeader, Kpi, LinkButton, PageHeader, Avatar, StatusBadge } from "@/components/ui/primitives";
import { WidgetBoard, type Widget } from "@/components/ui/WidgetBoard";
import { AreaTrend, Donut, GroupedBars, HBars, LineTrend, TreemapChart } from "@/components/charts/charts";
import * as Q from "@/lib/data/queries";
import { money, moneyShort } from "@/lib/money";
import { fmtDate } from "@/lib/utils";

export default function Dashboard() {
  const o = Q.feesOverview();
  const act = Q.activeStudents();
  const teachers = Q.staff.filter((s) => s.position.includes("Teacher")).length;
  const low = Q.lowStock(), oos = Q.outOfStock();
  const pendingGrades = Q.approvals.filter((a) => a.module === "academics").length;
  const unrec = Q.unreconciled();
  const prev = Q.enrollmentTrend[Q.enrollmentTrend.length - 2].students;
  const enrDelta = Math.round(((act.length - prev) / prev) * 1000) / 10;
  const feeRows = Q.topDebtors(6);
  const fs = [
    { name: "Fully paid", value: o.fullyPaid }, { name: "Partially paid", value: o.partial }, { name: "Unpaid", value: o.unpaid },
  ];

  const widgets: Widget[] = [
    { id: "collections", title: "Fee collections", span: 2, node: <Card><CardHeader title="Fee collections" sub="Confirmed payments per week, GHS" /><div className="px-2 pb-3"><LineTrend data={Q.collectionTrend()} x="week" y="collected" label="Collected" /></div></Card> },
    { id: "status", title: "Fee status", node: <Card><CardHeader title="Fee status distribution" sub="Active students" /><div className="px-2 pb-3"><Donut data={fs} money={false} colors={["var(--ok)", "var(--warn)", "var(--danger)"]} centerLabel="students" /></div></Card> },
    { id: "incexp", title: "Income vs expenditure", node: <Card><CardHeader title="Income vs expenditure" sub="Cash basis · confirmed receipts vs approved/paid expenses" /><div className="px-2 pb-3"><GroupedBars data={Q.incomeVsExpense()} x="month" bars={[{ key: "income", label: "Income (cash)", color: "var(--ok)" }, { key: "expense", label: "Expenditure", color: "var(--danger)" }]} /></div></Card> },
    { id: "byclass", title: "Outstanding by class", node: <Card><CardHeader title="Outstanding fees by class" /><div className="px-2 pb-3"><HBars data={Q.outstandingByClass()} x="name" y="outstanding" label="Outstanding" height={300} /></div></Card> },
    { id: "enroll", title: "Enrollment trend", node: <Card><CardHeader title="Student enrollment trend" sub="Prior years are opening-balance imports" /><div className="px-2 pb-3"><AreaTrend data={Q.enrollmentTrend} x="year" y="students" label="Students" /></div></Card> },
    { id: "attend", title: "Attendance trend", node: <Card><CardHeader title="Attendance trend" sub="Daily school-wide %" /><div className="px-2 pb-3"><LineTrend data={Q.attendanceTrend.map((a) => ({ ...a, date: a.date.slice(5) }))} x="date" y="rate" label="Attendance" money={false} domain={[85, 100]} color="var(--brand)" /></div></Card> },
    { id: "perf", title: "Performance by subject", node: <Card><CardHeader title="Academic performance by subject" sub="Mean total score (CA + exam)" /><div className="px-2 pb-3"><HBars data={Q.subjectAverages()} x="subject" y="avg" label="Average" money={false} color="var(--info)" height={300} /></div></Card> },
    { id: "invcat", title: "Inventory by category", node: <Card><CardHeader title="Inventory value by category" sub="At cost" /><div className="px-2 pb-3"><TreemapChart data={Q.inventoryByCategory()} /></div></Card> },
    { id: "expense", title: "Expense breakdown", node: <Card><CardHeader title="Expense breakdown" /><div className="px-2 pb-3"><Donut data={Q.expenseBreakdown().slice(0, 7)} centerLabel="approved & paid" /></div></Card> },
    { id: "payments", title: "Recent payments", node: <Card><CardHeader title="Recent payments" action={<Link className="text-xs text-info" href="/fees?tab=payments">View all</Link>} />
      <ul className="divide-y divide-line">{Q.payments.filter((p) => p.status === "Confirmed").sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6).map((p) => { const s = Q.getStudent(p.studentId)!; return <li key={p.id} className="flex items-center justify-between gap-2 px-4 py-2.5"><div className="min-w-0"><Link href={`/students/${s.id}`} className="block truncate font-medium hover:text-info">{Q.shortName(s)}</Link><span className="text-xs text-muted">{p.method} · {fmtDate(p.date)}</span></div><span className="num font-medium text-ok">{money(p.amount)}</span></li>; })}</ul></Card> },
    { id: "debtors", title: "Highest outstanding", node: <Card><CardHeader title="Highest outstanding balances" action={<Link className="text-xs text-info" href="/fees?tab=outstanding">View all</Link>} />
      <ul className="divide-y divide-line">{feeRows.map(({ s, f }) => <li key={s.id} className="flex items-center justify-between gap-2 px-4 py-2.5"><div className="flex min-w-0 items-center gap-2"><Avatar name={Q.shortName(s)} size={28} /><div className="min-w-0"><Link href={`/students/${s.id}`} className="block truncate font-medium hover:text-info">{Q.shortName(s)}</Link><span className="text-xs text-muted">{Q.getClass(s.classId).name}</span></div></div><div className="text-right"><div className="num font-medium text-danger">{money(f.balance)}</div>{f.overdue && <Badge tone="danger">Overdue</Badge>}</div></li>)}</ul></Card> },
    { id: "approvals", title: "Pending approvals", node: <Card><CardHeader title="Pending approvals" action={<Badge tone="warn">{Q.approvals.length}</Badge>} />
      <ul className="divide-y divide-line">{Q.approvals.slice(0, 5).map((a) => <li key={a.id} className="px-4 py-2.5"><div className="flex items-center justify-between gap-2"><span className="truncate font-medium">{a.title}</span>{a.amount && <span className="num text-xs">{money(a.amount)}</span>}</div><span className="text-xs text-muted">{a.kind} · {a.requester} · {fmtDate(a.date)}</span></li>)}</ul></Card> },
    { id: "lowstock", title: "Low stock", node: <Card><CardHeader title="Low-stock alerts" action={<Link className="text-xs text-info" href="/inventory">Inventory</Link>} />
      <ul className="divide-y divide-line">{[...oos, ...low].slice(0, 6).map((i) => <li key={i.id} className="flex items-center justify-between px-4 py-2.5"><span className="truncate">{i.name}</span><span className="num text-xs"><Badge tone={i.onHand <= 0 ? "danger" : "warn"}>{i.onHand} / {i.reorder}</Badge></span></li>)}{low.length + oos.length === 0 && <li className="p-4 text-muted">All stock above reorder levels.</li>}</ul></Card> },
    { id: "admitted", title: "Recently admitted", node: <Card><CardHeader title="Recently admitted" /><ul className="divide-y divide-line">{[...Q.students].sort((a, b) => b.admittedOn.localeCompare(a.admittedOn)).slice(0, 5).map((s) => <li key={s.id} className="flex items-center gap-2 px-4 py-2.5"><Avatar name={Q.shortName(s)} size={28} /><div className="min-w-0"><Link href={`/students/${s.id}`} className="block truncate font-medium hover:text-info">{Q.fullName(s)}</Link><span className="text-xs text-muted">{Q.getClass(s.classId).name} · {fmtDate(s.admittedOn)}</span></div></li>)}</ul></Card> },
    { id: "msgs", title: "Messages awaiting", node: <Card><CardHeader title="Parent messages awaiting delivery" action={<Link className="text-xs text-info" href="/communications">Open</Link>} />
      <ul className="divide-y divide-line">{Q.messages.filter((m) => ["Queued", "Failed", "Awaiting Approval"].includes(m.status)).slice(0, 5).map((m) => <li key={m.id} className="flex items-center justify-between gap-2 px-4 py-2.5"><div className="min-w-0"><div className="truncate font-medium">{Q.getGuardian(m.guardianId)?.name}</div><span className="text-xs text-muted">{m.template} · {m.channel}</span></div><StatusBadge status={m.status} /></li>)}</ul></Card> },
    { id: "audit", title: "Audit events", node: <Card><CardHeader title="Recent audit events" /><ul className="divide-y divide-line">{Q.audit.slice(0, 5).map((a) => <li key={a.id} className="px-4 py-2.5"><div className="font-medium">{a.action}</div><span className="text-xs text-muted">{a.actor} · {a.module} · {a.at}</span></li>)}</ul></Card> },
    { id: "events", title: "Upcoming events", node: <Card><CardHeader title="Upcoming school events" /><ul className="divide-y divide-line">{[...Q.events].sort((a, b) => a.date.localeCompare(b.date)).map((e) => <li key={e.id} className="flex items-center justify-between px-4 py-2.5"><span>{e.title}</span><span className="text-xs text-muted">{fmtDate(e.date)}</span></li>)}</ul></Card> },
  ];

  return (
    <div className="space-y-5">
      <PageHeader title="Good afternoon, Dr. Yeboah" sub={`${Q.SCHOOL.name} · ${Q.SCHOOL.year} · ${Q.SCHOOL.term} · Week 6 of 15`} actions={<><LinkButton href="/students/new" variant="primary">Register student</LinkButton><LinkButton href="/reports">Reports</LinkButton></>} />
      <div className="grid gap-3">
        <AlertBanner tone="danger" icon={AlertTriangle} title={`Outstanding School Fees: ${money(o.outstanding)} across ${o.owingCount} students`}
          actions={<><LinkButton href="/fees?tab=outstanding" size="sm">View students</LinkButton><LinkButton href="/fees?tab=reminders" size="sm" variant="primary">Prepare reminders</LinkButton></>}>
          {o.overdueCount} balances are overdue ({money(o.overdue)}). {o.eligibleGuardians} guardians are eligible for payment reminders.
        </AlertBanner>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[
            { icon: PackageX, t: "Low stock", d: `${low.length + oos.length} items need restocking`, h: "/inventory", tone: "text-warn" },
            { icon: ClipboardCheck, t: "Pending grade approvals", d: `${pendingGrades} batch awaiting review`, h: "/academics", tone: "text-info" },
            { icon: Wallet, t: "Unreconciled payments", d: `${unrec.length} gateway payments pending (${money(unrec.reduce((a, p) => a + p.amount, 0))}) — not counted as revenue`, h: "/fees?tab=reconcile", tone: "text-warn" },
            { icon: CalendarCheck, t: "Attendance exceptions", d: "3 students absent 3+ consecutive days", h: "/attendance", tone: "text-danger" },
          ].map((b) => <Link key={b.t} href={b.h} className="flex gap-3 rounded-xl border border-line bg-surface p-3 transition hover:shadow-md"><b.icon className={b.tone} size={20} /><div><div className="font-medium">{b.t}</div><div className="text-xs text-muted">{b.d}</div></div></Link>)}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <Kpi label="Total students" value={String(Q.students.length)} icon={GraduationCap} hint="All student records in the current school, any status." href="/students" />
        <Kpi label="Active students" value={String(act.length)} icon={UserCheck} hint="Students with status Active." trend={{ dir: enrDelta >= 0 ? "up" : "down", text: `${enrDelta > 0 ? "+" : ""}${enrDelta}% vs last year`, good: enrDelta >= 0 }} href="/students" tone="ok" />
        <Kpi label="Total parents" value={String(Q.guardians.length)} icon={UsersRound} hint="Unique guardian records (one per person, linked to many children)." href="/parents" />
        <Kpi label="Total teachers" value={String(teachers)} icon={Users} hint="Active staff with a teaching position." href="/staff" />
        <Kpi label="Fee collection rate" value={`${o.rate}%`} icon={Percent} hint="Confirmed payments ÷ total invoiced (net of discounts) for the selected term." href="/fees" tone={o.rate > 60 ? "ok" : "warn"} />
        <Kpi label="Total fees collected" value={moneyShort(o.paid)} icon={Banknote} hint="Sum of confirmed payments. Pending gateway payments are excluded." href="/fees?tab=payments" tone="ok" />
        <Kpi label="Outstanding fees" value={moneyShort(o.outstanding)} icon={Receipt} hint="Invoiced − discounts − confirmed payments, for students with a positive balance." href="/fees?tab=outstanding" tone="warn" />
        <Kpi label="Overdue fees" value={moneyShort(o.overdue)} icon={Clock} hint="Outstanding balances whose invoice due date is before today." href="/fees?tab=outstanding&overdue=1" tone="danger" />
        <Kpi label="Total expenditure" value={moneyShort(Q.totalExpenditure())} icon={Landmark} hint="Approved and paid expenses (accrual of approved spend)." href="/finance" />
        <Kpi label="Cash position" value={moneyShort(Q.cashPosition())} icon={Wallet} hint="Opening bank & cash + confirmed receipts − approved/paid expenses. Not profit." href="/finance" tone="info" />
        <Kpi label="Inventory value" value={moneyShort(Q.stockValue())} icon={Boxes} hint="Quantity on hand × unit cost (accounting cost, not selling or replacement price)." href="/inventory" />
        <Kpi label="Avg. attendance" value={`${Q.avgAttendance()}%`} icon={CalendarCheck} hint="Mean daily school-wide attendance over the last 20 school days." href="/attendance" tone="ok" />
      </div>
      <WidgetBoard widgets={widgets} storageKey="dash-v1" />
      <p className="text-xs text-muted">Demo data is generated locally; figures are derived from invoices, payments and stock movements.</p>
    </div>
  );
}
