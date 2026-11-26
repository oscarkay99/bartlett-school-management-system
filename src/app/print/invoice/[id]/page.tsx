import { LiveGate } from "@/lib/live/data";
import * as Q from "@/lib/data/queries";
import { InvoicePrint } from "./InvoicePrint";

// Demo site: one pre-built page per demo record. Live records open /print/invoice/view?id=… instead.
export function generateStaticParams() { return Q.invoices.flatMap((i) => [{ id: i.id }, { id: i.no }]); }
export const dynamicParams = false;

export default async function Page({ params }: PageProps<"/print/invoice/[id]">) {
  const { id } = await params;
  return <LiveGate><InvoicePrint id={id} /></LiveGate>;
}
