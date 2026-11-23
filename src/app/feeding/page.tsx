import { PageHeader } from "@/components/ui/primitives";
import { Suspense } from "react";
import { FeesRoute } from "@/components/fees/FeesRoute";
import { billingProps } from "@/lib/data/fees-view";

export const metadata = { title: "Feeding — EduFlow" };
export default function FeedingPage() {
  return (<><PageHeader title="Feeding" sub="Feeding bills, payments and receipts — kept separate from school fees" />
    <Suspense fallback={null}><FeesRoute {...billingProps("feeding")} /></Suspense></>);
}
