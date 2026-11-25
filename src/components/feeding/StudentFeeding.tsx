"use client";
import Link from "next/link";
import { useState } from "react";
import { Badge, Button, Card, CardHeader } from "@/components/ui/primitives";
import { useCalendar } from "@/components/shell/CalendarContext";
import { useFeeSchedule } from "@/components/shell/FeeScheduleContext";
import { useRole } from "@/components/shell/AppShell";
import { useFeeding } from "./useFeeding";
import { ChangeFeeding } from "./FeedingWorkspace";
import { feedingRate, termKey } from "@/lib/fees";
import { feedingStatus, studentFeedingRate } from "@/lib/feeding";
import { money } from "@/lib/money";
import { fmtDate } from "@/lib/utils";

/** Feeding charged on one of the student's school fees invoices. */
export interface FeedingHistoryRow { invoice: string; term: string; amount: number }
/** A payment that included feeding: with the school fees, or on its own (Daily / Weekly / Monthly / Term). */
export interface StudentFeedingPayment { id: string; receipt: string; date: string; feeding: number; how: string; status: string }

// Student profile → Feeding tab: this term's feeding (status, rate, reason, change) and the feeding billed so far.
export function StudentFeeding({ student, history, paid, payments }: { student: { id: string; name: string; classId: string; cls: string }; history: FeedingHistoryRow[]; paid: number; payments: StudentFeedingPayment[] }) {
  const { year, term } = useCalendar(); const fs = useFeeSchedule(); const tf = fs.get(year, term); const key = termKey(year, term);
  const feeding = useFeeding(); const { allow } = useRole(); const canEdit = allow("invoices", "create") || allow("students", "edit");
  const [open, setOpen] = useState(false);
  const cls = fs.classes.find((c) => c.id === student.classId);
  const classRate = tf && cls ? feedingRate(tf, cls) : 0; const ex = feeding.exceptionFor(student.id, key);
  const status = feedingStatus(ex); const rate = studentFeedingRate(classRate, ex);
  const billed = history.reduce((a, h) => a + h.amount, 0);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card><CardHeader title={`Feeding — ${term} ${year}`} sub="Billed on the school fees invoice." action={canEdit && tf ? <Button size="sm" onClick={() => setOpen(true)}>Change</Button> : undefined} />
        <dl className="space-y-2 px-4 pb-4 text-sm">
          <div className="flex justify-between gap-3"><dt className="text-muted">Status</dt><dd><Badge tone={status === "On feeding" ? "ok" : status === "Not on feeding" ? "neutral" : "info"} dot>{status}</Badge></dd></div>
          <div className="flex justify-between gap-3"><dt className="text-muted">Charged this term</dt><dd className="num font-semibold">{tf ? (rate ? money(rate) : "—") : "No fees set for this term"}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-muted">{student.cls} class rate</dt><dd className="num">{tf ? money(classRate) : "—"}</dd></div>
          {ex && <div className="flex justify-between gap-3"><dt className="text-muted">Reason</dt><dd className="text-right">{ex.reason}</dd></div>}
        </dl>
        <p className="border-t border-line px-4 py-2.5 text-xs text-muted">All students: <Link className="text-info hover:underline" href="/feeding">Feeding</Link></p></Card>
      <Card><CardHeader title="Feeding paid" sub="With school fees at once, or daily, weekly or monthly." />
        <div className="grid grid-cols-3 gap-2 px-4 pb-3 text-sm">{[["Billed", billed, ""], ["Paid", paid, "text-ok"], ["Still owed", Math.max(0, billed - paid), billed - paid > 0 ? "text-danger" : ""]].map(([k, v, c]) =>
          <div key={k as string}><div className="text-xs text-muted">{k}</div><div className={`num text-lg font-semibold ${c}`}>{money(v as number)}</div></div>)}</div>
        {history.length > 0 && <p className="px-4 pb-2 text-xs text-muted">Billed on {history.map((h) => `${h.invoice} (${h.term}, ${money(h.amount)})`).join(", ")}</p>}
        {payments.length === 0 ? <p className="border-t border-line px-4 py-3 text-sm text-muted">No feeding paid yet.</p>
          : <ul className="max-h-72 divide-y divide-line overflow-y-auto border-t border-line text-sm">{payments.map((p) => <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-2">
              <span>{fmtDate(p.date)} <Badge tone={p.how === "With school fees" ? "neutral" : "info"}>{p.how === "Term" ? "For the term" : p.how}</Badge>{p.status !== "Confirmed" && <span className="ml-1 text-xs text-warn">{p.status}</span>}</span>
              <span className="flex items-center gap-3"><b className="num">{money(p.feeding)}</b><Link className="num text-xs text-info hover:underline" href={`/print/receipt/${p.id}`}>{p.receipt}</Link></span></li>)}</ul>}</Card>
      {open && <ChangeFeeding row={{ id: student.id, name: student.name, cls: student.cls, classRate, ex }} termLabel={`${term} ${year}`} termKey={key}
        onClose={() => setOpen(false)} onSave={(e) => { feeding.updateException(student.id, key, e); setOpen(false); }} />}
    </div>
  );
}
