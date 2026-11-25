"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, ChevronLeft, HeartPulse, Phone } from "lucide-react";
import { Badge, Card, CardHeader, PageHeader } from "@/components/ui/primitives";
import { db, friendlyError } from "@/lib/live/client";
import { useRole } from "@/components/shell/AppShell";
import { money } from "@/lib/money";
import { fmtDate } from "@/lib/utils";
import { ACCOUNTS, type FeeAccount } from "@/lib/accounts";
import { fullName, useLoad } from "./LiveStudents";

interface Detail {
  id: string; admission_no: string; first_name: string; middle_name: string | null; last_name: string; date_of_birth: string | null; gender: string | null;
  status: string; admitted_on: string | null; nationality: string | null; address: string | null; previous_school: string | null; place_of_birth: string | null;
  emergency_contact_name: string | null; emergency_contact_phone: string | null; student_code: string | null; entry_assessment: string | null;
  classes: { name: string } | null;
  student_guardians: { relationship: string; is_primary: boolean; is_financial: boolean; is_emergency: boolean; can_pickup: boolean; guardians: { name: string; phone: string; email: string | null } | null }[];
  student_medical: { alert: string | null; allergies: string | null; emergency_instructions: string | null } | null;
}

/** A student's record from the school database (/students/view?id=…). What shows depends on the role's rules. */
export function LiveStudentView() {
  const id = useSearchParams().get("id") ?? ""; const { money: access } = useRole();
  const r = useLoad<{ s: Detail; bal: { account: FeeAccount; billed: number; paid: number; balance: number }[] }>(async () => {
    if (!/^[0-9a-f-]{36}$/.test(id)) return { data: null, error: "This link has no valid student." };
    const [s, b] = await Promise.all([
      db().from("students").select("*, classes(name), student_guardians(relationship, is_primary, is_financial, is_emergency, can_pickup, guardians(name, phone, email)), student_medical(alert, allergies, emergency_instructions)").eq("id", id).maybeSingle(),
      access === "none" ? Promise.resolve({ data: [], error: null }) : db().from("student_balances").select("account, billed, paid, balance").eq("student_id", id),
    ]);
    if (s.error || b.error) return { data: null, error: friendlyError(s.error ?? b.error) };
    if (!s.data) return { data: null, error: "Student not found, or your role cannot see this student." };
    return { data: { s: s.data as unknown as Detail, bal: (b.data ?? []) as { account: FeeAccount; billed: number; paid: number; balance: number }[] }, error: "" };
  }, [id, access]);
  const back = <Link href="/students" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-fg"><ChevronLeft size={15} />Students</Link>;
  if (r.loading) return <>{back}<Card className="p-8 text-center text-sm text-muted">Loading…</Card></>;
  if (r.error) return <>{back}<Card className="p-6 text-sm text-danger">{r.error}</Card></>;
  const { s, bal } = r.data!; const med = s.student_medical;
  const dl = (rows: [string, string | null | undefined][], cols = 2) => <dl className={`grid gap-x-6 gap-y-2 text-sm ${cols === 2 ? "sm:grid-cols-2" : ""}`}>{rows.map(([k, v]) => <div key={k} className="flex justify-between gap-3 border-b border-line py-1.5"><dt className="text-muted">{k}</dt><dd className="text-right font-medium">{v || "—"}</dd></div>)}</dl>;
  return (
    <>
      {back}
      <PageHeader title={fullName(s)} sub={`${s.admission_no} · ${s.classes?.name ?? "—"}`} actions={<Badge tone={s.status === "Active" ? "ok" : "neutral"}>{s.status}</Badge>} />
      {med?.alert && <div role="alert" className="mb-4 flex items-center gap-2 rounded-xl border border-danger/30 bg-danger/8 px-4 py-3 text-sm"><AlertTriangle className="text-danger" size={18} /><b>Medical alert:</b> {med.alert}</div>}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2"><CardHeader title="Personal & enrolment" /><div className="px-4 pb-4">{dl([
          ["Admission no.", s.admission_no], ["Class", s.classes?.name], ["Date of birth", s.date_of_birth ? fmtDate(s.date_of_birth) : null], ["Gender", s.gender],
          ["Nationality", s.nationality], ["Place of birth", s.place_of_birth], ["Admitted", s.admitted_on ? fmtDate(s.admitted_on) : null], ["Previous school", s.previous_school],
          ["Address", s.address], ["Student ID code", s.student_code], ["Entry assessment", s.entry_assessment],
          ["Emergency contact", [s.emergency_contact_name, s.emergency_contact_phone].filter(Boolean).join(" · ")]])}</div></Card>
        <Card><CardHeader title="Guardians" />
          <ul className="divide-y divide-line px-4 pb-3">{s.student_guardians.length === 0 ? <li className="py-3 text-sm text-muted">No guardians your role can see.</li> : s.student_guardians.map((g, i) => (
            <li key={i} className="py-2.5 text-sm"><div className="font-medium">{g.guardians?.name ?? "—"} <span className="text-xs font-normal text-muted">{g.relationship}</span></div>
              {g.guardians?.phone && <div className="flex items-center gap-1 text-muted"><Phone size={12} />{g.guardians.phone}</div>}
              <div className="mt-1 flex flex-wrap gap-1">{g.is_primary && <Badge tone="info">Primary</Badge>}{g.is_financial && <Badge>Pays fees</Badge>}{g.is_emergency && <Badge>Emergency</Badge>}{g.can_pickup && <Badge>Pick-up</Badge>}</div></li>))}</ul></Card>
        {med && <Card><CardHeader title="Medical & welfare" /><div className="px-4 pb-4"><div className="mb-2 flex items-center gap-2 text-sm text-muted"><HeartPulse size={15} />Visible to the Owner, Administrators and this student&apos;s teachers.</div>{dl([["Alert", med.alert], ["Allergies", med.allergies], ["Emergency instructions", med.emergency_instructions]], 1)}</div></Card>}
        {access !== "none" && <Card className={med ? "lg:col-span-2" : "lg:col-span-3"}><CardHeader title="Balances" sub="School fees, Extracurricular and Extra Classes are separate accounts." />
          <div className="grid gap-2 px-4 pb-4 sm:grid-cols-3">{(["fees", "extra", "classes"] as FeeAccount[]).map((a) => { const x = bal.find((y) => y.account === a);
            return <div key={a} className="rounded-xl border border-line p-3"><div className="text-xs text-muted">{ACCOUNTS[a].label}</div><div className={`num text-lg font-semibold ${x && x.balance > 0 ? "text-danger" : ""}`}>{x ? money(Math.max(0, x.balance)) : "Not billed"}</div>{x && <div className="text-xs text-muted">billed {money(x.billed)} · paid {money(x.paid)}</div>}</div>; })}</div></Card>}
      </div>
    </>
  );
}
