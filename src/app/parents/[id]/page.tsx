import { LiveGate } from "@/lib/live/data";
import * as Q from "@/lib/data/queries";
import { ParentPage } from "./ParentPage";

// Demo site: one pre-built page per demo record. Live records open /parents/view?id=… instead.
export function generateStaticParams() { return Q.guardians.map((g) => ({ id: g.id })); }
export const dynamicParams = false;

export default async function Page({ params }: PageProps<"/parents/[id]">) {
  const { id } = await params;
  return <LiveGate><ParentPage id={id} /></LiveGate>;
}
