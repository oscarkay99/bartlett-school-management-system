import { PageHeader } from "@/components/ui/primitives";
import { FeedingWorkspace } from "@/components/feeding/FeedingWorkspace";
import * as Q from "@/lib/data/queries";

export const metadata = { title: "Feeding — EduFlow" };
export default function FeedingPage() {
  const students = Q.activeStudents().map((s) => ({ id: s.id, name: Q.fullName(s), adm: s.admissionNo, classId: s.classId, cls: Q.getClass(s.classId).name, category: s.category }));
  const onHand = (id: string) => Q.inventory.find((i) => i.id === id)!.onHand;
  const kitchen = Q.inventory.filter((i) => i.category === "Kitchen & Feeding").map((i) => ({ id: i.id, name: i.name, unit: i.unit, onHand: onHand(i.id), reorder: i.reorder, expiry: i.expiry }));
  return (<>
    <PageHeader title="Feeding" sub="Who is on feeding, the daily meal register and kitchen stock. Feeding is billed on the school fees invoice." />
    <FeedingWorkspace students={students} kitchen={kitchen} today={Q.TODAY} />
  </>);
}
