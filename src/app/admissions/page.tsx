import { PageHeader, LinkButton } from "@/components/ui/primitives";
import { AdmissionsBoard } from "@/components/AdmissionsBoard";
import * as Q from "@/lib/data/queries";
export const metadata = { title: "Admissions — EduFlow" };
export default function Admissions() {
  return (<><PageHeader title="Admissions pipeline" sub="Application → documents → assessment → accepted → registered → enrolled" actions={<LinkButton variant="primary" href="/students/new">Register student</LinkButton>} /><AdmissionsBoard initial={Q.applicants} /></>);
}
