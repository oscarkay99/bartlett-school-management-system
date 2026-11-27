"use client";
import { studentHref, printHref } from "@/lib/links";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AlertTriangle, Banknote, CalendarClock, Download, FilePlus2, FileText, Percent, Search, Send, ShieldAlert, Users, Wallet } from "lucide-react";
import { ReceiptCedi as Receipt } from "@/components/ui/icons";
import { AlertBanner, Badge, Button, Card, CardHeader, EmptyState, Kpi, StatusBadge } from "@/components/ui/primitives";
import { ConfirmDialog, DataTable, Drawer, Modal, Select, Tabs, useToast, type Column } from "@/components/ui/interactive";
import { Donut, HBars, LineTrend } from "@/components/charts/charts";
import { RecordPaymentDialog, type PayStudent } from "./RecordPaymentDialog";
import { IssueBillDialog, type BillCandidate } from "./IssueBillDialog";
import { useRole } from "@/components/shell/AppShell";
import { canMessageParents } from "@/lib/permissions";
import { LIVE } from "@/lib/live/config";
import * as Q from "@/lib/data/queries";
import { useSave } from "@/lib/live/useSave";
import { confirmPayment, reversePayment, sendMessage } from "@/lib/live/actions";
import { useCalendar } from "@/components/shell/CalendarContext";
import { useFeeSchedule } from "@/components/shell/FeeScheduleContext";
import { TermFeeStructure } from "@/components/settings/FeeScheduleEditor";
import { activityPrice, feedingRate, invoiceStem, termKey } from "@/lib/fees";
import { termOfDate } from "@/lib/calendar";
import { studentFeedingRate } from "@/lib/feeding";
import { useFeeding } from "@/components/feeding/useFeeding";
import { buildTermInvoices, generatedTotal, type GeneratedInvoice } from "@/lib/generated-invoices";
import { GeneratedInvoiceDialog, useGeneratedInvoices } from "./GeneratedInvoices";
import { ACCOUNTS, ACTIVITY_LEVELS, activitiesOf, type FeeAccount } from "@/lib/accounts";
import { money, moneyShort, pct } from "@/lib/money";
import { fmtDate } from "@/lib/utils";

export interface SRow { id: string; name: string; adm: string; classId: string; cls: string; feedingOwed: number; feedingRate: number; billed: number; paid: number; balance: number; dueOn: string; overdue: boolean; status: string; invoice: string; terms: string[]; items: { label: string; amount: number }[]; payer?: { name: string; phone?: string } }
export interface PRow { id: string; receipt: string; studentId: string; student: string; classId: string; amount: number; feeding: number; feedingPeriod?: string; method: string; date: string; ref: string; status: string; staff: string }
export interface RRow { gid: string; name: string; channel: "SMS" | "WhatsApp" | "Email"; eligible: boolean; reason?: string; last?: string; total: number; overdue: boolean; classIds: string[]; students: { id: string; name: string; balance: number }[]; message: string }
const TODAY = Q.TODAY;
/** Feeding mode of this page: the same layout as School Fees, filled with feeding figures by the Feeding module. */
export interface FeedingMode { tabs: { id: string; label: string; content: React.ReactNode; badge?: string }[]; finder: React.ReactNode; dialog: React.ReactNode; onRecordPay: () => void; onEnrol?: () => void }
const FEEDING_VIEW = { ...ACCOUNTS.fees, label: "Feeding", noun: "feeding", href: "/feeding", nav: "feeding", reminderTemplate: "Feeding Reminder" };
const daysAgo = (n: number) => { const d = new Date(TODAY + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
const COST = { SMS: 5, WhatsApp: 12, Email: 0 } as const; // pesewas per message (estimate)

export function FeesWorkspace({ account, students, payments, reminders, classes, candidates, initialTab, openPay, overdueOnly, usedRefs, feeding }: { account: FeeAccount; students: SRow[]; payments: PRow[]; reminders: RRow[]; classes: { id: string; name: string }[]; candidates: BillCandidate[]; initialTab?: string; openPay?: boolean; overdueOnly?: boolean; usedRefs: string[] ; feeding?: FeedingMode}) {
  // Feeding mode: the same page, with feeding figures (billed = each student's feeding this term).
  const A = feeding ? FEEDING_VIEW : ACCOUNTS[account];
  const { ready, money: access, allow } = useRole(); const full = access === "full"; const canPay = allow("payments", "create"); const canBill = allow("invoices", "create");
  const [cls, setCls] = useState(""); const [range, setRange] = useState("term"); const [payOpen, setPayOpen] = useState(!!openPay); const [billOpen, setBillOpen] = useState(false);
  const router = useRouter();
  const { year, term, calendar } = useCalendar();
  // Everything here is for the year and term picked in the top bar: students invoiced that term, payments made in it.
  const tk = termKey(year, term); const td = calendar.find((y) => y.name === year)?.terms.find((t) => t.name === term);
  const ss = useMemo(() => students.filter((s) => s.terms.includes(tk) && (!cls || s.classId === cls)), [students, cls, tk]);
  const pp = useMemo(() => payments.filter((p) => { const t = termOfDate(calendar, p.date); return t?.year === year && t?.term === term && (!cls || p.classId === cls); }), [payments, cls, calendar, year, term]);
  const inTerm = useMemo(() => new Set(ss.map((s) => s.id)), [ss]);
  const conf = useMemo(() => pp.filter((p) => p.status === "Confirmed"), [pp]);
  const billed = ss.reduce((a, s) => a + s.billed, 0), paid = ss.reduce((a, s) => a + s.paid, 0);
  const owing = ss.filter((s) => s.balance > 0), outstanding = owing.reduce((a, s) => a + s.balance, 0);
  const od = owing.filter((s) => s.overdue), overdue = od.reduce((a, s) => a + s.balance, 0);
  const sum = (from: string) => conf.filter((p) => p.date >= from).reduce((a, p) => a + p.amount, 0);
  const periodFrom = range === "today" ? TODAY : range === "week" ? daysAgo(6) : range === "month" ? daysAgo(29) : (td?.start ?? "2026-09-01");
  const termReminders = reminders.filter((r) => r.students.some((x) => inTerm.has(x.id)) && (!cls || r.classIds.includes(cls)));
  const eligible = termReminders.filter((r) => r.eligible);
  const upcoming = owing.filter((s) => !s.overdue).reduce((a, s) => a + s.balance, 0);
  const byMethod = useMemo(() => { const m = new Map<string, number>(); conf.filter((p) => p.date >= periodFrom).forEach((p) => m.set(p.method, (m.get(p.method) ?? 0) + p.amount / 100)); return [...m].map(([name, value]) => ({ name, value })); }, [conf, periodFrom]);
  const trend = useMemo(() => { const w = new Map<string, number>(); conf.forEach((p) => { const d = new Date(p.date + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); const k = d.toISOString().slice(5, 10); w.set(k, (w.get(k) ?? 0) + p.amount / 100); }); return [...w].sort().map(([week, collected]) => ({ week, collected })); }, [conf]);
  const byClass = useMemo(() => classes.map((c) => ({ name: c.name, outstanding: ss.filter((s) => s.classId === c.id && s.balance > 0).reduce((a, s) => a + s.balance, 0) / 100 })), [classes, ss]);
  // Anyone can pay (also before their invoice is issued): the picker lists every active student, not only those billed this term.
  const payStudents: PayStudent[] = Q.activeStudents().map((x) => payStudentOf(x.id, account));

  const filters = (
    <div className="flex flex-wrap items-center gap-2">
      <Select label="Class" value={cls} onChange={setCls} options={[{ value: "", label: "All classes" }, ...classes.map((c) => ({ value: c.id, label: c.name }))]} />
      {full && <Select label="Collection period" value={range} onChange={setRange} options={[{ value: "today", label: "Today" }, { value: "week", label: "Last 7 days" }, { value: "month", label: "Last 30 days" }, { value: "term", label: "This term" }]} />}
      <span className="text-xs text-muted">{term} · {year}</span>
    </div>
  );

  const overview = (
    <div className="space-y-4">
      <AlertBanner tone={overdue > 0 ? "danger" : "ok"} icon={AlertTriangle} title={`Outstanding ${A.label}: ${money(outstanding)} across ${owing.length} students`}
        actions={<><Button size="sm" onClick={() => router.push(`${A.href}?tab=outstanding`)}>View Outstanding Students</Button><Button size="sm" variant="primary" onClick={() => router.push(`${A.href}?tab=reminders`)}>Prepare Reminders</Button>{!feeding && <Button size="sm" onClick={() => router.push(`${A.href}?tab=outstanding&overdue=1`)}>View Overdue</Button>}<Button size="sm" onClick={() => exportCsv(owing, account)}><Download size={13} />Export Report</Button></>}>
        {feeding ? "" : `${od.length} balances are overdue (${money(overdue)}). `}{eligible.length} guardians are eligible for payment reminders.
      </AlertBanner>
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
        <Kpi label={feeding ? "Total feeding billed" : "Total invoiced"} value={moneyShort(billed)} icon={FileText} hint={feeding ? "Feeding owed this term by everyone on feeding (not part of school fees)." : `Sum of ${A.label} invoices net of discounts for the filtered students.`} />
        <Kpi label="Confirmed collections" value={moneyShort(paid)} icon={Banknote} tone="ok" hint="Confirmed payments only; pending gateway payments excluded." />
        <Kpi label="Collection rate" value={`${pct(paid, billed)}%`} icon={Percent} tone="info" hint={`Confirmed collections ÷ total ${feeding ? "billed" : "invoiced"}.`} />
        <Kpi label="Expected upcoming" value={moneyShort(upcoming)} icon={CalendarClock} hint="Outstanding balances not yet past their due date." />
        {!feeding && <Kpi label="Overdue" value={moneyShort(overdue)} icon={ShieldAlert} tone="danger" hint="Outstanding balances past due date." href={`${A.href}?tab=outstanding&overdue=1`} />}
        <Kpi label="Collected in period" value={moneyShort(sum(periodFrom))} icon={Wallet} tone="ok" hint="Confirmed payments within the selected period." />
        <Kpi label="Paid in full" value={`${ss.filter((s) => s.balance <= 0).length} / ${ss.length}`} icon={Users} hint={`Students billed for ${A.label} with a zero or credit balance.`} />
        <Kpi label="Unpaid / partial" value={`${ss.filter((s) => s.balance > 0 && s.paid === 0).length} / ${ss.filter((s) => s.balance > 0 && s.paid > 0).length}`} icon={Receipt} hint="Students with no payment / some payment but a balance." />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2"><CardHeader title="Collection trend" sub="Weekly confirmed collections" /><div className="px-2 pb-3"><LineTrend data={trend} x="week" y="collected" label="Collected" /></div></Card>
        <Card><CardHeader title="Collections by method" /><div className="px-2 pb-3"><Donut data={byMethod} /></div></Card>
        <Card className="lg:col-span-3"><CardHeader title="Outstanding by class" /><div className="px-2 pb-3"><HBars data={byClass} x="name" y="outstanding" label="Outstanding" height={320} /></div></Card>
      </div>
    </div>
  );

  // Wait for the saved role so the Administrator never sees the collections view flash on load.
  if (!ready) return null;
  const breakdown = account === "fees"
    ? { id: "books", label: "Books", node: <ItemBreakdown students={ss} sections={[{ key: "Books", title: "Books", sub: "Textbooks and learning materials, on the school fees invoice" }]} /> }
    : { id: "activities", label: "Activities", node: <Activities students={ss} account={account} /> };
  type Tab = { id: string; label: string; content: React.ReactNode; badge?: string };
  const tabs = ([
    full && { id: "overview", label: "Dashboard", content: overview },
    { id: "outstanding", label: "Outstanding", badge: String(owing.length), content: <OutstandingTable rows={ss.filter((s) => s.balance > 0)} overdueOnly={overdueOnly} account={account} showTotals={full} tab={feeding ? "feeding" : account} overdueLabel={feeding ? "Behind on plan only" : undefined} /> },
    { id: "reminders", label: "Reminders", badge: String(eligible.length), content: <Reminders rows={termReminders} /> },
    full && { id: "payments", label: "Payments & receipts", content: <PaymentsTable rows={pp} /> },
    full && !feeding && { id: "invoices", label: "Invoices", content: <Invoices students={ss} candidates={candidates.filter((c) => !cls || c.classId === cls)} account={account} canBill={canBill} onIssue={() => setBillOpen(true)} /> },
    full && !feeding && { id: breakdown.id, label: breakdown.label, content: breakdown.node },
    full && !feeding && account === "fees" && { id: "structures", label: "Fee structures", content: <TermFeeStructure /> },
    full && { id: "reconcile", label: "Reconciliation", badge: String(pp.filter((p) => p.status !== "Confirmed").length), content: <Reconcile rows={pp} /> },
    ...(feeding?.tabs ?? []),
  ] as (Tab | false)[]).filter((t): t is Tab => !!t);
  const start = initialTab && tabs.some((t) => t.id === initialTab) ? initialTab : undefined;
  return (
    <div className="space-y-4">
      {!full && <AlertBanner tone="info" icon={Users} title="Follow-up view">You can see which students owe and send reminders to their parents. Collections and payment records are only visible to the Owner and the Accountant.</AlertBanner>}
      {feeding ? feeding.finder : <StudentFinder account={account} canPay={canPay} usedRefs={usedRefs} />}
      <div className="flex flex-wrap items-center justify-between gap-3">{filters}
        <div className="flex flex-wrap gap-2">{canBill && !feeding && account !== "fees" && <Button onClick={() => setBillOpen(true)}><FilePlus2 size={14} />Enrol & bill student</Button>}
          {feeding?.onEnrol && <Button onClick={feeding.onEnrol}><FilePlus2 size={14} />Enrol student</Button>}
          {canPay && <Button variant="primary" onClick={() => (feeding ? feeding.onRecordPay() : setPayOpen(true))}><Receipt size={14} />Record {A.label.toLowerCase()} payment</Button>}</div></div>
      <Tabs key={access} initial={start} tabs={tabs} />
      {feeding?.dialog}
      {canPay && !feeding && <RecordPaymentDialog open={payOpen} onClose={() => setPayOpen(false)} students={payStudents} usedRefs={usedRefs} account={account} />}
      {canBill && !feeding && <IssueBillDialog open={billOpen} onClose={() => setBillOpen(false)} account={account} candidates={candidates} />}
    </div>
  );
}

function exportCsv(rows: SRow[], account: FeeAccount) {
  const csv = ["Admission,Student,Class,Billed,Paid,Balance,Due"].concat(rows.map((r) => [r.adm, `"${r.name}"`, r.cls, r.billed / 100, r.paid / 100, r.balance / 100, r.dueOn].join(","))).join("\n");
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = `outstanding-${account}.csv`; a.click();
}

function OutstandingTable({ rows, overdueOnly, account, showTotals, tab = account, overdueLabel = "Overdue only" }: { rows: SRow[]; overdueOnly?: boolean; account: FeeAccount; showTotals: boolean; tab?: string; overdueLabel?: string }) {
  const [od, setOd] = useState(overdueOnly ? "1" : ""); const r = useRouter();
  const data = rows.filter((x) => !od || x.overdue);
  const cols: Column<SRow>[] = [
    { key: "n", header: "Student", sort: (x) => x.name, render: (x) => <div><div className="font-medium">{x.name}</div><div className="text-xs text-muted">{x.adm}</div></div> },
    { key: "c", header: "Class", render: (x) => x.cls },
    ...(showTotals ? [{ key: "b", header: "Billed", align: "right", hideOnMobile: true, render: (x) => money(x.billed) }, { key: "p", header: "Paid", align: "right", hideOnMobile: true, render: (x) => money(x.paid) }] as Column<SRow>[] : []),
    { key: "o", header: "Outstanding", align: "right", sort: (x) => x.balance, render: (x) => <b className="text-danger">{money(x.balance)}</b> },
    { key: "d", header: "Due", sort: (x) => x.dueOn, render: (x) => fmtDate(x.dueOn) }, { key: "s", header: "Status", render: (x) => <StatusBadge status={x.status} /> },
  ];
  return <Card><DataTable rows={data} columns={cols} rowId={(x) => x.id} searchText={(x) => `${x.name} ${x.adm}`} onRowClick={(x) => r.push(studentHref(x.id, tab))}
    filters={<Select label="Overdue filter" value={od} onChange={setOd} options={[{ value: "", label: "All outstanding" }, { value: "1", label: overdueLabel }]} />}
    toolbar={<Button size="sm" onClick={() => exportCsv(data, account)}><Download size={13} />CSV</Button>} /></Card>;
}

function Reminders({ rows }: { rows: RRow[] }) {
  const { role: myRole } = useRole(); const canSend = canMessageParents(myRole);
  const run = useSave();
  const [sel, setSel] = useState<Set<string>>(new Set()); const [ch, setCh] = useState(""); const [od, setOd] = useState(""); const [view, setView] = useState<RRow | null>(null); const [confirm, setConfirm] = useState(false); const toast = useToast();
  const data = rows.filter((r) => (!ch || r.channel === ch) && (!od || r.overdue));
  const picked = data.filter((r) => sel.has(r.gid) && r.eligible);
  const cost = picked.reduce((a, r) => a + COST[r.channel] * (r.channel === "SMS" ? Math.ceil(r.message.length / 160) : 1), 0);
  const cols: Column<RRow>[] = [
    { key: "g", header: "Guardian", sort: (x) => x.name, render: (x) => <div><div className="font-medium">{x.name}</div><div className="text-xs text-muted">{x.students.map((s) => s.name.split(" ")[0]).join(", ")}</div></div> },
    { key: "s", header: "Students", hideOnMobile: true, render: (x) => x.students.length },
    { key: "t", header: "Outstanding", align: "right", sort: (x) => x.total, render: (x) => <b>{money(x.total)}</b> },
    { key: "c", header: "Channel", render: (x) => x.channel },
    { key: "e", header: "Eligibility", render: (x) => x.eligible ? <Badge tone="ok" dot>Eligible</Badge> : <Badge tone="warn" dot>{x.reason}</Badge> },
    { key: "l", header: "Last reminder", hideOnMobile: true, render: (x) => x.last ? fmtDate(x.last) : "Never" },
    { key: "p", header: "Preview", render: (x) => <Button size="sm" variant="ghost" onClick={() => setView(x)}>Preview</Button> },
  ];
  return (
    <div className="space-y-3">
      <Card className="p-4"><div className="flex flex-wrap items-center justify-between gap-3">
        <div><div className="font-semibold">Bulk reminders</div><p className="text-sm text-muted">One consolidated message per guardian. Only guardians who are verified, financially responsible, and have consented are eligible; siblings are never disclosed to unauthorised guardians.</p></div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm"><span className="whitespace-nowrap"><b>{picked.length}</b> selected</span><span className="whitespace-nowrap text-muted">Est. cost <b className="num text-fg">{money(cost)}</b></span>{canSend ? <Button variant="primary" disabled={picked.length === 0} onClick={() => setConfirm(true)}><Send size={14} />Send reminders</Button> : <span className="text-xs text-muted">Read-only: your role can&apos;t send reminders.</span>}</div></div></Card>
      <Card><DataTable rows={data} columns={cols} rowId={(x) => x.gid} selectable selected={sel} onSelect={setSel} searchText={(x) => x.name + x.students.map((s) => s.name).join(" ")}
        filters={<><Select label="Channel" value={ch} onChange={setCh} options={[{ value: "", label: "Any channel" }, { value: "WhatsApp", label: "WhatsApp" }, { value: "SMS", label: "SMS" }, { value: "Email", label: "Email" }]} /><Select label="Overdue" value={od} onChange={setOd} options={[{ value: "", label: "All balances" }, { value: "1", label: "Overdue only" }]} /></>}
        toolbar={<Button size="sm" variant="ghost" onClick={() => setSel(new Set(data.filter((r) => r.eligible).map((r) => r.gid)))}>Select all eligible ({data.filter((r) => r.eligible).length})</Button>} pageSize={10} /></Card>
      <Drawer open={!!view} onClose={() => setView(null)} title="Reminder preview" footer={<Button onClick={() => setView(null)}>Close</Button>}>
        {view && <><div className="mb-3 flex flex-wrap gap-2"><Badge tone="info">{view.channel}</Badge>{view.eligible ? <Badge tone="ok">Eligible</Badge> : <Badge tone="warn">{view.reason}</Badge>}</div><pre className="whitespace-pre-wrap rounded-lg border border-line bg-surface-2 p-4 font-sans leading-relaxed">{view.message}</pre>
          <ul className="mt-3 divide-y divide-line text-sm">{view.students.map((s) => <li key={s.id} className="flex justify-between py-1.5"><Link className="hover:text-info" href={studentHref(s.id)}>{s.name}</Link><span className="num">{money(s.balance)}</span></li>)}</ul></>}
      </Drawer>
      <Modal open={confirm} onClose={() => setConfirm(false)} title="Send reminders?" footer={<><Button onClick={() => setConfirm(false)}>Cancel</Button><Button variant="primary" onClick={async () => {
          if (LIVE) { // No SMS/WhatsApp provider is connected: record them in the message log, and say so.
            const ok = await run(async () => { for (const r of picked) { const e = await sendMessage({ guardianId: r.gid, studentIds: r.students.map((x) => x.id), channel: r.channel, template: "Fee Reminder", body: r.message, amount: r.total }); if (e) return e; } return ""; },
              `${picked.length} reminders recorded in the message log. No SMS/WhatsApp provider is connected yet, so nothing was sent automatically.`);
            if (ok) { setConfirm(false); setSel(new Set()); } return; }
          toast(`${picked.length} reminders queued. Balances will be re-checked before each send.`); setConfirm(false); setSel(new Set()); }}>Queue {picked.length} reminders</Button></>}>
        <p>{picked.length} guardians · estimated provider cost <b>{money(cost)}</b>.</p><p className="mt-2 text-sm text-muted">Messages are queued, balances re-verified at send time, quiet hours respected, and anyone who has fully paid in the meantime is skipped automatically.</p>
      </Modal>
    </div>
  );
}

function PaymentsTable({ rows }: { rows: PRow[] }) {
  const [m, setM] = useState("");
  const cols: Column<PRow>[] = [
    { key: "r", header: "Receipt", sort: (x) => x.receipt, render: (x) => <b className="num">{x.receipt}</b> }, { key: "s", header: "Student", sort: (x) => x.student, render: (x) => <Link href={studentHref(x.studentId)} className="hover:text-info">{x.student}</Link> },
    { key: "a", header: "Amount", align: "right", sort: (x) => x.amount, render: (x) => money(x.amount) },
    { key: "f", header: "Feeding", align: "right", hideOnMobile: true, render: (x) => (x.feeding ? <span className="num">{money(x.feeding)}{x.feedingPeriod && <span className="block text-[11px] text-muted">{x.feedingPeriod === "Term" ? "for the term" : x.feedingPeriod.toLowerCase()}</span>}</span> : <span className="text-muted">—</span>) },
    { key: "m", header: "Method", hideOnMobile: true, render: (x) => x.method },
    { key: "d", header: "Date", sort: (x) => x.date, render: (x) => fmtDate(x.date) }, { key: "ref", header: "Reference", hideOnMobile: true, render: (x) => <span className="num text-xs">{x.ref}</span> },
    { key: "st", header: "Status", render: (x) => <StatusBadge status={x.status} /> }, { key: "p", header: "", render: (x) => x.status === "Confirmed" ? <span className="flex items-center gap-3"><Link className="text-info" href={printHref("receipt", x.id)}>Receipt</Link>{LIVE && <PaymentActions p={x} />}</span> : null },
  ];
  return <Card><DataTable rows={rows.filter((r) => !m || r.method === m)} columns={cols} rowId={(x) => x.id} searchText={(x) => `${x.receipt} ${x.student} ${x.ref}`} filters={<Select label="Method" value={m} onChange={setM} options={[{ value: "", label: "All methods" }, ...["Cash", "Mobile Money", "Bank Transfer", "Card", "Cheque"].map((v) => ({ value: v, label: v }))]} />} pageSize={12} /></Card>;
}

// One row of the Invoices tab: a recorded invoice, or one generated in this browser with "Generate Term N invoices".
type InvRow = { id: string; invoice: string; name: string; cls: string; activities: string; total: number; paid: number; dueOn: string; status: string; gen?: GeneratedInvoice };

function Invoices({ students, candidates, account, canBill, onIssue }: { students: SRow[]; candidates: BillCandidate[]; account: FeeAccount; canBill: boolean; onIssue: () => void }) {
  const [o, setO] = useState(false); const [view, setView] = useState<InvRow | null>(null); const A = ACCOUNTS[account]; const { role } = useRole();
  const { year, term } = useCalendar(); const key = termKey(year, term); const fs = useFeeSchedule();
  const generated = useGeneratedInvoices(year, term, account); const gen = generated.list;
  const ids = new Set(candidates.map((c) => c.id));
  const rows: InvRow[] = [
    ...students.filter((s) => s.terms.includes(key)).map((s) => ({ id: s.id, invoice: s.invoice, name: s.name, cls: s.cls, activities: s.items.map((i) => i.label).join(", "), total: s.billed, paid: s.paid, dueOn: s.dueOn, status: s.status })),
    ...gen.filter((g) => ids.has(g.studentId)).map((g) => ({ id: g.no, invoice: g.no, name: g.name, cls: fs.classes.find((c) => c.id === g.classId)?.name ?? "", activities: g.items.map((i) => i.label).join(", "), total: generatedTotal(g), paid: 0, dueOn: g.dueOn, status: generated.live ? (g.no.startsWith("Awaiting") ? "Awaiting approval" : "Draft") : "Outstanding", gen: g })),
  ];
  return (
    <Card><CardHeader title={`${A.label} invoices — ${term} ${year}`} sub={`Numbered ${invoiceStem(A.invoicePrefix, year, term)}-… and receipted separately (${A.receiptPrefix}-…)`} action={canBill ? (account === "fees" ? <Button variant="primary" size="sm" onClick={() => setO(true)}>Generate {term} invoices</Button> : <Button variant="primary" size="sm" onClick={onIssue}><FilePlus2 size={13} />Issue new bill</Button>) : undefined} />
      {gen.length > 0 && <div className="mx-4 mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-info/30 bg-info/8 px-3 py-2 text-sm">
        <span><b>{gen.length}</b> {term} {account === "fees" ? "invoices generated" : "bills not issued yet"} · {money(gen.reduce((a, g) => a + generatedTotal(g), 0))}. {generated.live
          ? <>Not issued yet: {generated.awaiting > 0 ? <>{generated.awaiting} await the Owner&apos;s approval. Approving issues them with their numbers and adds them to balances.</> : "they are drafts."}</>
          : "Saved in this browser until the backend is connected; payments against them are recorded once it is."}</span>
        <span className="flex gap-2">{generated.live && role === "owner" && generated.awaiting > 0 && <Button size="sm" variant="primary" onClick={generated.approve}>Approve {generated.awaiting} {account === "fees" ? "invoices" : generated.awaiting === 1 ? "bill" : "bills"}</Button>}
        {(LIVE ? role === "owner" : canBill) && <DiscardGenerated count={gen.length} term={term} onDiscard={generated.clear} />}</span></div>}
      <DataTable rows={rows} empty={<EmptyState icon={FileText} title={`No ${A.label.toLowerCase()} invoices for ${term} ${year} yet`} body={account === "fees" ? "Generate this term's invoices once its fees are set." : "Issue bills to students as they enrol."} />} columns={[
        { key: "i", header: "Invoice", render: (x) => <b className="num">{x.invoice}</b> }, { key: "n", header: "Student", sort: (x) => x.name, render: (x) => x.name }, { key: "c", header: "Class", render: (x) => x.cls },
        ...(account !== "fees" ? [{ key: "a", header: "Activities", hideOnMobile: true, render: (x: InvRow) => x.activities }] : []),
        { key: "b", header: "Total", align: "right", sort: (x) => x.total, render: (x) => money(x.total) }, { key: "p", header: "Paid", align: "right", render: (x) => money(x.paid) }, { key: "d", header: "Due", hideOnMobile: true, render: (x) => fmtDate(x.dueOn) },
        { key: "s", header: "Status", render: (x) => <StatusBadge status={x.status} /> },
        { key: "pdf", header: "", render: (x) => x.gen ? (account === "fees" ? <button className="text-info hover:underline" onClick={() => setView(x)}>View</button> : null) : <Link className="text-info" href={printHref("invoice", x.invoice)}>PDF</Link> },
      ]} rowId={(x) => x.id} searchText={(x) => `${x.name} ${x.invoice}`} pageSize={10} />
      {o && <GenerateInvoices candidates={candidates} already={new Set(gen.map((g) => g.studentId))} startSeq={gen.length} onGenerate={generated.add} onClose={() => setO(false)} />}
      {view?.gen && <GeneratedInvoiceDialog inv={view.gen} cls={view.cls} onClose={() => setView(null)} />}
    </Card>
  );
}

function DiscardGenerated({ count, term, onDiscard }: { count: number; term: string; onDiscard: () => void }) {
  const [open, setOpen] = useState(false); const toast = useToast();
  return (<>
    <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>Discard</Button>
    <Modal open={open} onClose={() => setOpen(false)} title={`Discard ${count} generated ${term} invoices?`} footer={<><Button onClick={() => setOpen(false)}>Keep them</Button><Button variant="danger" onClick={() => { onDiscard(); setOpen(false); toast(`${count} ${term} invoices discarded`); }}>Discard</Button></>}>
      <p className="text-sm">Use this if the fees were wrong: change them in Settings → Fee schedule, then generate again. Nothing has been paid against these invoices yet.</p>
    </Modal>
  </>);
}

// Bulk school-fee billing for the selected term: every active student without an invoice that term is billed
// from the fee schedule (their class's fees and feeding). Idempotent by student + term.
function GenerateInvoices({ candidates, already, startSeq, onGenerate, onClose }: { candidates: BillCandidate[]; already: Set<string>; startSeq: number; onGenerate: (inv: GeneratedInvoice[]) => void; onClose: () => void }) {
  const { year, term, calendar } = useCalendar(); const fs = useFeeSchedule(); const tf = fs.get(year, term); const toast = useToast();
  const key = termKey(year, term);
  const todo = candidates.filter((c) => !c.billed[key]?.length && !already.has(c.id));
  const termStart = calendar.find((y) => y.name === year)?.terms.find((t) => t.name === term)?.start ?? new Date().toISOString().slice(0, 10);
  const built = tf ? buildTermInvoices(todo, fs.classes, tf, termStart, startSeq) : [];
  const byClass = fs.classes.map((cls) => { const l = built.filter((x) => x.classId === cls.id); return { cls, n: l.length, total: l.reduce((a, x) => a + generatedTotal(x), 0) }; }).filter((r) => r.n > 0);
  const total = byClass.reduce((a, r) => a + r.total, 0);
  return (
    <Modal open onClose={onClose} title={`Generate ${term} ${year} invoices`} wide footer={<><Button onClick={onClose}>Close</Button>{built.length > 0 && <Button variant="primary" onClick={() => { onGenerate(built); toast(`${built.length} ${term} invoices generated · ${money(total)}`); onClose(); }}>Generate {built.length} invoices · {money(total)}</Button>}</>}>
      {!tf ? <div className="space-y-2"><p>{term} {year} has no fees set, so invoices can&apos;t be generated yet.</p><Link className="text-sm font-medium text-info hover:underline" href="/settings?tab=fees">Set {term} fees in Settings →</Link></div>
        : built.length === 0 ? <><p>All <b>{candidates.length}</b> active students in the current filter already have a {term} invoice.</p><p className="mt-2 text-sm text-muted">Each student can only have one invoice per term, so running this again never creates duplicates. New students admitted later are picked up automatically.</p></>
        : <div className="space-y-3">
            <p><b>{built.length}</b> students have no {term} invoice yet. Each is billed their class&apos;s {term} school fees from the fee schedule. Feeding is not on this invoice (it is paid in Feeding).</p>
            <div className="overflow-x-auto rounded-lg border border-line"><table className="w-full text-sm"><thead className="bg-surface-2/60 text-xs uppercase text-muted"><tr><th className="px-3 py-2 text-left">Class</th><th className="px-3 text-right">Students</th><th className="px-3 text-right">Total</th></tr></thead>
              <tbody className="divide-y divide-line">{byClass.map((r) => <tr key={r.cls.id}><td className="px-3 py-2">{r.cls.name}</td><td className="num px-3 text-right">{r.n}</td><td className="num px-3 text-right">{money(r.total)}</td></tr>)}</tbody>
              <tfoot><tr className="border-t-2 border-line font-semibold"><td className="px-3 py-2">Total</td><td className="num px-3 text-right">{built.length}</td><td className="num px-3 text-right">{money(total)}</td></tr></tfoot></table></div>
            <p className="text-xs text-muted">Numbered {built[0].no} onwards. Scholarship students get 25% off tuition.</p>
          </div>}
    </Modal>
  );
}

// Billed per class for the given item labels: amount per student × students charged = total.
function ItemBreakdown({ students, sections }: { students: SRow[]; sections: { key: string; title: string; sub: string }[] }) {
  const classIds = Array.from(new Set(students.map((s) => s.classId)));
  const totals = sections.map((sec) => {
    const lines = classIds.map((cid) => {
      const charged = students.filter((s) => s.classId === cid).map((s) => ({ s, amt: s.items.find((i) => i.label === sec.key)?.amount ?? 0 })).filter((x) => x.amt > 0);
      const rates = charged.map((x) => x.amt);
      return { classId: cid, name: students.find((s) => s.classId === cid)!.cls, amount: rates.sort((a, b) => rates.filter((v) => v === b).length - rates.filter((v) => v === a).length)[0] ?? 0, students: charged.length, total: charged.reduce((a, x) => a + x.amt, 0) };
    }).filter((l) => l.students > 0);
    return { ...sec, lines, students: lines.reduce((a, x) => a + x.students, 0), total: lines.reduce((a, x) => a + x.total, 0) };
  });
  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-2">
        {totals.map((t) => (
          <Card key={t.key}><CardHeader title={t.title} sub={t.sub} action={<Badge tone="info">Total {money(t.total)}</Badge>} />
            <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-surface-2/60 text-xs uppercase text-muted"><tr><th className="px-3 py-2 text-left sm:px-4">Class</th><th className="whitespace-nowrap px-2 text-right sm:px-3">Per student</th><th className="hidden px-3 text-right sm:table-cell">Students</th><th className="px-3 text-right sm:px-4">Total</th></tr></thead>
              <tbody className="divide-y divide-line">{t.lines.map((l) => <tr key={l.classId}><td className="whitespace-nowrap px-3 py-2.5 font-medium sm:px-4">{l.name}</td><td className="num whitespace-nowrap px-2 text-right sm:px-3">{money(l.amount)}</td><td className="num hidden px-3 text-right sm:table-cell">{l.students}</td><td className="num whitespace-nowrap px-3 text-right font-medium sm:px-4">{money(l.total)}</td></tr>)}</tbody>
              <tfoot><tr className="border-t-2 border-line bg-surface-2/60 font-semibold"><td className="px-3 py-2.5 sm:px-4">Total</td><td className="px-2 sm:px-3" /><td className="num hidden px-3 text-right sm:table-cell">{t.students}</td><td className="num whitespace-nowrap px-3 text-right sm:px-4">{money(t.total)}</td></tr></tfoot></table></div></Card>
        ))}
      </div>
      <p className="text-xs text-muted">Payments are applied to the whole bill, so collections are not split by item.</p>
    </div>
  );
}

// Which classes take each activity this term, and at what price (as set in Settings → Fee schedule).
function ClassPrices({ account }: { account: FeeAccount }) {
  const { year, term } = useCalendar(); const fs = useFeeSchedule(); const tf = fs.get(year, term); const acts = activitiesOf(account);
  if (!tf) return null;
  return (
    <Card><CardHeader title={`Classes and prices — ${term} ${year}`} sub="Who takes what, from Settings → Fee schedule. Compulsory: every student in a class that takes an activity is billed for it automatically. — = that class doesn't take it." />
      <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-surface-2/60 text-xs uppercase text-muted"><tr><th className="px-4 py-2 text-left">Class</th>{acts.map((a) => <th key={a} className="px-4 text-right">{a}</th>)}</tr></thead>
        <tbody className="divide-y divide-line">{fs.classes.map((c) => <tr key={c.id}><td className="px-4 py-2.5">{c.name}</td>{acts.map((a) => { const on = (ACTIVITY_LEVELS as Record<string, readonly string[]>)[a]?.includes(c.level); const p = activityPrice(tf, c, a);
          return <td key={a} className="num px-4 text-right">{on && p > 0 ? money(p) : <span className="text-muted">—</span>}</td>; })}</tr>)}</tbody></table></div></Card>
  );
}

// Extracurricular / Extra Classes: one card per activity (enrolment and billed), plus the full roster.
function Activities({ students, account }: { students: SRow[]; account: FeeAccount }) {
  const ACTIVITIES = activitiesOf(account);
  const [act, setAct] = useState(""); const r = useRouter();
  const per = ACTIVITIES.map((a) => { const kids = students.filter((s) => s.items.some((i) => i.label === a)); return { a, kids: kids.length, billed: kids.reduce((x, s) => x + (s.items.find((i) => i.label === a)?.amount ?? 0), 0) }; });
  const rows = students.filter((s) => !act || s.items.some((i) => i.label === act));
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">{per.map((p) => <button key={p.a} onClick={() => setAct(act === p.a ? "" : p.a)} className={`rounded-xl border bg-surface p-4 text-left transition hover:shadow-md ${act === p.a ? "border-info ring-1 ring-info" : "border-line"}`}><div className="text-xs text-muted">{p.a}</div><div className="mt-1 text-2xl font-semibold">{p.kids} <span className="text-sm font-normal text-muted">students</span></div><div className="num mt-1 text-sm">Billed {money(p.billed)}</div></button>)}</div>
      <Card><DataTable rows={rows} rowId={(x) => x.id} searchText={(x) => `${x.name} ${x.adm}`} onRowClick={(x) => r.push(studentHref(x.id, account))} pageSize={12}
        filters={<Select label="Activity" value={act} onChange={setAct} options={[{ value: "", label: "All activities" }, ...ACTIVITIES.map((a) => ({ value: a, label: a }))]} />}
        columns={[
          { key: "n", header: "Student", sort: (x) => x.name, render: (x) => <div><div className="font-medium">{x.name}</div><div className="text-xs text-muted">{x.adm}</div></div> },
          { key: "c", header: "Class", render: (x) => x.cls }, { key: "a", header: "Activities", render: (x) => <div className="flex flex-wrap gap-1">{x.items.map((i) => <Badge key={i.label}>{i.label}</Badge>)}</div> },
          { key: "b", header: "Billed", align: "right", hideOnMobile: true, render: (x) => money(x.billed) }, { key: "o", header: "Balance", align: "right", sort: (x) => x.balance, render: (x) => <span className={x.balance > 0 ? "font-medium text-danger" : ""}>{money(Math.max(0, x.balance))}</span> },
          { key: "s", header: "Status", render: (x) => <StatusBadge status={x.status} /> },
        ]} /></Card>
      <ClassPrices account={account} />
    </div>
  );
}

function Reconcile({ rows }: { rows: PRow[] }) {
  const exc = rows.filter((r) => r.status !== "Confirmed"); const toast = useToast();
  const dupRefs = Object.entries(rows.reduce<Record<string, number>>((a, r) => ({ ...a, [r.ref]: (a[r.ref] ?? 0) + 1 }), {})).filter(([, n]) => n > 1);
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">{[["Pending verification", exc.filter((e) => e.status === "Pending").length, "warn"], ["Reversed", exc.filter((e) => e.status === "Reversed").length, "danger"], ["Duplicate references", dupRefs.length, dupRefs.length ? "danger" : "ok"]].map(([k, v, t]) => <Card key={k as string} className="p-4"><div className="text-xs text-muted">{k}</div><div className="mt-1 flex items-center gap-2 text-2xl font-semibold">{v as number}<Badge tone={t as "warn"}>{(v as number) === 0 ? "Clear" : "Needs review"}</Badge></div></Card>)}</div>
      <Card><CardHeader title="Exceptions" sub="Pending gateway payments are not counted as revenue until verified via the signed provider callback." />
        {exc.length === 0 ? <p className="px-4 pb-4 text-muted">No exceptions in the current filter.</p> : exc.map((e) => <div key={e.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3"><div><div className="flex items-center gap-2"><b className="num">{e.ref}</b><StatusBadge status={e.status} /></div><div className="text-xs text-muted">{e.student} · {e.method} · {fmtDate(e.date)}</div></div><div className="flex items-center gap-2"><b className="num">{money(e.amount)}</b>{e.status === "Pending" && (LIVE ? <PaymentActions p={e} pending /> : <><Button size="sm" onClick={() => toast("Match requires gateway verification (backend)", "err")}>Match</Button><Button size="sm" variant="ghost" onClick={() => toast("Marked for follow-up")}>Flag</Button></>)}</div></div>)}</Card>
    </div>
  );
}

/** Live: confirm a pending payment, or reverse one (Bursar / Owner; a reason is required and the original stays on record). */
function PaymentActions({ p, pending }: { p: PRow; pending?: boolean }) {
  const { allow } = useRole(); const run = useSave(); const [rev, setRev] = useState(false);
  if (!allow("payments", "create")) return null;
  return (<>
    {pending && <Button size="sm" onClick={() => run(() => confirmPayment(p.id), `${p.receipt} confirmed`)}>Confirm</Button>}
    <button className="text-xs text-danger hover:underline" onClick={() => setRev(true)}>Reverse</button>
    <ConfirmDialog open={rev} onClose={() => setRev(false)} danger needReason title={`Reverse ${p.receipt}?`} confirmLabel="Reverse payment"
      body={`${money(p.amount)} from ${p.student}. The payment stays on record as Reversed and no longer counts towards the balance. Give the reason (e.g. wrong amount, bounced cheque).`}
      onConfirm={(reason) => { setRev(false); void run(() => reversePayment(p.id, reason ?? ""), `${p.receipt} reversed`); }} />
  </>);
}

/** Find any student (not only those already invoiced this term), see where they stand, and act. */
function StudentFinder({ account, canPay, usedRefs }: { account: FeeAccount; canPay: boolean; usedRefs: string[] }) {
  const A = ACCOUNTS[account]; const { year, term } = useCalendar(); const { money: access } = useRole();
  const [q, setQ] = useState(""); const [pay, setPay] = useState<string | null>(null);
  const n = q.trim().toLowerCase();
  const found = n.length < 2 ? [] : Q.students.filter((s) => `${Q.fullName(s)} ${s.admissionNo}`.toLowerCase().includes(n)).slice(0, 6);
  const termOf = (id: string) => { const inv = Q.invoicesOf(id, account).filter((i) => i.year === year && i.term === term); return inv; };
  return (
    <div className="relative">
      <div className="relative"><Search size={16} className="absolute left-3 top-3 text-muted" />
        <input aria-label="Find a student" className="h-10 w-full rounded-lg border border-line bg-surface pl-9 pr-3 text-sm" placeholder={`Find a student by name or admission number (all students, ${term} ${year})`} value={q} onChange={(e) => setQ(e.target.value)} /></div>
      {n.length >= 2 && <Card className="mt-1"><ul className="divide-y divide-line">
        {found.length === 0 && <li className="px-4 py-3 text-sm text-muted">No student matches &ldquo;{q}&rdquo;.</li>}
        {found.map((s) => { const inv = termOf(s.id); const f = Q.accountSummary(s.id, account);
          return <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-sm">
            <span><b>{Q.fullName(s)}</b> <span className="text-xs text-muted">{s.admissionNo} · {Q.getClass(s.classId)?.name}{s.status !== "Active" ? ` · ${s.status}` : ""}</span></span>
            <span className="flex flex-wrap items-center gap-3">
              {access === "none" ? null : inv.length === 0 ? <Badge tone="neutral">No {term} {A.label.toLowerCase()} invoice yet</Badge>
                : <span className="num">billed {money(f.billed)} · paid {money(f.paid)} · <b className={f.balance > 0 ? "text-danger" : "text-ok"}>{f.balance > 0 ? `owes ${money(f.balance)}` : "paid in full"}</b></span>}
              {canPay && <Button size="sm" variant="primary" onClick={() => setPay(s.id)}>Record payment</Button>}
              <Link className="text-info hover:underline" href={studentHref(s.id, account)}>Open record</Link></span></li>; })}
      </ul></Card>}
      {pay && <RecordPaymentDialog open onClose={() => { setPay(null); setQ(""); }} students={[payStudentOf(pay, account)]} studentId={pay} usedRefs={usedRefs} account={account} />}
    </div>
  );
}

/** A student as the payment form needs them: their balance in this account and the invoices it is applied to (oldest first). */
function payStudentOf(id: string, account: FeeAccount): PayStudent {
  const s = Q.getStudent(id)!; const f = Q.accountSummary(id, account); const inv = Q.invoicesOf(id, account);
  return { id, name: Q.fullName(s), adm: s.admissionNo, cls: Q.getClass(s.classId)?.name ?? "", balance: f.balance, payer: Q.payerOf(s),
    items: [...new Set(inv.flatMap((i) => i.items.map((x) => x.label)))], invoices: inv.map((i) => ({ no: i.no, balance: f.balance })) };
}
