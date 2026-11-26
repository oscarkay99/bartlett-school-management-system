"use client";
import { studentHref, printHref } from "@/lib/links";
import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangle, Users, Utensils, Wallet } from "lucide-react";
import { AlertBanner, Badge, Button, Card, CardHeader, EmptyState, Kpi } from "@/components/ui/primitives";
import { DataTable, Modal, MoneyInput, QueryTabs, Select, useToast, type Column } from "@/components/ui/interactive";
import { useCalendar } from "@/components/shell/CalendarContext";
import { useFeeSchedule } from "@/components/shell/FeeScheduleContext";
import { useRole } from "@/components/shell/AppShell";
import { canRecordMeals } from "@/lib/permissions";
import { useFeeding } from "./useFeeding";
import { feedingRate, termKey } from "@/lib/fees";
import { expectedByToday, feedingStatus, PLAN_FREQUENCIES, periodWord, perPeriod, planLabel, planStatus, studentFeedingRate, validateException, type FeedingException, type FeedingPlan, type PlanFrequency, type PlanStatus, type TermDates } from "@/lib/feeding";
import { useFeedingPlans } from "@/components/shell/FeedingPlansContext";
import { PlanDialog } from "./PlanDialog";
import { FeedingPaymentDialog } from "./FeedingPaymentDialog";
import { money } from "@/lib/money";
import { fmtDate } from "@/lib/utils";

interface FStudent { id: string; name: string; adm: string; classId: string; cls: string; billed: number; paid: number; dueOn?: string; payer?: { name: string; phone?: string } }
/** A payment that included feeding. `how`: "With school fees" or Daily / Weekly / Monthly / Term. */
export interface FeedingPayment { id: string; receipt: string; studentId: string; name: string; classId: string; cls: string; date: string; feeding: number; how: string; method: string; status: string }
interface KitchenItem { id: string; name: string; unit: string; onHand: number; reorder: number; expiry?: string }

// Feeding module: who is on feeding this term, the daily meal register, and kitchen stock.
// Billing stays on the school fees invoice; changes here decide each student's Feeding line when invoices are generated.
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
    const freq: PlanFrequency = plans.planOn(s.id, key, today)?.frequency ?? "With school fees";
    const expected = td ? expectedByToday(rate, td, freq, today, s.dueOn) : 0;
    return { ...s, classRate, ex, status: feedingStatus(ex), rate, freq, expected, perPeriod: td && freq !== "With school fees" ? perPeriod(rate, td, freq) : 0, plan: planStatus(rate, s.paid, expected) };
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
        <Kpi label="Expected feeding income" value={money(expected)} icon={Wallet} tone="ok" hint="Billed on the school fees invoice." />
        <Kpi label="Feeding collected" value={money(paidAll)} icon={Wallet} tone="ok" hint="Feeding paid so far: with school fees at once, or daily / weekly / monthly." />
        <Kpi label="Behind on plan" value={`${behind.length} · ${money(behind.reduce((a, r) => a + r.plan.behind, 0))}`} icon={Users} tone={behind.length ? "danger" : "ok"} hint="Students who have paid less feeding than their payment plan expects by today." />
        <Kpi label="Feeding still owed" value={money(owedAll)} icon={AlertTriangle} tone={owedAll ? "danger" : "ok"} hint="Feeding billed minus feeding paid." />
      </div>
      <Card><CardHeader title={`Feeding by class — ${term} ${year}`} sub="The rate per class is set in Settings → Fee schedule. Per-student changes are on the Students tab." />
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-surface-2/60 text-xs uppercase text-muted"><tr><th className="px-4 py-2 text-left">Class</th><th className="px-3 text-right">Students</th><th className="px-3 text-right">On feeding</th><th className="px-3 text-right">Not on feeding</th><th className="px-3 text-right">Rate</th><th className="px-3 text-right">Expected</th><th className="px-3 text-right">Paid</th><th className="px-4 text-right">Owed</th></tr></thead>
          <tbody className="divide-y divide-line">{byClass.map((c) => <tr key={c.id}><td className="px-4 py-2.5 font-medium">{c.name}</td><td className="num px-3 text-right">{c.students}</td><td className="num px-3 text-right">{c.on}</td><td className="num px-3 text-right">{c.off || "—"}</td><td className="num px-3 text-right">{money(c.rate)}</td><td className="num px-3 text-right font-medium">{money(c.expected)}</td><td className="num px-3 text-right text-ok">{money(c.paid)}</td><td className={`num px-4 text-right ${c.owed ? "text-danger" : ""}`}>{money(c.owed)}</td></tr>)}</tbody>
          <tfoot><tr className="border-t-2 border-line font-semibold"><td className="px-4 py-2.5">Total</td><td className="num px-3 text-right">{rows.length}</td><td className="num px-3 text-right">{onFeeding}</td><td className="num px-3 text-right">{rows.length - onFeeding}</td><td /><td className="num px-3 text-right">{money(expected)}</td><td className="num px-3 text-right">{money(paidAll)}</td><td className="num px-4 text-right">{money(owedAll)}</td></tr></tfoot></table></div></Card>
    </div>
  );

  return (
    <QueryTabs tabs={[
      { id: "overview", label: "Overview", content: overview },
      { id: "students", label: "Students", badge: String(rows.length - onFeeding || ""), content: <StudentsTab rows={rows} canEdit={canEdit} termLabel={`${term} ${year}`} onSave={(sid, ex) => feeding.updateException(sid, key, ex)} classes={fs.classes} termKey={key} /> },
      { id: "plans", label: "Payment plans", badge: behind.length ? String(behind.length) : undefined, content: <PlansTab rows={rows} canEdit={canEdit} td={td} today={today} termLabel={`${term} ${year}`} termKey={key} classes={fs.classes} history={plans.history} onPlan={plans.setPlan} /> },
      { id: "payments", label: "Payments", content: <PaymentsTab payments={payments} classes={fs.classes} payees={allow("payments", "create") ? rows : undefined} usedRefs={usedRefs} termLabel={`${term}, ${year}`} today={today} /> },
      { id: "meals", label: "Meal register", content: <MealsTab byClass={byClass} meals={feeding.meals} canEdit={canMeals} today={today} onSave={feeding.saveMeals} /> },
      { id: "kitchen", label: "Kitchen stock", badge: low.length ? String(low.length) : undefined, content: <KitchenTab items={kitchen} /> },
    ].map((t) => ({ ...t, badge: t.badge || undefined }))} />
  );
}

type Row = FStudent & { classRate: number; ex?: FeedingException; status: string; rate: number; freq: PlanFrequency; expected: number; perPeriod: number; plan: PlanStatus };

function StudentsTab({ rows, canEdit, termLabel, onSave, classes, termKey: key }: { rows: Row[]; canEdit: boolean; termLabel: string; onSave: (sid: string, ex: FeedingException | null) => void; classes: { id: string; name: string }[]; termKey: string }) {
  const [cls, setCls] = useState(""); const [st, setSt] = useState(""); const [edit, setEdit] = useState<Row | null>(null);
  const data = rows.filter((r) => (!cls || r.classId === cls) && (!st || r.status === st));
  const cols: Column<Row>[] = [
    { key: "n", header: "Student", sort: (x) => x.name, render: (x) => <div><div className="font-medium">{x.name}</div><div className="text-xs text-muted">{x.adm}</div></div> },
    { key: "c", header: "Class", render: (x) => x.cls },
    { key: "s", header: "Feeding", render: (x) => <Badge tone={x.status === "On feeding" ? "ok" : x.status === "Not on feeding" ? "neutral" : "info"} dot>{x.status}</Badge> },
    { key: "r", header: "Charged", align: "right", sort: (x) => x.rate, render: (x) => (x.rate ? money(x.rate) : "—") },
    { key: "p", header: "Paid", align: "right", sort: (x) => x.paid, render: (x) => <span className="num text-ok">{money(x.paid)}</span> },
    { key: "o", header: "Owed", align: "right", sort: (x) => x.billed - x.paid, render: (x) => <span className={`num ${x.billed - x.paid > 0 ? "text-danger" : ""}`}>{money(Math.max(0, x.billed - x.paid))}</span> },
    { key: "why", header: "Reason", hideOnMobile: true, render: (x) => <span className="text-xs text-muted">{x.ex?.reason ?? ""}</span> },
    ...(canEdit ? [{ key: "e", header: "", render: (x: Row) => <Button size="sm" variant="ghost" onClick={() => setEdit(x)}>Change</Button> }] : []),
  ];
  return (<>
    <Card><DataTable rows={data} columns={cols} rowId={(x) => x.id} searchText={(x) => x.name + x.adm} pageSize={12}
      filters={<><Select label="Class" value={cls} onChange={setCls} options={[{ value: "", label: "All classes" }, ...classes.map((c) => ({ value: c.id, label: c.name }))]} />
        <Select label="Feeding" value={st} onChange={setSt} options={[{ value: "", label: "Everyone" }, { value: "On feeding", label: "On feeding" }, { value: "Different rate", label: "Different rate" }, { value: "Not on feeding", label: "Not on feeding" }]} /></>} /></Card>
    {edit && <ChangeFeeding row={edit} termLabel={termLabel} termKey={key} onClose={() => setEdit(null)} onSave={(ex) => { onSave(edit.id, ex); setEdit(null); }} />}
  </>);
}

/** Change one student's feeding for a term. Shared by the Feeding page and the student profile's Feeding tab. */
export function ChangeFeeding({ row, termLabel, termKey: key, onClose, onSave }: { row: Pick<Row, "id" | "name" | "cls" | "classRate" | "ex">; termLabel: string; termKey: string; onClose: () => void; onSave: (ex: FeedingException | null) => void }) {
  const toast = useToast();
  const [mode, setMode] = useState<"class" | "rate" | "off">(row.ex ? (row.ex.onFeeding ? "rate" : "off") : "class");
  const [rate, setRate] = useState(row.ex?.rate ?? row.classRate); const [reason, setReason] = useState(row.ex?.reason ?? "");
  const ex: FeedingException | null = mode === "class" ? null : { studentId: row.id, term: key, onFeeding: mode === "rate", rate: mode === "rate" ? rate : undefined, reason: reason.trim() };
  const err = ex ? validateException(ex) : "";
  const opt = (v: typeof mode, label: string, sub: string) => <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-line p-3 text-sm hover:bg-surface-2"><input type="radio" className="mt-1" checked={mode === v} onChange={() => setMode(v)} /><span><b>{label}</b><span className="block text-xs text-muted">{sub}</span></span></label>;
  return (
    <Modal open onClose={onClose} title={`Feeding — ${row.name}`} footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!!err} onClick={() => { onSave(ex); toast(`Feeding updated for ${row.name}`); }}>Save</Button></>}>
      <div className="space-y-2">
        <p className="text-sm text-muted">{row.cls} · {termLabel}. This decides the Feeding line on the student&apos;s school fees invoice.</p>
        {opt("class", `On feeding at the class rate (${money(row.classRate)})`, "The default for every student.")}
        {opt("rate", "On feeding at a different rate", "For example half-day feeding.")}
        {mode === "rate" && <div className="pl-7"><MoneyInput className="w-40" label="Feeding rate for this student" value={rate} onChange={setRate} /></div>}
        {opt("off", "Not on feeding this term", "No Feeding line on the invoice.")}
        {mode !== "class" && <label className="block text-sm"><span className="mb-1 block font-medium">Reason *</span><input aria-label="Reason" className="h-9 w-full rounded-lg border border-line bg-surface px-3 text-sm" placeholder="e.g. brings lunch from home" value={reason} onChange={(e) => setReason(e.target.value)} /></label>}
        {err && reason && <p role="alert" className="text-sm text-danger">{err}</p>}
      </div>
    </Modal>
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
function PaymentsTab({ payments, classes, payees, usedRefs, termLabel, today }: { payments: FeedingPayment[]; classes: { id: string; name: string }[]; payees?: Row[]; usedRefs: string[]; termLabel: string; today: string }) {
  const [how, setHow] = useState(""); const [cls, setCls] = useState(""); const [pay, setPay] = useState(false);
  const data = payments.filter((p) => (!how || p.how === how) && (!cls || p.classId === cls));
  const total = data.filter((p) => p.status === "Confirmed").reduce((a, p) => a + p.feeding, 0);
  const label = (h: string) => (h === "Term" ? "For the term" : h);
  const cols: Column<FeedingPayment>[] = [
    { key: "d", header: "Date", sort: (x) => x.date, render: (x) => fmtDate(x.date) },
    { key: "s", header: "Student", sort: (x) => x.name, render: (x) => <div><Link className="font-medium hover:text-info" href={studentHref(x.studentId, "feeding")}>{x.name}</Link><div className="text-xs text-muted">{x.cls}</div></div> },
    { key: "h", header: "Paid", render: (x) => <Badge tone={x.how === "With school fees" ? "neutral" : "info"}>{label(x.how)}</Badge> },
    { key: "f", header: "Feeding", align: "right", sort: (x) => x.feeding, render: (x) => <b className="num">{money(x.feeding)}</b> },
    { key: "m", header: "Method", hideOnMobile: true, render: (x) => x.method },
    { key: "r", header: "Receipt", hideOnMobile: true, render: (x) => <Link className="num text-info hover:underline" href={printHref("receipt", x.id)}>{x.receipt}</Link> },
  ];
  return (
    <Card><CardHeader title="Feeding payments" sub={`${data.length} payments · ${money(total)} confirmed. Feeding paid with the school fees at once shows the feeding part of that payment.`}
      action={payees && <Button variant="primary" onClick={() => setPay(true)}>Record feeding payment</Button>} />
      {pay && payees && <FeedingPaymentDialog students={payees} usedRefs={usedRefs} termLabel={termLabel} today={today} onClose={() => setPay(false)} />}
      <DataTable rows={data} columns={cols} rowId={(x) => x.id} searchText={(x) => x.name + x.receipt} pageSize={12}
        filters={<><Select label="How it was paid" value={how} onChange={setHow} options={[{ value: "", label: "All payments" }, ...["With school fees", "Daily", "Weekly", "Monthly", "Term"].map((h) => ({ value: h, label: label(h) }))]} />
          <Select label="Class" value={cls} onChange={setCls} options={[{ value: "", label: "All classes" }, ...classes.map((c) => ({ value: c.id, label: c.name }))]} /></>} /></Card>
  );
}

// Payment plans: how each family pays feeding this term, whether they are keeping up, and where plans are changed.
function PlansTab({ rows, canEdit, td, today, termLabel, termKey: key, classes, history, onPlan }: { rows: Row[]; canEdit: boolean; td?: TermDates; today: string; termLabel: string; termKey: string;
  classes: { id: string; name: string }[]; history: (studentId: string, term: string) => FeedingPlan[]; onPlan: (p: FeedingPlan) => void }) {
  const [plan, setPlan] = useState(""); const [behindOnly, setBehindOnly] = useState(""); const [cls, setCls] = useState(""); const [planFor, setPlanFor] = useState<Row | null>(null);
  const onFeeding = rows.filter((r) => r.rate > 0);
  const data = onFeeding.filter((r) => (!plan || r.freq === plan) && (!behindOnly || r.plan.label === "Behind") && (!cls || r.classId === cls));
  const cols: Column<Row>[] = [
    { key: "n", header: "Student", sort: (x) => x.name, render: (x) => <div><Link className="font-medium hover:text-info" href={studentHref(x.id, "feeding")}>{x.name}</Link><div className="text-xs text-muted">{x.cls}</div></div> },
    { key: "pl", header: "Plan", sort: (x) => x.freq, render: (x) => { const h = history(x.id, key); return <div><div className="font-medium">{planLabel(x.freq)}</div>
      <div className="num text-[11px] text-muted">{x.perPeriod > 0 ? `${money(x.perPeriod)} per ${periodWord(x.freq)}` : "with the school fees invoice"}{h.length > 1 ? ` · ${h.length} changes` : ""}</div></div>; } },
    { key: "ex", header: "Expected by today", align: "right", hideOnMobile: true, sort: (x) => x.expected, render: (x) => <span className="num">{money(x.expected)}</span> },
    { key: "p", header: "Paid", align: "right", sort: (x) => x.paid, render: (x) => <span className="num text-ok">{money(x.paid)}</span> },
    { key: "s", header: "Status", sort: (x) => x.plan.behind, render: (x) => <Badge tone={x.plan.label === "Behind" ? "danger" : "ok"} dot>{x.plan.label === "Behind" ? `Behind ${money(x.plan.behind)}` : x.plan.label}</Badge> },
    ...(canEdit ? [{ key: "e", header: "", render: (x: Row) => <Button size="sm" variant="ghost" disabled={!td} onClick={() => setPlanFor(x)}>Change plan</Button> }] : []),
  ];
  const count = (f: string) => onFeeding.filter((r) => r.freq === f).length;
  return (<>
    <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-5">{PLAN_FREQUENCIES.map((f) => (
      <button key={f} onClick={() => setPlan(plan === f ? "" : f)} className={`rounded-xl border bg-surface px-3 py-2.5 text-left transition hover:shadow-md ${plan === f ? "border-info ring-1 ring-info" : "border-line"}`}>
        <div className="text-xs text-muted">{planLabel(f)}</div><div className="text-xl font-semibold">{count(f)}</div></button>))}</div>
    <Card><CardHeader title={`Feeding payment plans — ${termLabel}`} sub="When a parent switches (e.g. daily to weekly), change the plan here. The history is kept and payments already made still count." />
      <DataTable rows={data} columns={cols} rowId={(x) => x.id} searchText={(x) => x.name + x.adm} pageSize={12}
        filters={<><Select label="Plan" value={plan} onChange={setPlan} options={[{ value: "", label: "All plans" }, ...PLAN_FREQUENCIES.map((f) => ({ value: f, label: planLabel(f) }))]} />
          <Select label="Behind" value={behindOnly} onChange={setBehindOnly} options={[{ value: "", label: "Everyone" }, { value: "1", label: "Behind only" }]} />
          <Select label="Class" value={cls} onChange={setCls} options={[{ value: "", label: "All classes" }, ...classes.map((c) => ({ value: c.id, label: c.name }))]} /></>} /></Card>
    {planFor && td && <PlanDialog student={{ id: planFor.id, name: planFor.name }} current={planFor.freq} rate={planFor.rate} term={td} termLabel={termLabel} termKey={key} today={today}
      onClose={() => setPlanFor(null)} onSave={(p) => { onPlan(p); setPlanFor(null); }} />}
  </>);
}
