"use client";
import { printHref } from "@/lib/links";
import Link from "next/link";
import { Badge, Card, CardHeader } from "@/components/ui/primitives";
import { useCalendar } from "@/components/shell/CalendarContext";
import { useFeeSchedule } from "@/components/shell/FeeScheduleContext";
import { useFeeding } from "./useFeeding";
import { feedingRate, termKey } from "@/lib/fees";
import { expectedByToday, feedingStatus, periodWord, perPeriod, planLabel, planStatus, studentFeedingRate, type PlanFrequency } from "@/lib/feeding";
import { useFeedingPlans } from "@/components/shell/FeedingPlansContext";
import { money } from "@/lib/money";
import { fmtDate } from "@/lib/utils";

/** Feeding charged on one of the student's school fees invoices. */
export interface FeedingHistoryRow { invoice: string; term: string; amount: number }
/** A payment that included feeding: with the school fees, or on its own (Daily / Weekly / Monthly / Term). */
export interface StudentFeedingPayment { id: string; receipt: string; date: string; feeding: number; how: string; status: string }

// Student profile → Feeding tab (view only): this term's feeding, payment plan and payments.
// All feeding changes are made in the Feeding module; the links below go straight to the right tab.
export function StudentFeeding({ student, history, paid, payments, dueOn, today }: { student: { id: string; name: string; classId: string; cls: string }; history: FeedingHistoryRow[]; paid: number; payments: StudentFeedingPayment[]; dueOn?: string; today: string }) {
  const { year, term } = useCalendar(); const fs = useFeeSchedule(); const tf = fs.get(year, term); const key = termKey(year, term);
  const feeding = useFeeding();
  const cls = fs.classes.find((c) => c.id === student.classId);
  const classRate = tf && cls ? feedingRate(tf, cls) : 0; const ex = feeding.exceptionFor(student.id, key);
  const status = feedingStatus(ex); const rate = studentFeedingRate(classRate, ex);
  const billed = history.reduce((a, h) => a + h.amount, 0);
  // Payment plan: how the family pays feeding this term, and whether they are keeping up.
  const { calendar } = useCalendar(); const plans = useFeedingPlans();
  const td = calendar.find((y) => y.name === year)?.terms.find((t) => t.name === term);
  const plan = plans.planOn(student.id, key, today); const freq: PlanFrequency = plan?.frequency ?? "With school fees";
  const expected = td ? expectedByToday(rate, td, freq, today, dueOn) : 0; const ps = planStatus(rate, paid, expected);
  const hist = plans.history(student.id, key);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card><CardHeader title={`Feeding — ${term} ${year}`} sub="Billed on the school fees invoice." action={<Link className="text-sm font-medium text-info hover:underline" href="/feeding?tab=students">Manage in Feeding →</Link>} />
        <dl className="space-y-2 px-4 pb-4 text-sm">
          <div className="flex justify-between gap-3"><dt className="text-muted">Status</dt><dd><Badge tone={status === "On feeding" ? "ok" : status === "Not on feeding" ? "neutral" : "info"} dot>{status}</Badge></dd></div>
          <div className="flex justify-between gap-3"><dt className="text-muted">Charged this term</dt><dd className="num font-semibold">{tf ? (rate ? money(rate) : "—") : "No fees set for this term"}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-muted">{student.cls} class rate</dt><dd className="num">{tf ? money(classRate) : "—"}</dd></div>
          {ex && <div className="flex justify-between gap-3"><dt className="text-muted">Reason</dt><dd className="text-right">{ex.reason}</dd></div>}
        </dl>
</Card>
      <Card><CardHeader title="Feeding paid" sub="With school fees at once, or daily, weekly or monthly." />
        <div className="grid grid-cols-3 gap-2 px-4 pb-3 text-sm">{[["Billed", billed, ""], ["Paid", paid, "text-ok"], ["Still owed", Math.max(0, billed - paid), billed - paid > 0 ? "text-danger" : ""]].map(([k, v, c]) =>
          <div key={k as string}><div className="text-xs text-muted">{k}</div><div className={`num text-lg font-semibold ${c}`}>{money(v as number)}</div></div>)}</div>
        {history.length > 0 && <p className="px-4 pb-2 text-xs text-muted">Billed on {history.map((h) => `${h.invoice} (${h.term}, ${money(h.amount)})`).join(", ")}</p>}
        {payments.length === 0 ? <p className="border-t border-line px-4 py-3 text-sm text-muted">No feeding paid yet.</p>
          : <ul className="max-h-72 divide-y divide-line overflow-y-auto border-t border-line text-sm">{payments.map((p) => <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-2">
              <span>{fmtDate(p.date)} <Badge tone={p.how === "With school fees" ? "neutral" : "info"}>{p.how === "Term" ? "For the term" : p.how}</Badge>{p.status !== "Confirmed" && <span className="ml-1 text-xs text-warn">{p.status}</span>}</span>
              <span className="flex items-center gap-3"><b className="num">{money(p.feeding)}</b><Link className="num text-xs text-info hover:underline" href={printHref("receipt", p.id)}>{p.receipt}</Link></span></li>)}</ul>}</Card>
      <Card className="lg:col-span-2"><CardHeader title="Payment plan" sub="How the family pays feeding this term. Plans are changed in the Feeding module."
          action={<Link className="text-sm font-medium text-info hover:underline" href="/feeding?tab=plans">Change in Feeding → Payment plans</Link>} />
        <div className="grid gap-3 px-4 pb-3 text-sm sm:grid-cols-4">
          <div><div className="text-xs text-muted">Plan</div><div className="font-semibold">{planLabel(freq)}</div><div className="num text-xs text-muted">{freq === "With school fees" ? "with the school fees invoice" : td ? `${money(perPeriod(rate, td, freq))} per ${periodWord(freq)}` : ""}</div></div>
          <div><div className="text-xs text-muted">Expected by today</div><div className="num font-semibold">{money(expected)}</div></div>
          <div><div className="text-xs text-muted">Paid</div><div className="num font-semibold text-ok">{money(paid)}</div></div>
          <div><div className="text-xs text-muted">Status</div><Badge tone={ps.label === "Behind" ? "danger" : ps.label === "Not on feeding" ? "neutral" : "ok"} dot>{ps.label === "Behind" ? `Behind by ${money(ps.behind)}` : ps.label}</Badge></div>
        </div>
        {hist.length > 0 && <div className="border-t border-line px-4 py-2.5 text-xs text-muted">History: {hist.map((h, i) => <span key={h.from}>{i > 0 && " → "}<b className="text-fg">{planLabel(h.frequency)}</b> from {fmtDate(h.from)}{h.note ? ` (${h.note})` : ""}</span>)}</div>}</Card>
    </div>
  );
}
