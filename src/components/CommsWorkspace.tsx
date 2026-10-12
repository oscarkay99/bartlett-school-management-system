"use client";
import { useState } from "react";
import { Clock, Send } from "lucide-react";
import { Badge, Button, Card, CardHeader, Field, StatusBadge, inputClass } from "@/components/ui/primitives";
import { DataTable, Select, Tabs, useToast, type Column } from "@/components/ui/interactive";
import { fmtDate } from "@/lib/utils";
export interface MRow { id: string; date: string; guardian: string; students: string; channel: string; template: string; amount: number; status: string; sender: string; failure?: string }
const VARS = { guardian_name: "Mr. Mensah", student_name: "Ama Mensah", school_name: "Bartlett Montessori School", academic_year: "2026/2027", term: "Term 1", outstanding_balance: "GHS 1,500", due_date: "30 October 2026", payment_instructions: "Pay via MoMo to the school merchant ID shown on your invoice.", verified_payment_link: "[approved payment link]" };
const TEMPLATES = [{ id: "t1", name: "Fee reminder — single child", body: "Dear {{guardian_name}},\n\nThis is a friendly reminder that your ward, {{student_name}}, has an outstanding balance of {{outstanding_balance}} for {{term}} of {{academic_year}}.\n\nKindly pay by {{due_date}}. {{payment_instructions}}\n\nIf you have already paid, please disregard.\n\n{{school_name}} Accounts Department", approved: true }, { id: "t2", name: "Attendance alert", body: "Dear {{guardian_name}}, {{student_name}} was marked absent today. Please contact the school if this is unexpected.\n\n{{school_name}}", approved: true }, { id: "t3", name: "Term reopening", body: "Dear {{guardian_name}}, {{school_name}} reopens for Term 2 on 11 January 2027.", approved: false }];
const render = (b: string) => b.replace(/\{\{(\w+)\}\}/g, (_, k: string) => (VARS as Record<string, string>)[k] ?? `{{${k}}}`);

export function CommsWorkspace({ rows }: { rows: MRow[] }) {
  const toast = useToast(); const [tpl, setTpl] = useState(TEMPLATES[0]); const [st, setSt] = useState("");
  const [sched, setSched] = useState([{ k: "−7 days", on: true }, { k: "−3 days", on: true }, { k: "Due date", on: true }, { k: "+7 days", on: true }, { k: "+14 days", on: false }]);
  const [aud, setAud] = useState("All guardians"); const [subject, setSubject] = useState(""); const [body, setBody] = useState(""); const [ch, setCh] = useState<string[]>(["In-app", "SMS"]);
  const cols: Column<MRow>[] = [
    { key: "d", header: "Date", sort: (x) => x.date, render: (x) => fmtDate(x.date) }, { key: "g", header: "Recipient", render: (x) => <div><div className="font-medium">{x.guardian}</div><div className="text-xs text-muted">{x.students}</div></div> },
    { key: "t", header: "Template", hideOnMobile: true, render: (x) => x.template }, { key: "c", header: "Channel", render: (x) => x.channel },
    { key: "s", header: "Sender", hideOnMobile: true, render: (x) => <span className="text-xs text-muted">{x.sender}</span> }, { key: "st", header: "Status", render: (x) => <div><StatusBadge status={x.status} />{x.failure && <div className="mt-0.5 text-[11px] text-danger">{x.failure}</div>}</div> },
    { key: "r", header: "", render: (x) => x.status === "Failed" ? <Button size="sm" onClick={() => toast("Retry queued with backoff")}>Retry</Button> : x.status === "Awaiting Approval" ? <Button size="sm" variant="success" onClick={() => toast("Approved for sending")}>Approve</Button> : null },
  ];
  return (
    <Tabs tabs={[
      { id: "history", label: "History", content: <Card><DataTable rows={rows.filter((r) => !st || r.status === st)} columns={cols} rowId={(x) => x.id} searchText={(x) => x.guardian + x.students + x.template} pageSize={10} filters={<Select label="Status" value={st} onChange={setSt} options={[{ value: "", label: "Any status" }, ...["Delivered", "Sent", "Queued", "Awaiting Approval", "Failed"].map((v) => ({ value: v, label: v }))]} />} /></Card> },
      { id: "compose", label: "Compose", content: (
        <Card className="max-w-2xl p-5"><div className="space-y-4">
          <Field label="Audience"><select className={inputClass} value={aud} onChange={(e) => setAud(e.target.value)}>{["All guardians", "Primary 4 guardians", "JHS guardians", "Staff"].map((a) => <option key={a}>{a}</option>)}</select></Field>
          <Field label="Subject"><input className={inputClass} value={subject} onChange={(e) => setSubject(e.target.value)} /></Field>
          <Field label="Message"><textarea className={`${inputClass} h-32 py-2`} value={body} onChange={(e) => setBody(e.target.value)} /></Field>
          <div className="flex flex-wrap gap-3 text-sm">{["In-app", "Email", "SMS", "WhatsApp"].map((c) => <label key={c} className="flex items-center gap-1.5"><input type="checkbox" checked={ch.includes(c)} onChange={(e) => setCh(e.target.checked ? [...ch, c] : ch.filter((x) => x !== c))} />{c}</label>)}</div>
          <div className="flex gap-2"><Button onClick={() => toast("Draft saved")}>Save draft</Button><Button onClick={() => toast("Scheduled for 8:00 tomorrow")}><Clock size={14} />Schedule</Button><Button variant="primary" disabled={!subject || body.length < 10 || ch.length === 0} onClick={() => { toast(`Sent to review: ${aud} via ${ch.join(", ")}`); setSubject(""); setBody(""); }}><Send size={14} />Submit for review</Button></div></div></Card>) },
      { id: "templates", label: "Templates", content: (
        <div className="grid gap-4 lg:grid-cols-[260px_1fr]"><Card>{TEMPLATES.map((t) => <button key={t.id} onClick={() => setTpl(t)} className={`flex w-full items-center justify-between border-b border-line px-4 py-3 text-left last:border-0 ${tpl.id === t.id ? "bg-info/8" : ""}`}><span>{t.name}</span>{!t.approved && <Badge tone="warn">Needs approval</Badge>}</button>)}</Card>
          <div className="grid gap-4 md:grid-cols-2"><Card><CardHeader title="Template" /><pre className="whitespace-pre-wrap px-4 pb-4 font-mono text-xs">{tpl.body}</pre><div className="flex flex-wrap gap-1 border-t border-line p-3">{Object.keys(VARS).map((v) => <Badge key={v} tone="info">{`{{${v}}}`}</Badge>)}</div></Card>
            <Card><CardHeader title="Live preview" sub="Sample data" /><pre className="whitespace-pre-wrap px-4 pb-4 font-sans text-sm">{render(tpl.body)}</pre></Card></div></div>) },
      { id: "auto", label: "Automation", content: (
        <Card className="max-w-2xl"><CardHeader title="Automatic fee reminders" sub="Each send re-checks the latest balance; fully paid students are skipped and queued messages cancelled." />
          {sched.map((s, i) => <label key={s.k} className="flex items-center justify-between border-t border-line px-4 py-3"><span>{s.k === "Due date" ? "On due date" : `${s.k.replace("−", "").replace("+", "")} ${s.k.startsWith("−") ? "before" : "after"} due date`}</span><input type="checkbox" role="switch" checked={s.on} onChange={() => setSched(sched.map((x, j) => (j === i ? { ...x, on: !x.on } : x)))} className="size-4" /></label>)}
          <div className="grid gap-3 border-t border-line p-4 sm:grid-cols-3"><Field label="Quiet hours from"><input type="time" className={inputClass} defaultValue="20:00" /></Field><Field label="Quiet hours to"><input type="time" className={inputClass} defaultValue="07:00" /></Field><Field label="Cooldown (days)"><input className={inputClass} defaultValue="3" /></Field></div>
          <div className="border-t border-line p-4"><Button variant="primary" onClick={() => toast("Automation settings saved")}>Save schedule</Button></div></Card>) },
    ]} />
  );
}
