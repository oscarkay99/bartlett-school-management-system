"use client";
import { useLiveData } from "@/lib/live/data";
import { PageHeader } from "@/components/ui/primitives";
import { AttendanceWorkspace } from "@/components/AttendanceWorkspace";
import * as Q from "@/lib/data/queries";
export function View() {
  useLiveData(); // re-render with fresh data after each save (live site)
  const classes = Q.classes.map((c) => ({ id: c.id, name: c.name, students: Q.students.filter((s) => s.classId === c.id && s.status === "Active").map((s) => ({ id: s.id, name: Q.fullName(s) })) }));
  const chronic = Q.activeStudents().map((s) => ({ id: s.id, name: Q.fullName(s), cls: Q.getClass(s.classId).name, absent: Q.studentAttendance(s.id).absent })).filter((s) => s.absent >= 3).slice(0, 8);
  return (<><PageHeader title="Attendance" sub="Daily registers, trends and welfare follow-up" /><AttendanceWorkspace classes={classes} trend={Q.attendanceTrend} chronic={chronic} /></>);
}
