import { LiveGate } from "@/lib/live/data";
import * as Q from "@/lib/data/queries";
import { ReceiptPrint } from "./ReceiptPrint";

// Demo site: one pre-built page per demo record. Live records open /print/receipt/view?id=… instead.
export function generateStaticParams() { return Q.payments.map((p) => ({ id: p.id })); }
export const dynamicParams = false;

export default async function Page({ params }: PageProps<"/print/receipt/[id]">) {
  const { id } = await params;
  return <LiveGate><ReceiptPrint id={id} /></LiveGate>;
}
