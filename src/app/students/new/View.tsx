"use client";
import { PageHeader } from "@/components/ui/primitives";
import { RegistrationWizard, type RegistrationPayload } from "@/components/students/RegistrationWizard";
import * as Q from "@/lib/data/queries";
import { LIVE } from "@/lib/live/config";
import { useLiveData } from "@/lib/live/data";
import { registerStudent } from "@/lib/live/actions";
import { useRole } from "@/components/shell/AppShell";

export function View() {
  const { reload } = useLiveData(); const { allow, ready } = useRole();
  if (ready && !allow("students", "create")) return <><PageHeader title="Register student" /><p className="text-sm text-muted">Only the Owner or an Administrator can register students.</p></>;
  const gs = Q.guardians.map((g) => ({ id: g.id, name: g.name, phone: g.phone, email: g.email, children: Q.studentsOfGuardian(g.id).length }));
  // Live: saved to the database in one transaction (student, new guardians, links, medical); the number is assigned there.
  const save = async (p: RegistrationPayload) => { const r = await registerStudent(p); if (!r.error) await reload(); return r; };
  return (<><PageHeader title="Register student" sub="Guided admission: personal details, class, guardians, welfare and documents" />
    <RegistrationWizard guardians={gs} classes={Q.classes.map((c) => ({ id: c.id, name: c.name }))} nextAdm={LIVE ? "assigned when saved" : `BMS/26/${String(Q.students.length + 1).padStart(4, "0")}`} onRegister={LIVE ? save : undefined} /></>);
}
