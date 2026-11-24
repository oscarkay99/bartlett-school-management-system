"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AlertTriangle, Banknote, CalendarClock, Download, FilePlus2, FileText, Percent, Receipt, Send, ShieldAlert, Users, Wallet } from "lucide-react";
import { AlertBanner, Badge, Button, Card, CardHeader, EmptyState, Kpi, StatusBadge } from "@/components/ui/primitives";
import { DataTable, Drawer, Modal, Select, Tabs, useToast, type Column } from "@/components/ui/interactive";
import { Donut, HBars, LineTrend } from "@/components/charts/charts";
import { RecordPaymentDialog, type PayStudent } from "./RecordPaymentDialog";
import { IssueBillDialog, type BillCandidate } from "./IssueBillDialog";
import { useRole } from "@/components/shell/AppShell";
import { useCalendar } from "@/components/shell/CalendarContext";
import { useFeeSchedule } from "@/components/shell/FeeScheduleContext";
import { TermFeeStructure } from "@/components/settings/FeeScheduleEditor";
import { classFees, invoiceStem, sumItems, termKey } from "@/lib/fees";
import { ACCOUNTS, ACTIVITIES, type FeeAccount } from "@/lib/accounts";
import { money, moneyShort, pct } from "@/lib/money";
import { fmtDate } from "@/lib/utils";

export interface SRow { id: string; name: string; adm: string; classId: string; cls: string; cat: string; billed: number; paid: number; balance: number; dueOn: string; overdue: boolean; status: string; invoice: string; terms: string[]; items: { label: string; amount: number }[] }
export interface PRow { id: string; receipt: string; studentId: string; student: string; classId: string; cat: string; amount: number; method: string; date: string; ref: string; status: string; staff: string }
export interface RRow { gid: string; name: string; channel: "SMS" | "WhatsApp" | "Email"; eligible: boolean; reason?: string; last?: string; total: number; overdue: boolean; classIds: string[]; students: { id: string; name: string; balance: number }[]; message: string }
const TODAY = "2026-10-12";
const daysAgo = (n: number) => { const d = new Date(TODAY + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
const COST = { SMS: 5, WhatsApp: 12, Email: 0 } as const; // pesewas per message (estimate)

export function FeesWorkspace({ account, students, payments, reminders, classes, candidates, initialTab, openPay, overdueOnly, usedRefs }: { account: FeeAccount; students: SRow[]; payments: PRow[]; reminders: RRow[]; classes: { id: string; name: string }[]; candidates: BillCandidate[]; initialTab?: string; openPay?: boolean; overdueOnly?: boolean; usedRefs: string[] }) {
  const A = ACCOUNTS[account];
  const { ready, money: access, allow } = useRole(); const full = access === "full"; const canPay = allow("payments", "create"); const canBill = allow("invoices", "create");
  const [cls, setCls] = useState(""); const [cat, setCat] = useState(""); const [range, setRange] = useState("term"); const [payOpen, setPayOpen] = useState(!!openPay); const [billOpen, setBillOpen] = useState(false);
  const router = useRouter();
  const { year, term } = useCalendar();
  const ss = useMemo(() => students.filter((s) => (!cls || s.classId === cls) && (!cat || s.cat === cat)), [students, cls, cat]);
  const pp = useMemo(() => payments.filter((p) => (!cls || p.classId === cls) && (!cat || p.cat === cat)), [payments, cls, cat]);
  const conf = useMemo(() => pp.filter((p) => p.status === "Confirmed"), [pp]);
  const billed = ss.reduce((a, s) => a + s.billed, 0), paid = ss.reduce((a, s) => a + s.paid, 0);
  const owing = ss.filter((s) => s.balance > 0), outstanding = owing.reduce((a, s) => a + s.balance, 0);
  const od = owing.filter((s) => s.overdue), overdue = od.reduce((a, s) => a + s.balance, 0);
  const sum = (from: string) => conf.filter((p) => p.date >= from).reduce((a, p) => a + p.amount, 0);
  const periodFrom = range === "today" ? TODAY : range === "week" ? daysAgo(6) : range === "month" ? daysAgo(29) : "2026-09-01";
  const eligible = reminders.filter((r) => r.eligible && (!cls || r.classIds.includes(cls)));
  const upcoming = owing.filter((s) => !s.overdue).reduce((a, s) => a + s.balance, 0);
  const byMethod = useMemo(() => { const m = new Map<string, number>(); conf.filter((p) => p.date >= periodFrom).forEach((p) => m.set(p.method, (m.get(p.method) ?? 0) + p.amount / 100)); return [...m].map(([name, value]) => ({ name, value })); }, [conf, periodFrom]);
  const trend = useMemo(() => { const w = new Map<string, number>(); conf.forEach((p) => { const d = new Date(p.date + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); const k = d.toISOString().slice(5, 10); w.set(k, (w.get(k) ?? 0) + p.amount / 100); }); return [...w].sort().map(([week, collected]) => ({ week, collected })); }, [conf]);
  const byClass = useMemo(() => classes.map((c) => ({ name: c.name, outstanding: students.filter((s) => s.classId === c.id && (!cat || s.cat === cat) && s.balance > 0).reduce((a, s) => a + s.balance, 0) / 100 })), [classes, students, cat]);
  const payStudents: PayStudent[] = students.map((s) => ({ id: s.id, name: s.name, adm: s.adm, cls: s.cls, balance: s.balance, invoices: [{ no: s.invoice, balance: s.balance }] }));

  const filters = (
    <div className="flex flex-wrap items-center gap-2">
      <Select label="Class" value={cls} onChange={setCls} options={[{ value: "", label: "All classes" }, ...classes.map((c) => ({ value: c.id, label: c.name }))]} />
      <Select label="Student category" value={cat} onChange={setCat} options={[{ value: "", label: "Day & boarding" }, { value: "Day", label: "Day" }, { value: "Boarding", label: "Boarding" }]} />
      {full && <Select label="Collection period" value={range} onChange={setRange} options={[{ value: "today", label: "Today" }, { value: "week", label: "Last 7 days" }, { value: "month", label: "Last 30 days" }, { value: "term", label: "This term" }]} />}
      <span className="text-xs text-muted">{term} · {year}</span>
    </div>
  );

  const overview = (
    <div className="space-y-4">
      <AlertBanner tone={overdue > 0 ? "danger" : "ok"} icon={AlertTriangle} title={`Outstanding ${A.label}: ${money(outstanding)} across ${owing.length} students`}
        actions={<><Button size="sm" onClick={() => router.push(`${A.href}?tab=outstanding`)}>View Outstanding Students</Button><Button size="sm" variant="primary" onClick={() => router.push(`${A.href}?tab=reminders`)}>Prepare Reminders</Button><Button size="sm" onClick={() => router.push(`${A.href}?tab=outstanding&overdue=1`)}>View Overdue</Button><Button size="sm" onClick={() => exportCsv(owing, account)}><Download size={13} />Export Report</Button></>}>
        {od.length} balances are overdue ({money(overdue)}). {eligible.length} guardians are eligible for payment reminders.
      </AlertBanner>
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
        <Kpi label="Total invoiced" value={moneyShort(billed)} icon={FileText} hint={`Sum of ${A.label} invoices net of discounts for the filtered students.`} />
        <Kpi label="Confirmed collections" value={moneyShort(paid)} icon={Banknote} tone="ok" hint="Confirmed payments only; pending gateway payments excluded." />
        <Kpi label="Collection rate" value={`${pct(paid, billed)}%`} icon={Percent} tone="info" hint="Confirmed collections ÷ total invoiced." />
        <Kpi label="Expected upcoming" value={moneyShort(upcoming)} icon={CalendarClock} hint="Outstanding balances not yet past their due date." />
        <Kpi label="Overdue" value={moneyShort(overdue)} icon={ShieldAlert} tone="danger" hint="Outstanding balances past due date." href={`${A.href}?tab=outstanding&overdue=1`} />
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
    ? { id: "books", label: "Books", node: <ItemBreakdown students={ss} sections={[{ key: "Books", title: "Books", sub: "Textbooks and learning materials, part of school fees" }]} /> }
    : account === "feeding"
      ? { id: "classes", label: "Feeding by class", node: <ItemBreakdown students={ss} sections={[{ key: "Feeding", title: "Feeding", sub: "Meals billed per term, by class" }]} /> }
      : { id: "activities", label: "Activities", node: <Activities students={ss} /> };
  type Tab = { id: string; label: string; content: React.ReactNode; badge?: string };
  const tabs = ([
    full && { id: "overview", label: "Dashboard", content: overview },
    { id: "outstanding", label: "Outstanding", badge: String(owing.length), content: <OutstandingTable rows={ss.filter((s) => s.balance > 0)} overdueOnly={overdueOnly} account={account} showTotals={full} /> },
    { id: "reminders", label: "Reminders", badge: String(eligible.length), content: <Reminders rows={reminders.filter((r) => !cls || r.classIds.includes(cls))} /> },
    full && { id: "payments", label: "Payments & receipts", content: <PaymentsTable rows={pp} /> },
    full && { id: "invoices", label: account === "feeding" ? "Bills" : "Invoices", content: <Invoices students={ss} candidates={candidates.filter((c) => (!cls || c.classId === cls) && (!cat || (cat === "Boarding") === c.boarding))} account={account} canBill={canBill} onIssue={() => setBillOpen(true)} /> },
    full && { id: breakdown.id, label: breakdown.label, content: breakdown.node },
    full && account === "fees" && { id: "structures", label: "Fee structures", content: <TermFeeStructure /> },
    full && { id: "reconcile", label: "Reconciliation", badge: String(pp.filter((p) => p.status !== "Confirmed").length), content: <Reconcile rows={pp} /> },
  ] as (Tab | false)[]).filter((t): t is Tab => !!t);
  const start = initialTab && tabs.some((t) => t.id === initialTab) ? initialTab : undefined;
  return (
    <div className="space-y-4">
      {!full && <AlertBanner tone="info" icon={Users} title="Follow-up view">You can see which students owe and send reminders to their parents. Collections and payment records are only visible to the Owner and the Accountant.</AlertBanner>}
      <div className="flex flex-wrap items-center justify-between gap-3">{filters}
        <div className="flex flex-wrap gap-2">{canBill && account !== "fees" && <Button onClick={() => setBillOpen(true)}><FilePlus2 size={14} />{account === "feeding" ? "Add student to feeding" : "Enrol & bill student"}</Button>}
          {canPay && <Button variant="primary" onClick={() => setPayOpen(true)}><Receipt size={14} />Record {A.label.toLowerCase()} payment</Button>}</div></div>
      <Tabs key={access} initial={start} tabs={tabs} />
      {canPay && <RecordPaymentDialog open={payOpen} onClose={() => setPayOpen(false)} students={payStudents} usedRefs={usedRefs} account={account} />}
      {canBill && <IssueBillDialog open={billOpen} onClose={() => setBillOpen(false)} account={account} candidates={candidates} />}
    </div>
  );
}

function exportCsv(rows: SRow[], account: FeeAccount) {
  const csv = ["Admission,Student,Class,Billed,Paid,Balance,Due"].concat(rows.map((r) => [r.adm, `"${r.name}"`, r.cls, r.billed / 100, r.paid / 100, r.balance / 100, r.dueOn].join(","))).join("\n");
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = `outstanding-${account}.csv`; a.click();
}

function OutstandingTable({ rows, overdueOnly, account, showTotals }: { rows: SRow[]; overdueOnly?: boolean; account: FeeAccount; showTotals: boolean }) {
  const [od, setOd] = useState(overdueOnly ? "1" : ""); const r = useRouter();
  const data = rows.filter((x) => !od || x.overdue);
  const cols: Column<SRow>[] = [
    { key: "n", header: "Student", sort: (x) => x.name, render: (x) => <div><div className="font-medium">{x.name}</div><div className="text-xs text-muted">{x.adm}</div></div> },
    { key: "c", header: "Class", render: (x) => x.cls },
    ...(showTotals ? [{ key: "b", header: "Billed", align: "right", hideOnMobile: true, render: (x) => money(x.billed) }, { key: "p", header: "Paid", align: "right", hideOnMobile: true, render: (x) => money(x.paid) }] as Column<SRow>[] : []),
    { key: "o", header: "Outstanding", align: "right", sort: (x) => x.balance, render: (x) => <b className="text-danger">{money(x.balance)}</b> },
    { key: "d", header: "Due", sort: (x) => x.dueOn, render: (x) => fmtDate(x.dueOn) }, { key: "s", header: "Status", render: (x) => <StatusBadge status={x.status} /> },
  ];
  return <Card><DataTable rows={data} columns={cols} rowId={(x) => x.id} searchText={(x) => x.name + x.adm} onRowClick={(x) => r.push(`/students/${x.id}?tab=${account}`)}
    filters={<Select label="Overdue filter" value={od} onChange={setOd} options={[{ value: "", label: "All outstanding" }, { value: "1", label: "Overdue only" }]} />}
    toolbar={<Button size="sm" onClick={() => exportCsv(data, account)}><Download size={13} />CSV</Button>} /></Card>;
}

function Reminders({ rows }: { rows: RRow[] }) {
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
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm"><span className="whitespace-nowrap"><b>{picked.length}</b> selected</span><span className="whitespace-nowrap text-muted">Est. cost <b className="num text-fg">{money(cost)}</b></span><Button variant="primary" disabled={picked.length === 0} onClick={() => setConfirm(true)}><Send size={14} />Send reminders</Button></div></div></Card>
      <Card><DataTable rows={data} columns={cols} rowId={(x) => x.gid} selectable selected={sel} onSelect={setSel} searchText={(x) => x.name + x.students.map((s) => s.name).join(" ")}
        filters={<><Select label="Channel" value={ch} onChange={setCh} options={[{ value: "", label: "Any channel" }, { value: "WhatsApp", label: "WhatsApp" }, { value: "SMS", label: "SMS" }, { value: "Email", label: "Email" }]} /><Select label="Overdue" value={od} onChange={setOd} options={[{ value: "", label: "All balances" }, { value: "1", label: "Overdue only" }]} /></>}
        toolbar={<Button size="sm" variant="ghost" onClick={() => setSel(new Set(data.filter((r) => r.eligible).map((r) => r.gid)))}>Select all eligible ({data.filter((r) => r.eligible).length})</Button>} pageSize={10} /></Card>
      <Drawer open={!!view} onClose={() => setView(null)} title="Reminder preview" footer={<Button onClick={() => setView(null)}>Close</Button>}>
        {view && <><div className="mb-3 flex flex-wrap gap-2"><Badge tone="info">{view.channel}</Badge>{view.eligible ? <Badge tone="ok">Eligible</Badge> : <Badge tone="warn">{view.reason}</Badge>}</div><pre className="whitespace-pre-wrap rounded-lg border border-line bg-surface-2 p-4 font-sans leading-relaxed">{view.message}</pre>
          <ul className="mt-3 divide-y divide-line text-sm">{view.students.map((s) => <li key={s.id} className="flex justify-between py-1.5"><Link className="hover:text-info" href={`/students/${s.id}`}>{s.name}</Link><span className="num">{money(s.balance)}</span></li>)}</ul></>}
      </Drawer>
      <Modal open={confirm} onClose={() => setConfirm(false)} title="Send reminders?" footer={<><Button onClick={() => setConfirm(false)}>Cancel</Button><Button variant="primary" onClick={() => { toast(`${picked.length} reminders queued. Balances will be re-checked before each send.`); setConfirm(false); setSel(new Set()); }}>Queue {picked.length} reminders</Button></>}>
        <p>{picked.length} guardians · estimated provider cost <b>{money(cost)}</b>.</p><p className="mt-2 text-sm text-muted">Messages are queued, balances re-verified at send time, quiet hours respected, and anyone who has fully paid in the meantime is skipped automatically.</p>
      </Modal>
    </div>
  );
}

function PaymentsTable({ rows }: { rows: PRow[] }) {
  const [m, setM] = useState("");
  const cols: Column<PRow>[] = [
    { key: "r", header: "Receipt", sort: (x) => x.receipt, render: (x) => <b className="num">{x.receipt}</b> }, { key: "s", header: "Student", sort: (x) => x.student, render: (x) => <Link href={`/students/${x.studentId}`} className="hover:text-info">{x.student}</Link> },
    { key: "a", header: "Amount", align: "right", sort: (x) => x.amount, render: (x) => money(x.amount) }, { key: "m", header: "Method", hideOnMobile: true, render: (x) => x.method },
    { key: "d", header: "Date", sort: (x) => x.date, render: (x) => fmtDate(x.date) }, { key: "ref", header: "Reference", hideOnMobile: true, render: (x) => <span className="num text-xs">{x.ref}</span> },
    { key: "st", header: "Status", render: (x) => <StatusBadge status={x.status} /> }, { key: "p", header: "", render: (x) => x.status === "Confirmed" ? <Link className="text-info" href={`/print/receipt/${x.id}`}>Receipt</Link> : null },
  ];
  return <Card><DataTable rows={rows.filter((r) => !m || r.method === m)} columns={cols} rowId={(x) => x.id} searchText={(x) => `${x.receipt} ${x.student} ${x.ref}`} filters={<Select label="Method" value={m} onChange={setM} options={[{ value: "", label: "All methods" }, ...["Cash", "Mobile Money", "Bank Transfer", "Card", "Cheque"].map((v) => ({ value: v, label: v }))]} />} pageSize={12} /></Card>;
}

function Invoices({ students, candidates, account, canBill, onIssue }: { students: SRow[]; candidates: BillCandidate[]; account: FeeAccount; canBill: boolean; onIssue: () => void }) {
  const [o, setO] = useState(false); const A = ACCOUNTS[account];
  const { year, term } = useCalendar(); const key = termKey(year, term);
  const rows = students.filter((s) => s.terms.includes(key));
  return (
    <Card><CardHeader title={`${A.label} ${account === "feeding" ? "bills" : "invoices"} — ${term} ${year}`} sub={`Numbered ${invoiceStem(A.invoicePrefix, year, term)}-… and receipted separately (${A.receiptPrefix}-…)`} action={canBill ? (account === "fees" ? <Button variant="primary" size="sm" onClick={() => setO(true)}>Generate {term} invoices</Button> : <Button variant="primary" size="sm" onClick={onIssue}><FilePlus2 size={13} />Issue new bill</Button>) : undefined} />
      <DataTable rows={rows} empty={<EmptyState icon={FileText} title={`No ${account === "feeding" ? "bills" : "invoices"} for ${term} ${year} yet`} body={account === "fees" ? "Generate this term's invoices once its fees are set." : "Issue bills to students as they enrol."} />} columns={[
        { key: "i", header: "Invoice", render: (x) => <b className="num">{x.invoice}</b> }, { key: "n", header: "Student", sort: (x) => x.name, render: (x) => x.name }, { key: "c", header: "Class", render: (x) => x.cls },
        ...(account === "extra" ? [{ key: "a", header: "Activities", hideOnMobile: true, render: (x: SRow) => x.items.map((i) => i.label).join(", ") }] : []),
        { key: "b", header: "Total", align: "right", sort: (x) => x.billed, render: (x) => money(x.billed) }, { key: "p", header: "Paid", align: "right", render: (x) => money(x.paid) }, { key: "d", header: "Due", hideOnMobile: true, render: (x) => fmtDate(x.dueOn) },
        { key: "s", header: "Status", render: (x) => <StatusBadge status={x.status} /> }, { key: "pdf", header: "", render: (x) => <Link className="text-info" href={`/print/invoice/${x.invoice}`}>PDF</Link> },
      ]} rowId={(x) => x.id} searchText={(x) => x.name + x.invoice} pageSize={10} />
      {o && <GenerateInvoices candidates={candidates} onClose={() => setO(false)} />}
    </Card>
  );
}

// Bulk school-fee billing for the selected term: every active student without an invoice that term is billed
// from the fee schedule (their class's fees, plus boarding for boarders). Idempotent by student + term.
function GenerateInvoices({ candidates, onClose }: { candidates: BillCandidate[]; onClose: () => void }) {
  const { year, term } = useCalendar(); const fs = useFeeSchedule(); const tf = fs.get(year, term); const toast = useToast();
  const key = termKey(year, term);
  const todo = candidates.filter((c) => !c.billed[key]?.length);
  const lines = tf ? todo.map((c) => { const cls = fs.classes.find((x) => x.id === c.classId)!; return { c, cls, total: sumItems(classFees(tf, cls, c.boarding)) }; }) : [];
  const byClass = fs.classes.map((cls) => { const l = lines.filter((x) => x.cls.id === cls.id); return { cls, n: l.length, total: l.reduce((a, x) => a + x.total, 0) }; }).filter((r) => r.n > 0);
  const total = byClass.reduce((a, r) => a + r.total, 0);
  return (
    <Modal open onClose={onClose} title={`Generate ${term} ${year} invoices`} wide footer={<><Button onClick={onClose}>Close</Button>{tf && lines.length > 0 && <Button variant="primary" onClick={() => { toast(`${lines.length} ${term} invoices generated · ${money(total)}`); onClose(); }}>Generate {lines.length} invoices · {money(total)}</Button>}</>}>
      {!tf ? <div className="space-y-2"><p>{term} {year} has no fees set, so invoices can&apos;t be generated yet.</p><Link className="text-sm font-medium text-info hover:underline" href="/settings?tab=fees">Set {term} fees in Settings →</Link></div>
        : lines.length === 0 ? <><p>All <b>{candidates.length}</b> active students in the current filter already have a {term} invoice.</p><p className="mt-2 text-sm text-muted">Generation is idempotent: each student can only have one invoice per term, so running it again never creates duplicates. New students admitted later are picked up automatically.</p></>
        : <div className="space-y-3">
            <p><b>{lines.length}</b> students have no {term} invoice yet. Each is billed their class&apos;s {term} fees from the fee schedule, plus boarding for boarders.</p>
            <div className="overflow-x-auto rounded-lg border border-line"><table className="w-full text-sm"><thead className="bg-surface-2/60 text-xs uppercase text-muted"><tr><th className="px-3 py-2 text-left">Class</th><th className="px-3 text-right">Students</th><th className="px-3 text-right">Total</th></tr></thead>
              <tbody className="divide-y divide-line">{byClass.map((r) => <tr key={r.cls.id}><td className="px-3 py-2">{r.cls.name}</td><td className="num px-3 text-right">{r.n}</td><td className="num px-3 text-right">{money(r.total)}</td></tr>)}</tbody>
              <tfoot><tr className="border-t-2 border-line font-semibold"><td className="px-3 py-2">Total</td><td className="num px-3 text-right">{lines.length}</td><td className="num px-3 text-right">{money(total)}</td></tr></tfoot></table></div>
            <p className="text-xs text-muted">Numbered {invoiceStem("INV", year, term)}-0001 onwards. Scholarships are applied as discounts on each invoice. Front-end preview — invoices are saved once the backend is connected.</p>
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

// Extracurricular: one card per activity (enrolment and billed), plus the full roster.
function Activities({ students }: { students: SRow[] }) {
  const [act, setAct] = useState(""); const r = useRouter();
  const per = ACTIVITIES.map((a) => { const kids = students.filter((s) => s.items.some((i) => i.label === a)); return { a, kids: kids.length, billed: kids.reduce((x, s) => x + (s.items.find((i) => i.label === a)?.amount ?? 0), 0) }; });
  const rows = students.filter((s) => !act || s.items.some((i) => i.label === act));
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">{per.map((p) => <button key={p.a} onClick={() => setAct(act === p.a ? "" : p.a)} className={`rounded-xl border bg-surface p-4 text-left transition hover:shadow-md ${act === p.a ? "border-info ring-1 ring-info" : "border-line"}`}><div className="text-xs text-muted">{p.a}</div><div className="mt-1 text-2xl font-semibold">{p.kids} <span className="text-sm font-normal text-muted">students</span></div><div className="num mt-1 text-sm">Billed {money(p.billed)}</div></button>)}</div>
      <Card><DataTable rows={rows} rowId={(x) => x.id} searchText={(x) => x.name + x.adm} onRowClick={(x) => r.push(`/students/${x.id}?tab=extra`)} pageSize={12}
        filters={<Select label="Activity" value={act} onChange={setAct} options={[{ value: "", label: "All activities" }, ...ACTIVITIES.map((a) => ({ value: a, label: a }))]} />}
        columns={[
          { key: "n", header: "Student", sort: (x) => x.name, render: (x) => <div><div className="font-medium">{x.name}</div><div className="text-xs text-muted">{x.adm}</div></div> },
          { key: "c", header: "Class", render: (x) => x.cls }, { key: "a", header: "Activities", render: (x) => <div className="flex flex-wrap gap-1">{x.items.map((i) => <Badge key={i.label}>{i.label}</Badge>)}</div> },
          { key: "b", header: "Billed", align: "right", hideOnMobile: true, render: (x) => money(x.billed) }, { key: "o", header: "Balance", align: "right", sort: (x) => x.balance, render: (x) => <span className={x.balance > 0 ? "font-medium text-danger" : ""}>{money(Math.max(0, x.balance))}</span> },
          { key: "s", header: "Status", render: (x) => <StatusBadge status={x.status} /> },
        ]} /></Card>
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
        {exc.length === 0 ? <p className="px-4 pb-4 text-muted">No exceptions in the current filter.</p> : exc.map((e) => <div key={e.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3"><div><div className="flex items-center gap-2"><b className="num">{e.ref}</b><StatusBadge status={e.status} /></div><div className="text-xs text-muted">{e.student} · {e.method} · {fmtDate(e.date)}</div></div><div className="flex items-center gap-2"><b className="num">{money(e.amount)}</b>{e.status === "Pending" && <><Button size="sm" onClick={() => toast("Match requires gateway verification (backend)", "err")}>Match</Button><Button size="sm" variant="ghost" onClick={() => toast("Marked for follow-up")}>Flag</Button></>}</div></div>)}</Card>
    </div>
  );
}
