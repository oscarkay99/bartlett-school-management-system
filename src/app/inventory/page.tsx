import { PageHeader } from "@/components/ui/primitives";
import { InventoryWorkspace } from "@/components/inventory/InventoryWorkspace";
import * as Q from "@/lib/data/queries";
export const metadata = { title: "Inventory — EduFlow" };
export default async function Inventory({ searchParams }: PageProps<"/inventory">) {
  const sp = await searchParams;
  return (<><PageHeader title="Inventory & Assets" sub="Stock ledger, issuance, procurement and asset custody" />
    <InventoryWorkspace items={Q.inventory.map(({ onHand, ...i }) => { void onHand; return i; })} movements={Q.movements.map((m) => ({ ...m }))} students={Q.activeStudents().map((s) => ({ id: s.id, name: Q.fullName(s), cls: Q.getClass(s.classId).name }))} openIssue={sp.issue === "1"} /></>);
}
