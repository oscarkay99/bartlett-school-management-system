import { Suspense } from "react";
import { LiveStudentView } from "@/components/students/LiveStudentView";

export const metadata = { title: "Student — EduFlow" };
// A student's record from the school database (live site). Reads ?id= from the URL, so it needs Suspense for the static export.
export default function StudentView() { return <Suspense fallback={null}><LiveStudentView /></Suspense>; }
