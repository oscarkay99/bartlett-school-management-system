import { LiveGate } from "@/lib/live/data";
import * as Q from "@/lib/data/queries";
import { ReportCard } from "./ReportCard";

// Demo site: one pre-built page per demo record. Live records open /print/report-card/view?id=… instead.
export function generateStaticParams() { return Q.students.map((s) => ({ id: s.id })); }
export const dynamicParams = false;

export default async function Page({ params }: PageProps<"/print/report-card/[id]">) {
  const { id } = await params;
  return <LiveGate><ReportCard id={id} /></LiveGate>;
}
