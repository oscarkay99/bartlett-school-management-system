import { LiveGate } from "@/lib/live/data";
import * as Q from "@/lib/data/queries";
import { StudentProfile } from "./StudentProfile";

// Demo site: one pre-built page per demo record. Live records open /students/view?id=… instead.
export function generateStaticParams() { return Q.students.map((s) => ({ id: s.id })); }
export const dynamicParams = false;

export default async function Page({ params }: PageProps<"/students/[id]">) {
  const { id } = await params;
  return <LiveGate><StudentProfile id={id} /></LiveGate>;
}
