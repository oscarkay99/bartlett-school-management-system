"use client";
import { useLiveData } from "@/lib/live/data";
import { PageHeader } from "@/components/ui/primitives";
import { CommsWorkspace } from "@/components/CommsWorkspace";
import * as Q from "@/lib/data/queries";
export function View() {
  useLiveData(); // re-render with fresh data after each save (live site)
  const rows = Q.messages.map((m) => ({ id: m.id, date: m.date, guardian: Q.getGuardian(m.guardianId)?.name ?? "", students: m.studentIds.map((i) => Q.getStudent(i)!.first).join(", "), channel: m.channel, template: m.template, amount: m.amount ?? 0, status: m.status, sender: m.sender, failure: m.failure }));
  return (<><PageHeader title="Communications" sub="Announcements, fee reminders, templates and delivery tracking" /><CommsWorkspace rows={rows} /></>);
}
