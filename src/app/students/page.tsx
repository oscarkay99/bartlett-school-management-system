import { Download, UserPlus } from "lucide-react";
import { Card, LinkButton, PageHeader } from "@/components/ui/primitives";
import { StudentsTable, type StudentRow } from "@/components/students/StudentsTable";
import * as Q from "@/lib/data/queries";

export const metadata = { title: "Students — EduFlow" };
export default function StudentsPage() {
  const rows: StudentRow[] = Q.students.map((s) => {
    const f = Q.feeSummary(s.id);
    return { id: s.id, name: Q.fullName(s), adm: s.admissionNo, cls: Q.getClass(s.classId).name, classId: s.classId, cat: s.category, status: s.status, fee: f.status, balance: f.balance, medical: !!s.medicalAlert,
      guardians: s.guardians.filter((g) => g.verified).map((g) => Q.getGuardian(g.guardianId)!.name).join(", ") };
  });
  return (
    <>
      <PageHeader title="Students" sub="Enrolled learners, lifecycle status and fee standing" actions={<><LinkButton href="/reports"><Download size={15} />Export</LinkButton><LinkButton href="/students/new" variant="primary"><UserPlus size={15} />Register student</LinkButton></>} />
      <Card><StudentsTable rows={rows} classes={Q.classes.map((c) => ({ id: c.id, name: c.name }))} /></Card>
    </>
  );
}
