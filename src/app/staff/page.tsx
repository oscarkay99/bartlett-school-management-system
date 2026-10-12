import { PageHeader } from "@/components/ui/primitives";
import { StaffWorkspace } from "@/components/StaffWorkspace";
import * as Q from "@/lib/data/queries";
export const metadata = { title: "Teachers & Staff — EduFlow" };
export default function Staff() {
  const rows = Q.staff.map((t) => ({ id: t.id, empNo: t.empNo, name: t.name, position: t.position, department: t.department, type: t.type, phone: t.phone, qualification: t.qualification, status: t.status, classes: t.classIds.map((c) => Q.getClass(c).name).join(", "), subjects: t.subjects.join(", "), students: t.classIds.reduce((a, c) => a + Q.students.filter((s) => s.classId === c).length, 0), periods: t.classIds.length ? 22 + (Number(t.id.slice(1)) * 3) % 12 : 0 }));
  return (<><PageHeader title="Teachers & Staff" sub={`${rows.length} staff members`} /><StaffWorkspace rows={rows} /></>);
}
