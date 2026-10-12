import { PageHeader } from "@/components/ui/primitives";
import { SettingsWorkspace } from "@/components/SettingsWorkspace";
import { SCHOOL } from "@/lib/data/queries";
export const metadata = { title: "Settings — EduFlow" };
export default function Settings() {
  return (<><PageHeader title="Settings" sub="School profile, numbering, approvals and access control" /><SettingsWorkspace school={{ name: SCHOOL.name, phone: SCHOOL.phone, email: SCHOOL.email, city: SCHOOL.city, currency: "GHS — Ghana Cedi", timezone: SCHOOL.timezone }} /></>);
}
