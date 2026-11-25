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

/** Feeding charged on one of the student's school fees invoices. */
export interface FeedingHistoryRow { invoice: string; term: string; amount: number }

// Student profile → Feeding tab: this term's feeding (status, rate, reason, change) and the feeding billed so far.
export function StudentFeeding({ student, history }: { student: { id: string; name: string; classId: string; cls: string }; history: FeedingHistoryRow[] }) {
  const { year, term } = useCalendar(); const fs = useFeeSchedule(); const tf = fs.get(year, term); const key = termKey(year, term);
  const feeding = useFeeding(); const { allow } = useRole(); const canEdit = allow("invoices", "create") || allow("students", "edit");
  const [open, setOpen] = useState(false);
  const cls = fs.classes.find((c) => c.id === student.classId);
  const classRate = tf && cls ? feedingRate(tf, cls) : 0; const ex = feeding.exceptionFor(student.id, key);
  const status = feedingStatus(ex); const rate = studentFeedingRate(classRate, ex);
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
      <Card><CardHeader title="Feeding billed" sub="The Feeding line on each school fees invoice." />
        {history.length === 0 ? <p className="px-4 pb-4 text-sm text-muted">No feeding billed yet.</p>
          : <ul className="divide-y divide-line border-t border-line text-sm">{history.map((h) => <li key={h.invoice} className="flex justify-between gap-3 px-4 py-2.5"><span>{h.term} <span className="num text-xs text-muted">· {h.invoice}</span></span><b className="num">{money(h.amount)}</b></li>)}</ul>}</Card>
      {open && <ChangeFeeding row={{ id: student.id, name: student.name, cls: student.cls, classRate, ex }} termLabel={`${term} ${year}`} termKey={key}
        onClose={() => setOpen(false)} onSave={(e) => { feeding.updateException(student.id, key, e); setOpen(false); }} />}
    </div>
  );
}
