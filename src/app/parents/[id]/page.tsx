import { notFound } from "next/navigation";
import Link from "next/link";
import { Mail, MapPin, Phone } from "lucide-react";
import { Avatar, Badge, Card, CardHeader, PageHeader, StatusBadge } from "@/components/ui/primitives";
import { ParentRecordActions } from "@/components/RecordActions";
import { LinkChildButton } from "@/components/ParentActions";
import { ReminderButtons } from "@/components/fees/ReminderDialog";
import * as Q from "@/lib/data/queries";
import { money } from "@/lib/money";

export function generateStaticParams() { return Q.guardians.map((g) => ({ id: g.id })); }
export const dynamicParams = false;

export default async function ParentPage({ params }: PageProps<"/parents/[id]">) {
  const { id } = await params; const g = Q.getGuardian(id); if (!g) notFound();
  const kids = Q.studentsOfGuardian(id);
  const row = Q.reminderRows().find((r) => r.guardian.id === id);
  return (
    <>
      <PageHeader crumbs={<Link href="/parents" className="text-xs text-muted hover:text-fg">← Parents</Link>} title={`${g.title} ${g.name}`} sub={`Guardian record · ${kids.length} linked child${kids.length === 1 ? "" : "ren"}`} actions={<><ParentRecordActions soleFor={kids.filter((k) => k.guardians.length === 1).map((k) => Q.shortName(k))} initial={{ title: g.title, name: g.name, phone: g.phone, whatsapp: g.whatsapp ?? "", email: g.email ?? "", occupation: g.occupation ?? "", address: g.address, preferred: g.preferred, language: g.language, cSMS: g.consent.SMS ? "1" : "", cWhatsApp: g.consent.WhatsApp ? "1" : "", cEmail: g.consent.Email ? "1" : "" }} /><LinkChildButton parentName={g.name} students={Q.students.filter((x) => !x.guardians.some((y) => y.guardianId === id)).map((x) => ({ id: x.id, name: Q.fullName(x), cls: Q.getClass(x.classId).name, adm: x.admissionNo }))} /></>} />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-4"><div className="mb-4 flex items-center gap-3"><Avatar name={g.name} size={52} /><div><div className="font-semibold">{g.name}</div></div></div>
          <div className="space-y-2 text-sm"><div className="flex gap-2"><Phone size={15} className="text-muted" />{g.phone}</div>{g.whatsapp && <div className="flex gap-2 text-muted"><Phone size={15} />WhatsApp: {g.whatsapp}</div>}{g.email && <div className="flex gap-2"><Mail size={15} className="text-muted" />{g.email}</div>}<div className="flex gap-2"><MapPin size={15} className="text-muted" />{g.address}</div></div>
          <div className="mt-4 border-t border-line pt-3 text-sm"><div className="mb-1.5 font-medium">Communication consent</div><div className="flex flex-wrap gap-1.5">{(["SMS", "WhatsApp", "Email"] as const).map((c) => <Badge key={c} tone={g.consent[c] ? "ok" : "danger"}>{c}: {g.consent[c] ? "yes" : "no"}</Badge>)}</div><p className="mt-2 text-xs text-muted">Preferred: {g.preferred} · Language: {g.language}</p></div></Card>
        <div className="space-y-4 lg:col-span-2">
          <Card><CardHeader title="Linked children" sub="One parent record, shared across all children" />
            {kids.map((k) => { const sg = k.guardians.find((x) => x.guardianId === id)!; const f = Q.feeSummary(k.id); return (
              <div key={k.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3"><div className="flex items-center gap-3"><Avatar name={Q.shortName(k)} size={36} /><div><Link href={`/students/${k.id}`} className="font-medium hover:text-info">{Q.fullName(k)}</Link><div className="text-xs text-muted">{Q.getClass(k.classId).name} · {sg.relationship}{sg.primary ? " · Primary" : ""}{!sg.verified ? " · UNVERIFIED" : ""}</div></div></div>
                <div className="flex items-center gap-3">{sg.financial ? <><span className="num font-medium">{money(Math.max(0, f.balance))}</span><StatusBadge status={f.status} /></> : <Badge>No financial access</Badge>}</div></div>); })}</Card>
          {row && <Card><CardHeader title="Consolidated fee reminder" sub="One message covering all authorised children" /><div className="space-y-3 px-4 pb-4"><pre className="whitespace-pre-wrap rounded-lg border border-line bg-surface-2 p-4 font-sans text-sm">{Q.buildReminder(row)}</pre><ReminderButtons message={Q.buildReminder(row)} guardianName={g.name} consent={g.consent} studentName={row.lines.map((l) => l.student.first).join(", ")} /></div></Card>}
        </div>
      </div>
    </>
  );
}
