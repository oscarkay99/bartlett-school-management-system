import { PageHeader } from "@/components/ui/primitives";
import { ParentsTable } from "@/components/ParentsTable";
import * as Q from "@/lib/data/queries";
export const metadata = { title: "Parents — EduFlow" };
export default function Parents() {
  const rows = Q.guardians.map((g) => { const kids = Q.studentsOfGuardian(g.id); return { id: g.id, name: `${g.title} ${g.name}`, phone: g.phone, email: g.email, kids: kids.map((k) => k.first), owed: kids.reduce((a, k) => a + (k.guardians.find((x) => x.guardianId === g.id)?.financial ? Math.max(0, Q.feeSummary(k.id).balance) : 0), 0), channel: g.preferred, account: g.hasAccount }; });
  return (<><PageHeader title="Parents & Guardians" sub={`${rows.length} unique guardian records · ${rows.filter((r) => r.kids.length > 1).length} linked to multiple children`} /><ParentsTable rows={rows} /></>);
}
