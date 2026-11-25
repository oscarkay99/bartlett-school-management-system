import { PageHeader } from "@/components/ui/primitives";
import { Suspense } from "react";
import { FeesRoute } from "@/components/fees/FeesRoute";
import { billingProps } from "@/lib/data/fees-view";

export const metadata = { title: "Extra Classes — EduFlow" };
export default function ExtraClassesPage() {
  return (<><PageHeader title="Extra Classes" sub="Music (Piano) and Extra Classes, billed per student on their own invoice with their own receipts. Standalone: never added to school fees." />
    <Suspense fallback={null}><FeesRoute {...billingProps("extra")} /></Suspense></>);
}
