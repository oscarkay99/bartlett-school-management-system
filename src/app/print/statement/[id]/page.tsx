import { LiveGate } from "@/lib/live/data";
import * as Q from "@/lib/data/queries";
import { StatementPrint } from "./StatementPrint";

// Demo site: one pre-built page per demo record. Live records open /print/statement/view?id=… instead.
export function generateStaticParams() { return Q.students.map((s) => ({ id: s.id })); }
export const dynamicParams = false;

export default async function Page({ params }: PageProps<"/print/statement/[id]">) {
  const { id } = await params;
  return <LiveGate><StatementPrint id={id} /></LiveGate>;
}
