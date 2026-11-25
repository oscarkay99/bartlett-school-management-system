import { PageHeader } from "@/components/ui/primitives";
import { RegistrationWizard } from "@/components/students/RegistrationWizard";
import * as Q from "@/lib/data/queries";
import { LIVE } from "@/lib/live/config";
import { LiveRegister } from "@/components/students/LiveStudents";

export const metadata = { title: "Register student — EduFlow" };
export default function NewStudent() {
  const gs = Q.guardians.map((g) => ({ id: g.id, name: g.name, phone: g.phone, email: g.email, children: Q.studentsOfGuardian(g.id).length }));
  if (LIVE) return (<><PageHeader title="Register student" sub="Guided admission: saved to the school database in one step" /><LiveRegister /></>);
  return (<><PageHeader title="Register student" sub="Guided admission: personal details, class, guardians, welfare and documents" />
    <RegistrationWizard guardians={gs} classes={Q.classes.map((c) => ({ id: c.id, name: c.name }))} nextAdm={`BMS/26/${String(Q.students.length + 1).padStart(4, "0")}`} /></>);
}
