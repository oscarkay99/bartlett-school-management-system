import { PageHeader } from "@/components/ui/primitives";
import { ParentsTable } from "@/components/ParentsTable";
import * as Q from "@/lib/data/queries";
export const metadata = { title: "Parents — EduFlow" };
export default function Parents() {
  const rows = Q.guardians.map((g) => { const kids = Q.studentsOfGuardian(g.id); return { id: g.id, title: g.title, name: g.name, phone: g.phone, whatsapp: g.whatsapp, email: g.email, address: g.address, occupation: g.occupation, preferred: g.preferred, language: g.language, consent: g.consent, kids: kids.map((k) => k.first), soleFor: kids.filter((k) => k.guardians.length === 1).map((k) => Q.shortName(k)), owed: kids.reduce((a, k) => a + (k.guardians.find((x) => x.guardianId === g.id)?.financial ? Math.max(0, Q.feeSummary(k.id).balance) : 0), 0) }; });
  return (<><PageHeader title="Parents & Guardians" sub={`${rows.length} unique guardian records · ${rows.filter((r) => r.kids.length > 1).length} linked to multiple children`} /><ParentsTable rows={rows} /></>);
}
