import { PageHeader } from "@/components/ui/primitives";
import { AcademicsWorkspace } from "@/components/academics/AcademicsWorkspace";
import * as Q from "@/lib/data/queries";
import { grades } from "@/lib/data/seed";
export const metadata = { title: "Academics — EduFlow" };
export default function Academics() {
  const classes = Q.classes.map((c) => ({ id: c.id, name: c.name, subjects: Q.subjectsByLevel[c.level], students: Q.students.filter((s) => s.classId === c.id && s.status === "Active").map((s) => ({ id: s.id, name: Q.fullName(s), scores: Object.fromEntries(grades.filter((g) => g.studentId === s.id).map((g) => [g.subject, { ca: g.ca, exam: g.exam }])) })) }));
  const intervention = Q.activeStudents().map((s) => { const g = Q.studentGrades(s.id); return { id: s.id, name: Q.fullName(s), cls: Q.getClass(s.classId).name, avg: Math.round(g.reduce((a, b) => a + b.total, 0) / Math.max(1, g.length)) }; }).filter((s) => s.avg < 50).sort((a, b) => a.avg - b.avg);
  return (<><PageHeader title="Academics" sub={`${Q.SCHOOL.term} ${Q.SCHOOL.year} · grades, assessment configuration and performance analytics`} />
    <AcademicsWorkspace classes={classes} scale={Q.gradeScale} subjectAvg={Q.subjectAverages()} classAvg={Q.classAverages()} dist={Q.gradeDistribution()} intervention={intervention} /></>);
}
