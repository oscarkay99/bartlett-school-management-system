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
import { enrolment, feedingStatus, FEEDING_OPT_IN, studentFeedingRate, validateException, type FeedingException, type TermDates } from "@/lib/feeding";
import { FeedingPaymentDialog } from "./FeedingPaymentDialog";
import { FeesWorkspace, type PRow, type RRow, type SRow } from "@/components/fees/FeesWorkspace";
import { useSearchParams } from "next/navigation";
import * as Q from "@/lib/data/queries";
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
  const { calendar } = useCalendar();
  const td = calendar.find((y) => y.name === year)?.terms.find((t) => t.name === term);
  const rows = useMemo(() => students.map((s) => {
    const cls = fs.classes.find((c) => c.id === s.classId);
    const classRate = tf && cls ? feedingRate(tf, cls) : 0; const ex = feeding.exceptionFor(s.id, key); const rate = studentFeedingRate(classRate, ex);
    return { ...s, classRate, ex, status: feedingStatus(ex), rate };
  }), [students, fs.classes, tf, feeding, key]);
  const byClass = fs.classes.map((c) => { const r = rows.filter((x) => x.classId === c.id); const on = r.filter((x) => x.rate > 0);
    return { id: c.id, name: c.name, students: r.length, on: on.length, off: r.length - on.length, rate: tf ? feedingRate(tf, c) : 0, expected: on.reduce((a, x) => a + x.rate, 0),
      paid: r.reduce((a, x) => a + x.paid, 0), owed: r.reduce((a, x) => a + Math.max(0, x.billed - x.paid), 0) }; }).filter((c) => c.students > 0);
  const paidAll = rows.reduce((a, r) => a + r.paid, 0); const owedAll = rows.reduce((a, r) => a + Math.max(0, r.billed - r.paid), 0);
  const onFeeding = rows.filter((r) => r.rate > 0).length; const expected = rows.reduce((a, r) => a + r.rate, 0);
  const low = kitchen.filter((k) => k.onHand <= k.reorder);


  const canPay = allow("payments", "create");
  const sp = useSearchParams();
  const [payFor, setPayFor] = useState<string | null>(sp.get("pay") === "1" ? "" : null); const [enrolOpen, setEnrolOpen] = useState(false);
  // The School Fees page, filled with feeding: billed = each student's feeding this term, paid = feeding payments.
  // No payment plans: families pay feeding whenever and however much they like.
  const sRows: SRow[] = rows.filter((r) => r.rate > 0 || r.paid > 0).map((r) => { const balance = r.rate - r.paid;
    return { id: r.id, name: r.name, adm: r.adm, classId: r.classId, cls: r.cls, feedingOwed: Math.max(0, balance), feedingRate: r.rate, billed: r.rate, paid: r.paid, balance,
      dueOn: td?.start ?? "", overdue: false, status: balance <= 0 ? "Paid in Full" : r.paid > 0 ? "Partially Paid" : "Outstanding",
      invoice: "", terms: [key], items: [{ label: "Feeding", amount: r.rate }], payer: r.payer }; });
  const pRows: PRow[] = payments.map((x) => { const p = Q.payments.find((y) => y.id === x.id);
    return { term: p ? Q.paymentTermLabel(p) : undefined, id: x.id, receipt: x.receipt, studentId: x.studentId, student: x.name, classId: x.classId, amount: x.feeding, feeding: x.feeding, feedingPeriod: x.how, method: x.method, date: x.date, ref: p?.ref ?? "", status: x.status, staff: p?.staff ?? "" }; });
  const reminders: RRow[] = (() => {
    const by = new Map<string, RRow>();
    for (const r of sRows.filter((x) => x.balance > 0)) {
      const st = Q.getStudent(r.id); const link = st?.guardians.find((g) => g.primary) ?? st?.guardians[0]; const g = link ? Q.getGuardian(link.guardianId) : undefined; if (!g) continue;
      const row = by.get(g.id) ?? { gid: g.id, name: `${g.title} ${g.name}`.trim(), channel: g.preferred, eligible: !!g.consent[g.preferred], reason: g.consent[g.preferred] ? undefined : `No consent for ${g.preferred}`,
        total: 0, overdue: false, classIds: [], students: [], message: "" };
      row.total += r.balance; row.overdue ||= r.overdue; row.classIds.push(r.classId); row.students.push({ id: r.id, name: r.name, balance: r.balance }); by.set(g.id, row);
    }
    return [...by.values()].map((x) => ({ ...x, message: `Dear ${x.name}, this is a reminder from ${Q.SCHOOL.name}: feeding for ${x.students.map((y) => y.name.split(" ")[0]).join(" and ")} this term — ${money(x.total)} still owed. Thank you.` }));
  })();
  return (
    <FeesWorkspace account="fees" students={sRows} payments={pRows} reminders={reminders} classes={fs.classes} candidates={[]} usedRefs={usedRefs}
      initialTab={sp.get("tab") ?? undefined} overdueOnly={sp.get("overdue") === "1"}
      feeding={{
        finder: <FeedingFinder rows={rows} canPay={canPay} canEdit={canEdit} onPay={(id) => setPayFor(id)} termLabel={`${term} ${year}`} />,
        onRecordPay: () => setPayFor(""),
        onEnrol: FEEDING_OPT_IN && canEdit && td ? () => setEnrolOpen(true) : undefined,
        dialog: <>{payFor !== null && canPay && <FeedingPaymentDialog students={rows} usedRefs={usedRefs} termLabel={`${term}, ${year}`} today={today} initial={payFor || undefined} onClose={() => setPayFor(null)} />}
          {enrolOpen && <EnrolFeedingDialog rows={rows} levelOf={(id) => fs.classes.find((c) => c.id === id)?.level ?? ""} termLabel={`${term} ${year}`} onClose={() => setEnrolOpen(false)}
            onEnrol={(sid, rate) => { feeding.updateException(sid, key, enrolment(sid, key, rate)); setEnrolOpen(false); }} />}</>,
        tabs: [
          { id: "students", label: "Students", content: <StudentsTab rows={rows} canEdit={canEdit} td={td} termLabel={`${term} ${year}`} termKey={key} classes={fs.classes}
            onException={(sid, ex) => feeding.updateException(sid, key, ex)} /> },
          { id: "meals", label: "Meal register", content: <MealsTab byClass={byClass} meals={feeding.meals} canEdit={canMeals} today={today} onSave={feeding.saveMeals} /> },
          { id: "kitchen", label: "Kitchen stock", badge: low.length ? String(low.length) : undefined, content: <KitchenTab items={kitchen} /> },
        ],
      }} />
  );
}

type Row = FStudent & { classRate: number; ex?: FeedingException; status: string; rate: number };

/** One table for everyone: their feeding this term and what they have paid. */
function StudentsTab({ rows, canEdit, td, termLabel, termKey: key, classes, onException }: { rows: Row[]; canEdit: boolean; td?: TermDates; termLabel: string; termKey: string;
  classes: { id: string; name: string }[]; onException: (sid: string, ex: FeedingException | null) => void }) {
  const [cls, setCls] = useState(""); const [show, setShow] = useState(""); const [edit, setEdit] = useState<Row | null>(null);
  const data = rows.filter((r) => (!cls || r.classId === cls) && (!show || (show === "paid" ? r.paid > 0 : r.rate === 0)));
  const cols: Column<Row>[] = [
    { key: "n", header: "Student", sort: (x) => x.name, render: (x) => <div><Link className="font-medium hover:text-info" href={studentHref(x.id, "feeding")}>{x.name}</Link><div className="text-xs text-muted">{x.cls} · {x.adm}</div></div> },
    { key: "r", header: "Feeding this term", align: "right", sort: (x) => x.rate, render: (x) => x.rate ? <span className="num">{money(x.rate)}{x.ex?.onFeeding ? <span className="block text-[11px] text-muted">different rate</span> : null}</span> : <Badge tone="neutral">Not on feeding</Badge> },
    { key: "p", header: "Paid", align: "right", sort: (x) => x.paid, render: (x) => <span className="num text-ok">{money(x.paid)}</span> },
    ...(canEdit ? [{ key: "e", header: "", render: (x: Row) => <Button size="sm" variant="ghost" disabled={!td} onClick={() => setEdit(x)}>Change</Button> }] : []),
  ];
  return (<>
    <Card><CardHeader title={`Feeding — ${termLabel}`} sub="Each student's feeding this term and what they have paid. Payments can be any amount, at any time." />
      <DataTable rows={data} columns={cols} rowId={(x) => x.id} searchText={(x) => `${x.name} ${x.adm}`} pageSize={12}
        filters={<><Select label="Class" value={cls} onChange={setCls} options={[{ value: "", label: "All classes" }, ...classes.map((c) => ({ value: c.id, label: c.name }))]} />
          <Select label="Show" value={show} onChange={setShow} options={[{ value: "", label: "Everyone" }, { value: "paid", label: "Has paid" }, { value: "off", label: "Not on feeding" }]} /></>} /></Card>
    {edit && td && <FeedingSettings row={edit} termLabel={termLabel} termKey={key} onClose={() => setEdit(null)}
      onSave={(ex) => { onException(edit.id, ex); setEdit(null); }} />}
  </>);
}

/** Change a student's feeding this term: the class rate, a different amount, or not on feeding. */
export function FeedingSettings({ row, termLabel, termKey: key, onClose, onSave }: { row: Row; termLabel: string; termKey: string; onClose: () => void;
  /** null = back to the class rate. */
  onSave: (ex: FeedingException | null) => void }) {
  const toast = useToast();
  const [mode, setMode] = useState<"class" | "rate" | "off">(row.ex ? (!row.ex.onFeeding ? "off" : row.ex.rate !== undefined ? "rate" : "class") : FEEDING_OPT_IN ? "off" : "class");
  const [rate, setRate] = useState(row.ex?.rate ?? row.classRate); const [reason, setReason] = useState(row.ex?.reason ?? "");
  const ex: FeedingException | null = FEEDING_OPT_IN
    ? (mode === "off" ? null : mode === "class" ? enrolment(row.id, key) : { ...enrolment(row.id, key, rate), reason: reason.trim() })
    : (mode === "class" ? null : { studentId: row.id, term: key, onFeeding: mode === "rate", rate: mode === "rate" ? rate : undefined, reason: reason.trim() });
  const changed = JSON.stringify(ex) !== JSON.stringify(row.ex ?? null);
  const err = (ex ? validateException(ex) : "") || (!changed ? "Nothing changed" : "");
  const opt = (v: typeof mode, label: string, sub: string) => <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-line p-3 text-sm hover:bg-surface-2"><input type="radio" className="mt-1" checked={mode === v} onChange={() => setMode(v)} /><span><b>{label}</b><span className="block text-xs text-muted">{sub}</span></span></label>;
  return (
    <Modal open onClose={onClose} title={`Feeding — ${row.name}`} footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!!err} onClick={() => { onSave(ex); toast(`Feeding updated for ${row.name}`); }}>Save</Button></>}>
      <div className="space-y-2"><div className="text-sm font-semibold">Feeding this term ({termLabel})</div>
        {opt("class", `${FEEDING_OPT_IN ? "On feeding at the class rate" : "Class rate"} — ${money(row.classRate)}`, FEEDING_OPT_IN ? "The feeding cost for this level, set in Settings." : "The default for every student.")}
        {opt("rate", "A different amount", "For example half-day feeding.")}
        {mode === "rate" && <div className="pl-7"><MoneyInput className="w-40" label="Feeding for this student" value={rate} onChange={setRate} /></div>}
        {opt("off", "Not on feeding", "e.g. brings lunch from home.")}
        {(FEEDING_OPT_IN ? mode === "rate" : mode !== "class") && <label className="block text-sm"><span className="mb-1 block font-medium">Reason *</span><input aria-label="Reason" className="h-9 w-full rounded-lg border border-line bg-surface px-3 text-sm" placeholder="e.g. brings lunch from home" value={reason} onChange={(e) => setReason(e.target.value)} /></label>}
      </div>
      {err && err !== "Nothing changed" && <p role="alert" className="mt-3 text-sm text-danger">{err}</p>}
    </Modal>
  );
}

/** Enrol a student for feeding this term: billed their level's feeding cost from Settings (or a different amount). */
function EnrolFeedingDialog({ rows, levelOf, termLabel, onClose, onEnrol }: { rows: Row[]; levelOf: (classId: string) => string; termLabel: string; onClose: () => void; onEnrol: (studentId: string, rate?: number) => void }) {
  const toast = useToast(); const [sid, setSid] = useState(""); const [q, setQ] = useState(""); const [other, setOther] = useState(false); const [amount, setAmount] = useState(0);
  const st = rows.find((r) => r.id === sid); const n = q.trim().toLowerCase();
  const list = rows.filter((r) => !n || `${r.name} ${r.adm}`.toLowerCase().includes(n)).slice(0, 6);
  const enrolled = !!st && st.rate > 0;
  const err = !st ? "Select a student" : enrolled ? `${st.name} is already on feeding this term` : other ? (amount > 0 ? "" : "Enter the amount") : st.classRate > 0 ? "" : `No feeding cost is set for ${levelOf(st.classId)} — set it in Settings, or enter a different amount`;
  return (
    <Modal open onClose={onClose} title={`Enrol for feeding — ${termLabel}`} footer={<><Button onClick={onClose}>Cancel</Button>
      <Button variant="primary" disabled={!!err} onClick={() => { onEnrol(st!.id, other ? amount : undefined); toast(`${st!.name} enrolled for feeding`); }}>Enrol · {money(other ? amount : st?.classRate ?? 0)}</Button></>}>
      <div className="space-y-4">
        <div><label className="block text-sm"><span className="mb-1 block font-medium">Student *</span>
          <input className="h-9 w-full rounded-lg border border-line bg-surface px-3 text-sm" placeholder="Search name or admission no." value={st ? st.name : q} onChange={(e) => { setSid(""); setQ(e.target.value); }} /></label>
          {!st && q && <ul className="mt-1 rounded-lg border border-line">{list.length === 0 && <li className="px-3 py-2 text-sm text-muted">No student matches &ldquo;{q}&rdquo;.</li>}
            {list.map((r) => <li key={r.id}><button className="flex w-full justify-between px-3 py-2 text-left text-sm hover:bg-surface-2" onClick={() => setSid(r.id)}><span>{r.name} <span className="text-xs text-muted">{r.cls} · {r.adm}</span></span>{r.rate > 0 && <span className="text-xs text-muted">on feeding</span>}</button></li>)}</ul>}</div>
        {st && !enrolled && <div className="space-y-2">
          <label className="flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-line p-3 text-sm hover:bg-surface-2"><span className="flex items-center gap-2"><input type="radio" checked={!other} onChange={() => setOther(false)} /><span><b>{levelOf(st.classId)} feeding</b><span className="block text-xs text-muted">The feeding cost for {st.cls}, set in Settings</span></span></span><b className="num">{money(st.classRate)}</b></label>
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-line p-3 text-sm hover:bg-surface-2"><input type="radio" checked={other} onChange={() => setOther(true)} /><b>A different amount</b></label>
          {other && <div className="pl-7"><MoneyInput className="w-40" label="Feeding for this student" value={amount} onChange={setAmount} /></div>}
          {st.classRate === 0 && !other && <p className="text-sm text-muted">No feeding cost is set for {levelOf(st.classId)} this term. <Link className="text-info hover:underline" href="/settings?tab=fees">Set it in Settings →</Link></p>}
        </div>}
        {err && st && <p role="alert" className="text-sm text-danger">{err}</p>}
      </div>
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
          <span className="flex flex-wrap items-center gap-3"><span className="num">Feeding paid this term: <b>{money(r.paid)}</b></span>
            {canPay && <Button size="sm" variant="primary" onClick={() => { onPay(r.id); setQ(""); }}>Record payment</Button>}
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

