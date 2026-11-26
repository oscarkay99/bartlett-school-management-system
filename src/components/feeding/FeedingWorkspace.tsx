"use client";
import { studentHref, printHref } from "@/lib/links";
import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangle, Search, Users, Utensils, Wallet } from "lucide-react";
import { AlertBanner, Badge, Button, Card, CardHeader, EmptyState, Kpi } from "@/components/ui/primitives";
import { DataTable, Modal, MoneyInput, QueryTabs, Select, useToast, type Column } from "@/components/ui/interactive";
import { useCalendar } from "@/components/shell/CalendarContext";
import { useFeeSchedule } from "@/components/shell/FeeScheduleContext";
import { useRole } from "@/components/shell/AppShell";
import { canRecordMeals } from "@/lib/permissions";
import { useFeeding } from "./useFeeding";
import { feedingRate, termKey } from "@/lib/fees";
import { planFreq, expectedByToday, feedingStatus, PLAN_FREQUENCIES, periodWord, perPeriod, planLabel, planStatus, studentFeedingRate, validateException, validatePlan, type FeedingException, type FeedingPlan, type PlanFrequency, type PlanStatus, type TermDates } from "@/lib/feeding";
import { useFeedingPlans } from "@/components/shell/FeedingPlansContext";
import { clampToTerm } from "./PlanDialog";
import { FeedingPaymentDialog } from "./FeedingPaymentDialog";
import { money } from "@/lib/money";
import { fmtDate } from "@/lib/utils";

interface FStudent { id: string; name: string; adm: string; classId: string; cls: string; billed: number; paid: number; dueOn?: string; payer?: { name: string; phone?: string } }
/** A feeding payment. `how`: Daily / Weekly / Monthly / Term. */
export interface FeedingPayment { id: string; receipt: string; studentId: string; name: string; classId: string; cls: string; date: string; feeding: number; how: string; method: string; status: string }
interface KitchenItem { id: string; name: string; unit: string; onHand: number; reorder: number; expiry?: string }

// Feeding module, laid out like School Fees: find a student and record a payment at the top; tabs for the dashboard,
// students (what each owes, how they pay, one Change button), payments & receipts, the meal register and kitchen stock.
// Feeding is never on the school fees invoice.
export function FeedingWorkspace({ students, payments, kitchen, today, usedRefs = [] }: { students: FStudent[]; payments: FeedingPayment[]; kitchen: KitchenItem[]; today: string; usedRefs?: string[] }) {
  const { year, term } = useCalendar(); const fs = useFeeSchedule(); const tf = fs.get(year, term); const key = termKey(year, term);
  const feeding = useFeeding(); const { allow, role } = useRole();
  const canEdit = allow("invoices", "create") || allow("students", "edit");               // Owner, Admin, Bursar
  const canMeals = canRecordMeals(role);                                                   // Owner, Admin, Storekeeper
  const plans = useFeedingPlans(); const { calendar } = useCalendar();
  const td = calendar.find((y) => y.name === year)?.terms.find((t) => t.name === term);
  const rows = useMemo(() => students.map((s) => {
    const cls = fs.classes.find((c) => c.id === s.classId);
    const classRate = tf && cls ? feedingRate(tf, cls) : 0; const ex = feeding.exceptionFor(s.id, key); const rate = studentFeedingRate(classRate, ex);
    // Payment plan: how this family pays feeding, and whether they are keeping up with it.
    const freq: PlanFrequency = planFreq(plans.planOn(s.id, key, today)?.frequency);
    const expected = td ? expectedByToday(rate, td, freq, today, s.dueOn) : 0;
    return { ...s, classRate, ex, status: feedingStatus(ex), rate, freq, expected, perPeriod: td ? perPeriod(rate, td, freq) : 0, plan: planStatus(rate, s.paid, expected) };
  }), [students, fs.classes, tf, feeding, key, plans, td, today]);
  const behind = rows.filter((r) => r.plan.label === "Behind");
  const byClass = fs.classes.map((c) => { const r = rows.filter((x) => x.classId === c.id); const on = r.filter((x) => x.rate > 0);
    return { id: c.id, name: c.name, students: r.length, on: on.length, off: r.length - on.length, rate: tf ? feedingRate(tf, c) : 0, expected: on.reduce((a, x) => a + x.rate, 0),
      paid: r.reduce((a, x) => a + x.paid, 0), owed: r.reduce((a, x) => a + Math.max(0, x.billed - x.paid), 0) }; }).filter((c) => c.students > 0);
  const paidAll = rows.reduce((a, r) => a + r.paid, 0); const owedAll = rows.reduce((a, r) => a + Math.max(0, r.billed - r.paid), 0);
  const onFeeding = rows.filter((r) => r.rate > 0).length; const expected = rows.reduce((a, r) => a + r.rate, 0);
  const low = kitchen.filter((k) => k.onHand <= k.reorder);

  const overview = (
    <div className="space-y-4">
      {!tf && <AlertBanner tone="warn" icon={AlertTriangle} title={`No fees set for ${term} ${year}`} actions={<Link className="text-sm font-medium text-info hover:underline" href="/settings?tab=fees">Set fees in Settings →</Link>}>The feeding rate per class comes from the fee schedule.</AlertBanner>}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-5">
        <Kpi label="On feeding" value={`${onFeeding} / ${rows.length}`} icon={Users} hint="Active students on feeding this term (everyone unless marked otherwise)." />
        <Kpi label="Expected feeding income" value={money(expected)} icon={Wallet} tone="ok" hint="Feeding owed this term by everyone on feeding (not part of school fees)." />
        <Kpi label="Feeding collected" value={money(paidAll)} icon={Wallet} tone="ok" hint="Feeding paid so far this term: termly, daily, weekly or monthly." />
        <Kpi label="Behind on plan" value={`${behind.length} · ${money(behind.reduce((a, r) => a + r.plan.behind, 0))}`} icon={Users} tone={behind.length ? "danger" : "ok"} hint="Students who have paid less feeding than their payment plan expects by today." />
        <Kpi label="Feeding still owed" value={money(owedAll)} icon={AlertTriangle} tone={owedAll ? "danger" : "ok"} hint="Feeding billed minus feeding paid." />
      </div>
      <Card><CardHeader title={`Feeding by class — ${term} ${year}`} sub="The feeding rate per class is set in Settings → Fee schedule. Change one student on the Students tab." />
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-surface-2/60 text-xs uppercase text-muted"><tr><th className="px-4 py-2 text-left">Class</th><th className="px-3 text-right">Students</th><th className="px-3 text-right">On feeding</th><th className="px-3 text-right">Not on feeding</th><th className="px-3 text-right">Rate</th><th className="px-3 text-right">Expected</th><th className="px-3 text-right">Paid</th><th className="px-4 text-right">Owed</th></tr></thead>
          <tbody className="divide-y divide-line">{byClass.map((c) => <tr key={c.id}><td className="px-4 py-2.5 font-medium">{c.name}</td><td className="num px-3 text-right">{c.students}</td><td className="num px-3 text-right">{c.on}</td><td className="num px-3 text-right">{c.off || "—"}</td><td className="num px-3 text-right">{money(c.rate)}</td><td className="num px-3 text-right font-medium">{money(c.expected)}</td><td className="num px-3 text-right text-ok">{money(c.paid)}</td><td className={`num px-4 text-right ${c.owed ? "text-danger" : ""}`}>{money(c.owed)}</td></tr>)}</tbody>
          <tfoot><tr className="border-t-2 border-line font-semibold"><td className="px-4 py-2.5">Total</td><td className="num px-3 text-right">{rows.length}</td><td className="num px-3 text-right">{onFeeding}</td><td className="num px-3 text-right">{rows.length - onFeeding}</td><td /><td className="num px-3 text-right">{money(expected)}</td><td className="num px-3 text-right">{money(paidAll)}</td><td className="num px-4 text-right">{money(owedAll)}</td></tr></tfoot></table></div></Card>
    </div>
  );

  const canPay = allow("payments", "create");
  const [payFor, setPayFor] = useState<string | null>(null);
  return (
    <div className="space-y-4">
      <FeedingFinder rows={rows} canPay={canPay} canEdit={canEdit} onPay={(id) => setPayFor(id)} termLabel={`${term} ${year}`} />
      <div className="flex flex-wrap items-center justify-between gap-3"><span className="text-xs text-muted">{term} · {year}</span>
        {canPay && <Button variant="primary" onClick={() => setPayFor("")}><Wallet size={14} />Record feeding payment</Button>}</div>
      <QueryTabs tabs={[
        { id: "overview", label: "Dashboard", content: overview },
        { id: "students", label: "Students", badge: behind.length ? String(behind.length) : undefined, content: <StudentsTab rows={rows} canEdit={canEdit} td={td} today={today} termLabel={`${term} ${year}`} termKey={key} classes={fs.classes}
          onException={(sid, ex) => feeding.updateException(sid, key, ex)} onPlan={plans.setPlan} /> },
        { id: "payments", label: "Payments & receipts", content: <PaymentsTab payments={payments} classes={fs.classes} /> },
        { id: "meals", label: "Meal register", content: <MealsTab byClass={byClass} meals={feeding.meals} canEdit={canMeals} today={today} onSave={feeding.saveMeals} /> },
        { id: "kitchen", label: "Kitchen stock", badge: low.length ? String(low.length) : undefined, content: <KitchenTab items={kitchen} /> },
      ].map((t) => ({ ...t, badge: t.badge || undefined }))} />
      {payFor !== null && canPay && <FeedingPaymentDialog students={rows} usedRefs={usedRefs} termLabel={`${term}, ${year}`} today={today} initial={payFor || undefined} onClose={() => setPayFor(null)} />}
    </div>
  );
}

type Row = FStudent & { classRate: number; ex?: FeedingException; status: string; rate: number; freq: PlanFrequency; expected: number; perPeriod: number; plan: PlanStatus };

/** One table for everyone: what feeding they owe this term, how they pay it, what is paid and still owed. */
function StudentsTab({ rows, canEdit, td, today, termLabel, termKey: key, classes, onException, onPlan }: { rows: Row[]; canEdit: boolean; td?: TermDates; today: string; termLabel: string; termKey: string;
  classes: { id: string; name: string }[]; onException: (sid: string, ex: FeedingException | null) => void; onPlan: (p: FeedingPlan) => void }) {
  const [cls, setCls] = useState(""); const [plan, setPlan] = useState(""); const [show, setShow] = useState(""); const [edit, setEdit] = useState<Row | null>(null);
  const data = rows.filter((r) => (!cls || r.classId === cls) && (!plan || r.freq === plan)
    && (!show || (show === "owing" ? r.rate - r.paid > 0 : show === "behind" ? r.plan.label === "Behind" : r.rate === 0)));
  const cols: Column<Row>[] = [
    { key: "n", header: "Student", sort: (x) => x.name, render: (x) => <div><Link className="font-medium hover:text-info" href={studentHref(x.id, "feeding")}>{x.name}</Link><div className="text-xs text-muted">{x.cls} · {x.adm}</div></div> },
    { key: "pl", header: "Pays", sort: (x) => x.freq, render: (x) => x.rate === 0 ? <span className="text-muted">—</span> : <div><div className="font-medium">{planLabel(x.freq)}</div><div className="num text-[11px] text-muted">{x.freq === "Term" ? "all at once" : `${money(x.perPeriod)} per ${periodWord(x.freq)}`}</div></div> },
    { key: "r", header: "Feeding this term", align: "right", sort: (x) => x.rate, render: (x) => x.rate ? <span className="num">{money(x.rate)}{x.ex?.onFeeding ? <span className="block text-[11px] text-muted">different rate</span> : null}</span> : <Badge tone="neutral">Not on feeding</Badge> },
    { key: "p", header: "Paid", align: "right", sort: (x) => x.paid, render: (x) => <span className="num text-ok">{money(x.paid)}</span> },
    { key: "o", header: "Still owes", align: "right", sort: (x) => x.rate - x.paid, render: (x) => <b className={`num ${x.rate - x.paid > 0 ? "text-danger" : "text-ok"}`}>{money(Math.max(0, x.rate - x.paid))}</b> },
    { key: "s", header: "Status", sort: (x) => x.plan.behind, render: (x) => <Badge tone={x.plan.label === "Behind" ? "danger" : x.plan.label === "Not on feeding" ? "neutral" : "ok"} dot>{x.plan.label === "Behind" ? `Behind ${money(x.plan.behind)}` : x.plan.label}</Badge> },
    ...(canEdit ? [{ key: "e", header: "", render: (x: Row) => <Button size="sm" variant="ghost" disabled={!td} onClick={() => setEdit(x)}>Change</Button> }] : []),
  ];
  return (<>
    <Card><CardHeader title={`Feeding — ${termLabel}`} sub="What each student owes for feeding this term and how the family pays it. Change one student with Change." />
      <DataTable rows={data} columns={cols} rowId={(x) => x.id} searchText={(x) => `${x.name} ${x.adm}`} pageSize={12}
        filters={<><Select label="Class" value={cls} onChange={setCls} options={[{ value: "", label: "All classes" }, ...classes.map((c) => ({ value: c.id, label: c.name }))]} />
          <Select label="Pays" value={plan} onChange={setPlan} options={[{ value: "", label: "Any plan" }, ...PLAN_FREQUENCIES.map((f) => ({ value: f, label: planLabel(f) }))]} />
          <Select label="Show" value={show} onChange={setShow} options={[{ value: "", label: "Everyone" }, { value: "owing", label: "Still owing" }, { value: "behind", label: "Behind on plan" }, { value: "off", label: "Not on feeding" }]} /></>} /></Card>
    {edit && td && <FeedingSettings row={edit} td={td} today={today} termLabel={termLabel} termKey={key} onClose={() => setEdit(null)}
      onSave={(ex, p) => { if (ex !== undefined) onException(edit.id, ex); if (p) onPlan(p); setEdit(null); }} />}
  </>);
}

/** One box to change a student's feeding: how much they owe this term, and how the family pays it. */
export function FeedingSettings({ row, td, today, termLabel, termKey: key, onClose, onSave }: { row: Row; td: TermDates; today: string; termLabel: string; termKey: string; onClose: () => void;
  /** ex: undefined = amount unchanged, null = back to the class rate. p: a new plan, or undefined if unchanged. */
  onSave: (ex: FeedingException | null | undefined, p: FeedingPlan | undefined) => void }) {
  const toast = useToast();
  const [mode, setMode] = useState<"class" | "rate" | "off">(row.ex ? (row.ex.onFeeding ? "rate" : "off") : "class");
  const [rate, setRate] = useState(row.ex?.rate ?? row.classRate); const [reason, setReason] = useState(row.ex?.reason ?? "");
  const [freq, setFreq] = useState<PlanFrequency>(row.freq); const [from, setFrom] = useState(clampToTerm(today, td));
  const ex: FeedingException | null = mode === "class" ? null : { studentId: row.id, term: key, onFeeding: mode === "rate", rate: mode === "rate" ? rate : undefined, reason: reason.trim() };
  const amountChanged = JSON.stringify(ex) !== JSON.stringify(row.ex ?? null);
  const plan: FeedingPlan = { studentId: row.id, term: key, frequency: freq, from };
  const planChanged = mode !== "off" && freq !== row.freq;
  const newRate = mode === "class" ? row.classRate : mode === "rate" ? rate : 0;
  const err = (ex ? validateException(ex) : "") || (planChanged ? validatePlan(plan, td) : "") || (!amountChanged && !planChanged ? "Nothing changed" : "");
  const opt = (v: typeof mode, label: string, sub: string) => <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-line p-3 text-sm hover:bg-surface-2"><input type="radio" className="mt-1" checked={mode === v} onChange={() => setMode(v)} /><span><b>{label}</b><span className="block text-xs text-muted">{sub}</span></span></label>;
  return (
    <Modal open onClose={onClose} title={`Feeding — ${row.name}`} wide footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!!err} onClick={() => { onSave(amountChanged ? ex : undefined, planChanged ? plan : undefined); toast(`Feeding updated for ${row.name}`); }}>Save</Button></>}>
      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2"><div className="text-sm font-semibold">1. Feeding this term ({termLabel})</div>
          {opt("class", `Class rate — ${money(row.classRate)}`, "The default for every student.")}
          {opt("rate", "A different amount", "For example half-day feeding.")}
          {mode === "rate" && <div className="pl-7"><MoneyInput className="w-40" label="Feeding for this student" value={rate} onChange={setRate} /></div>}
          {opt("off", "Not on feeding", "e.g. brings lunch from home — owes no feeding.")}
          {mode !== "class" && <label className="block text-sm"><span className="mb-1 block font-medium">Reason *</span><input aria-label="Reason" className="h-9 w-full rounded-lg border border-line bg-surface px-3 text-sm" placeholder="e.g. brings lunch from home" value={reason} onChange={(e) => setReason(e.target.value)} /></label>}
        </div>
        <div className={`space-y-2 ${mode === "off" ? "opacity-50" : ""}`}><div className="text-sm font-semibold">2. How the family pays it</div>
          {PLAN_FREQUENCIES.map((f) => <label key={f} className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-line p-3 text-sm hover:bg-surface-2">
            <span className="flex items-center gap-2"><input type="radio" disabled={mode === "off"} checked={freq === f} onChange={() => setFreq(f)} /><b>{planLabel(f)}</b>{f === row.freq && <span className="text-xs text-muted">(now)</span>}</span>
            <span className="num text-xs text-muted">{f === "Term" ? `${money(newRate)} at once` : `${money(perPeriod(newRate, td, f))} per ${periodWord(f)}`}</span></label>)}
          {planChanged && <label className="block text-sm"><span className="mb-1 block font-medium">New plan starts on</span><input type="date" className="h-9 rounded-lg border border-line bg-surface px-2 text-sm" min={td.start} max={td.end} value={from} onChange={(e) => setFrom(e.target.value)} /></label>}
          <p className="text-xs text-muted">Payments already made still count. Already paid {money(row.paid)}; still owes {money(Math.max(0, newRate - row.paid))}.</p>
        </div>
      </div>
      {err && err !== "Nothing changed" && <p role="alert" className="mt-3 text-sm text-danger">{err}</p>}
    </Modal>
  );
}

/** Find any student and act: see what they owe for feeding, record a payment or change their feeding. */
function FeedingFinder({ rows, canPay, onPay, termLabel }: { rows: Row[]; canPay: boolean; canEdit: boolean; onPay: (id: string) => void; termLabel: string }) {
  const [q, setQ] = useState(""); const n = q.trim().toLowerCase();
  const found = n.length < 2 ? [] : rows.filter((r) => `${r.name} ${r.adm}`.toLowerCase().includes(n)).slice(0, 6);
  return (
    <div><div className="relative"><Search size={16} className="absolute left-3 top-3 text-muted" />
      <input aria-label="Find a student" className="h-10 w-full rounded-lg border border-line bg-surface pl-9 pr-3 text-sm" placeholder={`Find a student by name or admission number (${termLabel})`} value={q} onChange={(e) => setQ(e.target.value)} /></div>
      {n.length >= 2 && <Card className="mt-1"><ul className="divide-y divide-line">
        {found.length === 0 && <li className="px-4 py-3 text-sm text-muted">No student matches &ldquo;{q}&rdquo;.</li>}
        {found.map((r) => <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-sm">
          <span><b>{r.name}</b> <span className="text-xs text-muted">{r.adm} · {r.cls}</span></span>
          <span className="flex flex-wrap items-center gap-3">{r.rate === 0 ? <Badge tone="neutral">Not on feeding</Badge> : <span className="num">{planLabel(r.freq)} · paid {money(r.paid)} · <b className={r.rate - r.paid > 0 ? "text-danger" : "text-ok"}>{r.rate - r.paid > 0 ? `still owes ${money(r.rate - r.paid)}` : "paid in full"}</b></span>}
            {canPay && r.rate - r.paid > 0 && <Button size="sm" variant="primary" onClick={() => { onPay(r.id); setQ(""); }}>Record payment</Button>}
            <Link className="text-info hover:underline" href={studentHref(r.id, "feeding")}>Open record</Link></span></li>)}
      </ul></Card>}
    </div>
  );
}

function MealsTab({ byClass, meals, canEdit, today, onSave }: { byClass: { id: string; name: string; on: number }[]; meals: { date: string; classId: string; served: number }[]; canEdit: boolean; today: string; onSave: (date: string, counts: Record<string, number>) => void }) {
  const toast = useToast(); const [date, setDate] = useState(today);
  const existing = (cid: string) => meals.find((m) => m.date === date && m.classId === cid)?.served;
  const [counts, setCounts] = useState<Record<string, string>>({});
  const value = (cid: string, on: number) => counts[`${date}|${cid}`] ?? String(existing(cid) ?? on);
  const days = Array.from(new Set(meals.map((m) => m.date))).sort().reverse().slice(0, 10);
  const total = byClass.reduce((a, c) => a + (Number(value(c.id, c.on)) || 0), 0);
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <Card><CardHeader title="Meals served" sub="One count per class per day. Pre-filled with the number of students on feeding." action={<input type="date" aria-label="Date" className="h-9 rounded-lg border border-line bg-surface px-2 text-sm" value={date} max={today} onChange={(e) => setDate(e.target.value)} />} />
        <div className="divide-y divide-line border-t border-line">{byClass.map((c) => (
          <div key={c.id} className="flex items-center justify-between gap-3 px-4 py-2 text-sm"><span>{c.name} <span className="text-xs text-muted">· {c.on} on feeding{existing(c.id) !== undefined ? " · recorded" : ""}</span></span>
            <input aria-label={`Meals served ${c.name}`} inputMode="numeric" disabled={!canEdit} className="num h-9 w-24 rounded-lg border border-line bg-surface px-2 text-right text-sm disabled:opacity-70" value={value(c.id, c.on)} onChange={(e) => /^\d*$/.test(e.target.value) && setCounts({ ...counts, [`${date}|${c.id}`]: e.target.value })} />
          </div>))}</div>
        <div className="flex items-center justify-between border-t border-line px-4 py-3"><b>Total {total}</b>
          {canEdit && <Button variant="primary" onClick={() => { onSave(date, Object.fromEntries(byClass.map((c) => [c.id, Number(value(c.id, c.on)) || 0]))); toast(`Meals for ${fmtDate(date)} saved`); }}>Save {fmtDate(date)}</Button>}</div></Card>
      <Card><CardHeader title="Recent days" />{days.length === 0 ? <p className="px-4 pb-4 text-sm text-muted">Nothing recorded yet.</p>
        : <ul className="divide-y divide-line border-t border-line text-sm">{days.map((d) => <li key={d}><button className="flex w-full justify-between px-4 py-2 text-left hover:bg-surface-2" onClick={() => setDate(d)}><span>{fmtDate(d)}</span><b className="num">{meals.filter((m) => m.date === d).reduce((a, m) => a + m.served, 0)}</b></button></li>)}</ul>}</Card>
    </div>
  );
}

function KitchenTab({ items }: { items: KitchenItem[] }) {
  if (!items.length) return <Card><EmptyState icon={Utensils} title="No kitchen items" body="Add Kitchen & Feeding items in Inventory." /></Card>;
  return (
    <Card><CardHeader title="Kitchen & Feeding stock" sub="From Inventory. Receive and issue stock there." action={<Link className="text-sm font-medium text-info hover:underline" href="/inventory">Open Inventory →</Link>} />
      <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-surface-2/60 text-xs uppercase text-muted"><tr><th className="px-4 py-2 text-left">Item</th><th className="px-3 text-right">On hand</th><th className="px-3 text-right">Reorder at</th><th className="px-4 text-left">Status</th></tr></thead>
        <tbody className="divide-y divide-line">{items.map((i) => <tr key={i.id}><td className="px-4 py-2.5">{i.name}{i.expiry && <span className="ml-2 text-xs text-muted">expires {fmtDate(i.expiry)}</span>}</td><td className="num px-3 text-right">{i.onHand} {i.unit}</td><td className="num px-3 text-right">{i.reorder}</td><td className="px-4">{i.onHand <= 0 ? <Badge tone="danger">Out of stock</Badge> : i.onHand <= i.reorder ? <Badge tone="warn">Low — reorder</Badge> : <Badge tone="ok">OK</Badge>}</td></tr>)}</tbody></table></div></Card>
  );
}

// Every payment that included feeding, however it was paid: with the school fees at once, or daily / weekly / monthly / for the term.
function PaymentsTab({ payments, classes }: { payments: FeedingPayment[]; classes: { id: string; name: string }[] }) {
  const [how, setHow] = useState(""); const [cls, setCls] = useState("");
  const data = payments.filter((p) => (!how || p.how === how) && (!cls || p.classId === cls));
  const total = data.filter((p) => p.status === "Confirmed").reduce((a, p) => a + p.feeding, 0);
  const label = (h: string) => (h === "Term" ? "For the term" : h);
  const cols: Column<FeedingPayment>[] = [
    { key: "d", header: "Date", sort: (x) => x.date, render: (x) => fmtDate(x.date) },
    { key: "s", header: "Student", sort: (x) => x.name, render: (x) => <div><Link className="font-medium hover:text-info" href={studentHref(x.studentId, "feeding")}>{x.name}</Link><div className="text-xs text-muted">{x.cls}</div></div> },
    { key: "h", header: "Paid", render: (x) => <Badge tone="info">{label(x.how)}</Badge> },
    { key: "f", header: "Feeding", align: "right", sort: (x) => x.feeding, render: (x) => <b className="num">{money(x.feeding)}</b> },
    { key: "m", header: "Method", hideOnMobile: true, render: (x) => x.method },
    { key: "r", header: "Receipt", hideOnMobile: true, render: (x) => <Link className="num text-info hover:underline" href={printHref("receipt", x.id)}>{x.receipt}</Link> },
  ];
  return (
    <Card><CardHeader title="Payments & receipts" sub={`${data.length} payments · ${money(total)} confirmed. Feeding is paid separately from school fees.`}
/>
      <DataTable rows={data} columns={cols} rowId={(x) => x.id} searchText={(x) => x.name + x.receipt} pageSize={12}
        filters={<><Select label="How it was paid" value={how} onChange={setHow} options={[{ value: "", label: "All payments" }, ...["Daily", "Weekly", "Monthly", "Term"].map((h) => ({ value: h, label: label(h) }))]} />
          <Select label="Class" value={cls} onChange={setCls} options={[{ value: "", label: "All classes" }, ...classes.map((c) => ({ value: c.id, label: c.name }))]} /></>} /></Card>
  );
}

