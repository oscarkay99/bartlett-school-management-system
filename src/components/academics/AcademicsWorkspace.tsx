"use client";
import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Lock, Send, Undo2 } from "lucide-react";
import { AlertBanner, Badge, Button, Card, CardHeader, Field, StatusBadge, inputClass } from "@/components/ui/primitives";
import { ConfirmDialog, Select, Tabs, useToast } from "@/components/ui/interactive";
import { HBars, VBars } from "@/components/charts/charts";
import { useRole } from "@/components/shell/AppShell";
import { cn } from "@/lib/utils";

export interface Scale { grade: string; min: number; label: string }
export interface ClassData { id: string; name: string; subjects: string[]; students: { id: string; name: string; scores: Record<string, { ca: number; exam: number }> }[] }
type Status = "Draft" | "Submitted" | "Approved" | "Published" | "Returned";
const gradeOf = (scale: Scale[], t: number) => scale.find((g) => t >= g.min) ?? scale[scale.length - 1];

export function AcademicsWorkspace({ classes, scale, subjectAvg, classAvg, dist, intervention }: { classes: ClassData[]; scale: Scale[]; subjectAvg: { subject: string; avg: number }[]; classAvg: { name: string; avg: number }[]; dist: { grade: string; count: number }[]; intervention: { id: string; name: string; cls: string; avg: number }[] }) {
  const [classId, setClassId] = useState(classes[3].id); const [subject, setSubject] = useState(classes[3].subjects[0]);
  const { role, allow } = useRole(); const toast = useToast();
  const cd = classes.find((c) => c.id === classId)!;
  const [scores, setScores] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<Record<string, Status>>({ "c9|Mathematics": "Submitted", "c10|English Language": "Submitted", "c8|English Language": "Approved", "c5|Mathematics": "Draft" });
  const [w, setW] = useState({ ca: 40, exam: 60 }); const [reopen, setReopen] = useState(false);
  const key = `${classId}|${subject}`; const st: Status = status[key] ?? "Draft"; const locked = st === "Submitted" || st === "Approved" || st === "Published";
  const val = (id: string, f: "ca" | "exam") => scores[`${key}|${id}|${f}`] ?? String(cd.students.find((s) => s.id === id)!.scores[subject]?.[f] ?? "");
  const setVal = (id: string, f: "ca" | "exam", v: string) => setScores((s) => ({ ...s, [`${key}|${id}|${f}`]: v.replace(/[^\d.]/g, "") }));
  const errs = useMemo(() => cd.students.flatMap((s) => (["ca", "exam"] as const).map((f) => { const v = parseFloat(val(s.id, f)); const max = f === "ca" ? w.ca : w.exam; return isNaN(v) ? { id: s.id, f, m: "Required" } : v < 0 || v > max ? { id: s.id, f, m: `0–${max}` } : null; }).filter(Boolean) as { id: string; f: string; m: string }[]), [cd, scores, key, w]); // eslint-disable-line react-hooks/exhaustive-deps
  const bad = (id: string, f: string) => errs.find((e) => e.id === id && e.f === f);
  const wOk = w.ca + w.exam === 100;
  const can = role === "teacher" || allow("grades", "approve");
  const isApprover = allow("grades", "approve");
  const pending = Object.entries(status).filter(([, s]) => s === "Submitted");
  const label = (k: string) => { const [c, s] = k.split("|"); return `${classes.find((x) => x.id === c)?.name} — ${s}`; };

  return (
    <div className="space-y-4">
      {pending.length > 0 && <AlertBanner tone="info" icon={AlertTriangle} title={`${pending.length} grade batch${pending.length > 1 ? "es" : ""} awaiting approval`}>{pending.map(([k]) => label(k)).join(" · ")}</AlertBanner>}
      <Tabs tabs={[
        { id: "grades", label: "Gradebook", content: (
          <Card>
            <div className="flex flex-wrap items-end gap-3 border-b border-line p-4">
              <Select label="Class" value={classId} onChange={(v) => { setClassId(v); setSubject(classes.find((c) => c.id === v)!.subjects[0]); }} options={classes.map((c) => ({ value: c.id, label: c.name }))} />
              <Select label="Subject" value={subject} onChange={setSubject} options={cd.subjects.map((s) => ({ value: s, label: s }))} />
              <StatusBadge status={st === "Published" ? "Approved" : st} /><span className="text-xs text-muted">{st}</span>
              <div className="ml-auto flex gap-2">
                {!locked && <Button onClick={() => { setStatus({ ...status, [key]: "Draft" }); toast("Draft saved"); }} disabled={!can}>Save draft</Button>}
                {!locked && <Button variant="primary" disabled={!can || errs.length > 0 || !wOk} onClick={() => { setStatus({ ...status, [key]: "Submitted" }); toast(`${label(key)} submitted for review`); }}><Send size={14} />Submit for review</Button>}
                {st === "Submitted" && isApprover && <><Button variant="success" onClick={() => { setStatus({ ...status, [key]: "Approved" }); toast("Batch approved"); }}><CheckCircle2 size={14} />Approve</Button><Button onClick={() => { setStatus({ ...status, [key]: "Returned" }); toast("Returned to teacher for corrections"); }}><Undo2 size={14} />Return</Button></>}
                {st === "Approved" && isApprover && <Button variant="primary" onClick={() => { setStatus({ ...status, [key]: "Published" }); toast("Results published and locked"); }}>Publish & lock</Button>}
                {st === "Published" && <Button onClick={() => setReopen(true)}><Lock size={14} />Reopen (audited)</Button>}
              </div>
            </div>
            {!wOk && <p role="alert" className="border-b border-line bg-danger/8 px-4 py-2 text-sm text-danger">Assessment weights total {w.ca + w.exam}% — they must equal 100% before results can be submitted (Assessment setup tab).</p>}
            {!can && <p className="border-b border-line bg-surface-2 px-4 py-2 text-sm text-muted">Your role has read-only access to grades.</p>}
            <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-surface-2/60 text-xs uppercase text-muted"><tr><th className="px-4 py-2 text-left">Student</th><th className="px-3 text-right">CA /{w.ca}</th><th className="px-3 text-right">Exam /{w.exam}</th><th className="px-3 text-right">Total</th><th className="px-4 text-right">Grade</th></tr></thead>
              <tbody className="divide-y divide-line">{cd.students.map((s) => { const ca = parseFloat(val(s.id, "ca")), ex = parseFloat(val(s.id, "exam")); const total = (isNaN(ca) ? 0 : ca) + (isNaN(ex) ? 0 : ex); const g = gradeOf(scale, total); return (
                <tr key={s.id}><td className="px-4 py-1.5 font-medium">{s.name}</td>
                  {(["ca", "exam"] as const).map((f) => <td key={f} className="px-3 text-right"><input aria-label={`${s.name} ${f}`} inputMode="decimal" disabled={locked || !can} value={val(s.id, f)} onChange={(e) => setVal(s.id, f, e.target.value)} className={cn("num h-8 w-20 rounded-md border bg-surface px-2 text-right disabled:bg-surface-2", bad(s.id, f) ? "border-danger" : "border-line")} />{bad(s.id, f) && <div className="text-[10px] text-danger">{bad(s.id, f)!.m}</div>}</td>)}
                  <td className="num px-3 text-right font-semibold">{total}</td><td className="px-4 text-right"><Badge tone={g.grade <= "B" ? "ok" : g.grade === "C" ? "info" : g.grade === "D" ? "warn" : "danger"}>{g.grade}</Badge></td></tr>); })}</tbody></table></div>
            {errs.length > 0 && !locked && <p className="border-t border-line px-4 py-2 text-sm text-danger">{errs.length} field(s) need attention before submitting.</p>}
          </Card>) },
        { id: "analytics", label: "Analytics", content: (
          <div className="grid gap-4 lg:grid-cols-2">
            <Card><CardHeader title="Average by class" sub="Mean total score (CA + exam)" /><div className="px-2 pb-3"><HBars data={classAvg} x="name" y="avg" label="Average" money={false} color="var(--info)" height={320} /></div></Card>
            <Card><CardHeader title="Average by subject" /><div className="px-2 pb-3"><VBars data={subjectAvg} x="subject" y="avg" label="Average" color="var(--brand)" domain={[0, 100]} /></div></Card>
            <Card><CardHeader title="Grade distribution" /><div className="px-2 pb-3"><VBars data={dist} x="grade" y="count" label="Results" color="var(--warn)" height={220} /></div></Card>
            <Card><CardHeader title="Students who may benefit from support" sub="Average below 50%. A prompt for a human conversation, not an automated judgement." /><ul className="divide-y divide-line">{intervention.slice(0, 7).map((s) => <li key={s.id} className="flex justify-between px-4 py-2.5"><a className="hover:text-info" href={`/students/${s.id}?tab=academics`}>{s.name} <span className="text-xs text-muted">{s.cls}</span></a><b>{s.avg}%</b></li>)}{intervention.length === 0 && <li className="p-4 text-muted">No students below threshold.</li>}</ul></Card>
          </div>) },
        { id: "approvals", label: "Approvals", badge: String(pending.length), content: <Card><CardHeader title="Grade batches" />{Object.entries(status).map(([k, s]) => <div key={k} className="flex items-center justify-between border-t border-line px-4 py-3"><span>{label(k)}</span><StatusBadge status={s === "Published" ? "Approved" : s} /></div>)}</Card> },
        { id: "setup", label: "Assessment setup", content: (
          <div className="grid gap-4 lg:grid-cols-2">
            <Card><CardHeader title="Assessment weights" sub="Must total 100% before results can be published." /><div className="space-y-3 p-4 pt-1">
              <Field label="Continuous assessment %"><input className={inputClass} inputMode="numeric" value={w.ca} onChange={(e) => setW({ ...w, ca: Number(e.target.value.replace(/\D/g, "")) })} /></Field>
              <Field label="Final examination %"><input className={inputClass} inputMode="numeric" value={w.exam} onChange={(e) => setW({ ...w, exam: Number(e.target.value.replace(/\D/g, "")) })} /></Field>
              <Badge tone={wOk ? "ok" : "danger"}>Total {w.ca + w.exam}% {wOk ? "✓" : "— must equal 100"}</Badge></div></Card>
            <Card><CardHeader title="Grade scale" sub="Configurable per school and level" /><table className="w-full text-sm"><tbody className="divide-y divide-line">{scale.map((g, i) => <tr key={g.grade}><td className="px-4 py-2 font-semibold">{g.grade}</td><td>{g.label}</td><td className="px-4 text-right text-muted">{g.min}{i === 0 ? "–100" : `–${scale[i - 1].min - 1}`}</td></tr>)}</tbody></table></Card>
          </div>) },
        { id: "timetable", label: "Timetable", content: <Timetable /> },
      ]} />
      <ConfirmDialog open={reopen} needReason onClose={() => setReopen(false)} title="Reopen published results" body="Reopening unlocks published results for correction. The reason, your identity and every change will be recorded." confirmLabel="Reopen" onConfirm={() => { setStatus({ ...status, [key]: "Returned" }); setReopen(false); toast("Results reopened — logged to audit trail"); }} />
    </div>
  );
}

function Timetable() {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri"], periods = ["8:00", "8:45", "9:30", "10:30", "11:15", "12:00"]; const subj = ["English", "Maths", "Science", "ICT", "Ghanaian Lang.", "RME", "Creative Arts", "French"];
  const [cls] = useState("Primary 4");
  return <Card><CardHeader title={`${cls} — weekly timetable`} sub="Teacher clash detection runs on save" /><div className="overflow-x-auto p-3"><table className="w-full min-w-[560px] border-separate border-spacing-1 text-center text-xs"><thead><tr><th />{days.map((d) => <th key={d} className="py-1 text-muted">{d}</th>)}</tr></thead><tbody>{periods.map((p, i) => <tr key={p}><td className="pr-2 text-right text-muted">{p}</td>{days.map((d, j) => i === 3 && j >= 0 && i === 3 ? <td key={d} className="rounded-md bg-surface-2 py-3 text-muted">{i === 3 ? "Break" : ""}</td> : <td key={d} className="rounded-md bg-info/10 py-3 font-medium text-info">{subj[(i * 2 + j) % subj.length]}</td>)}</tr>)}</tbody></table></div></Card>;
}
